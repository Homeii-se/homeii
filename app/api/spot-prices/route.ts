import { NextRequest, NextResponse } from "next/server";
import type { SEZone } from "../../simulator/types";
import { fetchDailySpotPrices } from "../../simulator/data/historical-spot";
import { getHourlyPricesForMonth, type PricePoint } from "@/lib/prices";

export const runtime = "nodejs";

/**
 * Stockholm-local hour (0-23) for a UTC ISO timestamp.
 * Uses Intl so DST is handled correctly without shipping a tz library.
 */
function stockholmHour(utcIso: string): number {
  const d = new Date(utcIso);
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  // Intl returns "00".."23" - "24" can appear at midnight in some locales, normalise
  const h = parseInt(hourStr, 10) % 24;
  return Number.isFinite(h) ? h : -1;
}

/** Stockholm-local YYYY-MM-DD for a UTC ISO timestamp. */
function stockholmDate(utcIso: string): string {
  const d = new Date(utcIso);
  // sv-SE locale gives "YYYY-MM-DD" naturally
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Aggregate PricePoint[] (1 entry per hour, UTC timestamps) to 24 hourly
 * averages keyed by Stockholm-local hour.
 */
function aggregatePointsToHourly(points: PricePoint[]): number[] {
  const sums = new Array<number>(24).fill(0);
  const counts = new Array<number>(24).fill(0);
  for (const p of points) {
    const h = stockholmHour(p.timestamp);
    if (h < 0 || h > 23) continue;
    sums[h] += p.priceOreKwh;
    counts[h] += 1;
  }
  const result: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (counts[h] > 0) {
      result.push(sums[h] / counts[h]);
    } else {
      const prev = h > 0 && counts[h - 1] > 0 ? sums[h - 1] / counts[h - 1] : null;
      const next = h < 23 && counts[h + 1] > 0 ? sums[h + 1] / counts[h + 1] : null;
      result.push(prev ?? next ?? 0);
    }
  }
  return result;
}

/**
 * Fallback for dates before 2022-11-01 (where elprisetjustnu.se has no data):
 * fetch the full Stockholm-local month from Supabase and filter to the requested day.
 */
async function fetchHistoricalDayFromSupabase(
  date: string,
  zone: SEZone
): Promise<number[] | null> {
  const [yearStr, monthStr] = date.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12 for getHourlyPricesForMonth
  try {
    const monthPoints = await getHourlyPricesForMonth("SE", zone, year, month);
    const dayPoints = monthPoints.filter((p) => stockholmDate(p.timestamp) === date);
    if (dayPoints.length === 0) return null;
    return aggregatePointsToHourly(dayPoints);
  } catch (err) {
    console.warn(`[/api/spot-prices] Supabase fallback failed for ${zone} ${date}:`, err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const zone = (url.searchParams.get("zone") ?? "").toUpperCase() as SEZone;
    const date = url.searchParams.get("date") ?? "";

    if (!["SE1", "SE2", "SE3", "SE4"].includes(zone)) {
      return NextResponse.json({ error: "Invalid zone" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format (YYYY-MM-DD required)" }, { status: 400 });
    }

    const [yearStr, monthStr, dayStr] = date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const day = Number(dayStr);

    // Primary source: elprisetjustnu.se (live + recent, fr.o.m. 2022-11-01)
    let pricesOre: number[] | null = await fetchDailySpotPrices(year, month, day, zone);
    let source = "elprisetjustnu";

    // Fallback: Supabase (covers 2020-01-01 onwards via ENTSO-E import)
    if (!pricesOre) {
      pricesOre = await fetchHistoricalDayFromSupabase(date, zone);
      source = "supabase";
    }

    if (!pricesOre) {
      return NextResponse.json({ pricesOreExMoms: null, source: null }, { status: 200 });
    }

    return NextResponse.json({ pricesOreExMoms: pricesOre, source }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
