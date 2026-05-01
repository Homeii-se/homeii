/**
 * Modeled cost distributions per län — total annual electricity cost
 * (kr inkl moms) for a Swedish villa.
 *
 * Derived from Energimyndigheten 2024 T3.12 (electricity GWh per län)
 * + T3.2 (number of villas per län) + SCB zone-level spread. Lognormal
 * fit + zone-specific kr conversion. See data/scb-2024.md for details.
 */

import type { CostDistribution, KwhDistribution, LanCode } from "../types";
import type { SEZone } from "../../../app/simulator/types";

/**
 * Modeled annual kWh distribution per län — derived from Energimyndigheten
 * 2024 T3.12 (GWh/län) + T3.2 (antal villor) with zone-σ from SCB.
 *
 * These values are the *upstream* data — they describe how many kWh a villa
 * in each län uses per year. The kr distribution below is downstream, derived
 * via a zone-linear approximation (kr = fixed + rate × kWh). When the new
 * pipeline lands (Phase 3), kr is computed per-user via cost-model.ts using
 * the actual grid operator from the user's invoice, instead of the
 * approximation.
 *
 * Phase 1 note: this table is currently derived by inverting the linear kr
 * model on LAN_DISTRIBUTIONS — so feeding these kWh values back through the
 * same default tariff gives the original kr values exactly. That is the
 * intended Phase 3 validation point.
 */
const LAN_KWH_DISTRIBUTIONS: Record<LanCode, KwhDistribution> = {
  AB: { p10:  8900, p50: 13500, p90: 20700 },
  AC: { p10:  5300, p50: 11100, p90: 23400 },
  BD: { p10:  4800, p50: 10000, p90: 21300 },
  C:  { p10:  6900, p50: 10500, p90: 16100 },
  D:  { p10:  7500, p50: 11500, p90: 17700 },
  E:  { p10:  6100, p50:  9300, p90: 14200 },
  F:  { p10:  6600, p50: 10100, p90: 15300 },
  G:  { p10:  4900, p50:  7600, p90: 11900 },
  H:  { p10:  5100, p50:  7800, p90: 11900 },
  I:  { p10:  5900, p50:  8900, p90: 13700 },
  K:  { p10:  5700, p50:  8800, p90: 13800 },
  M:  { p10:  6500, p50: 10200, p90: 15800 },
  N:  { p10:  6800, p50: 10500, p90: 16400 },
  O:  { p10:  6900, p50: 10600, p90: 16200 },
  S:  { p10:  6900, p50: 10600, p90: 16200 },
  T:  { p10:  7100, p50: 10800, p90: 16500 },
  U:  { p10:  8200, p50: 12500, p90: 19100 },
  W:  { p10:  7000, p50: 10700, p90: 16300 },
  X:  { p10:  8400, p50: 12900, p90: 19700 },
  Y:  { p10:  7800, p50: 12400, p90: 20100 },
  Z:  { p10:  8000, p50: 12900, p90: 20800 },
};

const LAN_DISTRIBUTIONS: Record<LanCode, CostDistribution> = {
  AB: { p10: 21300, p50: 28300, p90: 39000 },
  AC: { p10: 13800, p50: 20800, p90: 35600 },
  BD: { p10: 13200, p50: 19500, p90: 33000 },
  C:  { p10: 18300, p50: 23800, p90: 32100 },
  D:  { p10: 19300, p50: 25300, p90: 34500 },
  E:  { p10: 17100, p50: 21900, p90: 29300 },
  F:  { p10: 17900, p50: 23100, p90: 31000 },
  G:  { p10: 16100, p50: 20300, p90: 26900 },
  H:  { p10: 15700, p50: 19700, p90: 25900 },
  I:  { p10: 16800, p50: 21400, p90: 28500 },
  K:  { p10: 17300, p50: 22200, p90: 29900 },
  M:  { p10: 18600, p50: 24300, p90: 33000 },
  N:  { p10: 19000, p50: 24800, p90: 33900 },
  O:  { p10: 18400, p50: 23900, p90: 32300 },
  S:  { p10: 18400, p50: 23900, p90: 32300 },
  T:  { p10: 18600, p50: 24200, p90: 32700 },
  U:  { p10: 20300, p50: 26700, p90: 36600 },
  W:  { p10: 18500, p50: 24000, p90: 32500 },
  X:  { p10: 20600, p50: 27300, p90: 37500 },
  Y:  { p10: 16800, p50: 22400, p90: 31600 },
  Z:  { p10: 17100, p50: 23000, p90: 32500 },
};

/** Number of permanent villas per län (Energimyndigheten T3.2, 2024). */
const LAN_SAMPLE_SIZE: Record<LanCode, number> = {
  AB: 279635, AC: 67119, BD: 54930, C: 88983, D: 65407,
  E: 78329, F: 90491, G: 36260, H: 76022, I: 19318,
  K: 40405, M: 278800, N: 94059, O: 336950, S: 63885,
  T: 67057, U: 49406, W: 86844, X: 73527, Y: 59535,
  Z: 33872,
};

/**
 * Average heated villa area (m²) per län — weighted average over size
 * classes from Energimyndigheten T3.2 (2024). Used for size adjustment.
 */
const LAN_AVG_AREA_M2: Record<LanCode, number> = {
  AB: 146, AC: 145, BD: 158, C: 149, D: 149,
  E: 156, F: 157, G: 157, H: 150, I: 153,
  K: 148, M: 154, N: 150, O: 151, S: 150,
  T: 145, U: 163, W: 146, X: 165, Y: 162,
  Z: 152,
};

/** Map each län to its primary SE-zone (used for fixed-cost coefficients). */
const LAN_TO_SEZONE: Record<LanCode, SEZone> = {
  AB: "SE3", AC: "SE1", BD: "SE1", C: "SE3", D: "SE3",
  E: "SE3", F: "SE3", G: "SE4", H: "SE3", I: "SE3",
  K: "SE4", M: "SE4", N: "SE4", O: "SE3", S: "SE3",
  T: "SE3", U: "SE3", W: "SE3", X: "SE3", Y: "SE2",
  Z: "SE2",
};

/**
 * Fixed annual cost (kr inkl moms) per zone — the part of the bill that does
 * NOT scale with consumption (grid fixed + retailer fixed + power-tariff
 * placeholder). Used for size-adjusted comparisons: the fixed part stays
 * constant, only the variable part scales with house size.
 */
const ZONE_FIXED_COST: Record<SEZone, number> = {
  SE1: 7500, SE2: 7500, SE3: 8000, SE4: 8500,
};

export function getModeledDistribution(lan: LanCode): CostDistribution {
  return LAN_DISTRIBUTIONS[lan];
}

/**
 * Annual kWh distribution for a län (P10/P50/P90).
 * Used by the new pipeline as the upstream data source before per-user
 * kr conversion via cost-model.ts.
 */
export function getModeledKwhDistribution(lan: LanCode): KwhDistribution {
  return LAN_KWH_DISTRIBUTIONS[lan];
}

export function getSampleSize(lan: LanCode): number {
  return LAN_SAMPLE_SIZE[lan];
}

export function getZoneForLan(lan: LanCode): SEZone {
  return LAN_TO_SEZONE[lan];
}

export function getAvgAreaM2(lan: LanCode): number {
  return LAN_AVG_AREA_M2[lan];
}

export function getFixedCostForLan(lan: LanCode): number {
  return ZONE_FIXED_COST[LAN_TO_SEZONE[lan]];
}
