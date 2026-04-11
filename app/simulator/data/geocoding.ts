/**
 * Geocoding utilities for converting Swedish addresses to coordinates.
 *
 * Uses OpenStreetMap Nominatim for geocoding.
 * Falls back to SE-zone centroids if geocoding fails.
 */

import type { SEZone } from "../types";

/** SE-zone centroid coordinates (representative cities) */
export const SE_ZONE_CENTROIDS: Record<SEZone, { lat: number; lon: number; city: string }> = {
  SE1: { lat: 65.58, lon: 22.15, city: "Lulea" },
  SE2: { lat: 62.39, lon: 17.31, city: "Sundsvall" },
  SE3: { lat: 59.33, lon: 18.07, city: "Stockholm" },
  SE4: { lat: 55.60, lon: 13.00, city: "Malmo" },
};

/**
 * Geocode a Swedish address to lat/lon using Nominatim.
 * Returns null if geocoding fails.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lon: number } | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&countrycodes=se&limit=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "HOMEii/1.0 (energy-buddy@example.com)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[GEOCODING] Nominatim returned ${response.status}`);
      return null;
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      console.warn(`[GEOCODING] No results for address: "${address}"`);
      return null;
    }

    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);

    if (isNaN(lat) || isNaN(lon)) {
      console.warn(`[GEOCODING] Invalid coordinates from Nominatim`);
      return null;
    }

    // Sanity check: is it within Sweden?
    if (lat < 55 || lat > 70 || lon < 10 || lon > 25) {
      console.warn(`[GEOCODING] Coordinates outside Sweden: ${lat}, ${lon}`);
      return null;
    }

    console.log(`[GEOCODING] "${address}" -> ${lat}, ${lon}`);
    return { lat, lon };
  } catch (error) {
    console.warn("[GEOCODING] Error:", error);
    return null;
  }
}

/**
 * Get coordinates for a location, trying geocoding first,
 * then falling back to SE-zone centroid.
 */
export function getZoneCentroid(seZone: SEZone): { lat: number; lon: number } {
  const centroid = SE_ZONE_CENTROIDS[seZone];
  return { lat: centroid.lat, lon: centroid.lon };
}
