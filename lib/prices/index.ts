/**
 * HOMEii – Prismodul: Publik API
 * ================================
 * Detta är den ENDA filen som resten av applikationen importerar från.
 * Alla andra filer i lib/prices/ är interna implementationsdetaljer.
 *
 * Lägg till en ny marknad:
 *   1. Skapa lib/prices/markets/<land>.ts med MarketConfig + data
 *   2. Registrera den i MARKETS-objektet nedan
 *   3. Klart – all befintlig kod fungerar automatiskt
 *
 * Användning:
 *   import { getMonthlyPrices, getAnnualPrices, getMarket, getDailyPrices } from "@/lib/prices"
 */

// ── Re-exportera typer ─────────────────────────────────────────────────────────
export type {
  MarketId,
  ZoneId,
  PriceResolution,
  DataSourceId,
  PricePoint,
  MonthlyPriceSummary,
  AnnualPriceSummary,
  ZoneInfo,
  MarketConfig,
  MonthlyPriceResult,
  AnnualPriceResult,
} from "./types";

// ── Marknadsregister ───────────────────────────────────────────────────────────
import { SWEDEN_MARKET }  from "./markets/sweden";
import { NORWAY_MARKET }  from "./markets/norway";
import type { MarketConfig, MarketId } from "./types";

const MARKETS: Record<MarketId, MarketConfig> = {
  SE: SWEDEN_MARKET,
  NO: NORWAY_MARKET,
  // DE: GERMANY_MARKET,  ← lägg till här
};

// ── Datakällor ─────────────────────────────────────────────────────────────────
import {
  getMonthlyData,
  getAllMonthlyData,
  getAnnualData,
  getAllAnnualData,
  getAvailableYears,
} from "./sources/entsoe";

import {
  fetchHourlyPrices,
  ELPRISETJUSTNU_HISTORICAL_LIMIT,
} from "./sources/elprisetjustnu";

// ── Publik API ─────────────────────────────────────────────────────────────────

/**
 * Hämta konfiguration för en marknad.
 */
export function getMarket(marketId: MarketId): MarketConfig | null {
  return MARKETS[marketId] ?? null;
}

/**
 * Lista alla tillgängliga marknader.
 */
export function getAllMarkets(): MarketConfig[] {
  return Object.values(MARKETS);
}

/**
 * Hämta månadssnitt (öre/kWh) för ett år och elområde.
 * Returnerar array med 12 månader, null för saknade månader.
 *
 * @example
 * const months = getMonthlyPrices("SE", "SE3", 2022)
 * // [{ month:1, avgOreKwh:107.24 }, ...]
 */
export function getMonthlyPrices(
  marketId: MarketId,
  zoneId: string,
  year: number
) {
  return getMonthlyData(marketId, zoneId, year);
}

/**
 * Hämta alla månadssnitt för ett elområde (alla år).
 * Används för fleråriga diagram.
 */
export function getAllMonthlyPrices(marketId: MarketId, zoneId: string) {
  return getAllMonthlyData(marketId, zoneId);
}

/**
 * Hämta årssnitt för ett år och elområde.
 */
export function getAnnualPrice(
  marketId: MarketId,
  zoneId: string,
  year: number
) {
  return getAnnualData(marketId, zoneId, year);
}

/**
 * Hämta alla årssnitt för ett elområde.
 */
export function getAllAnnualPrices(marketId: MarketId, zoneId: string) {
  return getAllAnnualData(marketId, zoneId);
}

/**
 * Tillgängliga år med historisk data för en marknad.
 */
export function getHistoricalYears(marketId: MarketId): number[] {
  return getAvailableYears(marketId);
}

/**
 * Hämta faktiska timpriser för ett specifikt datum (live, från elprisetjustnu.se).
 * Fungerar för svenska elområden fr.o.m. 2022-11-01.
 * Returnerar null om data saknas (för äldre datum: använd getMonthlyPrices).
 *
 * @example
 * const prices = await getDailyPrices("SE", "SE3", "2024-12-24")
 * // [{ hour:"00:00", priceOreKwh:32.1 }, ...]
 */
export async function getDailyPrices(
  marketId: MarketId,
  zoneId: string,
  date: string // YYYY-MM-DD
) {
  if (marketId !== "SE") {
    console.warn(`[prices] Live-priser ej implementerade för "${marketId}"`);
    return null;
  }
  if (date < ELPRISETJUSTNU_HISTORICAL_LIMIT) {
    console.warn(`[prices] Live-data saknas för ${date} – använd getMonthlyPrices`);
    return null;
  }
  return fetchHourlyPrices(date, zoneId as any);
}

/**
 * Metadata om prismodulen – för visning i UI.
 */
export const PRICE_MODULE_META = {
  version:       "1.0.0",
  historicalSource: {
    name:      "ENTSO-E Transparency Platform",
    endpoint:  "Day-Ahead Prices (A44)",
    fetchedAt: "2026-04-23",
    coverage:  "2020-01-01 / 2025-12-31",
    note:      "Månadsaggregat. Uppdateras kvartalsvis med homeii_fetch_prices.py",
  },
  liveSource: {
    name:      "elprisetjustnu.se",
    coverage:  "2022-11-01 / idag + imorgon",
    note:      "Gratis, ingen API-nyckel. Timpriser, kvartspriser fr.o.m. 2025-10-01",
  },
} as const;
