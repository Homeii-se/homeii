/**
 * PVGIS TMY (Typical Meteorological Year) data integration.
 *
 * Provides 8,760 hourly data points (one full year) with real weather data
 * from the EU Joint Research Centre's PVGIS service.
 *
 * @source https://re.jrc.ec.europa.eu/pvg_tools/en/
 */

export interface TmyHourlyData {
  /** PVGIS timestamp format "20070101:0010" */
  time: string;
  /** Global Horizontal Irradiance, W/m² */
  ghi: number;
  /** Direct Normal Irradiance, W/m² */
  dni: number;
  /** Diffuse Horizontal Irradiance, W/m² */
  dhi: number;
  /** Outdoor temperature, °C */
  tempC: number;
  /** Wind speed m/s */
  windMs: number;
  /** Month (0-11) — derived from time string */
  month: number;
  /** Hour of day (0-23) — derived from time string */
  hour: number;
  /** Day of year (0-364) — derived from time string */
  dayOfYear: number;
}

/** localStorage key prefix for TMY cache */
const TMY_CACHE_KEY_PREFIX = "homeii-tmy-";

/** Round coordinate to 0.1° for cache efficiency */
function roundCoord(val: number): number {
  return Math.round(val * 10) / 10;
}

/** Build cache key from rounded coordinates */
function buildCacheKey(lat: number, lon: number): string {
  return `${TMY_CACHE_KEY_PREFIX}${roundCoord(lat)}_${roundCoord(lon)}`;
}

/**
 * Parse the PVGIS TMY JSON response into our TmyHourlyData[] format.
 *
 * PVGIS JSON structure:
 * {
 *   "outputs": {
 *     "tmy_hourly": [
 *       { "time(UTC)": "20070101:0010", "G(h)": 0, "Gb(n)": 0, "Gd(h)": 0, "T2m": -5.2, "WS10m": 3.1 },
 *       ...
 *     ]
 *   }
 * }
 */
export function parseTmyJson(json: Record<string, unknown>): TmyHourlyData[] {
  const outputs = json.outputs as Record<string, unknown> | undefined;
  if (!outputs) {
    throw new Error("PVGIS response missing 'outputs' field");
  }

  const tmyHourly = outputs.tmy_hourly as Array<Record<string, unknown>> | undefined;
  if (!tmyHourly || !Array.isArray(tmyHourly)) {
    throw new Error("PVGIS response missing 'outputs.tmy_hourly' array");
  }

  return tmyHourly.map((row, index) => {
    const timeStr = (row["time(UTC)"] as string) ?? "";

    // Parse "20070101:0010" → month, hour, dayOfYear
    // Format: YYYYMMdd:HHmm
    const monthStr = timeStr.substring(4, 6);
    const dayStr = timeStr.substring(6, 8);
    const hourStr = timeStr.substring(9, 11);

    const monthNum = parseInt(monthStr, 10) - 1; // 0-indexed
    const dayNum = parseInt(dayStr, 10);
    const hourNum = parseInt(hourStr, 10);

    // Calculate day of year (approximate, sufficient for indexing)
    const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const dayOfYear = (daysBeforeMonth[monthNum] ?? 0) + dayNum - 1;

    return {
      time: timeStr,
      ghi: (row["G(h)"] as number) ?? 0,
      dni: (row["Gb(n)"] as number) ?? 0,
      dhi: (row["Gd(h)"] as number) ?? 0,
      tempC: (row["T2m"] as number) ?? 0,
      windMs: (row["WS10m"] as number) ?? 0,
      month: isNaN(monthNum) ? 0 : monthNum,
      hour: isNaN(hourNum) ? 0 : hourNum,
      dayOfYear: isNaN(dayOfYear) ? index % 365 : dayOfYear,
    };
  });
}

/**
 * Fetch TMY data for given coordinates.
 * Uses the local API proxy to avoid CORS issues.
 * Caches in localStorage for permanent persistence.
 */
export async function fetchTmyData(
  lat: number,
  lon: number
): Promise<TmyHourlyData[]> {
  const roundedLat = roundCoord(lat);
  const roundedLon = roundCoord(lon);

  // Check localStorage cache first
  if (typeof window !== "undefined") {
    const cacheKey = buildCacheKey(lat, lon);
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as TmyHourlyData[];
        if (parsed.length >= 8760) {
          console.log(`[PVGIS] Cache hit for ${roundedLat}, ${roundedLon} (${parsed.length} hours)`);
          return parsed;
        }
      }
    } catch {
      // Cache miss or corrupted — continue to fetch
    }
  }

  console.log(`[PVGIS] Fetching TMY data for ${roundedLat}, ${roundedLon}...`);

  const response = await fetch(
    `/api/pvgis-tmy?lat=${roundedLat}&lon=${roundedLon}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PVGIS fetch failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const data = parseTmyJson(json);

  console.log(`[PVGIS] Received ${data.length} hourly records`);

  // Validate
  if (data.length < 8760) {
    console.warn(`[PVGIS] Expected 8760 hours, got ${data.length}`);
  }

  // Cache to localStorage
  if (typeof window !== "undefined") {
    try {
      const cacheKey = buildCacheKey(lat, lon);
      localStorage.setItem(cacheKey, JSON.stringify(data));
      console.log(`[PVGIS] Cached ${data.length} hours to localStorage`);
    } catch {
      console.warn("[PVGIS] Failed to cache to localStorage (quota exceeded?)");
    }
  }

  return data;
}
