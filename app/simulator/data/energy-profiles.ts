/**
 * Energy consumption profiles — seasonal, hourly, and housing-type data.
 */

import type { HousingType, HeatingType, BigConsumer } from "../types";

/**
 * Swedish seasonal factors — sum = 12.0
 * @source SCB & Energimyndigheten
 * @updated 2026-04-04
 * @notes Baserat på riksgenomsnittet for svenska villor med elvärme
 */
export const SEASON_FACTORS = [
  1.45, 1.35, 1.15, 0.95, 0.75, 0.60,
  0.55, 0.60, 0.80, 1.00, 1.25, 1.55,
];

/**
 * Hourly profile (24h) — baseload (appliances, lighting, cooking)
 * Normalized to sum ~1.0. Strong morning+evening peaks.
 * @source Energimyndigheten FESTIS campaign (400 hushåll, 2005-2008)
 * @updated 2026-04-10
 * @notes Typisk dygnsprofil för baslast (exkl. uppvärmning) i svensk villa
 */
export const HOURLY_PROFILE = [
  0.025, 0.022, 0.020, 0.020, 0.022, 0.028,
  0.045, 0.058, 0.060, 0.052, 0.048, 0.045,
  0.042, 0.040, 0.038, 0.040, 0.048, 0.062,
  0.065, 0.060, 0.055, 0.048, 0.038, 0.030,
];

/**
 * Hourly heating profile (24h) — how heating demand distributes over the day.
 * Not flat! Heat pumps/radiators work harder in morning (house cooled overnight)
 * and evening (family home, doors opening, comfort setpoint raised).
 * Midday is lower (solar gains, fewer occupants), night is moderate (continuous but lower setpoint).
 * @source Based on FESTIS metering + Chalmers DSM study for electrically heated villas
 * @updated 2026-04-10
 * @notes Multiplier around 1.0 average. Range ~0.75 (night low) to ~1.25 (morning peak).
 */
export const HEATING_HOURLY_PROFILE = [
//  00    01    02    03    04    05    06    07    08    09    10    11
  0.80, 0.78, 0.76, 0.75, 0.78, 0.88, 1.12, 1.25, 1.22, 1.10, 1.00, 0.95,
//  12    13    14    15    16    17    18    19    20    21    22    23
  0.92, 0.90, 0.88, 0.92, 1.02, 1.18, 1.22, 1.15, 1.08, 1.00, 0.92, 0.85,
];

/**
 * Peak-to-average ratio for monthly top-3 power peaks (kW).
 * Real households experience spikes when heavy loads overlap (heat pump +
 * cooking + hot water + dryer). The hourly simulation gives *average* kWh
 * per hour — the actual metered peak is significantly higher.
 *
 * Validated against Ellevio effekttoppar data (villa med bergvärme, 2024-2026):
 *   Actual winter peaks ~10-12 kW vs simulated ~5 kW → ratio ~2.0-2.4x
 *   Actual summer peaks ~5-7 kW vs simulated ~1.6-2 kW → ratio ~2.5-3.5x
 *
 * @source Empirical validation against Ellevio metered peak data
 * @updated 2026-04-10
 */
export const PEAK_TO_AVERAGE_RATIO: Record<HousingType, number> = {
  villa: 2.2,
  radhus: 2.0,
  lagenhet: 1.8,
};

/**
 * Housing type affects seasonal amplitude
 * @source Energimyndigheten
 * @updated 2026-04-04
 * @notes Lägenheter har lägre amplitud pga delad uppvärmning
 */
export const HOUSING_AMPLITUDE: Record<HousingType, number> = {
  villa: 1.0,
  radhus: 0.75,
  lagenhet: 0.45,
};

/**
 * Heating type determines share of electricity used for heating
 * @source Energimyndigheten
 * @updated 2026-04-04
 * @notes Andel av total elförbrukning som går till uppvärmning
 */
export const HEATING_SHARE: Record<HeatingType, number> = {
  direktel: 0.70,
  luftluft: 0.45,
  luftvatten: 0.35,
  fjarrvarme: 0.15,
  bergvarme: 0.30,
};

/** Reference area for area adjustment calculations (m²) */
export const REFERENCE_AREA = 120;

/**
 * Share of total consumption that is hot water
 * @source Energimyndigheten
 * @updated 2026-04-04
 * @notes Typiskt värde för svenskt hushåll
 */
export const HOT_WATER_SHARE = 0.15;

/**
 * EV charging profile — adds to hourly consumption (kWh per day ~8 kWh)
 * @source SCB & Trafikverket
 * @updated 2026-04-04
 * @notes Typiskt laddningsmönster: kvälls- och nattladdning
 */
export const EV_CHARGING_PROFILE = [
  0.5, 0.5, 0.5, 0.5, 0.3, 0.1,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.1,
  0.2, 0.3, 0.5, 0.8, 0.8, 0.6,
];

/**
 * Storförbrukarprofiler — månatligt kWh-tillskott
 * @source Energimyndigheten & branschdata
 * @updated 2026-04-04
 * @notes Uppskattade förbrukningsprofiler per storförbrukare
 */
export const BIG_CONSUMER_PROFILES: Record<BigConsumer, {
  label: string; icon: string;
  monthlyKwhAdded: number[];
}> = {
  elbil:  { label: "Elbil",  icon: "\u{1F697}", monthlyKwhAdded: [300,300,300,300,300,250,250,250,300,300,300,300] },
  pool:   { label: "Pool",   icon: "\u{1F3CA}", monthlyKwhAdded: [0,0,0,0,500,800,1000,1000,700,0,0,0] },
  spabad: { label: "Spabad", icon: "\u{1F6C1}", monthlyKwhAdded: [250,250,220,200,180,160,150,150,170,200,230,250] },
  bastu:  { label: "Bastu",  icon: "\u{1F9D6}", monthlyKwhAdded: [130,130,120,100,80,70,60,70,90,110,120,130] },
};

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];
