/**
 * GET /api/monthly-spot-averages
 * Returnerar 12 manadsmedel av spotpriser for given zon + ar.
 * Datakalla: Supabase spot_prices (ENTSO-E day-ahead).
 */

import { NextResponse } from "next/server";
import { getHourlyPricesForYear } from "@/lib/prices";

export const runtime = "nodejs";

const ALLOWED_ZONES = new Set(["SE1", "SE2", "SE3", "SE4"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const zone = (url.searchParams.get("zone") ?? "SE3").toUpperCase();
  const yearStr = url.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear() - 1;

  if (!ALLOWED_ZONES.has(zone)) {
    return NextResponse.json({ error: `Okand zon: ${zone}` }, { status: 400 });
  }
  if (!Number.isFinite(year) || year < 2020 || year > new Date().getFullYear()) {
    return NextResponse.json({ error: `Ogiltigt ar: ${yearStr}` }, { status: 400 });
  }

  try {
    const prices = await getHourlyPricesForYear("SE", zone, year);
    if (prices.length === 0) {
      return NextResponse.json({ error: `Ingen data for ${zone} ${year}` }, { status: 404 });
    }

    const buckets: { sum: number; count: number }[] = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
    const tzFormatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      year: "numeric",
      month: "numeric",
    });
    for (const p of prices) {
      const parts = tzFormatter.formatToParts(new Date(p.timestamp));
      const monthStr = parts.find((x) => x.type === "month")?.value ?? "1";
      const monthIdx = parseInt(monthStr, 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        buckets[monthIdx].sum += p.priceOreKwh;
        buckets[monthIdx].count += 1;
      }
    }
    const monthlyAvgsOreExklMoms = buckets.map((b) => (b.count > 0 ? Math.round((b.sum / b.count) * 10) / 10 : 0));

    return NextResponse.json(
      { zone, year, monthlyAvgsOreExklMoms, source: "supabase-spot-prices" },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (err) {
    console.error("[monthly-spot-averages]", err);
    const message = err instanceof Error ? err.message : "Internt fel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
