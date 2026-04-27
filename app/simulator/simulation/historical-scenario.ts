/**
 * HOMEii - Historisk scenariomotor
 * ==================================
 * Svarar pa fragan: "Om X ars spotpriser kom tillbaka, vad skulle det kosta?"
 *
 * Metod: Ta anvandarens 8760-timprofil (gridImport per timme) och multiplicera
 * med faktiska ENTSO-E-priser fran valt ar. Natavgifter, elskatt och
 * elhandelspaslag halls pa DAGENS niva.
 *
 * Prisupplosning (VIKTIGT for att visa vardet av timavtal):
 *   "hourly"  - Anvand faktiska timpriser. Belonar smart styrning (flytta
 *               forbrukning till billiga timmar, batterier, solcellsegenanvandning).
 *   "monthly" - Anvand manadsnitt. Samma pris alla timmar inom samma manad.
 *               Simulerar ett manadsavtal dar timvariationer inte spelar nagon roll.
 *
 * Skillnaden mellan dessa tva = den potentiella vinsten med ett timavtal.
 */

import type { SEZone } from "../types";

// ============================================================
// Typer
// ============================================================

export type PriceResolutionChoice = "hourly" | "monthly";

export interface HistoricalScenarioResult {
  year: number;
  seZone: SEZone;
  /** Vilken prisupplosning som anvandes */
  priceResolution: PriceResolutionChoice;
  totalSpotCostKr: number;
  totalSpotCostKrExMoms: number;
  weightedAvgOreKwh: number;
  unweightedAvgOreKwh: number;
  monthlySpotCostKr: number[];
  monthlySpotCostKrExMoms: number[];
  monthlyAvgOreKwh: number[];
  totalGridImportKwh: number;
  priceHoursUsed: number;
  dataSource: {
    source: "entsoe";
    fetchedFrom: "supabase";
    generatedAt: string;
  };
}

export interface HistoricalScenarioComparison {
  year: number;
  seZone: SEZone;
  hourly: HistoricalScenarioResult;
  monthly: HistoricalScenarioResult;
  /** Manadsavtal - timavtal. Positiv = timavtal ar billigare. */
  savingsFromHourlyKr: number;
  /** Som procent av manadsavtalskostnaden */
  savingsFromHourlyPct: number;
}

// ============================================================
// Interna helpers
// ============================================================

const VAT = 1.25;

function alignTo8760(prices: { timestamp: string; priceOreKwh: number }[]): number[] {
  const arr = prices.map((p) => p.priceOreKwh);
  if (arr.length >= 8760) return arr.slice(0, 8760);
  const avg = arr.reduce((s, v) => s + v, 0) / Math.max(arr.length, 1);
  while (arr.length < 8760) arr.push(avg);
  return arr;
}

/** Hour-of-year (0-8759) till manad (0-11). Icke-skottar. */
const MONTH_INDEX_8760: number[] = (() => {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const idx: number[] = new Array(8760);
  let h = 0;
  for (let m = 0; m < 12; m++) {
    for (let d = 0; d < daysInMonth[m]; d++) {
      for (let hr = 0; hr < 24; hr++) idx[h++] = m;
    }
  }
  return idx;
})();

/** Berakna manadsnitt fran timpriser. Returnerar 12 varden. */
function monthlyAveragesFromHourly(hourlyPrices: number[]): number[] {
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (let i = 0; i < 8760; i++) {
    const m = MONTH_INDEX_8760[i];
    sums[m] += hourlyPrices[i];
    counts[m] += 1;
  }
  return sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
}

/** Utjamna timpriser till manadsnitt (samma pris alla timmar i samma manad). */
function smoothToMonthly(hourlyPrices: number[]): number[] {
  const monthAvgs = monthlyAveragesFromHourly(hourlyPrices);
  return MONTH_INDEX_8760.map((m) => monthAvgs[m]);
}

// ============================================================
// Publik API: ren beraknaingsfunktion
// ============================================================

/**
 * Berakna historisk scenariokostnad fran en timprofil + en rad timpriser.
 *
 * @param gridImport8760  - 8760 varden, gridImport kWh per timme
 * @param hourlyPrices    - minst 8760 varden, spot ore/kWh exkl moms
 * @param year            - Aret
 * @param seZone          - Zon (metadata)
 * @param priceResolution - "hourly" (default) eller "monthly" (utjamnat)
 */
export function computeHistoricalScenario(
  gridImport8760: number[],
  hourlyPrices: number[],
  year: number,
  seZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly"
): HistoricalScenarioResult {
  if (gridImport8760.length !== 8760) {
    throw new Error(
      `[historical-scenario] gridImport8760 maste vara 8760 lang (fick ${gridImport8760.length})`
    );
  }
  if (hourlyPrices.length < 8760) {
    throw new Error(
      `[historical-scenario] behover 8760 timpriser (fick ${hourlyPrices.length})`
    );
  }

  const basePrices = hourlyPrices.slice(0, 8760);
  const prices =
    priceResolution === "monthly" ? smoothToMonthly(basePrices) : basePrices;

  let totalOreExMoms = 0;
  let totalKwh = 0;
  let totalPriceWeighted = 0;
  const monthlyOreExMoms = new Array(12).fill(0);
  const monthlyPriceSum = new Array(12).fill(0);
  const monthlyHourCount = new Array(12).fill(0);

  for (let i = 0; i < 8760; i++) {
    const kwh = gridImport8760[i];
    const ore = prices[i];
    const hourCostOre = kwh * ore;
    totalOreExMoms += hourCostOre;
    totalKwh += kwh;
    totalPriceWeighted += ore * kwh;

    const m = MONTH_INDEX_8760[i];
    monthlyOreExMoms[m] += hourCostOre;
    monthlyPriceSum[m] += ore;
    monthlyHourCount[m] += 1;
  }

  const totalSpotCostKrExMoms = totalOreExMoms / 100;
  const totalSpotCostKr = totalSpotCostKrExMoms * VAT;

  const weightedAvg = totalKwh > 0 ? totalPriceWeighted / totalKwh : 0;
  const unweightedAvg = prices.reduce((s, v) => s + v, 0) / prices.length;

  const monthlySpotCostKrExMoms = monthlyOreExMoms.map((o) => o / 100);
  const monthlySpotCostKr = monthlySpotCostKrExMoms.map((kr) => kr * VAT);
  const monthlyAvgOreKwh = monthlyPriceSum.map((sum, i) =>
    monthlyHourCount[i] > 0 ? sum / monthlyHourCount[i] : 0
  );

  return {
    year,
    seZone,
    priceResolution,
    totalSpotCostKr: Math.round(totalSpotCostKr),
    totalSpotCostKrExMoms: Math.round(totalSpotCostKrExMoms),
    weightedAvgOreKwh: Math.round(weightedAvg * 100) / 100,
    unweightedAvgOreKwh: Math.round(unweightedAvg * 100) / 100,
    monthlySpotCostKr: monthlySpotCostKr.map((v) => Math.round(v)),
    monthlySpotCostKrExMoms: monthlySpotCostKrExMoms.map((v) => Math.round(v)),
    monthlyAvgOreKwh: monthlyAvgOreKwh.map((v) => Math.round(v * 10) / 10),
    totalGridImportKwh: Math.round(totalKwh),
    priceHoursUsed: prices.length,
    dataSource: {
      source: "entsoe",
      fetchedFrom: "supabase",
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Kor bade tim- och manadsavtal, returnera jamforelse.
 * Skillnaden = vardet av timavtal for denna profil detta ar.
 */
export function computeHistoricalComparison(
  gridImport8760: number[],
  hourlyPrices: number[],
  year: number,
  seZone: SEZone
): HistoricalScenarioComparison {
  const hourly = computeHistoricalScenario(gridImport8760, hourlyPrices, year, seZone, "hourly");
  const monthly = computeHistoricalScenario(gridImport8760, hourlyPrices, year, seZone, "monthly");
  const savings = monthly.totalSpotCostKr - hourly.totalSpotCostKr;
  const pct = monthly.totalSpotCostKr > 0 ? (savings / monthly.totalSpotCostKr) * 100 : 0;
  return {
    year,
    seZone,
    hourly,
    monthly,
    savingsFromHourlyKr: savings,
    savingsFromHourlyPct: Math.round(pct * 10) / 10,
  };
}

// ============================================================
// Client-side helpers
// ============================================================

async function fetchHourlyPrices(
  year: number,
  seZone: SEZone,
  fetchImpl: typeof fetch
): Promise<number[]> {
  const res = await fetchImpl(
    `/api/historical-prices?zone=${seZone}&year=${year}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[historical-scenario] Kunde inte hamta priser for ${seZone} ${year}: ${res.status} ${body.slice(0, 200)}`
    );
  }
  const json = (await res.json()) as {
    points: { timestamp: string; priceOreKwh: number }[];
    count: number;
  };
  return alignTo8760(json.points);
}

/** Hamta priser + kor motorn. priceResolution valbar. */
export async function fetchAndComputeHistoricalScenario(
  year: number,
  gridImport8760: number[],
  seZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly",
  fetchImpl: typeof fetch = fetch
): Promise<HistoricalScenarioResult> {
  const prices = await fetchHourlyPrices(year, seZone, fetchImpl);
  return computeHistoricalScenario(gridImport8760, prices, year, seZone, priceResolution);
}

/** Hamta priser + kor BADE timavtal och manadsavtal. Ett fetch, tva rakningar. */
export async function fetchAndCompareHistorical(
  year: number,
  gridImport8760: number[],
  seZone: SEZone,
  fetchImpl: typeof fetch = fetch
): Promise<HistoricalScenarioComparison> {
  const prices = await fetchHourlyPrices(year, seZone, fetchImpl);
  return computeHistoricalComparison(gridImport8760, prices, year, seZone);
}

/** Hamta och jamfor flera ar parallellt. */
export async function compareHistoricalYears(
  years: number[],
  gridImport8760: number[],
  seZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly",
  fetchImpl: typeof fetch = fetch
): Promise<HistoricalScenarioResult[]> {
  return Promise.all(
    years.map((y) => fetchAndComputeHistoricalScenario(y, gridImport8760, seZone, priceResolution, fetchImpl))
  );
}

export const HISTORICAL_YEARS_AVAILABLE = [2020, 2021, 2022, 2023, 2024, 2025] as const;
