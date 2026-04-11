import { calculateAnnualSummary, generateRecommendations } from "./app/simulator/calculations.ts";
import { DEFAULT_ACTIVE_UPGRADES } from "./app/simulator/constants.ts";

const billData = { kwhPerMonth: 1500, costPerMonth: 2200 };
const refinement = {
  housingType: "villa",
  heatingTypes: ["direktel", "luftluft"],
  heatingType: "direktel",
  area: 150,
  residents: 4,
  hasSolar: true,
  solarSizeKw: 10,
  hasBattery: true,
  batterySizeKwh: 30,
};
const assumptions = {
  gridFeeKrPerMonth: 400,
  powerFeeKrPerKw: 100,
  solarSizeKw: 10,
  batterySizeKwh: 30,
};

const noUpgrades = { ...DEFAULT_ACTIVE_UPGRADES };
const baseline = calculateAnnualSummary(billData, refinement, noUpgrades, "SE3", assumptions);
console.log("=== BASELINE (inga åtgärder) ===");
console.log("Årsförbrukning:", baseline.yearlyKwhBase, "kWh");
console.log("Energikostnad:", baseline.yearlyEnergyCostBase, "kr");
console.log("Nätavgift:", baseline.yearlyGridFeeCost, "kr");
console.log("Effektavgift bas:", baseline.yearlyPowerFeeCostBase, "kr");
console.log("TOTAL:", baseline.yearlyTotalCostBase, "kr");

const withExisting = { ...noUpgrades, solceller: true, batteri: true };
const existingSummary = calculateAnnualSummary(billData, refinement, withExisting, "SE3", assumptions);
console.log("\n=== MED BEFINTLIGA SOL + BATTERI ===");
console.log("kWh efter:", existingSummary.yearlyKwhAfter, "kWh");
console.log("Energikostnad efter:", existingSummary.yearlyEnergyCostAfter, "kr");
console.log("Effektavgift efter:", existingSummary.yearlyPowerFeeCostAfter, "kr");
console.log("TOTAL efter:", existingSummary.yearlyTotalCostAfter, "kr");
console.log("Besparing:", baseline.yearlyTotalCostBase - existingSummary.yearlyTotalCostAfter, "kr/år");

const recs = generateRecommendations(billData, refinement, "SE3", assumptions);
console.log("\n=== REKOMMENDATIONER ===");
for (const rec of recs.recommendations) {
  console.log(rec.upgradeId + ": " + rec.yearlySavingsKr + " kr/år, payback " + rec.paybackYears + " år, invest " + rec.investmentKr + " kr");
}

console.log("\n=== SANITY CHECK ===");
console.log("Kundens input: " + billData.costPerMonth + " kr/mån, " + billData.kwhPerMonth + " kWh/mån");
console.log("Implicit pris: " + (billData.costPerMonth / billData.kwhPerMonth).toFixed(2) + " kr/kWh");
console.log("Kundens verkliga årskostnad: " + (billData.costPerMonth * 12) + " kr");
console.log("Modellens baseline total: " + baseline.yearlyTotalCostBase + " kr");
console.log("Skillnad: " + (baseline.yearlyTotalCostBase - billData.costPerMonth * 12) + " kr");
