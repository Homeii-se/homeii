import { NextRequest, NextResponse } from "next/server";
import type { SEZone } from "../../simulator/types";
import { fetchDailySpotPrices } from "../../simulator/data/historical-spot";

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

    const pricesOre = await fetchDailySpotPrices(year, month, day, zone);
    if (!pricesOre) {
      return NextResponse.json({ pricesOreExMoms: null }, { status: 200 });
    }

    return NextResponse.json({ pricesOreExMoms: pricesOre }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
