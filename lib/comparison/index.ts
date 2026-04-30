/**
 * Public API for the comparison module.
 *
 * Usage:
 *   import { computeComparison } from "@/lib/comparison";
 *
 *   const result = computeComparison({
 *     yearlyKr: 24_326,
 *     latitude: 59.33,
 *     longitude: 18.07,
 *     area: 125, // optional — om angivet skalas distributionen efter husstorlek
 *   });
 */

export { computeComparison, findPercentile } from "./compute";
export { resolveLan } from "./scope";
export { LAN_INFO, ALL_LAN_CODES } from "./data/lan";
export {
  getModeledDistribution,
  getSampleSize,
  getAvgAreaM2,
  getFixedCostForLan,
  getZoneForLan,
} from "./data/distributions";
export type {
  LanCode,
  ScopeKind,
  DataMode,
  ComparisonScope,
  ComparisonInput,
  ComparisonResult,
  CostDistribution,
} from "./types";
