/**
 * Aggregate monthly results from 8760-hour simulation.
 *
 * Companion to `simulate8760WithUpgrades` (PR C1). Takes two full-year
 * simulation results — one for the baseline (no upgrades) and one for the
 * scenario with upgrades applied — and produces the same
 * `MonthlyDataPointExtended[]` shape that `simulateMonthsWithUpgrades`
 * (legacy 12-day pipeline) returns. This lets PR C3 swap the legacy
 * pipeline for the 8760 pipeline without touching any caller.
 *
 * Why a separate file: the legacy aggregation in `monthly.ts` is tightly
 * coupled to `simulateDay` and contains pin-and-redistribute calibration
 * that is already done inside `simulate8760Consumption`. Mixing the two
 * approaches in one file would obscure the structural difference.
 */

import type {
  ActiveUpgrades,
  Assumptions,
  BillData,
  MonthlyDataPointExtended,
  RefinementAnswers,
  SEZone,
} from "../types";
import type { Simulate8760ResultWithUpgrades } from "./simulate8760";
import { MONTH_LABELS } from "../data/energy-profiles";
import {
  SE_ZONE_SPOT_PRICE,
  getHourlyPriceProfile,
} from "../data/energy-prices";
import { calculateMonthlyCost } from "./cost-model";
import {
  DEFAULT_GRID_PRICING,
  getGridPricing,
} from "../data/grid-operators";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";
import { getEnergyTaxRate } from "../data/energy-tax";

const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const HOURS_PER_MONTH = DAYS_PER_MONTH.map((d) => d * 24);

/** Start hour-of-year (inclusive) for each month, 0-indexed. */
const MONTH_START_HOUR = (() => {
  const starts = new Array(12).fill(0);
  let acc = 0;
  for (let m = 0; m < 12; m++) {
    starts[m] = acc;
    acc += HOURS_PER_MONTH[m];
  }
  return starts;
})();

/**
 * Inputs needed to aggregate a pair of 8760 simulations into monthly cost.
 *
 * `baseSim` and `afterSim` should both be produced by
 * `simulate8760WithUpgrades`, called with the same bill/refinement/zone but
 * different `activeUpgrades` — typically `NO_UPGRADES` for `baseSim` and
 * the scenario being evaluated for `afterSim`.
 */
export interface AggregateMonthsFrom8760Inputs {
  baseSim: Simulate8760ResultWithUpgrades;
  afterSim: Simulate8760ResultWithUpgrades;
  bill: BillData;
  refinement: RefinementAnswers;
  activeUpgrades: ActiveUpgrades;
  seZone: SEZone;
  assumptions?: Assumptions;
  /**
   * Optional: per-hour historical spot prices in öre/kWh excl. moms (8760
   * values). When absent, hourly prices are derived from
   * `SE_ZONE_SPOT_PRICE[zone][month]` × `getHourlyPriceProfile(month)` —
   * the same fallback the legacy 24h pipeline uses, but applied at hourly
   * resolution over the full year.
   */
  hourlySpotPricesOre?: number[];
}

/** Convert per-hour 8760 array to per-month sum (12 values). */
function sumPerMonth(values: readonly number[]): number[] {
  const totals = new Array<number>(12).fill(0);
  for (let m = 0; m < 12; m++) {
    const start = MONTH_START_HOUR[m];
    const end = start + HOURS_PER_MONTH[m];
    let s = 0;
    for (let i = start; i < end; i++) s += values[i];
    totals[m] = s;
  }
  return totals;
}

/** Per-month max — used for peak kW detection. */
function maxPerMonth(values: readonly number[]): number[] {
  const peaks = new Array<number>(12).fill(0);
  for (let m = 0; m < 12; m++) {
    const start = MONTH_START_HOUR[m];
    const end = start + HOURS_PER_MONTH[m];
    let p = 0;
    for (let i = start; i < end; i++) {
      if (values[i] > p) p = values[i];
    }
    peaks[m] = p;
  }
  return peaks;
}

/**
 * Build a synthetic 8760 hourly price array from monthly averages and the
 * intra-month hourly profile. Used as the fallback when historical hourly
 * spot prices are not available.
 *
 * Each hour gets `monthlyAvg[m] × hourlyProfile[m][hod]`. The hourly profile
 * is normalised so its mean is 1.0, so the monthly average is preserved.
 */
function buildFallbackHourlySpotPrices(seZone: SEZone): number[] {
  const monthly =
    SE_ZONE_SPOT_PRICE[seZone] ?? SE_ZONE_SPOT_PRICE.SE3 ?? new Array(12).fill(80);
  const result = new Array<number>(8760);
  let idx = 0;
  for (let m = 0; m < 12; m++) {
    const profile = getHourlyPriceProfile(m);
    const monthlyAvg = monthly[m] ?? 80;
    const days = DAYS_PER_MONTH[m];
    for (let d = 0; d < days; d++) {
      for (let h = 0; h < 24; h++) {
        result[idx++] = monthlyAvg * profile[h];
      }
    }
  }
  return result;
}

/**
 * Sum hourly spot cost over a month's worth of hours.
 *
 * For dynamic (timpris) contracts: cost = Σ(gridImport[h] × hourlySpot[h] / 100).
 * The 8760 pipeline gives us *real* hourly grid import (not a 24h profile
 * scaled to monthly), so this sum is properly granular for the first time.
 */
function sumHourlySpotCostKrExMoms(
  gridImport: readonly number[],
  hourlySpotOre: readonly number[],
  monthIdx: number,
): number {
  const start = MONTH_START_HOUR[monthIdx];
  const end = start + HOURS_PER_MONTH[monthIdx];
  let cost = 0;
  for (let i = start; i < end; i++) {
    cost += (gridImport[i] * hourlySpotOre[i]) / 100;
  }
  return cost;
}

/**
 * Derive a fixed-contract energy price (öre/kWh excl moms) from the bill
 * total when no explicit override is provided. Mirrors the logic in
 * `monthly.ts` so cost output stays comparable between pipelines.
 */
function deriveFixedPriceOre(
  bill: BillData,
  seZone: SEZone,
  assumptions: Assumptions | undefined,
  gridPricing: ReturnType<typeof getGridPricing>,
): number | undefined {
  if (bill.kwhPerMonth <= 0 || bill.costPerMonth <= 0) return undefined;
  const estGridFixed =
    assumptions?.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth;
  const estTransfer =
    assumptions?.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh;
  const estTax = getEnergyTaxRate(seZone, false);
  const estMarkup =
    assumptions?.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh;
  const kwhMonth = bill.kwhPerMonth;
  const costExMoms = bill.costPerMonth / 1.25;
  const gridCostsExMoms =
    estGridFixed + (kwhMonth * (estTransfer + estTax + estMarkup)) / 100;
  const impliedSpotCostExMoms = costExMoms - gridCostsExMoms;
  return Math.max(0, (impliedSpotCostExMoms / kwhMonth) * 100);
}

/**
 * Aggregate a base + after-upgrades pair of 8760 simulations into a 12-month
 * `MonthlyDataPointExtended[]`. Output shape matches what
 * `simulateMonthsWithUpgrades` returns today, so callers (engine v2,
 * scenarios, annual summary) can swap pipelines without changing.
 *
 * Key precision improvements over the legacy 12-day pipeline:
 * - Peak detection uses the actual maximum across each month's 720 hours,
 *   not a representative day scaled by `peakScaleFactor`.
 * - Dynamic-pricing energy cost is summed over real hourly grid import, not
 *   approximated from a single day's profile scaled to monthly.
 * - No drift between dashboard 8760 view and recommendations cost — both
 *   speak the same hourly series.
 */
export function aggregateMonthsFrom8760(
  inputs: AggregateMonthsFrom8760Inputs,
): MonthlyDataPointExtended[] {
  const {
    baseSim,
    afterSim,
    bill,
    refinement,
    activeUpgrades,
    seZone,
    assumptions,
    hourlySpotPricesOre,
  } = inputs;

  // Resolve grid pricing once — needed for fixed-price derivation and
  // the effective power-charge configuration.
  const gridOperatorName = assumptions?.gridOperator ?? bill.natAgare;
  const gridPricing = gridOperatorName
    ? getGridPricing(gridOperatorName)
    : DEFAULT_GRID_PRICING;
  const hasPowerCharge =
    assumptions?.gridHasPowerCharge ?? gridPricing.hasPowerCharge;

  // Determine effective contract types. If the user already has a dynamic
  // contract OR the upgrade activates one, after-upgrade pricing is dynamic.
  const baseContract = (refinement.elContractType ?? "monthly") as
    | "dynamic"
    | "monthly"
    | "fixed";
  const effectiveContract = activeUpgrades.dynamiskt_elpris
    ? ("dynamic" as const)
    : baseContract;

  // Hourly spot prices — historical override or synthetic fallback.
  const hourlySpotOre =
    hourlySpotPricesOre && hourlySpotPricesOre.length === 8760
      ? hourlySpotPricesOre
      : buildFallbackHourlySpotPrices(seZone);

  // Fixed-price derivation (only used if either contract leg is fixed).
  const derivedFixedPriceOre =
    baseContract === "fixed" || effectiveContract === "fixed"
      ? deriveFixedPriceOre(bill, seZone, assumptions, gridPricing)
      : undefined;

  // Per-month aggregates from raw hourly arrays.
  const monthlyKwhBase = sumPerMonth(baseSim.consumptionAfter);
  const monthlyKwhAfter = sumPerMonth(afterSim.consumptionAfter);
  const monthlyGridImportBase = sumPerMonth(baseSim.gridImport);
  const monthlyGridImportAfter = sumPerMonth(afterSim.gridImport);
  const monthlyGridExportBase = sumPerMonth(baseSim.gridExport);
  const monthlyGridExportAfter = sumPerMonth(afterSim.gridExport);
  const monthlySolarAfter = sumPerMonth(afterSim.solarProduction);
  const monthlyPeakBase = maxPerMonth(baseSim.gridImport);
  const monthlyPeakAfter = maxPerMonth(afterSim.gridImport);

  // Effective peak kW for power-charge calculation.
  // Swedish grid operators that charge effektavgift typically apply the
  // average of the 3 highest monthly peaks uniformly to every month — so
  // we compute that here and use the same value for every month's cost.
  // When the invoice has actual peak data (e.g. Ellevio "Snitt effekttoppar"),
  // we trust the invoice for the base scenario and scale the after scenario
  // by the relative reduction observed in our simulation.
  let effectivePeakKwBase: number;
  let effectivePeakKwAfter: number;

  if (!hasPowerCharge) {
    effectivePeakKwBase = 0;
    effectivePeakKwAfter = 0;
  } else if (bill.invoicePeakKw !== undefined && bill.invoicePeakKw > 0) {
    effectivePeakKwBase = bill.invoicePeakKw;
    const sortedAfter = [...monthlyPeakAfter].sort((a, b) => b - a);
    const sortedBase = [...monthlyPeakBase].sort((a, b) => b - a);
    const top3After = sortedAfter.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
    const top3Base = sortedBase.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
    const reductionRatio = top3Base > 0 ? top3After / top3Base : 1;
    effectivePeakKwAfter = effectivePeakKwBase * reductionRatio;
  } else {
    const sortedAfter = [...monthlyPeakAfter].sort((a, b) => b - a);
    const sortedBase = [...monthlyPeakBase].sort((a, b) => b - a);
    effectivePeakKwAfter = sortedAfter.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
    effectivePeakKwBase = sortedBase.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  }

  const spotRatio = bill.spotPriceRatio;

  // Per-month cost calculation.
  return Array.from({ length: 12 }, (_, m) => {
    // Spot price override: when spotPriceRatio is set, scale the zone
    // monthly average. For dynamic contracts we don't pass an
    // hourlySpotCost (since the ratio captures the "smartness" effect at
    // the price level, not the hourly distribution).
    const baseMonthlySpot = SE_ZONE_SPOT_PRICE[seZone]?.[m];
    const spotPriceOverride =
      spotRatio !== undefined && baseMonthlySpot
        ? baseMonthlySpot * spotRatio
        : undefined;

    const sharedCostInputs = {
      month: m,
      seZone,
      gridOperator: gridOperatorName,
      gridFixedFeeKr: assumptions?.gridFixedFeeKr,
      gridTransferFeeOre: assumptions?.gridTransferFeeOre,
      gridPowerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw,
      gridHasPowerCharge: assumptions?.gridHasPowerCharge,
      elhandelMarkupOre: assumptions?.elhandelMarkupOre,
      elhandelMonthlyFeeKr: assumptions?.elhandelMonthlyFeeKr,
      fixedPriceOre: derivedFixedPriceOre,
      spotPriceOre: spotPriceOverride,
    };

    // Hourly spot cost — only used when contract is dynamic AND we don't
    // have a spotPriceRatio override (which captures price level via the
    // ratio-adjusted monthly spot).
    const hourlySpotAfter =
      effectiveContract === "dynamic" && spotRatio === undefined
        ? sumHourlySpotCostKrExMoms(afterSim.gridImport, hourlySpotOre, m)
        : undefined;

    const hourlySpotBase =
      baseContract === "dynamic" && spotRatio === undefined
        ? sumHourlySpotCostKrExMoms(baseSim.gridImport, hourlySpotOre, m)
        : undefined;

    const costBreakdown = calculateMonthlyCost({
      gridImportKwh: monthlyGridImportAfter[m],
      gridExportKwh: monthlyGridExportAfter[m],
      peakGridKw: effectivePeakKwAfter,
      elContractType: effectiveContract,
      hourlySpotCostKrExMoms: hourlySpotAfter,
      ...sharedCostInputs,
    });

    const costBreakdownBase = calculateMonthlyCost({
      gridImportKwh: monthlyGridImportBase[m],
      gridExportKwh: monthlyGridExportBase[m],
      peakGridKw: effectivePeakKwBase,
      elContractType: baseContract,
      hourlySpotCostKrExMoms: hourlySpotBase,
      ...sharedCostInputs,
    });

    const costAfter = costBreakdown.totalKr;
    const costBase = costBreakdownBase.totalKr;

    return {
      month: m,
      label: MONTH_LABELS[m],
      kwhBase: Math.round(monthlyKwhBase[m]),
      kwhAfterUpgrades: Math.round(monthlyKwhAfter[m]),
      solarProductionKwh: Math.round(monthlySolarAfter[m]),
      gridImportKwh: Math.round(monthlyGridImportAfter[m]),
      gridExportKwh: Math.round(monthlyGridExportAfter[m]),
      peakKw: monthlyPeakAfter[m],
      peakKwBase: monthlyPeakBase[m],
      costBase,
      costAfterUpgrades: costAfter,
      savingsKr: costBase - costAfter,
      gridFeeCostKr: costBreakdown.gridFixedFeeKr,
      powerFeeCostKr: costBreakdown.gridPowerChargeKr,
      totalCostKr: costAfter,
      totalCostBaseKr: costBase,
      costBreakdown,
      costBreakdownBase,
    };
  });
}
