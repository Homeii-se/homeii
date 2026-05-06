/**
 * Three-scenario comparison (without investments / current / after recommendations).
 * Also re-exports climate-related scenario functions.
 */

import type {
  BillData,
  RefinementAnswers,
  ThreeScenarioSummary,
  ScenarioDetail,
  AnnualCostComponents,
  ActiveUpgrades,
  AnnualSummary,
  Assumptions,
  SEZone,
  UpgradeId,
} from "../types";
import { buildExistingEquipmentUpgrades, NO_UPGRADES } from "./upgrades";
import { calculateAnnualSummary } from "./annual";
import { SOLAR_MONTHLY_PRODUCTION_10KW } from "../data/solar-profiles";
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { simulate8760WithSolar } from "./simulate8760";
import { dlog } from "../../../lib/log";

// Re-export climate scenario utilities
export { PRICE_SCENARIOS, projectCostsOverTime, calculateNPV } from "../climate";
export type { PriceScenario } from "../climate";

/** Extract annual cost components from AnnualSummary */
function extractCostComponents(summary: AnnualSummary): AnnualCostComponents {
  if (summary.annualCostBreakdown) {
    const months = summary.annualCostBreakdown.months;
    return {
      spotCostKr: months.reduce((s, m) => s + m.spotCostKr, 0),
      markupCostKr: months.reduce((s, m) => s + m.markupCostKr, 0),
      elhandelMonthlyFeeKr: months.reduce((s, m) => s + m.elhandelMonthlyFeeKr, 0),
      gridFixedFeeKr: months.reduce((s, m) => s + m.gridFixedFeeKr, 0),
      gridTransferFeeKr: months.reduce((s, m) => s + m.gridTransferFeeKr, 0),
      gridPowerChargeKr: months.reduce((s, m) => s + m.gridPowerChargeKr, 0),
      energyTaxKr: months.reduce((s, m) => s + m.energyTaxKr, 0),
      exportRevenueKr: months.reduce((s, m) => s + m.exportRevenueKr, 0),
      exportKwh: summary.annualCostBreakdown.totalExportKwh,
      totalKr: summary.annualCostBreakdown.totalKr,
    };
  }

  // Fallback: estimate from legacy fields
  return {
    spotCostKr: summary.yearlyEnergyCostAfter ?? summary.yearlyEnergyCostBase,
    markupCostKr: 0,
    elhandelMonthlyFeeKr: 0,
    gridFixedFeeKr: summary.yearlyGridFeeCost ?? 0,
    gridTransferFeeKr: 0,
    gridPowerChargeKr: summary.yearlyPowerFeeCostAfter ?? summary.yearlyPowerFeeCostBase ?? 0,
    energyTaxKr: 0,
    exportRevenueKr: 0,
    totalKr: summary.yearlyTotalCostAfter ?? summary.yearlyTotalCostBase,
  };
}

function buildScenarioDetail(summary: AnnualSummary, useAfter: boolean): ScenarioDetail {
  const breakdown = summary.annualCostBreakdown;
  return {
    yearlyKwh: useAfter ? summary.yearlyKwhAfter : summary.yearlyKwhBase,
    yearlyCostKr: useAfter ? summary.yearlyEnergyCostAfter : summary.yearlyEnergyCostBase,
    yearlyTotalCostKr: useAfter ? summary.yearlyTotalCostAfter : summary.yearlyTotalCostBase,
    costComponents: extractCostComponents(summary),
    monthlyKwh: breakdown?.months.map((m) => m.gridImportKwh),
    monthlyPeakKw: breakdown?.months.map((m) => m.peakGridKw),
  };
}

/**
 * When only one invoice type is uploaded, anchor that known component to the
 * invoice month so the model does not drift too high/low on partial data.
 */
function applyPartialInvoiceAnchor(summary: AnnualSummary, billData: BillData): void {
  const breakdown = summary.annualCostBreakdown;
  const month = billData.invoiceMonth;
  const types = billData.uploadedInvoiceTypes ?? [];
  if (!breakdown || month === undefined || month < 0 || month > 11) return;

  const hasElhandel = types.includes("elhandel");
  const hasElnat = types.includes("elnat");
  if (hasElhandel && hasElnat) return; // full data, no anchoring needed

  const onlyElnat = hasElnat && !hasElhandel && !!billData.invoiceElnatTotalKr;
  const onlyElhandel = hasElhandel && !hasElnat && !!billData.invoiceElhandelTotalKr;
  if (!onlyElnat && !onlyElhandel) return;

  const monthData = breakdown.months[month];
  if (!monthData) return;

  const target = onlyElnat ? billData.invoiceElnatTotalKr! : billData.invoiceElhandelTotalKr!;
  const modeled = onlyElnat ? monthData.totalElnatKr : monthData.totalElhandelKr;
  if (target <= 0 || modeled <= 0) return;

  // Keep calibration stable if OCR picks an odd number.
  const factor = Math.min(2.5, Math.max(0.4, target / modeled));
  if (Math.abs(factor - 1) < 0.03) return;

  for (const m of breakdown.months) {
    let before = 0;
    let after = 0;

    if (onlyElnat) {
      before = m.totalElnatKr;
      m.gridFixedFeeKr = Math.round(m.gridFixedFeeKr * factor);
      m.gridTransferFeeKr = Math.round(m.gridTransferFeeKr * factor);
      m.gridPowerChargeKr = Math.round(m.gridPowerChargeKr * factor);
      m.energyTaxKr = Math.round(m.energyTaxKr * factor);
      m.totalElnatKr = m.gridFixedFeeKr + m.gridTransferFeeKr + m.gridPowerChargeKr + m.energyTaxKr;
      after = m.totalElnatKr;
    } else {
      before = m.totalElhandelKr;
      m.spotCostKr = Math.round(m.spotCostKr * factor);
      m.markupCostKr = Math.round(m.markupCostKr * factor);
      m.elhandelMonthlyFeeKr = Math.round(m.elhandelMonthlyFeeKr * factor);
      m.totalElhandelKr = m.spotCostKr + m.markupCostKr + m.elhandelMonthlyFeeKr;
      after = m.totalElhandelKr;
    }

    m.totalKr += after - before;
  }

  breakdown.totalElhandelKr = breakdown.months.reduce((s, m) => s + m.totalElhandelKr, 0);
  breakdown.totalElnatKr = breakdown.months.reduce((s, m) => s + m.totalElnatKr, 0);
  breakdown.totalExportRevenueKr = breakdown.months.reduce((s, m) => s + m.exportRevenueKr, 0);
  breakdown.totalKr = breakdown.months.reduce((s, m) => s + m.totalKr, 0);
  breakdown.avgMonthlyKr = Math.round(breakdown.totalKr / 12);

  summary.yearlyEnergyCostBase = breakdown.totalKr;
  summary.yearlyEnergyCostAfter = breakdown.totalKr;
  summary.yearlyTotalCostBase = breakdown.totalKr;
  summary.yearlyTotalCostAfter = breakdown.totalKr;

  dlog("SCENARIOS", `Applied partial anchor (${onlyElnat ? "elnät" : "elhandel"}): month=${month}, target=${target}, modeled=${modeled}, factor=${factor.toFixed(3)}`);
}

/** Calculate three scenarios: without investments, current situation, and after recommendations.
 *  If tmyData is provided, uses 8760-hour simulation for accurate solar export estimation. */
export function calculateThreeScenarios(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions,
  recommendedUpgrades?: UpgradeId[],
  tmyData?: TmyHourlyData[]
): ThreeScenarioSummary {
  // Scenario A (nuläge): Current situation based on invoice data.
  //
  // The invoice kWh reflects actual grid consumption (net of existing solar,
  // heat pump, etc.). To correctly model the seasonal distribution we need to:
  //
  // 1. Understand what equipment the user already has (solar, VP, battery)
  // 2. Inflate the invoice kWh to "zero-equipment baseline" (what consumption
  //    would be without solar/VP)
  // 3. Simulate with existing equipment as active upgrades — the simulation
  //    then correctly models:
  //    - Solar reducing summer grid consumption
  //    - Heat pump COP varying by outdoor temperature
  //    - Battery shifting consumption
  //
  // This is critical because a house with 10 kW solar and 4,149 kWh in February
  // has a VERY different seasonal pattern than one without solar:
  //   Without solar: Feb=4149, Jul=1600 (ratio ~2.6:1)
  //   With solar:    Feb=4149, Jul=600  (ratio ~7:1, because solar covers summer)
  //
  // Equipment-related fields are included because they determine the seasonal
  // pattern. Profile fields (area, residents, bigConsumers) are omitted because
  // they only affect simulation detail, not the fundamental seasonal shape.
  const hasExistingEquipment =
    refinement.hasSolar ||
    refinement.hasBattery ||
    (refinement.heatingTypes ?? []).some(
      (ht) => ht === "luftluft" || ht === "luftvatten" || ht === "bergvarme"
    ) ||
    (refinement.heatingType === "luftluft" || refinement.heatingType === "luftvatten" || refinement.heatingType === "bergvarme");

  // --- Nuläge: always use invoice kWh directly (skipInflation=true, NO_UPGRADES) ---
  // The invoice kWh IS the actual grid consumption. If the user has solar panels,
  // the meter already reads net of solar self-consumption. We must NOT simulate
  // solar production on top of this — that would double-count the solar effect.
  //
  // Seasonal calibration (pin-and-redistribute in monthly.ts) uses the actual
  // invoice period kWh to correct the seasonal curve, giving correct monthly
  // distribution and peak kW for effektavgift calculation.
  const nulägeRefinement: RefinementAnswers = {
    elContractType: refinement.elContractType,
  };
  const currentSituationSummary = calculateAnnualSummary(
    billData, nulägeRefinement, NO_UPGRADES, seZone, assumptions, true /* skipInflation — invoice kWh = grid consumption */
  );
  applyPartialInvoiceAnchor(currentSituationSummary, billData);
  dlog("SCENARIOS", "nuläge: skipInflation=true, NO_UPGRADES, yearlyTotal:", currentSituationSummary.yearlyTotalCostBase);

  // --- Solar export credit for nuläge ---
  // The nuläge uses NO_UPGRADES → simulateDay() produces 0 solar → gridExportKwh=0.
  // But the invoice may contain actual solar export data (solarExportKwh for one month).
  // We estimate the annual export and inject the credit so it's visible in the UI.
  //
  // Two paths:
  // A) TMY data available → use 8760-hour simulation for accurate export estimation
  // B) No TMY data → fall back to scaling via SOLAR_MONTHLY_PRODUCTION_10KW profile
  if (billData.solarExportKwh && billData.solarExportKwh > 0 && billData.invoiceMonth !== undefined) {
    let monthlyExportKwh: number[];

    if (tmyData && tmyData.length >= 8760) {
      // --- Path A: 8760-hour simulation ---
      dlog("SCENARIOS", "Using 8760-hour TMY simulation for solar export estimation");
      const sim8760 = simulate8760WithSolar(billData, refinement, tmyData, seZone);
      monthlyExportKwh = sim8760.monthlyExportKwh;
      const estimatedAnnualExportKwh = sim8760.annualExportKwh;
      dlog("SCENARIOS", `8760 result: system=${sim8760.calibratedSystemSizeKw.toFixed(1)} kW, annual export=${Math.round(estimatedAnnualExportKwh)} kWh, self-consumption=${Math.round(sim8760.annualSelfConsumptionKwh)} kWh`);
    } else {
      // --- Path B: Profile-based scaling (legacy) ---
      const invoiceMonth = billData.invoiceMonth;
      const solarMonthly = SOLAR_MONTHLY_PRODUCTION_10KW;
      const totalAnnualSolar = solarMonthly.reduce((s, v) => s + v, 0);
      const invoiceMonthFraction = solarMonthly[invoiceMonth] / totalAnnualSolar;

      const estimatedAnnualExportKwh = invoiceMonthFraction > 0.005
        ? billData.solarExportKwh / invoiceMonthFraction
        : billData.solarExportKwh * 12;

      dlog("SCENARIOS", `Solar export (legacy): ${billData.solarExportKwh} kWh in month ${invoiceMonth} (fraction ${(invoiceMonthFraction * 100).toFixed(1)}%) → estimated annual export: ${Math.round(estimatedAnnualExportKwh)} kWh`);

      monthlyExportKwh = solarMonthly.map(
        monthly => estimatedAnnualExportKwh * (monthly / totalAnnualSolar)
      );
    }

    // Distribute export credit across months using zone spot prices
    const VAT = 1.25;
    const compensationRate = ELHANDEL_DEFAULTS.productionCompensationRate;
    const spotPrices = SE_ZONE_SPOT_PRICE[seZone] ?? SE_ZONE_SPOT_PRICE["SE3"];
    const spotRatio = billData.spotPriceRatio ?? 1.0;

    let totalExportRevenue = 0;
    const breakdown = currentSituationSummary.annualCostBreakdown;
    if (breakdown) {
      for (let m = 0; m < 12; m++) {
        const spotOre = (spotPrices[m] ?? 60) * spotRatio;
        const monthRevenue = -(monthlyExportKwh[m] * spotOre * compensationRate / 100) * VAT;
        totalExportRevenue += monthRevenue;

        // Inject into monthly breakdown
        if (breakdown.months[m]) {
          breakdown.months[m] = {
            ...breakdown.months[m],
            exportRevenueKr: Math.round(monthRevenue),
            totalKr: breakdown.months[m].totalKr + Math.round(monthRevenue),
          };
        }
      }

      // Update annual totals
      breakdown.totalExportRevenueKr = Math.round(totalExportRevenue);
      breakdown.totalKr = breakdown.totalKr + Math.round(totalExportRevenue);
      breakdown.avgMonthlyKr = Math.round(breakdown.totalKr / 12);

      // Update summary totals to reflect export credit
      currentSituationSummary.yearlyTotalCostBase += Math.round(totalExportRevenue);
      currentSituationSummary.yearlyTotalCostAfter += Math.round(totalExportRevenue);

      const totalExportKwh = monthlyExportKwh.reduce((s, v) => s + v, 0);
      // Store export kWh for display in cost breakdown
      breakdown.totalExportKwh = Math.round(totalExportKwh);
      dlog("SCENARIOS", `Solar export credit: ${Math.round(totalExportRevenue)} kr/år (${Math.round(totalExportKwh)} kWh export × ${compensationRate * 100}% av spot)`);
    }
  }

  // --- "Without investments" (for comparison: what would cost be without solar/VP?) ---
  // This uses the inflate+simulate approach to estimate gross consumption.
  let withoutInvestmentsSummary: AnnualSummary;
  if (hasExistingEquipment) {
    const existingEquipmentUpgrades = buildExistingEquipmentUpgrades(refinement);
    const equipmentRefinement: RefinementAnswers = {
      elContractType: refinement.elContractType,
      hasSolar: refinement.hasSolar,
      solarSizeKw: refinement.solarSizeKw,
      hasBattery: refinement.hasBattery,
      batterySizeKwh: refinement.batterySizeKwh,
      heatingType: refinement.heatingType,
      heatingTypes: refinement.heatingTypes,
    };
    dlog("SCENARIOS", "withoutInvestments: inflate + NO_UPGRADES, equipment:", Object.keys(existingEquipmentUpgrades).filter(k => (existingEquipmentUpgrades as Record<string, boolean>)[k]).join(", "));
    withoutInvestmentsSummary = calculateAnnualSummary(
      billData, equipmentRefinement, NO_UPGRADES, seZone, assumptions, false /* inflate to estimate gross consumption */
    );
  } else {
    // No equipment → withoutInvestments = nuläge (same thing)
    withoutInvestmentsSummary = currentSituationSummary;
  }

  // --- After recommended upgrades ---
  // Start from inflated baseline + apply existing + recommended upgrades
  const existingEquipmentUpgrades = buildExistingEquipmentUpgrades(refinement);
  const afterRecommendationsUpgrades: ActiveUpgrades = { ...existingEquipmentUpgrades };
  if (recommendedUpgrades) {
    for (const upgradeId of recommendedUpgrades) {
      afterRecommendationsUpgrades[upgradeId] = true;
    }
  }

  const afterRefinement: RefinementAnswers = {
    elContractType: refinement.elContractType,
    hasSolar: refinement.hasSolar,
    solarSizeKw: refinement.solarSizeKw,
    hasBattery: refinement.hasBattery,
    batterySizeKwh: refinement.batterySizeKwh,
    heatingType: refinement.heatingType,
    heatingTypes: refinement.heatingTypes,
  };
  const afterRecommendationsSummary = calculateAnnualSummary(
    billData, afterRefinement, afterRecommendationsUpgrades, seZone, assumptions, false
  );
  dlog("SCENARIOS", "afterRecommendations: inflate + recommended upgrades, yearlyTotal:", afterRecommendationsSummary.yearlyTotalCostAfter);

  // --- Build the three scenario details ---
  const withoutInvestmentsDetail = buildScenarioDetail(withoutInvestmentsSummary, false);
  const currentSituationDetail = buildScenarioDetail(currentSituationSummary, false);
  const afterRecommendationsDetail = buildScenarioDetail(afterRecommendationsSummary, true);

  return {
    withoutInvestments: withoutInvestmentsDetail,
    currentSituation: currentSituationDetail,
    afterRecommendations: afterRecommendationsDetail,
    existingSavingsKr: withoutInvestmentsDetail.yearlyTotalCostKr - currentSituationDetail.yearlyTotalCostKr,
    potentialSavingsKr: currentSituationDetail.yearlyTotalCostKr - afterRecommendationsDetail.yearlyTotalCostKr,
  };
}