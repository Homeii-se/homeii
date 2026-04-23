/**
 * HOMEii – Prismodul: Källa elprisetjustnu.se
 * =============================================
 * Hämtar faktiska timpriser för svenska elområden.
 *
 * Täckning: 2022-11-01 → idag (live) + morgondagen (fr.o.m. ~13:00)
 * Upplösning: Timdata (24 värden/dag) · Kvartdata fr.o.m. 2025-10-01
 * Datakälla: ENTSO-E via elprisetjustnu.se (gratis, ingen API-nyckel)
 *
 * Begränsning: Historik bara tillbaka till 2022-11-01.
 * För data före detta datum: använd entsoe.ts (månadssnitt).
 */

import type { PricePoint, ZoneId } from "../types";

const BASE_URL = "https://www.elprisetjustnu.se/api/v1/prices";

/** Gräns för historisk data – äldre än detta hämtas inte */
export const ELPRISETJUSTNU_HISTORICAL_LIMIT = "2022-11-01";

interface RawEntry {
  SEK_per_kWh: number;
  EUR_per_kWh: number;
  EXR: number;
  time_start: string;
  time_end: string;
}

/**
 * Hämtar faktiska timpriser för ett specifikt datum och elområde.
 * Returnerar null om data inte finns (t.ex. framtida datum utan publicerat pris,
 * eller datum före 2022-11-01).
 */
export async function fetchHourlyPrices(
  date: string,  // YYYY-MM-DD
  zoneId: ZoneId
): Promise<PricePoint[] | null> {
  // Kontrollera att datum är inom tillgängligt intervall
  if (date < ELPRISETJUSTNU_HISTORICAL_LIMIT) {
    console.warn(`[elprisetjustnu] Data saknas för ${date} – äldre än 2022-11-01`);
    return null;
  }

  const [year, mm, dd] = date.split("-");
  const url = `${BASE_URL}/${year}/${mm}-${dd}_${zoneId}.json`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 }, // Next.js cache: 1h
    });

    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[elprisetjustnu] HTTP ${res.status} för ${zoneId} ${date}`);
      }
      return null;
    }

    const raw: RawEntry[] = await res.json();

    return raw.map((entry) => ({
      timestamp:    entry.time_start,
      priceOreKwh:  Math.round(entry.SEK_per_kWh * 100 * 100) / 100, // SEK/kWh → öre/kWh
      resolution:   "hourly" as const,
      zoneId,
      source:       "elprisetjustnu" as const,
    }));
  } catch (err) {
    console.error(`[elprisetjustnu] Nätverksfel för ${zoneId} ${date}:`, err);
    return null;
  }
}

/**
 * Hämtar timpriserna för ett helt år genom att iterera alla dagar.
 * OBS: Gör upp till 366 API-anrop – använd med cache.
 * Lämplig för engångshämtning, inte realtid.
 */
export async function fetchYearlyHourlyPrices(
  year: number,
  zoneId: ZoneId,
  onProgress?: (done: number, total: number) => void
): Promise<PricePoint[]> {
  const startDate = new Date(`${year}-01-01`);
  const endDate   = new Date(`${year}-12-31`);
  const allPoints: PricePoint[] = [];
  const limit     = new Date(ELPRISETJUSTNU_HISTORICAL_LIMIT);

  let current = new Date(startDate);
  const total = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  let done = 0;

  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];

    if (current >= limit) {
      const points = await fetchHourlyPrices(dateStr, zoneId);
      if (points) allPoints.push(...points);
      // Kort paus för att inte hammra API:et
      await new Promise(r => setTimeout(r, 50));
    }

    done++;
    onProgress?.(done, total);
    current.setDate(current.getDate() + 1);
  }

  return allPoints;
}
