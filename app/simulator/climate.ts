/**
 * Climate data per SE-zone.
 *
 * Sources:
 * - Temperatures: SMHI normalvärden 1991-2020 (representative cities per zone)
 * - Solar production: PVGIS 5.2, 10 kWp, optimal tilt south, 14% system losses
 * - Heating degree days: derived from temperature data (base 17°C)
 *
 * Each zone uses a representative city:
 *   SE1: Luleå (65.6°N)    — subarctic, very cold winters, midnight sun
 *   SE2: Sundsvall (62.4°N) — cold winters, moderate summers
 *   SE3: Stockholm (59.3°N) — temperate, most populated zone
 *   SE4: Malmö (55.6°N)     — mildest, closest to continental climate
 */

import type { SEZone } from "./types";

export interface ZoneClimateData {
  /** Representative city name */
  city: string;
  /** Latitude for solar calculations */
  latitude: number;
  /** Average monthly temperatures °C (Jan-Dec), SMHI 1991-2020 */
  monthlyTemp: number[];
  /** Monthly solar production kWh for a 10 kWp system (PVGIS) */
  solarMonthly10kw: number[];
  /** Solar hourly profile blend factor per month (0=winter, 1=summer) */
  solarSeasonBlend: number[];
  /** Solar hourly profile for long summer days */
  solarHourlySummer: number[];
  /** Solar hourly profile for short winter days */
  solarHourlyWinter: number[];
  /** Heating season: months where average temp < 17°C (heating needed) */
  heatingMonths: boolean[];
}

/**
 * SMHI normalvärden 1991-2020
 * Source: https://www.smhi.se/klimat/klimatet-da-och-nu/
 */
const ZONE_CLIMATE: Record<SEZone, ZoneClimateData> = {
  SE1: {
    city: "Luleå",
    latitude: 65.6,
    monthlyTemp: [-10, -9.5, -5, 1, 7, 14, 17, 15, 9, 3, -3, -8],
    // PVGIS: 10kWp Luleå, 65.6°N, 40° tilt south — ~7200 kWh/year
    // Very low winter (polar darkness), very high summer (midnight sun effect)
    solarMonthly10kw: [30, 120, 450, 850, 1100, 1200, 1150, 900, 500, 200, 50, 10],
    solarSeasonBlend: [0.0, 0.05, 0.25, 0.50, 0.80, 1.0, 1.0, 0.85, 0.55, 0.25, 0.05, 0.0],
    solarHourlySummer: [
      0.00, 0.00, 0.01, 0.02, 0.04, 0.06,
      0.08, 0.09, 0.10, 0.11, 0.11, 0.11,
      0.11, 0.10, 0.09, 0.08, 0.06, 0.04,
      0.03, 0.02, 0.01, 0.00, 0.00, 0.00,
    ],
    solarHourlyWinter: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
      0.00, 0.00, 0.00, 0.10, 0.20, 0.25,
      0.25, 0.15, 0.05, 0.00, 0.00, 0.00,
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    ],
    heatingMonths: [true, true, true, true, true, true, false, true, true, true, true, true],
  },

  SE2: {
    city: "Sundsvall",
    latitude: 62.4,
    monthlyTemp: [-7, -6.5, -2, 3, 9, 15, 18, 16, 11, 5, -1, -5],
    // PVGIS: 10kWp Sundsvall, 62.4°N — ~7800 kWh/year
    solarMonthly10kw: [60, 180, 520, 900, 1150, 1250, 1180, 980, 600, 280, 80, 25],
    solarSeasonBlend: [0.0, 0.08, 0.28, 0.52, 0.80, 0.95, 1.0, 0.88, 0.58, 0.30, 0.08, 0.0],
    solarHourlySummer: [
      0.00, 0.00, 0.00, 0.02, 0.04, 0.06,
      0.08, 0.09, 0.10, 0.11, 0.12, 0.12,
      0.11, 0.10, 0.09, 0.08, 0.06, 0.04,
      0.02, 0.01, 0.00, 0.00, 0.00, 0.00,
    ],
    solarHourlyWinter: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
      0.00, 0.00, 0.02, 0.10, 0.18, 0.22,
      0.22, 0.16, 0.08, 0.02, 0.00, 0.00,
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    ],
    heatingMonths: [true, true, true, true, true, true, false, true, true, true, true, true],
  },

  SE3: {
    city: "Stockholm",
    latitude: 59.3,
    monthlyTemp: [-3, -3, 1, 6, 12, 17, 20, 18, 13, 7, 2, -1],
    // PVGIS: 10kWp Stockholm, 59.3°N — ~8470 kWh/year
    solarMonthly10kw: [180, 320, 680, 1000, 1200, 1280, 1220, 1050, 750, 430, 220, 140],
    solarSeasonBlend: [0.05, 0.15, 0.35, 0.55, 0.80, 0.95, 1.00, 0.90, 0.65, 0.40, 0.15, 0.05],
    solarHourlySummer: [
      0.00, 0.00, 0.00, 0.00, 0.02, 0.04,
      0.06, 0.08, 0.10, 0.11, 0.12, 0.12,
      0.12, 0.11, 0.10, 0.08, 0.06, 0.04,
      0.02, 0.01, 0.00, 0.00, 0.00, 0.00,
    ],
    solarHourlyWinter: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
      0.00, 0.00, 0.04, 0.10, 0.16, 0.20,
      0.20, 0.16, 0.10, 0.04, 0.00, 0.00,
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    ],
    heatingMonths: [true, true, true, true, true, false, false, false, true, true, true, true],
  },

  SE4: {
    city: "Malmö",
    latitude: 55.6,
    monthlyTemp: [0, 0, 3, 8, 13, 17, 19, 19, 15, 9, 5, 2],
    // PVGIS: 10kWp Malmö, 55.6°N — ~9100 kWh/year (more sun, lower latitude)
    solarMonthly10kw: [220, 380, 720, 1050, 1250, 1350, 1300, 1120, 820, 480, 260, 160],
    solarSeasonBlend: [0.08, 0.18, 0.38, 0.58, 0.82, 0.95, 1.00, 0.92, 0.68, 0.42, 0.18, 0.08],
    solarHourlySummer: [
      0.00, 0.00, 0.00, 0.00, 0.02, 0.04,
      0.06, 0.08, 0.10, 0.12, 0.12, 0.12,
      0.12, 0.11, 0.10, 0.08, 0.06, 0.04,
      0.02, 0.00, 0.00, 0.00, 0.00, 0.00,
    ],
    solarHourlyWinter: [
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
      0.00, 0.00, 0.06, 0.12, 0.17, 0.20,
      0.20, 0.14, 0.08, 0.03, 0.00, 0.00,
      0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
    ],
    heatingMonths: [true, true, true, true, true, false, false, false, true, true, true, true],
  },
};

export function getZoneClimate(zone: SEZone): ZoneClimateData {
  return ZONE_CLIMATE[zone];
}

/**
 * Get temperature for a specific zone, date, and hour.
 * Interpolates between months and applies diurnal variation.
 */
export function getTemperature(zone: SEZone, date: Date, hour: number): number {
  const climate = ZONE_CLIMATE[zone];
  const month = date.getMonth();
  const day = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), month + 1, 0).getDate();

  // Interpolate monthly base temperature
  const t = (day - 1) / daysInMonth;
  const nextMonth = (month + 1) % 12;
  const baseTemp =
    climate.monthlyTemp[month] * (1 - t) +
    climate.monthlyTemp[nextMonth] * t;

  // Diurnal variation — amplitude depends on latitude and season
  // Higher latitude = larger summer variation, smaller winter variation
  const latFactor = climate.latitude / 60; // normalized around Stockholm
  const summerAmplitude = 5 * latFactor;
  const winterAmplitude = 3 / latFactor;
  const seasonBlend = climate.solarSeasonBlend[month];
  const amplitude = winterAmplitude * (1 - seasonBlend) + summerAmplitude * seasonBlend;

  // Diurnal curve: min at 04:00, max at 14:00
  const hourAngle = ((hour - 4) / 24) * 2 * Math.PI;
  const diurnal = -Math.cos(hourAngle) * amplitude;

  return baseTemp + diurnal;
}

/**
 * Get solar production for a specific zone, date, hour, and system size.
 */
export function getSolarProduction(zone: SEZone, date: Date, hour: number, solarSizeKw: number = 10): number {
  const climate = ZONE_CLIMATE[zone];
  const month = date.getMonth();
  const day = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), month + 1, 0).getDate();

  // Interpolate monthly total
  const t = (day - 1) / daysInMonth;
  const nextMonth = (month + 1) % 12;
  const monthlyTotal =
    climate.solarMonthly10kw[month] * (1 - t) +
    climate.solarMonthly10kw[nextMonth] * t;

  const dailyTotal = monthlyTotal / daysInMonth;

  // Blend hourly profile between summer and winter
  const blend =
    climate.solarSeasonBlend[month] * (1 - t) +
    climate.solarSeasonBlend[nextMonth] * t;
  const hourlyWeight =
    climate.solarHourlyWinter[hour] * (1 - blend) +
    climate.solarHourlySummer[hour] * blend;

  return dailyTotal * hourlyWeight * (solarSizeKw / 10);
}

/**
 * Calculate heating degree hours for a zone and month.
 * Base temperature 17°C (Swedish standard).
 * Returns total degree-hours for the month (used for energy need calculation).
 */
export function getHeatingDegreeHours(zone: SEZone, monthIdx: number): number {
  const year = new Date().getFullYear();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const baseTemp = 17; // Swedish standard indoor-outdoor balance point

  let totalDegreeHours = 0;
  const repDate = new Date(year, monthIdx, 15);

  for (let h = 0; h < 24; h++) {
    const temp = getTemperature(zone, repDate, h);
    if (temp < baseTemp) {
      totalDegreeHours += (baseTemp - temp);
    }
  }

  // Scale from representative day to full month
  return totalDegreeHours * daysInMonth;
}

/**
 * Calculate monthly season factors based on actual heating degree hours.
 * This replaces the old static SEASON_FACTORS with physics-based factors.
 *
 * The idea: total annual consumption = baseload + heating.
 * Baseload is flat across months. Heating varies with degree hours.
 */
export function calculateSeasonFactors(
  zone: SEZone,
  heatingShareOfTotal: number
): number[] {
  const degreeHoursPerMonth: number[] = [];
  for (let m = 0; m < 12; m++) {
    degreeHoursPerMonth.push(getHeatingDegreeHours(zone, m));
  }

  const totalDH = degreeHoursPerMonth.reduce((s, v) => s + v, 0);
  if (totalDH === 0) return new Array(12).fill(1.0);

  // Each month's factor = baseload_share + heating_share * (month_DH / avg_DH)
  const avgDH = totalDH / 12;
  const baseloadShare = 1 - heatingShareOfTotal;

  return degreeHoursPerMonth.map((dh) => {
    const heatingFactor = avgDH > 0 ? dh / avgDH : 0;
    return baseloadShare + heatingShareOfTotal * heatingFactor;
  });
}

/**
 * Price scenario parameters for sensitivity analysis.
 */
export interface PriceScenario {
  /** Label for display */
  label: string;
  /** Annual electricity price change (e.g. 0.03 = +3%/year) */
  annualPriceChange: number;
  /** Annual grid fee change */
  annualGridFeeChange: number;
  /** Price volatility multiplier (1.0 = current, 1.5 = 50% more volatile) */
  volatilityMultiplier: number;
}

/**
 * @source Energimyndigheten långtidsprognos 2023, Ei nätavgiftsrapport 2024
 * @updated 2026-04-04
 */
export const PRICE_SCENARIOS: Record<string, PriceScenario> = {
  base: {
    label: "Basscenario",
    annualPriceChange: 0.02,
    annualGridFeeChange: 0.03,
    volatilityMultiplier: 1.0,
  },
  below_inflation: {
    label: "Under inflation",
    annualPriceChange: -0.01,
    annualGridFeeChange: 0.02,
    volatilityMultiplier: 0.8,
  },
  above_inflation: {
    label: "Över inflation",
    annualPriceChange: 0.05,
    annualGridFeeChange: 0.05,
    volatilityMultiplier: 1.3,
  },
  eu_harmonization: {
    label: "EU-harmonisering",
    annualPriceChange: 0.04,
    annualGridFeeChange: 0.06,
    volatilityMultiplier: 1.5,
  },
};

/**
 * Project costs over multiple years under a given price scenario.
 * Returns array of yearly costs [year0, year1, ... yearN].
 */
export function projectCostsOverTime(
  baseYearlyCostKr: number,
  baseGridFeeYearlyKr: number,
  scenario: PriceScenario,
  years: number
): { year: number; energyCostKr: number; gridFeeCostKr: number; totalCostKr: number }[] {
  const result = [];
  for (let y = 0; y <= years; y++) {
    const energyCost = Math.round(baseYearlyCostKr * Math.pow(1 + scenario.annualPriceChange, y));
    const gridFee = Math.round(baseGridFeeYearlyKr * Math.pow(1 + scenario.annualGridFeeChange, y));
    result.push({
      year: y,
      energyCostKr: energyCost,
      gridFeeCostKr: gridFee,
      totalCostKr: energyCost + gridFee,
    });
  }
  return result;
}

/**
 * Calculate NPV (net present value) of savings from an investment.
 * discountRate = annual discount rate (e.g. 0.04 = 4%)
 */
export function calculateNPV(
  investmentCostKr: number,
  yearlySavingsKr: number,
  lifespanYears: number,
  scenario: PriceScenario,
  discountRate: number = 0.04
): { npv: number; realPaybackYears: number | null } {
  let npv = -investmentCostKr;
  let realPaybackYears: number | null = null;
  let cumulativeSavings = -investmentCostKr;

  for (let y = 1; y <= lifespanYears; y++) {
    // Savings grow with electricity price changes
    const adjustedSavings = yearlySavingsKr * Math.pow(1 + scenario.annualPriceChange, y);
    const discountedSavings = adjustedSavings / Math.pow(1 + discountRate, y);
    npv += discountedSavings;
    cumulativeSavings += adjustedSavings;

    if (cumulativeSavings >= 0 && realPaybackYears === null) {
      // Interpolate exact payback year
      const prevCumulative = cumulativeSavings - adjustedSavings;
      realPaybackYears = y - 1 + (-prevCumulative / adjustedSavings);
    }
  }

  return {
    npv: Math.round(npv),
    realPaybackYears: realPaybackYears !== null ? Math.round(realPaybackYears * 10) / 10 : null,
  };
}

// Data source references
export const CLIMATE_DATA_SOURCES = {
  smhiTemperature: {
    label: "Månadstemperaturer per zon",
    source: "SMHI",
    url: "https://www.smhi.se/klimat/klimatet-da-och-nu/klimatindikatorer/temperatur/",
    note: "Normalvärden 1991-2020 för representativa städer: Luleå (SE1), Sundsvall (SE2), Stockholm (SE3), Malmö (SE4)",
  },
  pvgisSolar: {
    label: "Solproduktion per latitud",
    source: "PVGIS (EU Joint Research Centre)",
    url: "https://re.jrc.ec.europa.eu/pvg_tools/en/",
    note: "10 kWp system, optimal lutning söder, 14% systemförluster. Anpassat per SE-zon: Luleå 65.6°N, Sundsvall 62.4°N, Stockholm 59.3°N, Malmö 55.6°N",
  },
  heatingDegreeDays: {
    label: "Graddagar per zon",
    source: "SMHI / Boverket",
    url: "https://www.smhi.se/data/meteorologi/temperatur",
    note: "Graddagar (bas 17°C) per SE-zon. Normalvärden 1991-2020.",
  },
  electricityPrices: {
    label: "Elpriser per zon",
    source: "Elpriskollen (Energimarknadsinspektionen) / Nord Pool",
    url: "https://www.ei.se/konsumentstod/elpriskollen",
    note: "Genomsnittliga konsumentpriser 2023-2025 per SE-zon, inklusive nätavgifter och skatter.",
  },
};