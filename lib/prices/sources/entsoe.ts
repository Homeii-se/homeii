/**
 * HOMEii – Prismodul: Källa ENTSO-E
 * ====================================
 * Wrapper kring den förberäknade ENTSO-E-datan i markets/sweden.ts.
 * Vid framtida utbyggnad: lägg till norway.ts, germany.ts etc. här.
 *
 * Denna fil exponerar ingen nätverksfunktion – all data är
 * förladdad från CSV via homeii_fetch_prices.py och inbakad i
 * markets/-filerna. Uppdateras kvartalsvis.
 */

import { SE_MONTHLY_DATA, SE_ANNUAL_DATA } from "../markets/sweden";
import type {
  MarketId,
  ZoneId,
  MonthlyPriceSummary,
  AnnualPriceSummary,
} from "../types";

/**
 * Hämta månadssnitt för ett specifikt år och elområde.
 * Returnerar null om data saknas.
 */
export function getMonthlyData(
  marketId: MarketId,
  zoneId: ZoneId,
  year: number
): MonthlyPriceSummary[] | null {
  if (marketId === "SE") {
    const data = SE_MONTHLY_DATA.filter(
      (d) => d.zoneId === zoneId && d.year === year
    );
    return data.length ? data : null;
  }
  console.warn(`[entsoe] Marknad "${marketId}" ej implementerad än`);
  return null;
}

/**
 * Hämta alla tillgängliga månadssnitt för ett elområde (alla år).
 */
export function getAllMonthlyData(
  marketId: MarketId,
  zoneId: ZoneId
): MonthlyPriceSummary[] {
  if (marketId === "SE") {
    return SE_MONTHLY_DATA.filter((d) => d.zoneId === zoneId);
  }
  return [];
}

/**
 * Hämta årssnitt för ett specifikt år och elområde.
 */
export function getAnnualData(
  marketId: MarketId,
  zoneId: ZoneId,
  year: number
): AnnualPriceSummary | null {
  if (marketId === "SE") {
    return SE_ANNUAL_DATA.find(
      (d) => d.zoneId === zoneId && d.year === year
    ) ?? null;
  }
  return null;
}

/**
 * Hämta alla årssnitt för ett elområde.
 */
export function getAllAnnualData(
  marketId: MarketId,
  zoneId: ZoneId
): AnnualPriceSummary[] {
  if (marketId === "SE") {
    return SE_ANNUAL_DATA.filter((d) => d.zoneId === zoneId);
  }
  return [];
}

/**
 * Alla tillgängliga år med ENTSO-E-data för en marknad.
 */
export function getAvailableYears(marketId: MarketId): number[] {
  if (marketId === "SE") {
    return [...new Set(SE_ANNUAL_DATA.map((d) => d.year))].sort();
  }
  return [];
}
