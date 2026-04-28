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
 * Returns prices in öre/kWh (exkl moms), aggregated to 24 hourly averages.
 *
 * Note: From 2025-10-01 onwards, Nord Pool / elprisetjustnu.se publishes
 * 15-minute resolution prices (96 entries/day instead of 24). We aggregate
 * those to hourly averages here so downstream code (which expects 24 values
 * indexed by hour 0-23) keeps working correctly.
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
  return aggregateToHourly(dayData);
}

/**
 * Aggregate raw API entries (hourly OR 15-minute resolution) into 24 hourly
 * averages, keyed by the local hour parsed from each entry's `time_start`.
 *
 * Robust against:
 *  - 24 entries (legacy hourly resolution, pre 2025-10-01)
 *  - 96 entries (15-min resolution, from 2025-10-01)
 *  - 23 / 92 entries (DST spring-forward day)
 *  - 25 / 100 entries (DST fall-back day) - duplicate hour 02 averaged
 *
 * `time_start` is ISO-8601 with explicit offset, e.g. "2026-04-27T07:15:00+02:00".
 * We slice characters 11-12 to read the local hour without depending on the
 * runtime timezone.
 */
function aggregateToHourly(entries: ElprisetHourlyEntry[]): number[] {
  const hourSums = new Array<number>(24).fill(0);
  const hourCounts = new Array<number>(24).fill(0);

  for (const entry of entries) {
    const hour = parseHourFromIso(entry.time_start);
    if (hour < 0 || hour > 23) continue;
    hourSums[hour] += entry.SEK_per_kWh * 100; // SEK/kWh -> öre/kWh
    hourCounts[hour] += 1;
  }

  // Build the 24-slot array. If a slot has zero samples (rare DST edge cases),
  // fall back to a neighbour so the chart stays continuous.
  const result: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (hourCounts[h] > 0) {
      result.push(hourSums[h] / hourCounts[h]);
    } else {
      const prev = h > 0 && hourCounts[h - 1] > 0 ? hourSums[h - 1] / hourCounts[h - 1] : null;
      const next = h < 23 && hourCounts[h + 1] > 0 ? hourSums[h + 1] / hourCounts[h + 1] : null;
      result.push(prev ?? next ?? 0);
    }
  }

  return result;
}

/** Extract the local hour (0-23) from an ISO timestamp like "2026-04-27T07:15:00+02:00". */
function parseHourFromIso(iso: string): number {
  if (iso.length < 13 || iso[10] !== "T") return -1;
  const h = Number(iso.slice(11, 13));
  return Number.isFinite(h) ? h : -1;
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
