/**
 * Electricity pricing data per SE-zone and time-of-day profiles.
 */

import type { SEZone } from "../types";

/**
 * SE Zone VARIABLE energy price (öre/kWh) per month.
 * Variable cost per kWh = spot price + energiskatt (~42 öre) + rörlig nätavgift (~25 öre) + moms (25%)
 * Fixed costs (abonnemang, effektavgift) handled separately.
 * @source Elpriskollen (Energimarknadsinspektionen) / Nord Pool
 * @updated 2026-04-04
 * @notes Baserat på 2023-2025 genomsnitt per zon
 */
export const SE_ZONE_TOTAL_CONSUMER_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [  201,  208,  113,  155,  153,   99,  114,  136,  123,  109,  149,  139],
  SE2: [  201,  208,  110,  146,  150,  106,  118,  133,  118,  108,  144,  140],
  SE3: [  219,  221,  158,  160,  170,  130,  120,  132,  136,  152,  159,  140],
  SE4: [  225,  224,  190,  170,  172,  144,  134,  161,  159,  169,  180,  161],
};

/**
 * Hourly spot price multipliers per month — normalized around 1.0.
 * Each array = 24 values (hour 0-23) representing how that hour's price
 * relates to the month's average spot price.
 *
 * Key seasonal patterns:
 * - Winter (Nov-Feb): Strong morning peak (7-9) + evening peak (17-20), moderate night valley
 * - Summer (Jun-Aug): Duck curve — midday dip from continental solar, flatter overall
 * - Spring/Autumn: Transitional — moderate peaks, emerging/fading duck curve
 *
 * @source Nord Pool historical hourly data SE3/SE4, 2022-2025 averages
 * @updated 2026-04-04
 * @notes Profiles are zone-independent (same shape, different absolute prices).
 *        The multiplier × SE_ZONE_SPOT_PRICE[zone][month] gives the hourly spot price.
 */
export const HOURLY_PRICE_PROFILES: number[][] = [
  // January — deep winter, strong double peak, cold mornings
  //  00    01    02    03    04    05    06    07    08    09    10    11
  // January — deep winter, strong double peak, cold mornings
  //  00    01    02    03    04    05    06    07    08    09    10    11
  [  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.45, 1.30, 1.15, 1.05,
  //  12    13    14    15    16    17    18    19    20    21    22    23
     1.00, 0.98, 0.95, 1.00, 1.15, 1.42, 1.48, 1.35, 1.15, 0.95, 0.78, 0.68],

  // February
  [  0.63, 0.59, 0.56, 0.56, 0.61, 0.76, 1.02, 1.32, 1.42, 1.28, 1.12, 1.02,
     0.98, 0.95, 0.93, 0.97, 1.12, 1.38, 1.45, 1.32, 1.12, 0.93, 0.77, 0.68],

  // March
  [  0.65, 0.62, 0.58, 0.58, 0.63, 0.78, 1.00, 1.25, 1.32, 1.18, 1.05, 0.95,
     0.90, 0.88, 0.88, 0.92, 1.08, 1.32, 1.38, 1.25, 1.10, 0.95, 0.80, 0.70],

  // April
  [  0.68, 0.64, 0.60, 0.60, 0.65, 0.78, 0.98, 1.18, 1.22, 1.10, 0.95, 0.85,
     0.80, 0.78, 0.80, 0.88, 1.05, 1.28, 1.35, 1.22, 1.08, 0.95, 0.82, 0.72],

  // May
  [  0.70, 0.66, 0.63, 0.63, 0.68, 0.80, 0.95, 1.12, 1.15, 1.02, 0.88, 0.78,
     0.72, 0.70, 0.72, 0.82, 1.00, 1.25, 1.32, 1.20, 1.05, 0.95, 0.82, 0.75],

  // June — pronounced duck curve
  [  0.75, 0.70, 0.68, 0.68, 0.72, 0.82, 0.92, 1.05, 1.05, 0.92, 0.78, 0.68,
     0.65, 0.62, 0.65, 0.78, 0.98, 1.25, 1.35, 1.22, 1.08, 0.95, 0.85, 0.78],

  // July — deepest duck curve
  [  0.78, 0.73, 0.70, 0.70, 0.73, 0.82, 0.90, 1.02, 1.00, 0.88, 0.75, 0.65,
     0.62, 0.60, 0.62, 0.75, 0.95, 1.22, 1.32, 1.20, 1.08, 0.95, 0.85, 0.80],

  // August
  [  0.75, 0.70, 0.68, 0.68, 0.72, 0.82, 0.93, 1.08, 1.08, 0.95, 0.82, 0.72,
     0.68, 0.65, 0.68, 0.80, 1.00, 1.28, 1.35, 1.22, 1.08, 0.95, 0.82, 0.78],

  // September
  [  0.68, 0.64, 0.60, 0.60, 0.65, 0.78, 0.98, 1.18, 1.25, 1.12, 0.98, 0.88,
     0.85, 0.82, 0.85, 0.92, 1.08, 1.32, 1.38, 1.25, 1.10, 0.95, 0.82, 0.72],

  // October
  [  0.65, 0.60, 0.58, 0.58, 0.62, 0.78, 1.00, 1.28, 1.35, 1.22, 1.08, 0.98,
     0.95, 0.92, 0.92, 0.98, 1.12, 1.38, 1.42, 1.28, 1.12, 0.95, 0.80, 0.68],

  // November
  [  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.42, 1.28, 1.12, 1.02,
     0.98, 0.95, 0.95, 1.00, 1.15, 1.40, 1.45, 1.32, 1.12, 0.95, 0.78, 0.68],

  // December — strongest peaks
  [  0.60, 0.56, 0.54, 0.54, 0.58, 0.78, 1.08, 1.38, 1.48, 1.32, 1.18, 1.08,
     1.02, 1.00, 0.98, 1.02, 1.18, 1.45, 1.50, 1.38, 1.18, 0.98, 0.80, 0.68],
];

/**
 * Get the hourly price profile for a specific month.
 * Returns 24 multipliers normalized around 1.0.
 */
export function getHourlyPriceProfile(month: number): number[] {
  return HOURLY_PRICE_PROFILES[Math.max(0, Math.min(11, month))];
}

/**
 * @deprecated Use getHourlyPriceProfile(month) instead.
 * Kept for backwards compatibility — returns January profile.
 */
export const HOURLY_PRICE_PROFILE = HOURLY_PRICE_PROFILES[0];

/**
 * Spot price forecast per SE-zone and month (öre/kWh, EXKL moms, skatt och nätavgifter).
 * Detta är BARA spotpriset — inte konsumentpriset.
 *
 * Jan-Mar 2026: Faktiskt utfall (Energimarknadsbyrån / Nord Pool)
 * Apr-Dec 2026: Terminspriser (Nasdaq OMX Commodities via Elpriser24.se),
 *               fördelade till månader med 2025 års säsongsmönster.
 *
 * @source Energimarknadsbyrån, Elbruk.se, Elpriser24.se (terminspriser)
 * @updated 2026-04-07
 */
export const SE_ZONE_SPOT_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [   94,   99,   23,   57,   55,   12,   24,   42,   31,   20,   52,   44],
  SE2: [   94,   99,   21,   50,   53,   18,   27,   39,   27,   19,   48,   45],
  SE3: [  108,  110,   59,   61,   69,   37,   29,   39,   42,   55,   60,   45],
  SE4: [  113,  113,   85,   69,   71,   48,   40,   62,   60,   68,   77,   62],
};

/**
 * Default grid fee and power fee — legacy constants for backwards compatibility.
 * New code should use grid-operators.ts instead.
 */
export const DEFAULT_GRID_FEE_KR_PER_MONTH = 320;
export const DEFAULT_POWER_FEE_KR_PER_KW = 44;
  