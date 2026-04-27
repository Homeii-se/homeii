/**
 * HOMEii - Framtidsscenarier (v2, zon-medveten)
 * =============================================
 * Anvander anvandarens SE-zon for att valja ratt multiplier (stalbom-scenario
 * paverkar SE1/SE2 mycket mer an SE3/SE4).
 */

import type { SEZone } from "../types";
import {
  computeHistoricalScenario,
  type HistoricalScenarioResult,
  type PriceResolutionChoice,
} from "./historical-scenario";
import {
  type ScenarioPreset,
  type HistoricalYearPreset,
  type ForeignMarketPreset,
  type ProjectionPreset,
  getProjectionMultiplier,
} from "../data/scenarios-presets";

async function fetchBasePrices(
  zone: string,
  year: number,
  fetchImpl: typeof fetch
): Promise<{ points: { timestamp: string; priceOreKwh: number }[] }> {
  const res = await fetchImpl(`/api/historical-prices?zone=${zone}&year=${year}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[future-scenario] Basdata saknas for ${zone} ${year}: ${res.status} ${body.slice(0, 200)}`
    );
  }
  return res.json();
}

function toHourlyArray(points: { priceOreKwh: number }[]): number[] {
  const arr = points.map((p) => p.priceOreKwh);
  if (arr.length >= 8760) return arr.slice(0, 8760);
  const avg = arr.reduce((s, v) => s + v, 0) / Math.max(arr.length, 1);
  while (arr.length < 8760) arr.push(avg);
  return arr;
}

const DE_SE3_APPROX_FACTOR = 1.55;
const DE_SE3_APPROX_NOTE =
  "Simulering baserad pa SE3-priser * DE/SE-snittfaktor 1.55 (ENTSO-E 2020-2024, exkl 2022). Ersatts av faktiska tyska priser nar de laddats i Supabase.";

function applyMultiplier(prices: number[], multiplier: number): number[] {
  return prices.map((p) => p * multiplier);
}

async function tryFetchRealForeignPrices(
  zone: string,
  year: number,
  fetchImpl: typeof fetch
): Promise<number[] | null> {
  try {
    const data = await fetchBasePrices(zone, year, fetchImpl);
    const arr = toHourlyArray(data.points);
    if (arr.length < 8760 || arr.every((v) => v === 0)) return null;
    return arr;
  } catch {
    return null;
  }
}

export interface ScenarioComputationMeta {
  method: "direct" | "projected" | "approximated";
  explanation: string;
  approximationFactor?: number;
  /** Vilken zonspecifik multiplier som anvandes (om projection). */
  appliedZoneMultiplier?: number;
}

export interface FutureScenarioResult {
  result: HistoricalScenarioResult;
  meta: ScenarioComputationMeta;
}

/**
 * Projektion: valjer multiplier baserat pa anvandarens zon.
 * Viktigt - anvander userZone (dar anvandaren BOR), inte preset.baseZone (varifrn prisdata hamtas).
 */
export async function fetchAndComputeProjection(
  preset: ProjectionPreset,
  gridImport8760: number[],
  userZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly",
  fetchImpl: typeof fetch = fetch
): Promise<FutureScenarioResult> {
  // Hamta priser fran ANVANDARENS zon (basYear 2025). Sedan multipliceras med
  // zonspecifik faktor sa SE1 far storre okning an SE3 for stalbom-scenariot.
  const base = await fetchBasePrices(userZone, preset.baseYear, fetchImpl);
  const basePrices = toHourlyArray(base.points);
  const mult = getProjectionMultiplier(preset, userZone);
  const projected = applyMultiplier(basePrices, mult);

  const projectedYear = preset.baseYear + preset.horizonYears;
  const result = computeHistoricalScenario(
    gridImport8760,
    projected,
    projectedYear,
    userZone,
    priceResolution
  );

  return {
    result,
    meta: {
      method: "projected",
      explanation: `${preset.baseYear} ars priser for ${userZone} skalas med ${mult.toFixed(2)}x till ${projectedYear}.`,
      approximationFactor: mult,
      appliedZoneMultiplier: mult,
    },
  };
}

export async function fetchAndComputeForeignMarket(
  preset: ForeignMarketPreset,
  gridImport8760: number[],
  userZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly",
  fetchImpl: typeof fetch = fetch
): Promise<FutureScenarioResult> {
  const realPrices = await tryFetchRealForeignPrices(
    preset.foreignZoneId,
    preset.referenceYear,
    fetchImpl
  );

  if (realPrices) {
    const result = computeHistoricalScenario(
      gridImport8760,
      realPrices,
      preset.referenceYear,
      userZone, // metadata - var anvandaren bor
      priceResolution
    );
    return {
      result,
      meta: {
        method: "direct",
        explanation: `Faktiska ${preset.foreignMarketId} day-ahead-priser fran ENTSO-E ${preset.referenceYear}.`,
      },
    };
  }

  // Fallback: userZone * DE/SE-faktor
  const base = await fetchBasePrices(userZone, preset.referenceYear, fetchImpl);
  const basePrices = toHourlyArray(base.points);
  const approximated = applyMultiplier(basePrices, DE_SE3_APPROX_FACTOR);

  const result = computeHistoricalScenario(
    gridImport8760,
    approximated,
    preset.referenceYear,
    userZone,
    priceResolution
  );

  return {
    result,
    meta: {
      method: "approximated",
      explanation: DE_SE3_APPROX_NOTE,
      approximationFactor: DE_SE3_APPROX_FACTOR,
    },
  };
}

export async function fetchAndComputeHistoricalYear(
  preset: HistoricalYearPreset,
  gridImport8760: number[],
  userZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly",
  fetchImpl: typeof fetch = fetch
): Promise<FutureScenarioResult> {
  // Hamta anvandarens zon for det aret - inte preset.zone. Viktigt sa att
  // en SE4-bo far sin zons 2022-priser, inte SE3:s.
  const base = await fetchBasePrices(userZone, preset.year, fetchImpl);
  const prices = toHourlyArray(base.points);
  const result = computeHistoricalScenario(
    gridImport8760,
    prices,
    preset.year,
    userZone,
    priceResolution
  );
  return {
    result,
    meta: {
      method: "direct",
      explanation: `Faktiska ENTSO-E day-ahead-priser ${userZone} ${preset.year}.`,
    },
  };
}

/** Enhetlig dispatcher - anvandarens zon skickas med sa rätt multiplier valjs. */
export async function computeScenarioFromPreset(
  preset: ScenarioPreset,
  gridImport8760: number[],
  userZone: SEZone,
  priceResolution: PriceResolutionChoice = "hourly",
  fetchImpl: typeof fetch = fetch
): Promise<FutureScenarioResult> {
  switch (preset.kind) {
    case "historical-year":
      return fetchAndComputeHistoricalYear(preset, gridImport8760, userZone, priceResolution, fetchImpl);
    case "foreign-market":
      return fetchAndComputeForeignMarket(preset, gridImport8760, userZone, priceResolution, fetchImpl);
    case "projection":
      return fetchAndComputeProjection(preset, gridImport8760, userZone, priceResolution, fetchImpl);
    default: {
      const _exhaust: never = preset;
      throw new Error(`[future-scenario] Unknown preset kind: ${JSON.stringify(_exhaust)}`);
    }
  }
}
