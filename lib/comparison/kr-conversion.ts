/**
 * kWh → kr conversion for the comparison module.
 *
 * Wraps app/simulator/simulation/cost-model.ts so that "median villa kWh"
 * is converted to kr through the same engine as the user's own bill.
 *
 * The engine is monthly-granular (peak kW, season-varying spot, energy tax),
 * so we synthesise 12 monthly inputs from a single annual kWh:
 *   1. spread annual kWh across months using a canonical Swedish villa load
 *      profile (Energimyndigheten season factors, normalised).
 *   2. estimate peak kW from annual kWh with the formula
 *      `peak = max(3.5, kwh / 2200)` (validated against typical villa data
 *      across heating types — see scb-2024.md). Same peak each month — a
 *      conservative simplification; users with their own bill will pass
 *      `invoicePeakKw` instead.
 *   3. forward all optional billData overrides to cost-model so that
 *      operator-specific tariffs (Ellevio effekttariff, Vattenfall etc.) and
 *      contract-type pricing flow through.
 *
 * If billData is missing, cost-model.ts falls back to DEFAULT_GRID_PRICING +
 * ELHANDEL_DEFAULTS — same defaults the simulator uses elsewhere. By design,
 * a default-tariff conversion of the kWh values currently in
 * LAN_KWH_DISTRIBUTIONS reproduces the original LAN_DISTRIBUTIONS kr values
 * (within rounding) — that is the Phase 3 validation point.
 */

import {
  calculateAnnualCost,
  type MonthlyCostInput,
} from "../../app/simulator/simulation/cost-model";
import type { SEZone } from "../../app/simulator/types";

/**
 * Per-month share of annual kWh for a typical permanent Swedish villa.
 * Indices 0-11 = Jan-Dec. Sums to 1.0.
 *
 * Source: Energimyndigheten typical monthly distribution for småhus,
 * blended across heating types (eluppvärmd, värmepump, fjärrvärme) — gives
 * a moderate winter peak suitable for a median-villa baseline.
 */
const VILLA_MONTHLY_PROFILE: number[] = [
  0.140, // Jan  — coldest, darkest, post-holiday
  0.125, // Feb
  0.110, // Mar
  0.080, // Apr
  0.055, // May
  0.040, // Jun
  0.035, // Jul
  0.040, // Aug
  0.055, // Sep
  0.080, // Oct
  0.110, // Nov
  0.130, // Dec  — sum = 1.000
];

/**
 * Estimate peak kW from annual kWh for a "normal" villa (no smart-load
 * optimisation, no scheduled EV charging). Floor at 3.5 kW so very low-
 * consumption villas (district heating only) still get a non-trivial peak
 * for effekttariff calculation.
 *
 * Validated band 5 000–30 000 kWh against typical heating-type peaks
 * (see scb-2024.md / failure-analys discussion).
 */
export function estimatePeakKw(annualKwh: number): number {
  return Math.max(3.5, annualKwh / 2200);
}

/**
 * Bill context — everything the comparison module needs from the user's
 * uploaded invoice (or simulator assumptions) to convert kWh to kr.
 *
 * Mirrors the optional override fields on MonthlyCostInput. All fields are
 * optional; cost-model.ts fills in defaults for anything missing.
 */
export interface BillContext {
  /** Required: SE zone — drives spot price + energy tax. */
  seZone: SEZone;

  // --- Grid operator ---
  /** Operator name — looked up against grid-operators.ts. */
  gridOperator?: string;
  /** Override: fixed grid fee (kr/mån exkl moms). */
  gridFixedFeeKr?: number;
  /** Override: transfer fee (öre/kWh exkl moms). */
  gridTransferFeeOre?: number;
  /** Override: power charge (kr/kW exkl moms). */
  gridPowerChargeKrPerKw?: number;
  /** Override: does the operator have power charges? */
  gridHasPowerCharge?: boolean;
  /** Override: actual peak kW from invoice (Ellevio "snitt effekttoppar" etc). */
  invoicePeakKw?: number;

  // --- Elhandel ---
  /** Override: elhandel markup (öre/kWh exkl moms). */
  elhandelMarkupOre?: number;
  /** Override: elhandel monthly fee (kr/mån exkl moms). */
  elhandelMonthlyFeeKr?: number;
  /** Override: energy tax (öre/kWh exkl moms). */
  energyTaxOre?: number;

  // --- Contract ---
  /** Contract type — defaults to "monthly" (rörligt). */
  elContractType?: "dynamic" | "monthly" | "fixed";
  /** For fixed contracts: locked price (öre/kWh exkl moms). */
  fixedPriceOre?: number;
}

/**
 * Convert annual kWh to annual kr using the cost-model engine.
 *
 * Spreads kWh across 12 months via the canonical villa profile, estimates
 * peak kW, and forwards any billData overrides to cost-model. Pass an
 * `invoicePeakKw` override on the BillContext to skip the peak estimate
 * (useful for users whose bills include actual peak data).
 */
export function kwhToAnnualKr(annualKwh: number, ctx: BillContext): number {
  const peakKw = ctx.invoicePeakKw ?? estimatePeakKw(annualKwh);

  const monthlyInputs: MonthlyCostInput[] = VILLA_MONTHLY_PROFILE.map(
    (share, monthIdx) => ({
      gridImportKwh: annualKwh * share,
      gridExportKwh: 0,
      peakGridKw: peakKw,
      month: monthIdx,
      seZone: ctx.seZone,
      gridOperator: ctx.gridOperator,
      gridFixedFeeKr: ctx.gridFixedFeeKr,
      gridTransferFeeOre: ctx.gridTransferFeeOre,
      gridPowerChargeKrPerKw: ctx.gridPowerChargeKrPerKw,
      gridHasPowerCharge: ctx.gridHasPowerCharge,
      energyTaxOre: ctx.energyTaxOre,
      elhandelMarkupOre: ctx.elhandelMarkupOre,
      elhandelMonthlyFeeKr: ctx.elhandelMonthlyFeeKr,
      elContractType: ctx.elContractType,
      fixedPriceOre: ctx.fixedPriceOre,
    })
  );

  const annual = calculateAnnualCost(monthlyInputs);
  return annual.totalKr;
}

/**
 * Convert a P10/P50/P90 kWh distribution to a kr distribution using a
 * single shared BillContext. Used by computeComparison() in Phase 3.
 */
export function kwhDistributionToKr(
  dist: { p10: number; p50: number; p90: number },
  ctx: BillContext
): { p10: number; p50: number; p90: number } {
  return {
    p10: Math.round(kwhToAnnualKr(dist.p10, ctx) / 100) * 100,
    p50: Math.round(kwhToAnnualKr(dist.p50, ctx) / 100) * 100,
    p90: Math.round(kwhToAnnualKr(dist.p90, ctx) / 100) * 100,
  };
}
