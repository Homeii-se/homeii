/**
 * Simulation layer — all calculation and modeling logic.
 * Master re-export for the simulation/ directory.
 */

export * from "./upgrades";
export * from "./battery";
export * from "./hourly";
export * from "./monthly";
export * from "./annual";
export * from "./scoring";
export * from "./scenarios";
export * from "./adapters";
export { calculateMonthlyCost, calculateAnnualCost } from "./cost-model";
export type { MonthlyCostInput, MonthlyCostBreakdown, AnnualCostBreakdown } from "./cost-model";
export * from "./simulate8760";
