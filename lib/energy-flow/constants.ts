import type { Season, StodtjanstEvent } from "./types";

/**
 * Spotpriser per timme och säsong (öre/kWh) — typvärden för svensk SE3.
 * Index = timme 0–23.
 *
 * Vinter har dramatisk dygnsvariation (56 öre nattetid, 410 öre
 * kvällspeak); sommar har "duck curve" med nära-noll runt midsommar-middag.
 */
export const PRICES: Record<Season, number[]> = {
  vinter: [
    128, 82, 67, 56, 67, 108, 230, 369, 343, 200, 143, 123, 113, 131, 164, 220,
    317, 405, 410, 374, 266, 189, 154, 141,
  ],
  host: [
    50, 32, 25, 20, 25, 40, 100, 175, 130, 75, 45, 30, 22, 28, 48, 80, 120, 195,
    240, 175, 120, 85, 65, 55,
  ],
  sommar: [
    40, 28, 18, 10, 14, 28, 65, 150, 105, 35, 5, 0, 0, 0, 0, 3, 25, 75, 180,
    225, 135, 80, 55, 42,
  ],
};

/**
 * Sol-uppgång och sol-nedgång per säsong (decimal-timmar).
 * Används för att avgöra när sol-produktion kan ske.
 *
 * UI-konstanter som peakY för SVG-bågen lever i visualiseringskomponenten,
 * inte här.
 */
export const SOL_HOURS: Record<Season, { rise: number; set: number }> = {
  vinter: { rise: 8.5, set: 15.5 },
  host: { rise: 7, set: 17 },
  sommar: { rise: 4.5, set: 21.5 },
};

/**
 * Frekvensreserv-event (FCR-D/N) där batteriet kan stötta Svenska Kraftnät
 * och få betalt. 3 korta event per dygn, totalt 17 kr/dygn.
 *
 * Aktiveras endast när hushållet har både batteri och smart styrning.
 */
export const STODTJANST_EVENTS: StodtjanstEvent[] = [
  { startMin: 555, endMin: 645, kr: 6 }, // 09:15–10:45
  { startMin: 825, endMin: 915, kr: 4 }, // 13:45–15:15
  { startMin: 1110, endMin: 1200, kr: 7 }, // 18:30–20:00
];

export const STODTJANST_DAY_TOTAL = STODTJANST_EVENTS.reduce(
  (s, e) => s + e.kr,
  0,
);

// ── Hushållsutrustning ──────────────────────────────────────────────

/** Batteriets kapacitet (kWh). */
export const BAT_CAP = 10;
/** Batteriets max effekt (kW), både laddning och urladdning. */
export const BAT_RATE = 5;

/** Elbilens batterikapacitet (kWh). */
export const EV_CAP = 100;
/** EV-räckvidd vid lägsta SOC (mil). */
export const EV_MIL_MIN = 30;
/** EV-räckvidd vid full SOC (mil). */
export const EV_MIL_MAX = 50;
/** Energiåtgång per mil körning (kWh). EV_MIL_MAX × KWH_PER_MIL = EV_CAP. */
export const KWH_PER_MIL = 2.0;
/** Max EV-laddningseffekt (kW). */
export const EV_RATE = 5;
/** V2H peak discharge (kW) under morgon-/kvällspeak. Off-peak: 2 kW. */
export const V2H_RATE = 4;
/** Mil/h som körs under bortrest-fönstret 15:00–20:00. */
export const DRIVE_PER_HOUR = 2.5;

// ── Värme och kylning ──────────────────────────────────────────────

/** Värmepumpens COP (effektförhållande för värme). */
export const COP_HEAT = 3.2;
/** Värmepumpens COP i kylläge (sommar AC). */
export const COP_COOL = 3.0;
/** Inomhustemp där AC-kylning aktiveras (°C). */
export const COOLING_THRESHOLD = 22;

// ── Säsongsviktning ─────────────────────────────────────────────────

/**
 * Antal dagar per säsong i ett år. Höst inkluderar både vår och höst
 * (samma typvärden). Total = 360, vilket är en grov approximation av 365.
 */
export const SEASON_DAYS: Record<Season, number> = {
  vinter: 90,
  host: 180,
  sommar: 90,
};

// ── Övriga konstanter ──────────────────────────────────────────────

/** Visuell maxnivå för "EFFEKT JUST NU"-mätaren (kW). */
export const MAX_KW = 10;

/** Effektavgift (kr/kW/dag) — motsvarar 100 kr/månad/kW på elnätet. */
export const EFFEKTAVGIFT_PER_KW_PER_DAY = 3;

/** Säsongsspecifika peak-shaving-tak (kW) som smart system håller sig under. */
export const PEAK_CAP: Record<Season, number> = {
  vinter: 8,
  host: 5,
  sommar: 2,
};
