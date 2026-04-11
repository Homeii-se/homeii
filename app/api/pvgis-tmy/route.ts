/**
 * Server-side proxy for PVGIS TMY API.
 * Avoids CORS issues and provides in-memory caching.
 *
 * TMY data never changes — cache permanently.
 */

import { NextRequest, NextResponse } from "next/server";

// In-memory cache: key = "lat_lon" (rounded to 0.1°), value = raw JSON
const tmyCache = new Map<string, unknown>();

function roundCoord(val: number): number {
  return Math.round(val * 10) / 10;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latRaw = searchParams.get("lat");
    const lonRaw = searchParams.get("lon");

    if (!latRaw || !lonRaw) {
      return NextResponse.json(
        { error: "Missing lat/lon parameters" },
        { status: 400 }
      );
    }

    const lat = roundCoord(parseFloat(latRaw));
    const lon = roundCoord(parseFloat(lonRaw));

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: "Invalid lat/lon values" },
        { status: 400 }
      );
    }

    // Validate reasonable Swedish coordinate range
    if (lat < 55 || lat > 70 || lon < 10 || lon > 25) {
      return NextResponse.json(
        { error: "Coordinates outside Sweden (lat 55-70, lon 10-25)" },
        { status: 400 }
      );
    }

    const cacheKey = `${lat}_${lon}`;

    // Check in-memory cache
    if (tmyCache.has(cacheKey)) {
      console.log(`[PVGIS-PROXY] Cache hit for ${cacheKey}`);
      return NextResponse.json(tmyCache.get(cacheKey), {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    console.log(`[PVGIS-PROXY] Fetching TMY from PVGIS for lat=${lat}, lon=${lon}`);

    const pvgisUrl = `https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat=${lat}&lon=${lon}&outputformat=json`;

    const response = await fetch(pvgisUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PVGIS-PROXY] PVGIS API error ${response.status}:`, errorText.slice(0, 500));
      return NextResponse.json(
        { error: `PVGIS API error (${response.status}): ${errorText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const json = await response.json();

    // Validate response has expected structure
    if (!json.outputs?.tmy_hourly || !Array.isArray(json.outputs.tmy_hourly)) {
      console.error("[PVGIS-PROXY] Unexpected response structure:", Object.keys(json));
      return NextResponse.json(
        { error: "PVGIS returned unexpected data format" },
        { status: 502 }
      );
    }

    const hourCount = json.outputs.tmy_hourly.length;
    console.log(`[PVGIS-PROXY] Received ${hourCount} hourly records for ${cacheKey}`);

    // Store in memory cache
    tmyCache.set(cacheKey, json);

    return NextResponse.json(json, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PVGIS-PROXY] Error:", message);
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500 }
    );
  }
}
