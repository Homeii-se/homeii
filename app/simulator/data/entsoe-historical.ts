/**
 * DEPRECATED - 2026-04-24
 * ========================
 * Den har filen innehol hardkodade ENTSO-E manadssnitt som var
 * utdaterade och stammer inte overens med Supabase-datan.
 *
 * Anvand istallet:
 *   - @/lib/prices                                          (publik API)
 *   - @/lib/prices -> getMonthlyPrices, getAnnualPrice      (manadsaggregat)
 *   - @/lib/prices -> getHourlyPricesForYear/Month/Range    (timdata fran Supabase)
 *   - /api/historical-prices                                (client-side access)
 *
 * Om du anropar exports harifran kommer du fa ett runtime-fel med
 * pekare till ratt API.
 */

function deprecated(_: unknown): never {
  throw new Error(
    "[entsoe-historical] DEPRECATED. Anvand @/lib/prices istallet (getMonthlyPrices, getHourlyPricesForYear etc)."
  );
}

export const ENTSOE_MONTHLY_AVG = new Proxy({} as Record<string, unknown>, { get: deprecated });
export const ENTSOE_ANNUAL_AVG = new Proxy({} as Record<string, unknown>, { get: deprecated });
export const ENTSOE_AVAILABLE_YEARS = [] as const;
export const ENTSOE_DATA_SOURCE = {
  name: "DEPRECATED - se @/lib/prices",
  endpoint: "",
  fetched_at: "",
  coverage: "",
} as const;

export function getMonthlyAvg(_zone: string, _year: number): (number | null)[] {
  deprecated(null);
}

export function getAnnualAvg(_zone: string, _year: number): number | null {
  deprecated(null);
}
