/**
 * Hourly simulation — hourly profiles, temperature,
 * solar production, and full day simulation.
 */

import type {
  BillData,
  RefinementAnswers,
  HourlyDataPoint,
  HourlyDataPointExtended,
  ActiveUpgrades,
  Assumptions,
  SEZone,
} from "../types";
import { HOURLY_PROFILE, HEATING_HOURLY_PROFILE, HEATING_SHARE, EV_CHARGING_PROFILE, BIG_CONSUMER_PROFILES } from "../data/energy-profiles";
import { SE_ZONE_SPOT_PRICE, getHourlyPriceProfile } from "../data/energy-prices";
import { getTemperature, getSolarProduction } from "../climate";
import { getSeasonFactorForDate, applyUpgradesToHour } from "./upgrades";
import { simulateBattery } from "./battery";

export function getAdjustedHourlyProfile(refinement: RefinementAnswers, month?: number): number[] {
  const baseProfile = [...HOURLY_PROFILE];
  const residents = refinement.residents ?? 2;

  const peakBoost = 1 + (residents - 2) * 0.05;
  for (let h = 6; h <= 9; h++) baseProfile[h] *= peakBoost;
  for (let h = 17; h <= 21; h++) baseProfile[h] *= peakBoost;

  // Legacy elCar support
  if (refinement.elCar === "ja" && !refinement.bigConsumers?.includes("elbil")) {
    for (let h = 0; h < 24; h++) {
      baseProfile[h] += EV_CHARGING_PROFILE[h] / 24;
    }
  } else if (refinement.elCar === "planerar" && !refinement.bigConsumers?.includes("elbil")) {
    for (let h = 0; h < 24; h++) {
      baseProfile[h] += (EV_CHARGING_PROFILE[h] / 24) * 0.5;
    }
  }

  // Big consumers — add their monthly kWh distributed across hours
  if (refinement.bigConsumers && refinement.bigConsumers.length > 0 && month !== undefined) {
    for (const consumer of refinement.bigConsumers) {
      const profile = BIG_CONSUMER_PROFILES[consumer];
      if (profile) {
        const monthlyKwh = profile.monthlyKwhAdded[month];
        const dailyKwh = monthlyKwh / 30;
        // Distribute evenly across hours (simplified)
        for (let h = 0; h < 24; h++) {
          baseProfile[h] += dailyKwh / 24;
        }
      }
    }
  }

  const sum = baseProfile.reduce((a, b) => a + b, 0);
  return baseProfile.map((v) => v / sum);
}

/** Get outdoor temperature for a specific zone, date and hour */
export function getTemperatureForDateHour(date: Date, hour: number, seZone: SEZone = "SE3"): number {
  return getTemperature(seZone, date, hour);
}

/** Get solar production for a specific zone, date and hour (kWh, scaled by system size) */
export function getSolarProductionForHour(date: Date, hour: number, solarSizeKw: number = 10, seZone: SEZone = "SE3"): number {
  return getSolarProduction(seZone, date, hour, solarSizeKw);
}

export function getHourlyData(
  bill: BillData,
  refinement: RefinementAnswers
): HourlyDataPoint[] {
  const dailyKwh = bill.kwhPerMonth / 30;
  const profile = getAdjustedHourlyProfile(refinement);

  return profile.map((weight, hour) => ({
    hour,
    kwh: Math.round(dailyKwh * weight * 100) / 100,
  }));
}

/** Main simulation: simulate a full day with all upgrades and pricing */
export function simulateDay(
  bill: BillData,
  refinement: RefinementAnswers,
  date: Date,
  activeUpgrades: ActiveUpgrades,
  seZone: SEZone,
  assumptions?: Assumptions,
  actualSpotPricesOre?: number[]
): HourlyDataPointExtended[] {
  const seasonFactor = getSeasonFactorForDate(date, refinement, seZone);
  const dailyKwh = bill.kwhPerMonth * seasonFactor / 30;
  const month = date.getMonth();
  const hourlyProfile = getAdjustedHourlyProfile(refinement, month);
  const day = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), month + 1, 0).getDate();
  const t = (day - 1) / daysInMonth;
  const nextMonth = (month + 1) % 12;

  // Base hourly consumption
  const hourlyBase: number[] = [];
  const hourlyAfter: number[] = [];
  const hourlySolar: number[] = [];
  const hourlyPrice: number[] = [];

  for (let h = 0; h < 24; h++) {
    const base = dailyKwh * hourlyProfile[h];
    hourlyBase.push(base);

    const after = applyUpgradesToHour(base, h, date, activeUpgrades, refinement, seZone, assumptions);
    hourlyAfter.push(after);

    const solar = activeUpgrades.solceller
      ? getSolarProductionForHour(date, h, assumptions?.solarSizeKw ?? 10, seZone)
      : 0;
    hourlySolar.push(solar);

    // Spot price for this hour — month-specific profile
    const monthlySpotPrice = SE_ZONE_SPOT_PRICE[seZone]?.[month] ?? 80;
    const hourlyPriceProfile = getHourlyPriceProfile(month);
    const historicalSpotForHour = actualSpotPricesOre?.[h];

    const effectiveContract = activeUpgrades.dynamiskt_elpris
      ? "dynamic"
      : (refinement.elContractType ?? "monthly");

    if (effectiveContract === "dynamic") {
      // Dynamic contract: price varies by hour within the month
      hourlyPrice.push(historicalSpotForHour ?? (monthlySpotPrice * hourlyPriceProfile[h]));
    } else if (effectiveContract === "fixed") {
      // Fixed contract: annual average spot price
      const annualAvgSpot = SE_ZONE_SPOT_PRICE[seZone]
        ? SE_ZONE_SPOT_PRICE[seZone].reduce((s, v) => s + v, 0) / 12
        : 80;
      hourlyPrice.push(annualAvgSpot);
    } else {
      // Monthly average contract: same price all hours within month
      hourlyPrice.push(monthlySpotPrice);
    }
  }

  // Battery simulation
  let batteryResult = {
    batteryCharge: new Array(24).fill(0),
    batteryState: new Array(24).fill(0),
    gridImport: hourlyAfter.map((c, h) => Math.max(0, c - hourlySolar[h])),
    gridExport: hourlyAfter.map((c, h) => Math.max(0, hourlySolar[h] - c)),
  };

  if (activeUpgrades.batteri && activeUpgrades.solceller) {
    const effectiveBatteryContract = activeUpgrades.dynamiskt_elpris
      ? "dynamic"
      : (refinement.elContractType ?? "monthly");
    const batteryPriceProfile = effectiveBatteryContract === "dynamic"
      ? getHourlyPriceProfile(month)
      : new Array(24).fill(1.0);
    batteryResult = simulateBattery(hourlyAfter, hourlySolar, batteryPriceProfile, assumptions?.batterySizeKwh);
  } else if (activeUpgrades.solceller) {
    batteryResult.gridImport = hourlyAfter.map((c, h) =>
      Math.max(0, c - hourlySolar[h])
    );
    batteryResult.gridExport = hourlyAfter.map((c, h) =>
      Math.max(0, hourlySolar[h] - c)
    );
  }

  // Build extended data points
  const result: HourlyDataPointExtended[] = [];
  for (let h = 0; h < 24; h++) {
    const costOre = batteryResult.gridImport[h] * hourlyPrice[h];
    result.push({
      hour: h,
      kwhBase: Math.round(hourlyBase[h] * 100) / 100,
      kwhAfterUpgrades: Math.round(hourlyAfter[h] * 100) / 100,
      solarProductionKwh: Math.round(hourlySolar[h] * 100) / 100,
      batteryChargeKwh: batteryResult.batteryCharge[h],
      batteryStateKwh: batteryResult.batteryState[h],
      gridImportKwh: batteryResult.gridImport[h],
      gridExportKwh: batteryResult.gridExport[h],
      costOre: Math.round(costOre * 100) / 100,
      spotPriceOre: Math.round(hourlyPrice[h] * 100) / 100,
    });
  }

  return result;
}