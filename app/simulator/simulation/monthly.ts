/**
 * Monthly simulation — aggregate daily simulations into monthly data.
 */

import type {
  BillData,
  RefinementAnswers,
  MonthlyDataPoint,
  MonthlyDataPointExtended,
  ActiveUpgrades,
  Assumptions,
  SEZone,
} from "../types";
import { MONTH_LABELS } from "../data/energy-profiles";
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { getAdjustedSeasonFactors, NO_UPGRADES } from "./upgrades";
import { simulateDay } from "./hourly";
import { calculateMonthlyCost } from "./cost-model";
import { getGridPricing, DEFAULT_GRID_PRICING } from "../data/grid-operators";
import { getEnergyTaxRate } from "../data/energy-tax";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";

export function getMonthlyData(
  bill: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone = "SE3"
): MonthlyDataPoint[] {
  const pricePerKwh = bill.kwhPerMonth > 0 ? bill.costPerMonth / bill.kwhPerMonth : 0;
  const seasonFactors = getAdjustedSeasonFactors(refinement, seZone);

  return seasonFactors.map((factor, i) => {
    const kwh = Math.round(bill.kwhPerMonth * factor);
    return {
      month: i,
      label: MONTH_LABELS[i],
      kwh,
      cost: Math.round(kwh * pricePerKwh),
    };
  });
}

/** Simulate all 12 months with upgrades, using a representative day per month */
export function simulateMonthsWithUpgrades(
  bill: BillData,
  refinement: RefinementAnswers,
  activeUpgrades: ActiveUpgrades,
  seZone: SEZone,
  assumptions?: Assumptions
): MonthlyDataPointExtended[] {
  const year = new Date().getFullYear();
  let seasonFactors = getAdjustedSeasonFactors(refinement, seZone);

  // --- Seasonal consumption calibration (pin-and-redistribute) ---
  // If we have actual kWh for a specific month from the invoice, use it to
  // calibrate the seasonal curve. This corrects for houses with steeper
  // winter/summer ratios than the generic model assumes (e.g. solar houses
  // with very high winter / very low summer grid consumption).
  //
  // Method: "pin" the invoice month's factor to the actual value, then
  // redistribute the remaining annual kWh proportionally across the other
  // 11 months. This preserves the annual total exactly AND matches the
  // known data point perfectly.
  const referenceAnnualKwh = bill.kwhPerMonth * 12;

  console.log('[CALIBRATION] inputs:', {
    invoicePeriodKwh: bill.invoicePeriodKwh,
    invoiceMonth: bill.invoiceMonth,
    annualKwh: bill.annualKwh,
    referenceAnnualKwh,
    kwhPerMonth: bill.kwhPerMonth,
    factorsBefore: [...seasonFactors],
  });
  if (
    bill.invoicePeriodKwh &&
    bill.invoiceMonth !== undefined &&
    referenceAnnualKwh > 0
  ) {
    const avgMonthly = referenceAnnualKwh / 12;
    const actualFactor = bill.invoicePeriodKwh / avgMonthly;
    const modelFactor = seasonFactors[bill.invoiceMonth];

    if (modelFactor > 0 && Math.abs(actualFactor - modelFactor) > 0.1) {
      // Pin the invoice month to its actual factor
      const pinnedFactor = actualFactor;

      // Sum of model factors for the OTHER 11 months
      const sumOtherModelFactors = seasonFactors.reduce((s, v, i) =>
        i === bill.invoiceMonth ? s : s + v, 0);

      // Remaining "factor budget" for the other 11 months
      const remainingBudget = 12 - pinnedFactor;

      // Scale factor for the other months (redistribute proportionally)
      const otherScale = sumOtherModelFactors > 0
        ? remainingBudget / sumOtherModelFactors
        : 1;

      for (let i = 0; i < 12; i++) {
        if (i === bill.invoiceMonth) {
          seasonFactors[i] = pinnedFactor;
        } else {
          seasonFactors[i] = Math.max(0.15, seasonFactors[i] * otherScale);
        }
      }

      // Re-check sum after floor clipping — if floors stole budget,
      // adjust the pinned month slightly to keep annual total correct
      const sumAfter = seasonFactors.reduce((s, v) => s + v, 0);
      if (Math.abs(sumAfter - 12) > 0.01) {
        const excess = sumAfter - 12;
        seasonFactors[bill.invoiceMonth!] = Math.max(0.5, pinnedFactor - excess);
      }

      console.log('[CALIBRATION] pin-and-redistribute applied!', {
        invoiceMonth: bill.invoiceMonth,
        actualFactor: actualFactor.toFixed(3),
        modelFactor: modelFactor.toFixed(3),
        otherScale: otherScale.toFixed(3),
        factorsAfter: seasonFactors.map(f => f.toFixed(3)),
        sum: seasonFactors.reduce((s, v) => s + v, 0).toFixed(3),
      });
    }
  }

  // Determine contract types
  const baseContract = (refinement.elContractType ?? "monthly") as "dynamic" | "monthly" | "fixed";
  const effectiveContract = activeUpgrades.dynamiskt_elpris
    ? "dynamic" as const
    : baseContract;

  // Resolve grid pricing (needed for fixed-price derivation and power charge check)
  const gridPricing = assumptions?.gridOperator
    ? getGridPricing(assumptions.gridOperator)
    : (bill.natAgare ? getGridPricing(bill.natAgare) : DEFAULT_GRID_PRICING);
  const hasPowerCharge = assumptions?.gridHasPowerCharge ?? gridPricing.hasPowerCharge;

  // ========== PASS 1: Compute raw monthly data (peaks, kWh, costs excl effektavgift) ==========
  const rawMonths = seasonFactors.map((factor, monthIdx) => {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const repDate = new Date(year, monthIdx, 15);
    const dayData = simulateDay(bill, refinement, repDate, activeUpgrades, seZone, assumptions);
    const dayDataBase = simulateDay(bill, refinement, repDate, NO_UPGRADES, seZone);

    const dailyBase = dayData.reduce((s, d) => s + d.kwhBase, 0);
    const monthlyBase = Math.round(bill.kwhPerMonth * factor);

    // After-upgrades daily totals
    const dailyGridImport = dayData.reduce((s, d) => s + d.gridImportKwh, 0);
    const dailyGridExport = dayData.reduce((s, d) => s + d.gridExportKwh, 0);
    const dailySolar = dayData.reduce((s, d) => s + d.solarProductionKwh, 0);

    // Scale daily values to full month
    const scaleRatio = dailyBase > 0 ? (monthlyBase / (dailyBase * daysInMonth)) * daysInMonth : daysInMonth;
    const monthlyGridImport = Math.round(dailyGridImport * scaleRatio);
    const monthlyGridExport = Math.round(dailyGridExport * scaleRatio);
    const monthlySolar = Math.round(dailySolar * scaleRatio / daysInMonth);
    const monthlyAfter = Math.max(0, Math.round((dailyGridImport - dailyGridExport) * scaleRatio));

    // Peak kW from representative day, scaled to match calibrated monthly level.
    // simulateDay() uses the generic (uncalibrated) season factor, so the hourly
    // values may be too low/high vs the calibrated monthly target. We scale the
    // peak by the ratio of calibrated daily average to the simulated daily total.
    const peakScaleFactor = dailyBase > 0 ? (monthlyBase / daysInMonth) / dailyBase : 1;
    const peakKw = Math.max(...dayData.map((d) => d.gridImportKwh)) * peakScaleFactor;

    // Base scenario scaling
    const dailyBaseKwh = dayDataBase.reduce((s, d) => s + d.kwhBase, 0);
    const dailyBaseGridImport = dayDataBase.reduce((s, d) => s + d.gridImportKwh, 0);
    const dailyBaseGridExport = dayDataBase.reduce((s, d) => s + d.gridExportKwh, 0);
    const baseScaleRatio = dailyBaseKwh > 0
      ? (monthlyBase / (dailyBaseKwh * daysInMonth)) * daysInMonth
      : daysInMonth;
    const monthlyBaseGridImport = Math.round(dailyBaseGridImport * baseScaleRatio);
    const monthlyBaseGridExport = Math.round(dailyBaseGridExport * baseScaleRatio);

    // Peak kW for base scenario (same calibration logic)
    const peakScaleFactorBase = dailyBaseKwh > 0 ? (monthlyBase / daysInMonth) / dailyBaseKwh : 1;
    const peakKwBase = Math.max(...dayDataBase.map((d) => d.gridImportKwh)) * peakScaleFactorBase;

    // Hourly spot cost for dynamic contracts
    let hourlySpotCostKrExMoms: number | undefined;
    if (effectiveContract === "dynamic") {
      const dailySpotCostKrExMoms = dayData.reduce(
        (sum, d) => sum + (d.gridImportKwh * d.spotPriceOre / 100), 0
      );
      hourlySpotCostKrExMoms = dailySpotCostKrExMoms * scaleRatio;
    }

    let hourlySpotCostBaseKrExMoms: number | undefined;
    if (baseContract === "dynamic") {
      const dailySpotCostBaseKrExMoms = dayDataBase.reduce(
        (sum, d) => sum + (d.gridImportKwh * d.spotPriceOre / 100), 0
      );
      hourlySpotCostBaseKrExMoms = dailySpotCostBaseKrExMoms * baseScaleRatio;
    }

    // Fixed price derivation
    let fixedPriceOre: number | undefined;
    if (effectiveContract === "fixed" || baseContract === "fixed") {
      const estGridFixed = assumptions?.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth;
      const estTransfer = assumptions?.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh;
      const estTax = getEnergyTaxRate(seZone, false);
      const estMarkup = assumptions?.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh;
      const kwhMonth = bill.kwhPerMonth;

      if (kwhMonth > 0) {
        const costExMoms = bill.costPerMonth / 1.25;
        const gridCostsExMoms = estGridFixed + (kwhMonth * (estTransfer + estTax + estMarkup) / 100);
        const impliedSpotCostExMoms = costExMoms - gridCostsExMoms;
        fixedPriceOre = Math.max(0, (impliedSpotCostExMoms / kwhMonth) * 100);
      }
    }

    return {
      monthIdx,
      factor,
      daysInMonth,
      monthlyBase,
      monthlyAfter,
      monthlySolar,
      monthlyGridImport,
      monthlyGridExport,
      monthlyBaseGridImport,
      monthlyBaseGridExport,
      peakKw,
      peakKwBase,
      hourlySpotCostKrExMoms,
      hourlySpotCostBaseKrExMoms,
      fixedPriceOre,
    };
  });

  // ========== Compute effective peak for effektavgift ==========
  // Swedish grid operators (Ellevio, Vattenfall Eldistribution, E.ON) typically
  // charge effektavgift based on the average of the 3 highest monthly peaks,
  // applied uniformly to every month.
  let effectivePeakKw: number;
  let effectivePeakKwBase: number;

  if (hasPowerCharge) {
    // If the invoice has actual peak kW data (e.g. Ellevio "Snitt effekttoppar"),
    // use it directly for the base scenario — it's far more accurate than our
    // simulated peaks which only have one month of real data to calibrate from.
    if (bill.invoicePeakKw !== undefined && bill.invoicePeakKw > 0) {
      effectivePeakKwBase = bill.invoicePeakKw;
      console.log(`[EFFEKTAVGIFT] Using INVOICE peak for base: ${effectivePeakKwBase.toFixed(1)} kW (from elnät invoice)`);
      if (bill.invoiceTop3PeakKw && bill.invoiceTop3PeakKw.length > 0) {
        console.log(`[EFFEKTAVGIFT] Invoice top-3 peaks: ${bill.invoiceTop3PeakKw.map(v => v.toFixed(1)).join(', ')} kW`);
      }

      // For the after-upgrades scenario, scale the invoice peak by the ratio
      // of simulated after-peaks to simulated base-peaks.
      // This preserves the real peak level while reflecting upgrade effects.
      const sortedPeaks = rawMonths.map(m => m.peakKw).sort((a, b) => b - a);
      const sortedPeaksBase = rawMonths.map(m => m.peakKwBase).sort((a, b) => b - a);
      const top3Simulated = sortedPeaks.slice(0, 3);
      const top3SimulatedBase = sortedPeaksBase.slice(0, 3);
      const simAfterAvg = top3Simulated.reduce((s, v) => s + v, 0) / 3;
      const simBaseAvg = top3SimulatedBase.reduce((s, v) => s + v, 0) / 3;
      const peakReductionRatio = simBaseAvg > 0 ? simAfterAvg / simBaseAvg : 1;
      effectivePeakKw = effectivePeakKwBase * peakReductionRatio;

      console.log(`[EFFEKTAVGIFT] After-upgrades peak: ${effectivePeakKwBase.toFixed(1)} × ${peakReductionRatio.toFixed(3)} = ${effectivePeakKw.toFixed(1)} kW`);
    } else {
      // No invoice peak data — fall back to simulated top-3 average
      const sortedPeaks = rawMonths.map(m => m.peakKw).sort((a, b) => b - a);
      const sortedPeaksBase = rawMonths.map(m => m.peakKwBase).sort((a, b) => b - a);
      const top3 = sortedPeaks.slice(0, 3);
      const top3Base = sortedPeaksBase.slice(0, 3);
      effectivePeakKw = top3.reduce((s, v) => s + v, 0) / 3;
      effectivePeakKwBase = top3Base.reduce((s, v) => s + v, 0) / 3;

      console.log('[EFFEKTAVGIFT] top-3 peaks (after):', top3.map(v => v.toFixed(1)), '→ effective:', effectivePeakKw.toFixed(1), 'kW');
      console.log('[EFFEKTAVGIFT] top-3 peaks (base):', top3Base.map(v => v.toFixed(1)), '→ effective:', effectivePeakKwBase.toFixed(1), 'kW');
    }
  } else {
    effectivePeakKw = 0;
    effectivePeakKwBase = 0;
  }

  // ========== PASS 2: Calculate costs using effective peak ==========
  // If we have a spotPriceRatio (smartness factor), use it to adjust the
  // spot price for all months. This makes the nuläge cost match the user's
  // actual invoice by accounting for their consumption pattern (e.g. EV
  // charging at night = lower effective spot price).
  const spotRatio = bill.spotPriceRatio;

  return rawMonths.map((raw) => {
    // Apply spot price ratio if available — adjusts each month's spot price
    // to reflect the user's actual consumption pattern
    let spotPriceOverride: number | undefined;
    if (spotRatio !== undefined) {
      const baseSpot = SE_ZONE_SPOT_PRICE[seZone]?.[raw.monthIdx];
      if (baseSpot) {
        spotPriceOverride = baseSpot * spotRatio;
      }
    }

    const sharedCostInputs = {
      month: raw.monthIdx,
      seZone: seZone as SEZone,
      gridOperator: assumptions?.gridOperator ?? bill.natAgare,
      gridFixedFeeKr: assumptions?.gridFixedFeeKr,
      gridTransferFeeOre: assumptions?.gridTransferFeeOre,
      gridPowerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw,
      gridHasPowerCharge: assumptions?.gridHasPowerCharge,
      elhandelMarkupOre: assumptions?.elhandelMarkupOre,
      elhandelMonthlyFeeKr: assumptions?.elhandelMonthlyFeeKr,
      fixedPriceOre: raw.fixedPriceOre,
      spotPriceOre: spotPriceOverride,
    };

    // After-upgrades cost — use effective (top-3 average) peak
    // When spotPriceRatio is set, don't use hourly weighted costs (they were
    // calculated with a neutral profile). Instead let the cost model use the
    // ratio-adjusted spotPriceOre — this better reflects the user's actual
    // consumption pattern.
    const costBreakdown = calculateMonthlyCost({
      gridImportKwh: raw.monthlyGridImport,
      gridExportKwh: raw.monthlyGridExport,
      peakGridKw: effectivePeakKw,
      elContractType: effectiveContract,
      hourlySpotCostKrExMoms: spotRatio !== undefined ? undefined : raw.hourlySpotCostKrExMoms,
      ...sharedCostInputs,
    });

    // Base cost — same effective peak approach
    const costBreakdownBase = calculateMonthlyCost({
      gridImportKwh: raw.monthlyBaseGridImport,
      gridExportKwh: raw.monthlyBaseGridExport,
      peakGridKw: effectivePeakKwBase,
      elContractType: baseContract,
      hourlySpotCostKrExMoms: spotRatio !== undefined ? undefined : raw.hourlySpotCostBaseKrExMoms,
      ...sharedCostInputs,
    });

    const costAfter = costBreakdown.totalKr;
    const costBase = costBreakdownBase.totalKr;

    return {
      month: raw.monthIdx,
      label: MONTH_LABELS[raw.monthIdx],
      kwhBase: raw.monthlyBase,
      kwhAfterUpgrades: raw.monthlyAfter,
      solarProductionKwh: raw.monthlySolar,
      gridImportKwh: raw.monthlyGridImport,
      gridExportKwh: raw.monthlyGridExport,
      peakKw: raw.peakKw,
      peakKwBase: raw.peakKwBase,
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
