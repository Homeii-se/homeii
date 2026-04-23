/**
 * 8760-hour simulation using PVGIS TMY (Typical Meteorological Year) data.
 *
 * Replaces the "one representative day per month" approach with 8,760 unique
 * hours driven by real weather data — temperature for consumption modeling
 * and solar irradiance for production modeling.
 *
 * Design principle: NO AVERAGES. Every hour has a unique combination of
 * consumption (driven by real temperature) and production (driven by real
 * irradiance). Averages give false decision data.
 */

import type {
  BillData,
  RefinementAnswers,
  SEZone,
} from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { HOURLY_PROFILE, HEATING_HOURLY_PROFILE } from "../data/energy-profiles";
import { getBlendedHeatingShare, getAdjustedSeasonFactors } from "./upgrades";
import { HEATING_SHARE } from "../data/energy-profiles";
import { BATTERY_PARAMS } from "../data/upgrade-catalog";

// ============================================================
// Types
// ============================================================

export interface Simulate8760Result {
  /** 8760 hourly consumption values (kWh per hour) */
  consumption: number[];
  /** 8760 hourly solar production values (kWh per hour) */
  solarProduction: number[];
  /** 8760 hourly self-consumption: min(production, consumption) */
  selfConsumption: number[];
  /** 8760 hourly grid import: consumption - selfConsumption */
  gridImport: number[];
  /** 8760 hourly grid export: production - selfConsumption */
  gridExport: number[];
  /** Total annual export kWh */
  annualExportKwh: number;
  /** Total annual self-consumption kWh */
  annualSelfConsumptionKwh: number;
  /** Total annual grid import kWh */
  annualGridImportKwh: number;
  /** Total annual solar production kWh */
  annualSolarProductionKwh: number;
  /** Calibrated system size (kW) that matches invoice export data */
  calibratedSystemSizeKw: number;
  /** Monthly export totals (12 values, kWh) */
  monthlyExportKwh: number[];
  /** Monthly self-consumption totals (12 values, kWh) */
  monthlySelfConsumptionKwh: number[];
  /** Monthly grid import totals (12 values, kWh) */
  monthlyGridImportKwh: number[];
  /** Monthly solar production totals (12 values, kWh) */
  monthlySolarProductionKwh: number[];
}

// ============================================================
// Utility: extract day slices from 8760 arrays
// ============================================================

/**
 * Extract 24 hourly values for a specific day-of-year from an 8760 array.
 * @param hourlyArray Full 8760-element array
 * @param dayOfYear 0-indexed (0 = Jan 1, 364 = Dec 31)
 * @returns Array of 24 values
 */
export function getDay(hourlyArray: number[], dayOfYear: number): number[] {
  const startIndex = Math.min(dayOfYear, 364) * 24;
  return hourlyArray.slice(startIndex, startIndex + 24);
}

/**
 * Convert a Date to day-of-year (0-indexed, non-leap).
 * Ignores the actual year — maps to TMY's 365-day structure.
 */
export function dateToDayOfYear(date: Date): number {
  const month = date.getMonth(); // 0-11
  const day = date.getDate(); // 1-31
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return Math.min((daysBeforeMonth[month] ?? 0) + day - 1, 364);
}

// ============================================================
// Fas 3: Temperature-driven consumption model (8760 hours)
// ============================================================

/** Days per month (non-leap year) */
const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Hours per month */
const HOURS_PER_MONTH = DAYS_PER_MONTH.map(d => d * 24);

/**
 * Build month index lookup: for each of 8760 hours, which month (0-11)?
 * Also provides hour-of-day (0-23) for each hour index.
 */
function buildTimeIndex(): { month: number[]; hourOfDay: number[] } {
  const month: number[] = new Array(8760);
  const hourOfDay: number[] = new Array(8760);
  let idx = 0;
  for (let m = 0; m < 12; m++) {
    const hoursInMonth = HOURS_PER_MONTH[m];
    for (let h = 0; h < hoursInMonth; h++) {
      month[idx] = m;
      hourOfDay[idx] = h % 24;
      idx++;
    }
  }
  return { month, hourOfDay };
}

/** Cached time index (same for every call — 8760 is always a standard year) */
let _timeIndex: { month: number[]; hourOfDay: number[] } | null = null;
function getTimeIndex() {
  if (!_timeIndex) _timeIndex = buildTimeIndex();
  return _timeIndex;
}

/**
 * Simulate 8760 hours of household electricity consumption.
 *
 * Logic per hour:
 * 1. Base load: HOURLY_PROFILE[hourOfDay] gives the time-of-day shape.
 *    Same profile every day (the important variation is temperature, not weekday).
 * 2. Heating: max(0, 17 - tempC) * heatingFactor — degree-hour method.
 * 3. Scaling: Normalize so monthly totals match calibrated season factors × kwhPerMonth.
 *    The annual total equals annualKwh exactly.
 *
 * Pin-and-redistribute: If the invoice has actual kWh for a specific month,
 * that month is pinned and the remaining annual budget is redistributed
 * proportionally.
 *
 * @param targetAnnualKwh - Optional override for annual total (used for gross consumption iteration)
 */
export function simulate8760Consumption(
  bill: BillData,
  refinement: RefinementAnswers,
  tmyData: TmyHourlyData[],
  seZone: SEZone,
  targetAnnualKwh?: number
): number[] {
  const timeIndex = getTimeIndex();
  const referenceAnnualKwh = bill.kwhPerMonth * 12;

  // Allow overriding annual total for gross consumption iteration
  const effectiveKwhPerMonth = targetAnnualKwh
    ? targetAnnualKwh / 12
    : bill.kwhPerMonth;

  // Heating share determines how much consumption is temperature-driven
  const heatingShare = getBlendedHeatingShare(refinement.heatingTypes)
    ?? (refinement.heatingType ? HEATING_SHARE[refinement.heatingType] : 0.5);

  // Season factors (may be pin-and-redistributed)
  const seasonFactors = [...getAdjustedSeasonFactors(refinement, seZone)];

  // --- Pin-and-redistribute calibration (same logic as monthly.ts) ---
  if (
    bill.invoicePeriodKwh &&
    bill.invoiceMonth !== undefined &&
    referenceAnnualKwh > 0 &&
    !targetAnnualKwh // Only pin from invoice when not using overridden annual
  ) {
    const avgMonthly = referenceAnnualKwh / 12;
    const actualFactor = bill.invoicePeriodKwh / avgMonthly;
    const modelFactor = seasonFactors[bill.invoiceMonth];

    if (modelFactor > 0 && Math.abs(actualFactor - modelFactor) > 0.1) {
      const pinnedFactor = actualFactor;
      const sumOtherModelFactors = seasonFactors.reduce(
        (s, v, i) => (i === bill.invoiceMonth ? s : s + v), 0
      );
      const remainingBudget = 12 - pinnedFactor;
      const otherScale = sumOtherModelFactors > 0
        ? remainingBudget / sumOtherModelFactors
        : 1;

      for (let i = 0; i < 12; i++) {
        if (i === bill.invoiceMonth) {
          seasonFactors[i] = pinnedFactor;
        } else {
          seasonFactors[i] = Math.max(0.15, seasonFactors[i] * otherScale);
        }
      }

      const sumAfter = seasonFactors.reduce((s, v) => s + v, 0);
      if (Math.abs(sumAfter - 12) > 0.01) {
        const excess = sumAfter - 12;
        seasonFactors[bill.invoiceMonth] = Math.max(0.5, pinnedFactor - excess);
      }
    }
  }

  // Monthly target kWh (from calibrated season factors)
  const monthlyTargetKwh = seasonFactors.map(f =>
    Math.round(effectiveKwhPerMonth * f)
  );

  // --- Step 1: Build raw (un-scaled) hourly consumption ---
  // For each hour: baseLoad(hourOfDay) + heatingDemand(temperature)
  const rawHourly = new Float64Array(8760);
  const monthlyRawSum = new Float64Array(12);

  // Normalize HOURLY_PROFILE to sum to 1.0
  const profileSum = HOURLY_PROFILE.reduce((s, v) => s + v, 0);
  const normalizedProfile = HOURLY_PROFILE.map(v => v / profileSum);

  // Normalize HEATING_HOURLY_PROFILE to average 1.0
  const heatingProfileSum = HEATING_HOURLY_PROFILE.reduce((s, v) => s + v, 0);
  const heatingProfileAvg = heatingProfileSum / 24;
  const normalizedHeatingProfile = HEATING_HOURLY_PROFILE.map(v => v / heatingProfileAvg);

  for (let i = 0; i < 8760; i++) {
    const m = timeIndex.month[i];
    const hod = timeIndex.hourOfDay[i];

    // Use TMY temperature if available, otherwise use a reasonable default
    const tempC = i < tmyData.length ? tmyData[i].tempC : 5;

    // Base load component (appliances, lighting — varies by hour of day)
    const baseFraction = normalizedProfile[hod]; // fraction of daily base load
    const baseLoad = baseFraction * (1 - heatingShare);

    // Heating component: degree-hour method, base 17°C
    // Now modulated by time-of-day profile (morning+evening peaks)
    const heatingDegrees = Math.max(0, 17 - tempC);
    const heatingLoad = heatingDegrees * heatingShare / 17 * normalizedHeatingProfile[hod];

    rawHourly[i] = baseLoad + heatingLoad;
    monthlyRawSum[m] += rawHourly[i];
  }

  // --- Step 2: Scale each month to match target kWh ---
  const result = new Array<number>(8760);
  for (let i = 0; i < 8760; i++) {
    const m = timeIndex.month[i];
    const scale = monthlyRawSum[m] > 0
      ? monthlyTargetKwh[m] / monthlyRawSum[m]
      : 0;
    result[i] = Math.max(0, rawHourly[i] * scale);
  }

  // Verify: log monthly and annual totals
  const monthTotals = new Array(12).fill(0);
  let total = 0;
  for (let i = 0; i < 8760; i++) {
    monthTotals[timeIndex.month[i]] += result[i];
    total += result[i];
  }
  console.log("[8760-CONSUMPTION] Monthly totals:", monthTotals.map(v => Math.round(v)));
  console.log("[8760-CONSUMPTION] Annual total:", Math.round(total), "kWh (target:", Math.round(effectiveKwhPerMonth * 12), ")");

  return result;
}

// ============================================================
// Fas 4: Solar production from real irradiance (8760 hours)
// ============================================================

/**
 * Monthly tilt correction factors for a 30° south-facing panel in Sweden.
 * Represents the ratio of irradiance on tilted surface vs horizontal.
 * Source: typical values for ~60°N latitude, 30° tilt, south azimuth.
 *
 * Calibrated so that 10 kW system in Stockholm produces ~8,500 kWh/year
 * (matching PVGIS 5.2 reference of ~8,470 kWh for 10 kWp, 30° south, 14% losses).
 */
const TILT_CORRECTION_30_SOUTH = [
  1.35, // Jan — very low sun, tilt helps a lot
  1.25, // Feb
  1.18, // Mar
  1.10, // Apr
  1.04, // May
  1.02, // Jun — sun high, tilt doesn't help much
  1.03, // Jul
  1.06, // Aug
  1.14, // Sep
  1.22, // Oct
  1.30, // Nov
  1.38, // Dec — lowest sun, maximum tilt benefit
];

/**
 * Performance ratio: accounts for inverter efficiency, cable losses,
 * module temperature degradation, soiling, and mismatch.
 * Calibrated against PVGIS reference (10 kW Stockholm → ~8,470 kWh/year).
 */
const PERFORMANCE_RATIO = 0.79;

/**
 * Simulate 8760 hours of solar PV production.
 *
 * Uses GHI (Global Horizontal Irradiance) from TMY data with:
 * - Tilt correction factor (monthly, for 30° south-facing as default)
 * - Performance ratio (0.79, calibrated to PVGIS)
 *
 * Formula per hour:
 *   P_hour = GHI × tiltCorrection × systemSizeKw / 1000 × performanceRatio
 *
 * @param systemSizeKw - PV system size in kWp
 * @param tmyData - 8760 hourly TMY records
 * @param tiltDeg - Panel tilt in degrees (default 30°)
 * @param azimuthDeg - Panel azimuth in degrees (default 180° = south)
 * @returns 8760 hourly production values in kWh
 */
export function simulate8760Solar(
  systemSizeKw: number,
  tmyData: TmyHourlyData[],
  tiltDeg: number = 30,
  azimuthDeg: number = 180
): number[] {
  void azimuthDeg;
  const timeIndex = getTimeIndex();
  const result = new Array<number>(8760);

  // Use tilt correction based on default 30° south orientation
  // For non-standard angles, scale the correction factor
  const tiltScale = tiltDeg / 30; // simple linear scaling for now

  for (let i = 0; i < 8760; i++) {
    const m = timeIndex.month[i];
    const ghi = i < tmyData.length ? tmyData[i].ghi : 0;

    // Apply tilt correction (interpolated for non-30° tilts)
    const baseTiltCorrection = TILT_CORRECTION_30_SOUTH[m];
    // For tilt=0 (horizontal), correction = 1.0
    // For tilt=30, use full correction
    // Linear interpolation between these
    const tiltCorrection = 1.0 + (baseTiltCorrection - 1.0) * Math.min(1, tiltScale);

    // P_hour = GHI(W/m²) × tiltCorrection × systemSize(kW) / 1000(W→kW) × PR
    const production = (ghi * tiltCorrection * systemSizeKw / 1000) * PERFORMANCE_RATIO;

    result[i] = Math.max(0, production);
  }

  return result;
}

// ============================================================
// Fas 5: Self-consumption, export, battery, and calibration
// ============================================================

/**
 * Combine consumption and solar production hour-by-hour to determine
 * self-consumption, grid import, and grid export.
 *
 * For each hour:
 *   selfConsumption = min(production, consumption)
 *   gridImport = consumption - selfConsumption
 *   gridExport = production - selfConsumption
 */
function calculateSelfConsumption(
  consumption: number[],
  solarProduction: number[]
): {
  selfConsumption: number[];
  gridImport: number[];
  gridExport: number[];
} {
  const n = consumption.length;
  const selfConsumption = new Array<number>(n);
  const gridImport = new Array<number>(n);
  const gridExport = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const c = consumption[i];
    const p = solarProduction[i];
    const sc = Math.min(c, p);
    selfConsumption[i] = sc;
    gridImport[i] = c - sc;
    gridExport[i] = p - sc;
  }

  return { selfConsumption, gridImport, gridExport };
}

/**
 * Simulate battery over 8760 hours.
 * Battery charges from solar surplus and discharges to offset consumption.
 * Reduces grid export and grid import.
 *
 * Uses same parameters as the 24-hour battery model (battery.ts):
 * - capacity: from refinement or BATTERY_PARAMS default
 * - maxChargeRate / maxDischargeRate: proportional to capacity
 * - roundTripEfficiency: 92%
 */
function simulateBattery8760(
  consumption: number[],
  solarProduction: number[],
  batterySizeKwh?: number
): {
  gridImport: number[];
  gridExport: number[];
  selfConsumption: number[];
} {
  const capacity = batterySizeKwh ?? BATTERY_PARAMS.capacityKwh;
  const scale = capacity / BATTERY_PARAMS.capacityKwh;
  const maxChargeRate = BATTERY_PARAMS.maxChargeRateKw * scale;
  const maxDischargeRate = BATTERY_PARAMS.maxDischargeRateKw * scale;
  const efficiency = BATTERY_PARAMS.roundTripEfficiency;

  const n = consumption.length;
  const gridImport = new Array<number>(n);
  const gridExport = new Array<number>(n);
  const selfConsumption = new Array<number>(n);

  let batteryState = capacity * 0.5; // start at 50%

  for (let i = 0; i < n; i++) {
    const c = consumption[i];
    const p = solarProduction[i];

    // Direct self-consumption (solar covers part of consumption)
    const directSC = Math.min(c, p);
    const netSurplus = p - directSC;   // solar surplus after direct use
    const netDeficit = c - directSC;   // consumption not covered by solar

    let batteryCharge = 0;
    let batteryDischarge = 0;

    if (netSurplus > 0) {
      // Solar surplus → charge battery
      const canCharge = Math.min(
        netSurplus,
        maxChargeRate,
        (capacity - batteryState) / efficiency
      );
      batteryCharge = canCharge * efficiency;
      batteryState += batteryCharge;
    }

    if (netDeficit > 0 && batteryState > 0) {
      // Consumption deficit → discharge battery
      batteryDischarge = Math.min(
        netDeficit,
        maxDischargeRate,
        batteryState
      );
      batteryState -= batteryDischarge;
    }

    // Total self-consumption = direct solar + battery discharge
    selfConsumption[i] = directSC + batteryDischarge;

    // Grid flows after battery
    gridExport[i] = Math.max(0, netSurplus - (batteryCharge / efficiency));
    gridImport[i] = Math.max(0, netDeficit - batteryDischarge);
  }

  return { gridImport, gridExport, selfConsumption };
}

/**
 * Calculate monthly totals from an 8760-hour array.
 */
function monthlyTotals(values: number[]): number[] {
  const timeIndex = getTimeIndex();
  const totals = new Array(12).fill(0);
  for (let i = 0; i < values.length; i++) {
    totals[timeIndex.month[i]] += values[i];
  }
  return totals;
}

/**
 * Calculate total export kWh for a specific month, accounting for battery.
 */
function sumExportForMonthWithBattery(
  consumption: number[],
  production: number[],
  targetMonth: number,
  hasBattery: boolean,
  batterySizeKwh?: number
): number {
  const timeIndex = getTimeIndex();

  if (!hasBattery) {
    // Simple: export = surplus
    let exportKwh = 0;
    for (let i = 0; i < consumption.length; i++) {
      if (timeIndex.month[i] === targetMonth) {
        const surplus = production[i] - consumption[i];
        if (surplus > 0) exportKwh += surplus;
      }
    }
    return exportKwh;
  }

  // With battery: need to simulate the full year up to and including targetMonth
  // (battery state carries over between months)
  const capacity = batterySizeKwh ?? BATTERY_PARAMS.capacityKwh;
  const scale = capacity / BATTERY_PARAMS.capacityKwh;
  const maxChargeRate = BATTERY_PARAMS.maxChargeRateKw * scale;
  const efficiency = BATTERY_PARAMS.roundTripEfficiency;

  let batteryState = capacity * 0.5;
  let monthExport = 0;

  for (let i = 0; i < consumption.length; i++) {
    const c = consumption[i];
    const p = production[i];
    const directSC = Math.min(c, p);
    const netSurplus = p - directSC;
    const netDeficit = c - directSC;

    let batteryCharge = 0;
    if (netSurplus > 0) {
      const canCharge = Math.min(
        netSurplus,
        maxChargeRate,
        (capacity - batteryState) / efficiency
      );
      batteryCharge = canCharge * efficiency;
      batteryState += batteryCharge;
    }

    if (netDeficit > 0 && batteryState > 0) {
      const discharge = Math.min(netDeficit, BATTERY_PARAMS.maxDischargeRateKw * scale, batteryState);
      batteryState -= discharge;
    }

    if (timeIndex.month[i] === targetMonth) {
      monthExport += Math.max(0, netSurplus - (batteryCharge / efficiency));
    }
  }

  return monthExport;
}

/**
 * Calibrate solar system size using binary search.
 *
 * The invoice contains solarExportKwh for a specific month (e.g. 14.59 kWh
 * in February). We find the system size S that produces this export level.
 *
 * If the user has a battery, the battery is included in the calibration
 * (it absorbs surplus before export).
 *
 * @returns Calibrated system size in kW
 */
function calibrateSystemSize(
  consumption: number[],
  tmyData: TmyHourlyData[],
  targetExportKwh: number,
  targetMonth: number,
  hasBattery: boolean,
  batterySizeKwh: number | undefined,
  initialGuess: number = 10
): number {
  let lo = 0.5;
  let hi = 30;
  let bestSize = initialGuess;
  let bestDiff = Infinity;

  for (let iter = 0; iter < 25; iter++) {
    const mid = (lo + hi) / 2;
    const production = simulate8760Solar(mid, tmyData);
    const monthExport = sumExportForMonthWithBattery(
      consumption, production, targetMonth, hasBattery, batterySizeKwh
    );

    const diff = monthExport - targetExportKwh;
    if (Math.abs(diff) < Math.abs(bestDiff)) {
      bestDiff = diff;
      bestSize = mid;
    }

    // Check convergence (within 5% or 0.5 kWh absolute)
    if (Math.abs(diff) <= Math.max(targetExportKwh * 0.05, 0.5)) {
      console.log(`[8760-CALIBRATE] Converged at ${mid.toFixed(2)} kW (export=${monthExport.toFixed(1)} kWh, target=${targetExportKwh} kWh, iter=${iter})`);
      return mid;
    }

    if (diff < 0) {
      lo = mid; // Need more production → larger system
    } else {
      hi = mid; // Too much production → smaller system
    }
  }

  console.log(`[8760-CALIBRATE] Best found: ${bestSize.toFixed(2)} kW (diff=${bestDiff.toFixed(1)} kWh)`);
  return bestSize;
}

/**
 * Full 8760-hour simulation with solar, battery, and system size calibration.
 *
 * System size strategy (in priority order):
 * 1. Use refinement.solarSizeKw if reported by user (most reliable)
 * 2. Otherwise, calibrate from invoice solarExportKwh via binary search
 * 3. Fallback: 10 kW default
 *
 * When the user has solar, the consumption model iterates to account for
 * self-consumption (the bill's kWh is NET grid, not gross household use):
 * 1. First pass: consumption from net grid data → estimate self-consumption
 * 2. Second pass: inflate consumption to gross → final simulation
 *
 * Returns comprehensive hourly results for the full year.
 */
export function simulate8760WithSolar(
  bill: BillData,
  refinement: RefinementAnswers,
  tmyData: TmyHourlyData[],
  seZone: SEZone
): Simulate8760Result {
  const hasBattery = refinement.hasBattery ?? false;
  const batterySizeKwh = refinement.batterySizeKwh;
  const netAnnualKwh = bill.annualKwh ?? bill.kwhPerMonth * 12;

  // --- Determine system size ---
  // Prefer user-reported size. Calibration from a single winter month's export
  // is unreliable because our consumption model is too smooth (doesn't capture
  // real intra-day variation like "empty house" hours or solar heat gain).
  // Calibration works better as a fallback when system size is unknown.
  let systemSizeKw: number;
  let sizeSource: string;

  if (refinement.solarSizeKw && refinement.solarSizeKw > 0) {
    systemSizeKw = refinement.solarSizeKw;
    sizeSource = "user-reported";
    console.log(`[8760] Using user-reported system size: ${systemSizeKw} kW`);
  } else if (
    bill.solarExportKwh !== undefined &&
    bill.solarExportKwh > 0 &&
    bill.invoiceMonth !== undefined
  ) {
    // Calibrate from export data — only when system size is unknown
    const initialConsumption = simulate8760Consumption(bill, refinement, tmyData, seZone);
    systemSizeKw = calibrateSystemSize(
      initialConsumption, tmyData, bill.solarExportKwh, bill.invoiceMonth,
      hasBattery, batterySizeKwh, 10
    );
    // Sanity cap: never exceed 25 kW from calibration alone
    systemSizeKw = Math.min(systemSizeKw, 25);
    sizeSource = "calibrated";
    console.log(`[8760] Calibrated system size: ${systemSizeKw.toFixed(2)} kW`);
  } else {
    systemSizeKw = 10;
    sizeSource = "default";
    console.log(`[8760] Using default system size: ${systemSizeKw} kW`);
  }

  // --- Pass 1: Net consumption → estimate self-consumption ---
  let consumption = simulate8760Consumption(bill, refinement, tmyData, seZone);
  let production = simulate8760Solar(systemSizeKw, tmyData);

  let pass1Result: { selfConsumption: number[]; gridImport: number[]; gridExport: number[] };
  if (hasBattery) {
    pass1Result = simulateBattery8760(consumption, production, batterySizeKwh);
  } else {
    pass1Result = calculateSelfConsumption(consumption, production);
  }
  const pass1SelfConsumptionTotal = pass1Result.selfConsumption.reduce((s, v) => s + v, 0);

  // --- Pass 2: Inflate to gross consumption ---
  // The bill's kWhPerMonth is NET grid consumption (meter reads grid import).
  // Actual household consumption = grid import + solar self-consumed.
  // Without this correction, summer consumption looks too low → too much export.
  if (pass1SelfConsumptionTotal > 100) {
    const grossAnnualKwh = netAnnualKwh + pass1SelfConsumptionTotal;
    console.log(`[8760] Gross consumption: net=${Math.round(netAnnualKwh)} + self=${Math.round(pass1SelfConsumptionTotal)} = gross=${Math.round(grossAnnualKwh)} kWh`);

    consumption = simulate8760Consumption(bill, refinement, tmyData, seZone, grossAnnualKwh);
    production = simulate8760Solar(systemSizeKw, tmyData);
  }

  // --- Final computation with battery if present ---
  let selfConsumption: number[];
  let gridImport: number[];
  let gridExport: number[];

  if (hasBattery) {
    const batteryResult = simulateBattery8760(consumption, production, batterySizeKwh);
    selfConsumption = batteryResult.selfConsumption;
    gridImport = batteryResult.gridImport;
    gridExport = batteryResult.gridExport;
  } else {
    const scResult = calculateSelfConsumption(consumption, production);
    selfConsumption = scResult.selfConsumption;
    gridImport = scResult.gridImport;
    gridExport = scResult.gridExport;
  }

  // Aggregate annual and monthly totals
  const annualExportKwh = gridExport.reduce((s, v) => s + v, 0);
  const annualSelfConsumptionKwh = selfConsumption.reduce((s, v) => s + v, 0);
  const annualGridImportKwh = gridImport.reduce((s, v) => s + v, 0);
  const annualSolarProductionKwh = production.reduce((s, v) => s + v, 0);

  const monthlyExportKwh = monthlyTotals(gridExport);
  const monthlySelfConsumptionKwh = monthlyTotals(selfConsumption);
  const monthlyGridImportKwh = monthlyTotals(gridImport);
  const monthlySolarProductionKwh = monthlyTotals(production);

  console.log(`[8760-RESULT] System: ${systemSizeKw.toFixed(1)} kW (${sizeSource})${hasBattery ? ' + battery' : ''}`);
  console.log(`[8760-RESULT] Annual production: ${Math.round(annualSolarProductionKwh)} kWh`);
  console.log(`[8760-RESULT] Self-consumption: ${Math.round(annualSelfConsumptionKwh)} kWh (${annualSolarProductionKwh > 0 ? (annualSelfConsumptionKwh / annualSolarProductionKwh * 100).toFixed(1) : 0}%)`);
  console.log(`[8760-RESULT] Grid export: ${Math.round(annualExportKwh)} kWh`);
  console.log(`[8760-RESULT] Grid import: ${Math.round(annualGridImportKwh)} kWh`);
  console.log(`[8760-RESULT] Monthly export:`, monthlyExportKwh.map(v => Math.round(v)));

  return {
    consumption,
    solarProduction: production,
    selfConsumption,
    gridImport,
    gridExport,
    annualExportKwh,
    annualSelfConsumptionKwh,
    annualGridImportKwh,
    annualSolarProductionKwh,
    calibratedSystemSizeKw: systemSizeKw,
    monthlyExportKwh,
    monthlySelfConsumptionKwh,
    monthlyGridImportKwh,
    monthlySolarProductionKwh,
  };
}
