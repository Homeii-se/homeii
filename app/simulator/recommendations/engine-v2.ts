/**
 * Recommendation Engine v2 — variant-aware investment comparison.
 *
 * Instead of evaluating one upgrade per type, this engine evaluates ALL
 * variants (budget/standard/premium) for each relevant upgrade type and
 * picks the best ROI. Results include head-to-head comparisons so users
 * can see the trade-offs between e.g. bergvärme vs solceller + batteri.
 *
 * Architecture:
 * 1. Determine relevant upgrade types for this household
 * 2. For each type, evaluate every variant using the full simulation
 * 3. Pick the best variant per type (shortest payback)
 * 4. Rank best-of-type across all types
 * 5. Build combination packages (e.g. "sol + batteri + smartstyrning")
 *
 * The engine outputs both per-variant details (for head-to-head UI) and
 * a ranked recommendation list (for the results page).
 *
 * @updated 2026-04-10
 */

import type {
  BillData,
  RefinementAnswers,
  ActiveUpgrades,
  Assumptions,
  SEZone,
  UpgradeId,
  Recommendation,
  RecommendationResult,
} from "../types";
import {
  UPGRADE_TYPES,
  UPGRADE_VARIANTS,
  getVariantsForType,
  getRelevantTypeIds,
  type UpgradeType,
  type UpgradeVariant,
} from "../data/upgrade-variants";
import { DEFAULT_ACTIVE_UPGRADES, RECOMMENDATION_CONFIG } from "../data/upgrade-catalog";
import { calculateAnnualSummary } from "../simulation/annual";
import { calculateEnergyScore } from "../simulation/scoring";
import { simulateMonthsWithUpgrades } from "../simulation/monthly";

// ============================================================
// Types for the variant-aware engine output
// ============================================================

/** Result of evaluating a single variant */
export interface VariantEvaluation {
  variant: UpgradeVariant;
  type: UpgradeType;
  /** Annual savings vs baseline (kr inkl moms) */
  yearlySavingsKr: number;
  /** Total investment cost including combo items (e.g. sol + batteri) */
  totalInvestmentKr: number;
  /** Payback period in years */
  paybackYears: number;
  /** kWh reduction vs baseline (%) */
  kwhReductionPercent: number;
  /** Peak kW reduction vs baseline (%) */
  peakReductionPercent: number;
  /** Annual cost after this upgrade (kr) */
  annualCostAfterKr: number;
  /** Annual kWh after this upgrade */
  annualKwhAfter: number;
  /** Human-readable reasoning */
  reasoning: string;
  /** Which battery variant is bundled (for solar) */
  bundledBatteryVariant?: UpgradeVariant;
}

/** Head-to-head comparison for a single upgrade type */
export interface TypeComparison {
  type: UpgradeType;
  /** All variants evaluated, sorted by payback */
  variants: VariantEvaluation[];
  /** The recommended variant (best payback) */
  bestVariant: VariantEvaluation;
}

/** Full output from the v2 engine */
export interface RecommendationResultV2 {
  /** Legacy-compatible recommendation list */
  legacy: RecommendationResult;
  /** Per-type comparisons with all variants */
  typeComparisons: TypeComparison[];
  /** Baseline (nuläge) annual cost */
  baselineAnnualCostKr: number;
  /** Baseline annual kWh */
  baselineAnnualKwh: number;
}


// ============================================================
// Helpers
// ============================================================

/**
 * Build Assumptions overrides for a variant.
 * Injects variant-specific COP curve, sizing, etc. into the simulation.
 */
function buildVariantAssumptions(
  baseAssumptions: Assumptions,
  variant: UpgradeVariant,
  batteryVariant?: UpgradeVariant
): Assumptions {
  const overrides: Partial<Assumptions> = {};

  // Solar size
  if (variant.systemSizeKw !== undefined) {
    overrides.solarSizeKw = variant.systemSizeKw;
  }

  // Battery params (from bundled battery or battery variant itself)
  const bv = batteryVariant ?? (variant.capacityKwh !== undefined ? variant : undefined);
  if (bv?.capacityKwh !== undefined) {
    overrides.batterySizeKwh = bv.capacityKwh;
  }

  // COP curve override
  if (variant.copCurve) {
    overrides.copCurveOverride = variant.copCurve;
  }

  // Heating coverage (for luft-luft which doesn't cover 100%)
  if (variant.heatingCoverage !== undefined) {
    overrides.heatingCoverageOverride = variant.heatingCoverage;
  }

  // Reduction factor override
  if (variant.reductionFactor !== undefined) {
    overrides.reductionOverrides = {
      ...baseAssumptions.reductionOverrides,
      [variant.typeId]: variant.reductionFactor,
    };
  }

  return { ...baseAssumptions, ...overrides };
}

/**
 * Build ActiveUpgrades for a variant, adding the type as active.
 * For solar variants, also bundle battery.
 */
function buildActiveUpgrades(
  variant: UpgradeVariant,
  includeBattery: boolean
): ActiveUpgrades {
  const upgrades: ActiveUpgrades = { ...DEFAULT_ACTIVE_UPGRADES };
  const typeId = variant.typeId as UpgradeId;
  if (typeId in upgrades) {
    upgrades[typeId] = true;
  }
  if (includeBattery) {
    upgrades.batteri = true;
  }
  return upgrades;
}

/** Determine existing equipment from refinement as type IDs */
function getExistingEquipment(refinement: RefinementAnswers): string[] {
  const existing: string[] = [];
  const heatingTypes = refinement.heatingTypes ?? (refinement.heatingType ? [refinement.heatingType] : []);
  for (const ht of heatingTypes) {
    if (ht === "luftluft" || ht === "luftvatten" || ht === "bergvarme") {
      existing.push(ht);
    }
  }
  if (refinement.hasSolar) existing.push("solceller");
  if (refinement.hasBattery) existing.push("batteri");
  if (refinement.elContractType === "dynamic") existing.push("dynamiskt_elpris");
  return existing;
}


// ============================================================
// Main engine
// ============================================================

export function generateRecommendationsV2(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions
): RecommendationResultV2 {
  // ========== 1. Calculate baseline (nuläge) ==========
  // Nuläge = actual bill, no upgrades — the reality anchor
  const baselineSummary = calculateAnnualSummary(
    billData, refinement, DEFAULT_ACTIVE_UPGRADES, seZone, assumptions, true
  );
  const baselineAnnualCostKr = baselineSummary.yearlyTotalCostBase;
  const baselineAnnualKwh = baselineSummary.yearlyKwhBase;

  // Baseline peak kW (avg monthly)
  const baselineMonthly = simulateMonthsWithUpgrades(
    billData, refinement, DEFAULT_ACTIVE_UPGRADES, seZone, assumptions
  );
  const baselinePeaks = baselineMonthly.map(m => m.peakKwBase);
  const baselineAvgPeak = baselinePeaks.reduce((s, v) => s + v, 0) / 12;

  const baselineScore = calculateEnergyScore(
    baselineAnnualKwh, baselineAnnualCostKr, baselineAvgPeak, false, 0
  );

  console.log(`[ENGINE-V2] Baseline: ${Math.round(baselineAnnualKwh)} kWh, ${Math.round(baselineAnnualCostKr)} kr/år, peak ${baselineAvgPeak.toFixed(1)} kW`);

  // ========== 2. Determine relevant upgrade types ==========
  const existingEquipment = getExistingEquipment(refinement);
  const housingType = refinement.housingType ?? "villa";
  const relevantTypeIds = getRelevantTypeIds(housingType, existingEquipment);

  // Battery is bundled with solar — remove standalone
  const typeIds = relevantTypeIds.filter(id => id !== "batteri");

  console.log(`[ENGINE-V2] Relevant types: ${typeIds.join(", ")} (excluded: ${existingEquipment.join(", ")})`);

  // ========== 3. Evaluate all variants per type ==========
  const typeComparisons: TypeComparison[] = [];

  for (const typeId of typeIds) {
    const type = UPGRADE_TYPES.find(t => t.id === typeId);
    if (!type) continue;

    const variants = getVariantsForType(typeId);
    if (variants.length === 0) continue;

    const evaluations: VariantEvaluation[] = [];

    for (const variant of variants) {
      // For solar: bundle with each battery variant for comparison
      if (typeId === "solceller") {
        const batteryVariants = getVariantsForType("batteri");
        // Find the "standard" battery to bundle by default
        const defaultBattery = batteryVariants.find(bv => bv.tier === "standard") ?? batteryVariants[0];

        if (defaultBattery) {
          const evaluation = evaluateVariant(
            variant, type, billData, refinement, seZone, assumptions,
            baselineAnnualCostKr, baselineAnnualKwh, baselineAvgPeak,
            defaultBattery
          );
          if (evaluation) evaluations.push(evaluation);
        }
      } else {
        const evaluation = evaluateVariant(
          variant, type, billData, refinement, seZone, assumptions,
          baselineAnnualCostKr, baselineAnnualKwh, baselineAvgPeak
        );
        if (evaluation) evaluations.push(evaluation);
      }
    }

    if (evaluations.length > 0) {
      evaluations.sort((a, b) => a.paybackYears - b.paybackYears);
      typeComparisons.push({
        type,
        variants: evaluations,
        bestVariant: evaluations[0],
      });
    }
  }

  // ========== 4. Rank best-of-type across all types ==========
  const rankedBest = typeComparisons
    .map(tc => tc.bestVariant)
    .sort((a, b) => a.paybackYears - b.paybackYears);

  console.log(`[ENGINE-V2] Ranked best variants:`);
  rankedBest.forEach((ev, i) => {
    console.log(`  ${i + 1}. ${ev.variant.label}: ${ev.yearlySavingsKr} kr/år, payback ${ev.paybackYears} år`);
  });

  // ========== 5. Build legacy-compatible output ==========
  const topRecs: Recommendation[] = rankedBest
    .slice(0, RECOMMENDATION_CONFIG.maxRecommendations)
    .map((ev, i) => ({
      upgradeId: ev.variant.typeId as UpgradeId,
      rank: i + 1,
      yearlySavingsKr: ev.yearlySavingsKr,
      investmentKr: ev.totalInvestmentKr,
      paybackYears: ev.paybackYears,
      reasoning: ev.reasoning,
      kwhReductionPercent: ev.kwhReductionPercent,
      peakReductionPercent: ev.peakReductionPercent,
      isTopPick: i < RECOMMENDATION_CONFIG.topPickCount,
    }));

  // ========== 6. Calculate score after all recommendations ==========
  // Apply all top recommended types simultaneously
  const allRecsUpgrades: ActiveUpgrades = { ...DEFAULT_ACTIVE_UPGRADES };
  let combinedAssumptions = { ...assumptions };
  for (const rec of topRecs) {
    allRecsUpgrades[rec.upgradeId] = true;
    if (rec.upgradeId === "solceller") {
      allRecsUpgrades.batteri = true;
    }
    // Find the best variant for this type and use its assumptions
    const tc = typeComparisons.find(tc => tc.type.id === rec.upgradeId);
    if (tc) {
      const bv = tc.bestVariant;
      combinedAssumptions = buildVariantAssumptions(
        combinedAssumptions, bv.variant, bv.bundledBatteryVariant
      );
    }
  }

  const afterAllSummary = calculateAnnualSummary(
    billData, refinement, allRecsUpgrades, seZone, combinedAssumptions, true
  );
  const afterAllMonthly = simulateMonthsWithUpgrades(
    billData, refinement, allRecsUpgrades, seZone, combinedAssumptions
  );
  const afterAllAvgPeak = afterAllMonthly.map(m => m.peakKw).reduce((s, v) => s + v, 0) / 12;
  const savingsPercentAfterAll = baselineAnnualCostKr > 0
    ? ((baselineAnnualCostKr - afterAllSummary.yearlyTotalCostAfter) / baselineAnnualCostKr) * 100
    : 0;
  const scoreAfterAll = calculateEnergyScore(
    afterAllSummary.yearlyKwhAfter,
    afterAllSummary.yearlyTotalCostAfter,
    afterAllAvgPeak,
    true,
    savingsPercentAfterAll
  );

  const totalYearlySavingsKr = Math.round(
    baselineAnnualCostKr - afterAllSummary.yearlyTotalCostAfter
  );

  return {
    legacy: {
      recommendations: topRecs,
      score: baselineScore,
      scoreAfterAll,
      totalYearlySavingsKr,
    },
    typeComparisons,
    baselineAnnualCostKr,
    baselineAnnualKwh,
  };
}


// ============================================================
// Single variant evaluation
// ============================================================

function evaluateVariant(
  variant: UpgradeVariant,
  type: UpgradeType,
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  baseAssumptions: Assumptions,
  baselineCostKr: number,
  baselineKwh: number,
  baselineAvgPeak: number,
  bundledBatteryVariant?: UpgradeVariant
): VariantEvaluation | null {
  // Build simulation parameters for this variant
  const variantAssumptions = buildVariantAssumptions(baseAssumptions, variant, bundledBatteryVariant);
  const activeUpgrades = buildActiveUpgrades(variant, !!bundledBatteryVariant);

  // Run full annual simulation
  const summary = calculateAnnualSummary(
    billData, refinement, activeUpgrades, seZone, variantAssumptions, true
  );

  const yearlySavingsKr = Math.round(baselineCostKr - summary.yearlyTotalCostAfter);
  if (yearlySavingsKr <= 0) return null;

  // Investment cost (including bundled battery if solar)
  let totalInvestmentKr = variant.investmentCostSEK;
  if (bundledBatteryVariant) {
    totalInvestmentKr += bundledBatteryVariant.investmentCostSEK;
  }

  const paybackYears = Math.round((totalInvestmentKr / yearlySavingsKr) * 10) / 10;

  const kwhReductionPercent = baselineKwh > 0
    ? Math.round(((baselineKwh - summary.yearlyKwhAfter) / baselineKwh) * 1000) / 10
    : 0;

  // Peak reduction
  const monthlyData = simulateMonthsWithUpgrades(
    billData, refinement, activeUpgrades, seZone, variantAssumptions
  );
  const avgPeak = monthlyData.map(m => m.peakKw).reduce((s, v) => s + v, 0) / 12;
  const peakReductionPercent = baselineAvgPeak > 0
    ? Math.round(((baselineAvgPeak - avgPeak) / baselineAvgPeak) * 1000) / 10
    : 0;

  // Build reasoning
  const reasoning = buildReasoning(variant, type, yearlySavingsKr, kwhReductionPercent, peakReductionPercent, bundledBatteryVariant);

  return {
    variant,
    type,
    yearlySavingsKr,
    totalInvestmentKr,
    paybackYears,
    kwhReductionPercent,
    peakReductionPercent,
    annualCostAfterKr: Math.round(summary.yearlyTotalCostAfter),
    annualKwhAfter: Math.round(summary.yearlyKwhAfter),
    reasoning,
    bundledBatteryVariant,
  };
}

function buildReasoning(
  variant: UpgradeVariant,
  type: UpgradeType,
  yearlySavingsKr: number,
  kwhReductionPercent: number,
  peakReductionPercent: number,
  bundledBattery?: UpgradeVariant
): string {
  const savingsStr = yearlySavingsKr.toLocaleString("sv-SE");

  if (type.id === "solceller" && bundledBattery) {
    return `${variant.systemSizeKw} kW sol + ${bundledBattery.capacityKwh} kWh batteri — sparar ${savingsStr} kr/år`;
  }

  if (type.category === "varmepump") {
    const tier = variant.tier === "budget" ? "Prisvärt" : variant.tier === "premium" ? "Premiumval" : "Populärt";
    return `${tier}: ${variant.label} — sparar ${savingsStr} kr/år (${Math.round(kwhReductionPercent)}% lägre förbrukning)`;
  }

  if (peakReductionPercent > 10) {
    return `${variant.label} — minskar toppeffekten ${Math.round(peakReductionPercent)}% och sparar ${savingsStr} kr/år`;
  }

  if (kwhReductionPercent > 10) {
    return `${variant.label} — minskar förbrukningen ${Math.round(kwhReductionPercent)}% och sparar ${savingsStr} kr/år`;
  }

  return `${variant.label} — sparar ${savingsStr} kr/år`;
}
