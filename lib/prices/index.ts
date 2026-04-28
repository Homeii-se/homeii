/**
 * HOMEii - Prismodul: Publik API
 */

export type {
  MarketId, ZoneId, PriceResolution, DataSourceId, PricePoint,
  MonthlyPriceSummary, AnnualPriceSummary, ZoneInfo, MarketConfig,
  MonthlyPriceResult, AnnualPriceResult,
} from "./types";

import { SWEDEN_MARKET } from "./markets/sweden";
import { NORWAY_MARKET } from "./markets/norway";
import type { MarketConfig, MarketId, PricePoint } from "./types";

const MARKETS: Record<MarketId, MarketConfig> = {
  SE: SWEDEN_MARKET,
  NO: NORWAY_MARKET,
};

import {
  getMonthlyData, getAllMonthlyData, getAnnualData, getAllAnnualData, getAvailableYears,
} from "./sources/entsoe";
import { fetchHourlyPrices, ELPRISETJUSTNU_HISTORICAL_LIMIT } from "./sources/elprisetjustnu";

export function getMarket(marketId: MarketId): MarketConfig | null { return MARKETS[marketId] ?? null; }
export function getAllMarkets(): MarketConfig[] { return Object.values(MARKETS); }
export function getMonthlyPrices(marketId: MarketId, zoneId: string, year: number) { return getMonthlyData(marketId, zoneId, year); }
export function getAllMonthlyPrices(marketId: MarketId, zoneId: string) { return getAllMonthlyData(marketId, zoneId); }
export function getAnnualPrice(marketId: MarketId, zoneId: string, year: number) { return getAnnualData(marketId, zoneId, year); }
export function getAllAnnualPrices(marketId: MarketId, zoneId: string) { return getAllAnnualData(marketId, zoneId); }
export function getHistoricalYears(marketId: MarketId): number[] { return getAvailableYears(marketId); }

export async function getDailyPrices(marketId: MarketId, zoneId: string, date: string) {
  if (marketId !== "SE") {
    console.warn(`[prices] Live-priser ej implementerade for "${marketId}"`);
    return null;
  }
  if (date < ELPRISETJUSTNU_HISTORICAL_LIMIT) {
    console.warn(`[prices] Live-data saknas for ${date}`);
    return null;
  }
  return fetchHourlyPrices(date, zoneId as Parameters<typeof fetchHourlyPrices>[1]);
}

/**
 * Historisk timdata via Supabase. Stodjer ALLA marknader/zoner som
 * finns i spot_prices-tabellen (SE, NO, DK, DE, FI).
 */
export async function getHourlyPricesForYear(
  _marketId: MarketId, zoneId: string, year: number
): Promise<PricePoint[]> {
  const mod = await import("./sources/supabase");
  return mod.getHourlyPricesForYear(zoneId, year);
}

export async function getHourlyPricesForMonth(
  _marketId: MarketId, zoneId: string, year: number, month: number
): Promise<PricePoint[]> {
  const mod = await import("./sources/supabase");
  return mod.getHourlyPricesForMonth(zoneId, year, month);
}

export async function getHourlyPricesForRange(
  _marketId: MarketId, zoneId: string, from: Date, to: Date
): Promise<PricePoint[]> {
  const mod = await import("./sources/supabase");
  return mod.getHourlyPricesForRange(zoneId, from, to);
}

export const PRICE_MODULE_META = {
  version: "1.2.0",
  historicalSource: {
    name: "ENTSO-E Transparency Platform",
    endpoint: "Day-Ahead Prices (A44)",
    fetchedAt: "2026-04-24",
    coverage: "2020-01-01 / 2025-12-31",
    markets: ["SE1-4", "NO1-5", "DK1-2", "DE-LU", "FI"],
    note: "Manadsaggregat bundlade + timdata i Supabase spot_prices.",
  },
  historicalHourlySource: {
    name: "Supabase spot_prices",
    note: "Server-side. Stodjer SE+NO+DK+DE+FI via zoneId.",
  },
  liveSource: {
    name: "elprisetjustnu.se",
    coverage: "2022-11-01 / idag + imorgon",
    note: "Gratis, ingen API-nyckel. Timpriser, kvartspriser fr.o.m. 2025-10-01",
  },
} as const;
