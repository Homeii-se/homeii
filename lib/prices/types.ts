/**
 * HOMEii – Prismodul: Marknadsagnostiska typer
 * ============================================
 * Alla typer är designade för att fungera för valfri elmarknad –
 * Sverige, Norge, Tyskland, etc. Inga svenska-specifika antaganden här.
 *
 * Lägg till en ny marknad: skapa lib/prices/markets/<land>.ts
 * och implementera MarketConfig-interfacet.
 */

// ── Identifierare ──────────────────────────────────────────────────────────────

/** Unik identifierare för en elmarknad, t.ex. "SE", "NO", "DE" */
export type MarketId = string;

/** Unik identifierare för ett elområde, t.ex. "SE3", "NO1", "DE-LU" */
export type ZoneId = string;

/** Prisupplösning */
export type PriceResolution = "hourly" | "quarterly" | "daily" | "monthly" | "annual";

/** Datakälla */
export type DataSourceId = "entsoe" | "elprisetjustnu" | "nordpool" | "mock";

// ── Prispunkter ────────────────────────────────────────────────────────────────

/**
 * En enskild prispunkt – upplösningsagnostisk.
 * Kan representera ett timpris, kvartspris, dagsnitt eller månadssnitt.
 */
export interface PricePoint {
  /** ISO 8601 tidsstämpel för periodens start (UTC) */
  timestamp: string;
  /** Spotpris i öre/kWh exkl. moms, nätavgift och energiskatt */
  priceOreKwh: number;
  /** Upplösning för denna datapunkt */
  resolution: PriceResolution;
  /** Elområde */
  zoneId: ZoneId;
  /** Datakälla */
  source: DataSourceId;
}

/**
 * Månadsaggregat – förkompilerat för snabb visning.
 */
export interface MonthlyPriceSummary {
  year: number;
  month: number; // 1–12
  zoneId: ZoneId;
  avgOreKwh: number;
  minOreKwh?: number;
  maxOreKwh?: number;
  source: DataSourceId;
}

/**
 * Årsaggregat.
 */
export interface AnnualPriceSummary {
  year: number;
  zoneId: ZoneId;
  avgOreKwh: number;
  source: DataSourceId;
  /** Sant om bara delar av året finns (t.ex. innevarande år) */
  partial?: boolean;
}

// ── Marknadsconfig ─────────────────────────────────────────────────────────────

/** Information om ett elområde */
export interface ZoneInfo {
  id: ZoneId;
  /** Visningsnamn */
  label: string;
  /** Kortnamn / stad */
  shortLabel: string;
  /** Landkod ISO 3166-1 alpha-2 */
  countryCode: string;
  /** Ungefärlig geografisk mittpunkt */
  center?: { lat: number; lng: number };
}

/**
 * Konfiguration för en elmarknad.
 * Implementeras av varje marknadsfil i lib/prices/markets/.
 */
export interface MarketConfig {
  id: MarketId;
  name: string;
  /** Valuta (ISO 4217) */
  currency: "SEK" | "NOK" | "EUR" | "DKK";
  /** Alla elområden på marknaden */
  zones: ZoneInfo[];
  /** Vilka datakällor som används, i prioritetsordning */
  sources: DataSourceId[];
  /** Minsta historiska år med data */
  historicalFrom: number;
  /** Stöds live-priser (dagens/morgondagens)? */
  supportsLivePrices: boolean;
  /** Stöds kvartsupplösning? (fr.o.m. datum) */
  quarterlyFrom?: string; // ISO date
}

// ── Frågetyper ─────────────────────────────────────────────────────────────────

/** Parametrar för att hämta priser */
export interface PriceQuery {
  marketId: MarketId;
  zoneId: ZoneId;
  resolution: PriceResolution;
  /** Startdatum YYYY-MM-DD (inkl.) */
  from: string;
  /** Slutdatum YYYY-MM-DD (inkl.) */
  to: string;
}

/** Svar från prismodulen */
export interface PriceResult {
  query: PriceQuery;
  data: PricePoint[];
  source: DataSourceId;
  /** Tidsstämpel för när data hämtades */
  fetchedAt: string;
  /** Varningsmeddelanden, t.ex. om delar av intervallet saknas */
  warnings?: string[];
}

/** Svar med förberäknade månadsaggregat */
export interface MonthlyPriceResult {
  marketId: MarketId;
  zoneId: ZoneId;
  year: number;
  months: MonthlyPriceSummary[];
  source: DataSourceId;
}

/** Svar med förberäknade årsaggregat */
export interface AnnualPriceResult {
  marketId: MarketId;
  zoneId: ZoneId;
  years: AnnualPriceSummary[];
  source: DataSourceId;
}
