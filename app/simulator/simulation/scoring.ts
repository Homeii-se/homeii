/**
 * Energy health score calculation.
 */

import type { ScoreBreakdown } from "../types";

/** Calculate energy health score */
export function calculateEnergyScore(
  yearlyKwh: number,
  yearlyCostKr: number,
  avgPeakKw: number,
  hasUpgrades: boolean,
  savingsPercent: number
): ScoreBreakdown {
  const pricePerKwh = yearlyKwh > 0 ? yearlyCostKr / yearlyKwh : 2;
  const priceScore = Math.round(Math.max(0, Math.min(30, 30 - (pricePerKwh - 0.8) * 17.6)));
  const consumptionScore = Math.round(Math.max(0, Math.min(30, 30 - (yearlyKwh - 8000) * (30 / 20000))));
  const peakScore = Math.round(Math.max(0, Math.min(20, 20 - (avgPeakKw - 1) * (20 / 8))));
  let optimizationScore = 0;
  if (hasUpgrades) {
    optimizationScore = Math.round(Math.min(20, savingsPercent * 0.8));
  }

  const total = Math.max(0, Math.min(100, priceScore + consumptionScore + peakScore + optimizationScore));

  let grade: string;
  let color: string;
  let message: string;

  if (total >= 80) {
    grade = "A"; color = "var(--color-energy-green)"; message = "Utmärkt energiekonomi!";
  } else if (total >= 65) {
    grade = "B"; color = "#22c55e"; message = "Bra energiekonomi med lite förbättringspotential";
  } else if (total >= 50) {
    grade = "C"; color = "#eab308"; message = "Genomsnittlig — det finns besparingspotential";
  } else if (total >= 35) {
    grade = "D"; color = "#f97316"; message = "Under genomsnittet — du kan spara tusenlappar per år";
  } else {
    grade = "E"; color = "#ef4444"; message = "Hög förbättringspotential — utforska åtgärderna nedan";
  }

  return { total, priceScore, consumptionScore, peakScore, optimizationScore, grade, color, message };
}
