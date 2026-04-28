/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * DEPRECATED - 2026-04-24
 * ========================
 * Den här filen innehöll hårdkodade ENTSO-E månadssnitt som var
 * utdaterade och stämmer inte överens med Supabase-datan.
 *
 * Använd istället:
 *   - @/lib/prices                                          (publik API)
 *   - @/lib/prices -> getMonthlyPrices, getAnnualPrice      (månadsaggregat)
 *   - @/lib/prices -> getHourlyPricesForYear/Month/Range    (timdata från Supabase)
 *   - /api/historical-prices                                (client-side access)
 *
 * Om du anropar exports härifrån kommer du få ett runtime-fel med
 * pekare till rätt API.
 */

function deprecated(_: unknown): never {
  throw new Error(
    "[entsoe-historical] DEPRECATED. Använd @/lib/prices istället (getMonthlyPrices, getHourlyPricesForYear etc)."
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
