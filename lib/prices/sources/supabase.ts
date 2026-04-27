/**
 * HOMEii - Prismodul: Kalla Supabase (historisk timdata)
 * =======================================================
 * Server-side wrapper kring Supabase-tabellen spot_prices.
 *
 * VIKTIGT - TIDSZON:
 *   Ar- och manadsgranser tolkas i Europe/Stockholm som DEFAULT.
 *   Detta matchar Nord Pools officiella manadsmedel och vad
 *   kunder med manadsspot-avtal faktiskt betalar enligt faktura.
 *   DST hanteras automatiskt via Intl.DateTimeFormat.
 *
 *   Alternativt kan ett tidszon-id skickas in explicit (t.ex. "UTC",
 *   "Europe/Berlin") for andra marknader.
 */

import type { PricePoint, ZoneId } from "../types";

// -- Miljovariabler --

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[prices/supabase] Saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i miljovariablerna."
    );
  }
  return { url, key };
}

// -- Typer (internt) --

interface SpotPriceRow {
  timestamp: string;
  zone_id: string;
  price_ore_kwh: number;
  price_eur_mwh: number;
  resolution: string;
  source: string;
}

// -- Tidszonhjalpare --

/**
 * Hitta UTC-offset (minuter) for en tidszon vid ett specifikt UTC-datum.
 * Hanterar DST automatiskt via Intl.
 */
function tzOffsetMinutes(utcDate: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(utcDate);
  const gmt = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = gmt.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

/**
 * Konvertera en lokal datum/tid (i given tidszon) till motsvarande UTC-Date.
 * Ex: stockholmLocalToUTC(2022, 9, 1, 0) = 2022-08-31T22:00:00Z (CEST = UTC+2).
 */
function localToUTC(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  tz: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour));
  const offsetMin = tzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - offsetMin * 60 * 1000);
}

// -- In-memory cache --

type YearCacheKey = `${ZoneId}:${number}:${string}`;
const YEAR_CACHE = new Map<YearCacheKey, PricePoint[]>();

export function clearPriceCache() {
  YEAR_CACHE.clear();
}

// -- PostgREST-anrop --

async function fetchRange(
  zoneId: ZoneId,
  fromIso: string,
  toIso: string
): Promise<SpotPriceRow[]> {
  const { url, key } = getConfig();
  const all: SpotPriceRow[] = [];
  const PAGE = 1000;
  let offset = 0;

  for (;;) {
    const params = new URLSearchParams({
      select: "timestamp,zone_id,price_ore_kwh,price_eur_mwh,resolution,source",
      zone_id: `eq.${zoneId}`,
      timestamp: `gte.${fromIso}`,
      order: "timestamp.asc",
      limit: String(PAGE),
      offset: String(offset),
    });
    params.append("timestamp", `lt.${toIso}`);

    const endpoint = `${url}/rest/v1/spot_prices?${params.toString()}`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `[prices/supabase] ${res.status} ${res.statusText} for ${zoneId} ${fromIso}->${toIso}: ${body.slice(0, 200)}`
      );
    }

    const page = (await res.json()) as SpotPriceRow[];
    all.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
    if (offset > 20000) {
      throw new Error(`[prices/supabase] For manga rader (${offset}+) for ${zoneId} ${fromIso}->${toIso}`);
    }
  }

  return all;
}

function rowToPricePoint(row: SpotPriceRow): PricePoint {
  return {
    timestamp: row.timestamp,
    priceOreKwh: Number(row.price_ore_kwh),
    resolution: "hourly",
    zoneId: row.zone_id,
    source: "entsoe",
  };
}

// -- Publik API (server-side) --

const DEFAULT_TZ = "Europe/Stockholm";

/**
 * Hamta ett helt ars timpriser for en zon.
 * Aret tolkas som kalenderar i Europe/Stockholm som default - detta
 * matchar vad kunder med manadsspot-avtal faktiskt betalar for.
 */
export async function getHourlyPricesForYear(
  zoneId: ZoneId,
  year: number,
  tz: string = DEFAULT_TZ
): Promise<PricePoint[]> {
  const cacheKey: YearCacheKey = `${zoneId}:${year}:${tz}`;
  const cached = YEAR_CACHE.get(cacheKey);
  if (cached) return cached;

  // Gransa: 1 jan 00:00 i lokal tid -> 1 jan 00:00 nasta ar
  const fromDate = localToUTC(year, 1, 1, 0, tz);
  const toDate = localToUTC(year + 1, 1, 1, 0, tz);

  const rows = await fetchRange(zoneId, fromDate.toISOString(), toDate.toISOString());
  const points = rows.map(rowToPricePoint);

  YEAR_CACHE.set(cacheKey, points);
  return points;
}

/**
 * Hamta timpriser for en specifik manad. Manaden tolkas i lokal tid
 * (default Europe/Stockholm) sa snittet matchar Nord Pools
 * manadsmedel och kundens manadsavtals-faktura.
 */
export async function getHourlyPricesForMonth(
  zoneId: ZoneId,
  year: number,
  month: number, // 1-12
  tz: string = DEFAULT_TZ
): Promise<PricePoint[]> {
  const fromDate = localToUTC(year, month, 1, 0, tz);
  // Forsta dagen i nasta manad
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const toDate = localToUTC(nextYear, nextMonth, 1, 0, tz);

  const rows = await fetchRange(zoneId, fromDate.toISOString(), toDate.toISOString());
  return rows.map(rowToPricePoint);
}

/** Fritt intervall (anvandaren anger ISO-datum direkt, ingen TZ-tolkning). */
export async function getHourlyPricesForRange(
  zoneId: ZoneId,
  from: Date,
  to: Date
): Promise<PricePoint[]> {
  const rows = await fetchRange(zoneId, from.toISOString(), to.toISOString());
  return rows.map(rowToPricePoint);
}

/** Health-check. */
export async function pingSupabase(): Promise<{ ok: boolean; sampleRowCount: number; error?: string }> {
  try {
    const probe = await fetchRange("SE3", "2024-01-01T00:00:00+00:00", "2024-01-02T00:00:00+00:00");
    return { ok: true, sampleRowCount: probe.length };
  } catch (e) {
    return { ok: false, sampleRowCount: 0, error: String(e) };
  }
}
