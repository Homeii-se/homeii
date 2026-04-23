/**
 * Annual-level calculations — price per kWh, yearly estimates,
 * zero-equipment reversal, and annual summary.
 */

import type {
  BillData,
  RefinementAnswers,
  YearlyDataPoint,
  AnnualSummary,
  ActiveUpgrades,
  Assumptions,
  SEZone,
} from "../types";
import { UPGRADE_DEFINITIONS } from "../data/upgrade-catalog";
import { getZoneClimate } from "../climate";
import { getBlendedHeatingShare, getHeatPumpCOP, getAdjustedSeasonFactors } from "./upgrades";
import { simulateMonthsWithUpgrades } from "./monthly";
import type { AnnualCostBreakdown } from "./cost-model";

export function calculatePricePerKwh(bill: BillData): number {
  if (bill.kwhPerMonth <= 0) return 0;
  return bill.costPerMonth / bill.kwhPerMonth;
}

export function calculateDailyKwh(bill: BillData): number {
  return bill.kwhPerMonth / 30;
}

export function calculateYearlyKwh(bill: BillData): number {
  return bill.kwhPerMonth * 12;
}

/**
 * Estimate what the user's consumption would be WITHOUT their existing equipment.
 *
 * The bill kwhPerMonth represents the user's ACTUAL consumption (with existing
 * heat pumps, solar, etc already active). To correctly model "without investments"
 * we need to reverse-engineer the zero-equipment baseline.
 *
 * Returns a synthetic BillData with inflated kwhPerMonth and costPerMonth.
 */
export function estimateZeroEquipmentBill(
  bill: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone
): BillData {
  let inflationFactor = 1.0;

  // 1. Reverse heat pump COP effect on the heating portion
  const heatingTypes = refinement.heatingTypes ?? (refinement.heatingType ? [refinement.heatingType] : []);
  const heatPumpTypes = heatingTypes.filter(
    (ht): ht is "luftluft" | "luftvatten" | "bergvarme" =>
      ht === "luftluft" || ht === "luftvatten" || ht === "bergvarme"
  );

  if (heatPumpTypes.length > 0) {
    const totalHeatingShare = getBlendedHeatingShare(heatingTypes) ?? 0.5;
    const nonPumpTypes = heatingTypes.filter(ht => ht !== "luftluft" && ht !== "luftvatten" && ht !== "bergvarme");
    let pumpFractionOfHeating = 1.0;
    if (nonPumpTypes.length > 0 && heatPumpTypes.length > 0) {
      pumpFractionOfHeating = heatPumpTypes.length === 1 && nonPumpTypes.length === 1 ? 0.65 : 0.5;
    }

    const zoneClimate = getZoneClimate(seZone);
    let totalCOP = 0;
    let heatingMonths = 0;
    for (let m = 0; m < 12; m++) {
      const temp = zoneClimate.monthlyTemp[m];
      if (temp < 17) {
        const primaryPump = heatPumpTypes[0];
        totalCOP += getHeatPumpCOP(primaryPump, temp);
        heatingMonths++;
      }
    }
    const avgCOP = heatingMonths > 0 ? totalCOP / heatingMonths : 2.5;

    const heatingByPumpShare = totalHeatingShare * pumpFractionOfHeating;
    inflationFactor = heatingByPumpShare * (avgCOP - 1) + 1;
  }

  // 2. Reverse solar self-consumption effect
  if (refinement.hasSolar) {
    const solarSizeKw = refinement.solarSizeKw ?? 10;
    const zoneClimate = getZoneClimate(seZone);
    const yearlyProduction = zoneClimate.solarMonthly10kw.reduce((s, v) => s + v, 0) * (solarSizeKw / 10);
    const selfConsumptionRate = refinement.hasBattery ? 0.60 : 0.30;
    const monthlySelfConsumed = (yearlyProduction * selfConsumptionRate) / 12;
    const inflatedKwh = bill.kwhPerMonth * inflationFactor;
    inflationFactor = (inflatedKwh + monthlySelfConsumed) / bill.kwhPerMonth;
  }

  return {
    ...bill,
    kwhPerMonth: Math.round(bill.kwhPerMonth * inflationFactor),
    costPerMonth: Math.round(bill.costPerMonth * inflationFactor),
    annualKwh: bill.annualKwh
      ? Math.round(bill.annualKwh * inflationFactor)
      : undefined,
  };
}

export function getYearlyData(
  bill: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone = "SE3"
): YearlyDataPoint[] {
  const currentYear = new Date().getFullYear();
  const pricePerKwh = calculatePricePerKwh(bill);

  const seasonFactors = getAdjustedSeasonFactors(refinement, seZone);
  const adjustedYearly = seasonFactors.reduce(
    (sum, f) => sum + bill.kwhPerMonth * f,
    0
  );

  const prevYear = Math.round(adjustedYearly * 0.97);
  const nextYear = Math.round(adjustedYearly * 1.03);

  return [
    {
      year: currentYear - 1,
      label: `${currentYear - 1}`,
      kwh: prevYear,
      cost: Math.round(prevYear * pricePerKwh * 0.95),
      isEstimate: true,
    },
    {
      year: currentYear,
      label: `${currentYear}`,
      kwh: Math.round(adjustedYearly),
      cost: Math.round(adjustedYearly * pricePerKwh),
      isEstimate: false,
    },
    {
      year: currentYear + 1,
      label: `${currentYear + 1}`,
      kwh: nextYear,
      cost: Math.round(nextYear * pricePerKwh * 1.05),
      isEstimate: true,
    },
  ];
}

export function getPrecision(answeredQuestions: number): number {
  return Math.min(100, 40 + answeredQuestions * 12);
}

/** Calculate annual summary with investment costs and payback.
 *  @param skipInflation — if true, use the bill as-is (for nuläge scenario
 *  where the invoice kWh already reflects actual grid consumption). */
export function calculateAnnualSummary(
  bill: BillData,
  refinement: RefinementAnswers,
  activeUpgrades: ActiveUpgrades,
  seZone: SEZone,
  assumptions?: Assumptions,
  skipInflation?: boolean
): AnnualSummary {
  // When skipInflation is false (default), inflate the bill to a zero-equipment
  // baseline so the simulation can model "without investments" and "with upgrades".
  // When true (nuläge), use the actual invoice kWh directly.
  const effectiveBill = skipInflation
    ? bill
    : estimateZeroEquipmentBill(bill, refinement, seZone);
  const monthlyData = simulateMonthsWithUpgrades(effectiveBill, refinement, activeUpgrades, seZone, assumptions);

  // Aggregate from monthly cost breakdowns (new cost model)
  const yearlyKwhBase = monthlyData.reduce((s, m) => s + m.kwhBase, 0);
  const yearlyKwhAfter = monthlyData.reduce((s, m) => s + m.kwhAfterUpgrades, 0);
  const yearlyEnergyCostBase = monthlyData.reduce((s, m) => s + m.costBase, 0);
  const yearlyEnergyCostAfter = monthlyData.reduce((s, m) => s + m.costAfterUpgrades, 0);
  const yearlyGridFeeCost = monthlyData.reduce((s, m) => s + m.gridFeeCostKr, 0);
  const yearlyPowerFeeCostBase = monthlyData.reduce((s, m) => s + m.costBreakdownBase.gridPowerChargeKr, 0);
  const yearlyPowerFeeCostAfter = monthlyData.reduce((s, m) => s + m.powerFeeCostKr, 0);
  const yearlyTotalCostBase = monthlyData.reduce((s, m) => s + m.totalCostBaseKr, 0);
  const yearlyTotalCostAfter = monthlyData.reduce((s, m) => s + m.totalCostKr, 0);

  // Total investment
  const totalInvestmentCost = UPGRADE_DEFINITIONS.filter(
    (u) => activeUpgrades[u.id]
  ).reduce((s, u) => s + u.investmentCostSEK, 0);

  // Payback based on total savings (incl. grid + power fee)
  const yearlySavings = yearlyTotalCostBase - yearlyTotalCostAfter;
  const paybackYears =
    yearlySavings > 0 ? totalInvestmentCost / yearlySavings : 0;

  // Solar production (scaled by system size and zone)
  const solarScale = (assumptions?.solarSizeKw ?? 10) / 10;
  const zoneClimate = getZoneClimate(seZone);
  const solarProductionYearlyKwh = activeUpgrades.solceller
    ? Math.round(zoneClimate.solarMonthly10kw.reduce((s, v) => s + v, 0) * solarScale)
    : 0;

  // Build annual cost breakdown from monthly breakdowns
  const monthlyBreakdowns = monthlyData.map((m) => m.costBreakdown);

  const annualCostBreakdown: AnnualCostBreakdown = {
          months: monthlyBreakdowns,
          totalElhandelKr: monthlyBreakdowns.reduce((s, m) => s + m.totalElhandelKr, 0),
          totalElnatKr: monthlyBreakdowns.reduce((s, m) => s + m.totalElnatKr, 0),
          totalExportRevenueKr: monthlyBreakdowns.reduce((s, m) => s + m.exportRevenueKr, 0),
          totalKr: monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0),
          avgMonthlyKr: Math.round(monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0) / 12),
          effectiveOrePerKwh: yearlyKwhAfter > 0
            ? Math.round((monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0) / yearlyKwhAfter) * 100 * 10) / 10
            : 0,
  };

  return {
    yearlyKwhBase,
    yearlyKwhAfter,
    yearlyEnergyCostBase,
    yearlyEnergyCostAfter,
    yearlyGridFeeCost,
    yearlyPowerFeeCostBase,
    yearlyPowerFeeCostAfter,
    yearlyTotalCostBase,
    yearlyTotalCostAfter,
    totalInvestmentCost,
    paybackYears: Math.round(paybackYears * 10) / 10,
    solarProductionYearlyKwh,
    annualCostBreakdown,
  };
}