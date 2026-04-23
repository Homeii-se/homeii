/**
 * Reasoning chains — explain WHY a recommendation was made.
 * Provides transparent, user-facing explanations for each upgrade recommendation.
 */

import type {
  BillData,
  RefinementAnswers,
  Recommendation,
  Assumptions,
  SEZone,
  AnnualSummary,
  ActiveUpgrades,
} from "../types";

export interface ReasoningFactor {
  label: string;
  impact: "positive" | "negative" | "neutral";
  description: string;
  value?: number;
  unit?: string;
}

export interface ReasoningChain {
  upgradeId: string;
  factors: ReasoningFactor[];
  conclusion: string;
  annualSavingsKr: number;
  investmentKr: number;
  paybackYears: number;
}

/**
 * Build a reasoning chain explaining why an upgrade was recommended.
 */
export function buildReasoningChain(
  rec: Recommendation,
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions,
  existingUpgrades: ActiveUpgrades,
  annualSummaryBefore: AnnualSummary
): ReasoningChain {
  void billData;
  void refinement;
  void seZone;
  void assumptions;
  void existingUpgrades;
  void annualSummaryBefore;
  const factors: ReasoningFactor[] = [];

  if (rec.kwhReductionPercent > 0) {
    factors.push({
      label: "Förbrukningsminskning",
      impact: "positive",
      description: `Beräknad minskning: ${rec.kwhReductionPercent}% av nuvarande förbrukning`,
      value: rec.kwhReductionPercent,
      unit: "%",
    });
  }

  if (rec.peakReductionPercent > 0) {
    factors.push({
      label: "Effektminskning",
      impact: "positive",
      description: `Beräknad toppeffektminskning: ${rec.peakReductionPercent}%, kan sänka effektavgiften`,
      value: rec.peakReductionPercent,
      unit: "%",
    });
  }

  const conclusion = `${rec.upgradeId} beräknas spara ${rec.yearlySavingsKr.toLocaleString("sv-SE")} kr/år med en investering på ${rec.investmentKr.toLocaleString("sv-SE")} kr (återbetalningstid: ${rec.paybackYears} år).`;

  return {
    upgradeId: rec.upgradeId,
    factors,
    conclusion,
    annualSavingsKr: rec.yearlySavingsKr,
    investmentKr: rec.investmentKr,
    paybackYears: rec.paybackYears,
  };
}