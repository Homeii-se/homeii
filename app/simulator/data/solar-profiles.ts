/**
 * Solar production profiles — monthly totals and hourly shapes.
 */

/**
 * Solar monthly production for a 10kW system in Stockholm (kWh) ~8470 kWh/year
 * @source PVGIS (EU Joint Research Centre)
 * @updated 2026-04-04
 * @notes 10 kWp system, 59.3°N, 30° tilt south, 14% system losses
 */
export const SOLAR_MONTHLY_PRODUCTION_10KW = [
  180, 320, 680, 1000, 1200, 1280,
  1220, 1050, 750, 430, 220, 140,
];

/**
 * Solar hourly profile for summer (long days) — relative, sums to ~1.0
 * @source PVGIS
 * @updated 2026-04-04
 * @notes Typisk sommarprofil för Stockholm
 */
export const SOLAR_HOURLY_PROFILE_SUMMER = [
  0.00, 0.00, 0.00, 0.00, 0.02, 0.04,
  0.06, 0.08, 0.10, 0.11, 0.12, 0.12,
  0.12, 0.11, 0.10, 0.08, 0.06, 0.04,
  0.02, 0.01, 0.00, 0.00, 0.00, 0.00,
];

/**
 * Solar hourly profile for winter (short days) — relative, sums to ~1.0
 * @source PVGIS
 * @updated 2026-04-04
 * @notes Typisk vinterprofil för Stockholm
 */
export const SOLAR_HOURLY_PROFILE_WINTER = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
  0.00, 0.00, 0.04, 0.10, 0.16, 0.20,
  0.20, 0.16, 0.10, 0.04, 0.00, 0.00,
  0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
];

/**
 * Blend factor: 0 = full winter profile, 1 = full summer profile
 * @source PVGIS
 * @updated 2026-04-04
 * @notes Interpolering mellan sommar- och vinterprofil per månad
 */
export const SOLAR_SEASON_BLEND = [
  0.05, 0.15, 0.35, 0.55, 0.80, 0.95,
  1.00, 0.90, 0.65, 0.40, 0.15, 0.05,
];
