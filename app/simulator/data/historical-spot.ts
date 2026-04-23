/**
 * Fetch historical spot prices from elprisetjustnu.se API.
 *
 * API docs: https://www.elprisetjustnu.se/elpris-api
 * URL pattern: https://www.elprisetjustnu.se/api/v1/prices/{YEAR}/{MM-DD}_{ZONE}.json
 * Returns hourly spot prices in SEK/kWh and öre/kWh for a given day and zone.
 *
 * @source elprisetjustnu.se (free, no API key required)
 * @updated 2026-04-08
 */

import type { SEZone } from "../types";

interface ElprisetHourlyEntry {
  SEK_per_kWh: number;
  EUR_per_kWh: number;
  EXR: number; // exchange rate
  time_start: string;
  time_end: string;
}

/**
 * Fetch average spot price for a specific month and SE zone.
 * Returns the time-weighted average in öre/kWh (exkl moms).
 *
 * Fetches all days in the month in parallel (max 31 API calls).
 * Uses a simple cache to avoid redundant fetches within the same process.
 */
const cache = new Map<string, number>();

export async function fetchMonthlyAverageSpotPrice(
  year: number,
  month: number, // 0-11 (JS convention)
  zone: SEZone
): Promise<number | null> {
  const cacheKey = `${year}-${month}-${zone}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStr = String(month + 1).padStart(2, "0");

  // Fetch all days in parallel (batched in groups of 10 to avoid overwhelming the API)
  const allPrices: number[] = [];
  const batchSize = 10;

  for (let batchStart = 1; batchStart <= daysInMonth; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, daysInMonth);
    const promises: Promise<ElprisetHourlyEntry[] | null>[] = [];

    for (let day = batchStart; day <= batchEnd; day++) {
      const dayStr = String(day).padStart(2, "0");
      const url = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${monthStr}-${dayStr}_${zone}.json`;
      promises.push(fetchDayPrices(url));
    }

    const results = await Promise.all(promises);
    for (const dayData of results) {
      if (dayData) {
        for (const entry of dayData) {
          // SEK_per_kWh → öre/kWh: multiply by 100
          // elprisetjustnu.se prices are EXKL moms
          allPrices.push(entry.SEK_per_kWh * 100);
        }
      }
    }
  }

  if (allPrices.length === 0) {
    console.warn(`[HISTORICAL-SPOT] No data for ${zone} ${year}-${monthStr}`);
    return null;
  }

  // Time-weighted average (all hours equally weighted)
  const average = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;
  const rounded = Math.round(average * 100) / 100; // 2 decimal öre

  console.log(
    `[HISTORICAL-SPOT] ${zone} ${year}-${monthStr}: ${rounded} öre/kWh (from ${allPrices.length} hourly prices)`
  );

  cache.set(cacheKey, rounded);
  return rounded;
}

/**
 * Fetch hourly spot prices for a specific day and SE zone.
 * Returns prices in öre/kWh (exkl moms), one value per returned time slot.
 */
export async function fetchDailySpotPrices(
  year: number,
  month: number, // 0-11
  day: number,
  zone: SEZone
): Promise<number[] | null> {
  const monthStr = String(month + 1).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const url = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${monthStr}-${dayStr}_${zone}.json`;
  const dayData = await fetchDayPrices(url);
  if (!dayData || dayData.length === 0) return null;
  return dayData.map((entry) => entry.SEK_per_kWh * 100);
}

async function fetchDayPrices(url: string): Promise<ElprisetHourlyEntry[] | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      // 5 second timeout per request
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // 404 = data not yet available for this date, not an error
      if (response.status !== 404) {
        console.warn(`[HISTORICAL-SPOT] ${url}: HTTP ${response.status}`);
      }
      return null;
    }

    return (await response.json()) as ElprisetHourlyEntry[];
  } catch {
    // Timeout or network error — skip this day
    return null;
  }
}

/**
 * Clear the in-memory cache (useful for testing).
 */
export function clearSpotPriceCache(): void {
  cache.clear();
}
