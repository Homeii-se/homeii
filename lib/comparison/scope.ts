/**
 * Scope resolution — given a user's geocoded location, determine the
 * comparison scope (initially always län-level).
 *
 * The lookup uses nearest-neighbor against per-län population-weighted
 * centroids. This is approximate (a coastline border between two län may
 * resolve to whichever centroid is closer) but accurate enough for the
 * dashboard use case where overshoot doesn't change the modeled distribution
 * meaningfully.
 *
 * When kommun- or postnummer-level data becomes available, this module
 * gains a tighter resolver and the calling code's contract stays the same.
 */

import type { LanCode } from "./types";
import { LAN_INFO, ALL_LAN_CODES } from "./data/lan";

/**
 * Find the nearest län centroid to the given lat/lon.
 * Uses planar (squared) distance — fine at the scale of Sweden because
 * we only care about ranking, not absolute distance.
 */
export function resolveLan(latitude: number, longitude: number): LanCode {
  let best: LanCode = "AB";
  let bestDistSq = Infinity;

  for (const code of ALL_LAN_CODES) {
    const c = LAN_INFO[code].centroid;
    const dLat = latitude - c.lat;
    const dLon = longitude - c.lon;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = code;
    }
  }

  return best;
}
