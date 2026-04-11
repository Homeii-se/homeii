/**
 * Barrel re-export — all calculation/simulation logic.
 * Maintained for backwards compatibility.
 * Prefer importing directly from simulation/ or recommendations/ modules.
 */

// Re-export everything from simulation layer
export {
  // upgrades
  getBlendedHeatingShare,
  getHeatPumpCOP,
  getAdjustedSeasonFactors,
  getSeasonFactorForDate,
  applyUpgradesToHour,
  buildExistingEquipmentUpgrades,
  NO_UPGRADES,
  // battery
  simulateBattery,
  // hourly
  getAdjustedHourlyProfile,
  getTemperatureForDateHour,
  getSolarProductionForHour,
  getHourlyData,
  simulateDay,
  // monthly
  getMonthlyData,
  simulateMonthsWithUpgrades,
  // annual
  calculatePricePerKwh,
  calculateDailyKwh,
  calculateYearlyKwh,
  estimateZeroEquipmentBill,
  getYearlyData,
  getPrecision,
  calculateAnnualSummary,
  // scoring
  calculateEnergyScore,
  // scenarios
  calculateThreeScenarios,
  PRICE_SCENARIOS,
  projectCostsOverTime,
  calculateNPV,
} from "./simulation/index";

// Re-export types from climate (used by scenarios)
export type { PriceScenario } from "./climate";

// Re-export from recommendations
export { generateRecommendations } from "./recommendations/engine";
