/**
 * GET /api/historical-prices
 * ===========================
 * Server-side proxy for historisk timdata fran Supabase spot_prices.
 *
 * Parametrar:
 *   - market:   "SE" | "NO" | "DK" | "DE" | "FI" (default "SE")
 *   - zone:     "SE1"..."SE4" | "DK1" | "DK2" | "DE-LU" | "NO1"..."NO5" | "FI"
 *   - year:     2020-2025
 *   - month:    1-12 (valfritt)
 *   - from/to:  ISO-datum, alternativ till year/month
 *   - tz:       IANA-tidszon (default "Europe/Stockholm")
 */

import { NextResponse } from "next/server";
import {
  getHourlyPricesForYear,
  getHourlyPricesForMonth,
  getHourlyPricesForRange,
} from "@/lib/prices";

export const runtime = "nodejs";

const ALLOWED_ZONES = new Set([
  "SE1", "SE2", "SE3", "SE4",
  "NO1", "NO2", "NO3", "NO4", "NO5",
  "DK1", "DK2",
  "DE-LU",
  "FI",
]);
const ALLOWED_MARKETS = new Set(["SE", "NO", "DK", "DE", "FI"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const market = (url.searchParams.get("market") ?? "SE").toUpperCase();
  const zoneRaw = url.searchParams.get("zone") ?? "SE3";
  // DE-LU och liknande ska inte uppercase:as fel - behall case pa bindestreck
  const zone = zoneRaw.toUpperCase();
  const yearStr = url.searchParams.get("year");
  const monthStr = url.searchParams.get("month");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  if (!ALLOWED_MARKETS.has(market)) {
    return NextResponse.json({ error: `Okand marknad: ${market}` }, { status: 400 });
  }
  if (!ALLOWED_ZONES.has(zone)) {
    return NextResponse.json({ error: `Okand zon: ${zone}` }, { status: 400 });
  }

  const fetchedAt = new Date().toISOString();

  try {
    if (fromStr && toStr) {
      const from = new Date(fromStr);
      const to = new Date(toStr);
      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return NextResponse.json({ error: "Ogiltigt datumformat" }, { status: 400 });
      }
      if (to.getTime() - from.getTime() > 400 * 24 * 3600 * 1000) {
        return NextResponse.json({ error: "Intervall > 400 dagar otillatet" }, { status: 400 });
      }
      const points = await getHourlyPricesForRange(market, zone, from, to);
      return NextResponse.json({
        query: { market, zone, from: from.toISOString(), to: to.toISOString() },
        points, count: points.length, fetchedAt,
      });
    }

    if (!yearStr) {
      return NextResponse.json({ error: "Ange year (+ valfritt month) eller from/to" }, { status: 400 });
    }
    const year = parseInt(yearStr, 10);
    if (year < 2020 || year > 2025) {
      return NextResponse.json({ error: `Ar ${year} utanfor tackning 2020-2025` }, { status: 400 });
    }

    if (monthStr) {
      const month = parseInt(monthStr, 10);
      if (month < 1 || month > 12) {
        return NextResponse.json({ error: `Ogiltig manad: ${monthStr}` }, { status: 400 });
      }
      const points = await getHourlyPricesForMonth(market, zone, year, month);
      return NextResponse.json({
        query: { market, zone, year, month },
        points, count: points.length, fetchedAt,
      });
    }

    const points = await getHourlyPricesForYear(market, zone, year);
    return NextResponse.json({
      query: { market, zone, year },
      points, count: points.length, fetchedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/historical-prices]", msg);
    return NextResponse.json({ error: "Internt fel", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
