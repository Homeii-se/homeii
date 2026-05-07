/**
 * Recommendation engine — generates personalized energy upgrade recommendations.
 */

import type {
  BillData,
  RefinementAnswers,
  ActiveUpgrades,
  Assumptions,
  SEZone,
  Recommendation,
  RecommendationResult,
} from "../types";
import { UPGRADE_DEFINITIONS, RECOMMENDATION_CONFIG } from "../data/upgrade-catalog";
import { buildExistingEquipmentUpgrades } from "../simulation/upgrades";
import { calculateAnnualSummary, estimateZeroEquipmentBill } from "../simulation/annual";
import { calculateEnergyScore } from "../simulation/scoring";
import { simulateMonthsWithUpgrades } from "../simulation/monthly";
import type { TmyHourlyData } from "../data/pvgis-tmy";

/** Helper to compute avg monthly peak kW from monthly data */
function getAvgPeakKw(
  bill: BillData,
  refinement: RefinementAnswers,
  activeUpgrades: ActiveUpgrades,
  seZone: SEZone,
  assumptions?: Assumptions,
  tmyData?: TmyHourlyData[],
): number {
  const zeroEquipmentBill = estimateZeroEquipmentBill(bill, refinement, seZone);
  const monthlyData = simulateMonthsWithUpgrades(zeroEquipmentBill, refinement, activeUpgrades, seZone, assumptions, tmyData);
  const hasUpgrades = Object.values(activeUpgrades).some(Boolean);
  const peaks = monthlyData.map((m) => hasUpgrades ? m.peakKw : m.peakKwBase);
  return peaks.reduce((s, v) => s + v, 0) / peaks.length;
}

/** Generate personalized recommendations based on profile */
export function generateRecommendations(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions,
  tmyData?: TmyHourlyData[],
): RecommendationResult {
  // 1. Calculate baseline including existing equipment
  const existingEquipmentUpgrades = buildExistingEquipmentUpgrades(refinement);
  const baselineSummary = calculateAnnualSummary(billData, refinement, existingEquipmentUpgrades, seZone, assumptions, undefined, tmyData);
  const avgPeakKwBase = getAvgPeakKw(billData, refinement, existingEquipmentUpgrades, seZone, assumptions, tmyData);
  const baselineScore = calculateEnergyScore(
    baselineSummary.yearlyKwhBase,
    baselineSummary.yearlyTotalCostBase,
    avgPeakKwBase,
    false,
    0
  );

  // 2. Filter candidate upgrades based on profile
  const excludeIds = new Set<string>();

  if (refinement.housingType === "lagenhet") {
    RECOMMENDATION_CONFIG.excludeForApartment.forEach((id) => excludeIds.add(id));
  }

  const heatingTypesToCheck = refinement.heatingTypes ?? (refinement.heatingType ? [refinement.heatingType] : []);
  for (const ht of heatingTypesToCheck) {
    const excludeForHeating = RECOMMENDATION_CONFIG.excludeIfHeatingType[ht];
    if (excludeForHeating) {
      excludeForHeating.forEach((id) => excludeIds.add(id));
    }
  }

  // Battery requires solar — exclude standalone battery
  excludeIds.add("batteri");

  // Exclude dynamic pricing if user already has it
  if (refinement.elContractType === "dynamic") {
    excludeIds.add("dynamiskt_elpris");
  }

  // Exclude equipment user already has
  if (refinement.hasSolar) {
    excludeIds.add("solceller");
    excludeIds.add("batteri");
  }
  if (refinement.hasBattery) {
    excludeIds.add("batteri");
  }

  const candidates = UPGRADE_DEFINITIONS.filter((u) => !excludeIds.has(u.id));

  // 3. Evaluate each candidate
  const evaluated: Recommendation[] = [];

  for (const upgrade of candidates) {
    const candidateUpgrades: ActiveUpgrades = { ...existingEquipmentUpgrades, [upgrade.id]: true };

    // If solar, also test with battery as a combo
    if (upgrade.id === "solceller") {
      candidateUpgrades.batteri = true;
    }

    const candidateSummary = calculateAnnualSummary(billData, refinement, candidateUpgrades, seZone, assumptions, undefined, tmyData);
    // Compare against existing-equipment cost
    const yearlySavingsKr = baselineSummary.yearlyTotalCostAfter - candidateSummary.yearlyTotalCostAfter;

    if (yearlySavingsKr <= 0) continue;

    let investmentKr = upgrade.investmentCostSEK;
    if (upgrade.id === "solceller") {
      const batteryDef = UPGRADE_DEFINITIONS.find((u) => u.id === "batteri");
      investmentKr += batteryDef?.investmentCostSEK ?? 0;
    }

    const paybackYears = investmentKr / yearlySavingsKr;
    const kwhReductionPercent = baselineSummary.yearlyKwhAfter > 0
      ? ((baselineSummary.yearlyKwhAfter - candidateSummary.yearlyKwhAfter) / baselineSummary.yearlyKwhAfter) * 100
      : 0;

    const avgPeakKwCandidate = getAvgPeakKw(billData, refinement, candidateUpgrades, seZone, assumptions, tmyData);
    const peakReductionPercent = avgPeakKwBase > 0
      ? ((avgPeakKwBase - avgPeakKwCandidate) / avgPeakKwBase) * 100
      : 0;

    // Generate reasoning
    const energySavings = baselineSummary.yearlyEnergyCostAfter - candidateSummary.yearlyEnergyCostAfter;
    const powerFeeSavings = baselineSummary.yearlyPowerFeeCostAfter - candidateSummary.yearlyPowerFeeCostAfter;
    let reasoning: string;
    if (powerFeeSavings > energySavings && powerFeeSavings > 0) {
      reasoning = `Minskar din toppeffekt med ${Math.round(peakReductionPercent)}% — lägre effektavgift`;
    } else if (kwhReductionPercent > 15) {
      reasoning = `Minskar din förbrukning med ${Math.round(kwhReductionPercent)}% — stor besparing på energikostnaden`;
    } else {
      reasoning = `Sparar ${Math.round(yearlySavingsKr).toLocaleString("sv-SE")} kr per år på din totala elkostnad`;
    }

    if (upgrade.id === "solceller") {
      reasoning = `Producera egen el och lagra överskottet — sparar ${Math.round(yearlySavingsKr).toLocaleString("sv-SE")} kr/år`;
    }

    evaluated.push({
      upgradeId: upgrade.id,
      rank: 0,
      yearlySavingsKr: Math.round(yearlySavingsKr),
      investmentKr,
      paybackYears: Math.round(paybackYears * 10) / 10,
      reasoning,
      kwhReductionPercent: Math.round(kwhReductionPercent * 10) / 10,
      peakReductionPercent: Math.round(peakReductionPercent * 10) / 10,
      isTopPick: false,
    });
  }

  // 4. Sort by payback (lowest first), take top N
  evaluated.sort((a, b) => a.paybackYears - b.paybackYears);
  const topRecs = evaluated.slice(0, RECOMMENDATION_CONFIG.maxRecommendations);

  // 5. Assign rank and mark top picks
  topRecs.forEach((rec, i) => {
    rec.rank = i + 1;
    rec.isTopPick = i < RECOMMENDATION_CONFIG.topPickCount;
  });

  // 6. Calculate score after all recommendations (on top of existing equipment)
  const allRecsUpgrades: ActiveUpgrades = { ...existingEquipmentUpgrades };
  for (const rec of topRecs) {
    allRecsUpgrades[rec.upgradeId] = true;
    if (rec.upgradeId === "solceller") {
      allRecsUpgrades.batteri = true;
    }
  }
  const afterAllSummary = calculateAnnualSummary(billData, refinement, allRecsUpgrades, seZone, assumptions, undefined, tmyData);
  const avgPeakKwAfterAll = getAvgPeakKw(billData, refinement, allRecsUpgrades, seZone, assumptions, tmyData);
  const savingsPercentAfterAll = baselineSummary.yearlyTotalCostAfter > 0
    ? ((baselineSummary.yearlyTotalCostAfter - afterAllSummary.yearlyTotalCostAfter) / baselineSummary.yearlyTotalCostAfter) * 100
    : 0;
  const scoreAfterAll = calculateEnergyScore(
    afterAllSummary.yearlyKwhAfter,
    afterAllSummary.yearlyTotalCostAfter,
    avgPeakKwAfterAll,
    true,
    savingsPercentAfterAll
  );

  // Combined savings from running all recommendations together (not summing individual)
  const totalYearlySavingsKr = Math.round(
    baselineSummary.yearlyTotalCostAfter - afterAllSummary.yearlyTotalCostAfter
  );

  return {
    recommendations: topRecs,
    score: baselineScore,
    scoreAfterAll,
    totalYearlySavingsKr,
  };
}
