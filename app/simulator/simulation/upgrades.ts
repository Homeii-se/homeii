/**
 * Upgrade application logic — heating share blending, COP interpolation,
 * season factor adjustment, and per-hour upgrade effects.
 */

import type {
  HeatingType,
  ActiveUpgrades,
  Assumptions,
  RefinementAnswers,
  SEZone,
} from "../types";
import { HEATING_SHARE, REFERENCE_AREA, HOT_WATER_SHARE } from "../data/energy-profiles";
import { HEAT_PUMP_COP_CURVES } from "../data/cop-curves";
import { REDUCTION_FACTORS, DEFAULT_ACTIVE_UPGRADES } from "../data/upgrade-catalog";
import { getTemperature, calculateSeasonFactors } from "../climate";

/** Blend HEATING_SHARE values for multiple heating types.
 *  1 type = direct value. 2 types = 55/45 weighting (most efficient primary).
 *  3+ = descending weights. */
export function getBlendedHeatingShare(heatingTypes?: HeatingType[]): number | undefined {
  if (!heatingTypes || heatingTypes.length === 0) return undefined;
  if (heatingTypes.length === 1) return HEATING_SHARE[heatingTypes[0]];

  // Sort by efficiency (lowest share = most efficient comes first as primary)
  const sorted = [...heatingTypes].sort(
    (a, b) => HEATING_SHARE[a] - HEATING_SHARE[b]
  );

  if (sorted.length === 2) {
    return HEATING_SHARE[sorted[0]] * 0.55 + HEATING_SHARE[sorted[1]] * 0.45;
  }

  // 3+: descending weights
  const weights = sorted.map((_, i) => 1 / (i + 1));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  return sorted.reduce(
    (sum, ht, i) => sum + HEATING_SHARE[ht] * (weights[i] / totalWeight),
    0
  );
}

/**
 * Calculate season factors using zone-based degree hours (physics-based).
 * Falls back to SE3 if no zone provided.
 */
export function getAdjustedSeasonFactors(refinement: RefinementAnswers, seZone: SEZone = "SE3"): number[] {
  const heatingShare = getBlendedHeatingShare(refinement.heatingTypes)
    ?? (refinement.heatingType ? HEATING_SHARE[refinement.heatingType] : 0.5);

  // Area adjustment: larger houses = more heating, so heating share is amplified
  const areaFactor = refinement.area
    ? Math.min(1.5, Math.max(0.5, refinement.area / REFERENCE_AREA))
    : 1.0;

  const effectiveHeatingShare = Math.min(0.85, heatingShare * areaFactor);

  return calculateSeasonFactors(seZone, effectiveHeatingShare);
}

/** Interpolate season factor for a specific date (smooth between months) */
export function getSeasonFactorForDate(
  date: Date,
  refinement: RefinementAnswers,
  seZone: SEZone = "SE3"
): number {
  const adjustedFactors = getAdjustedSeasonFactors(refinement, seZone);
  const month = date.getMonth();
  const day = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), month + 1, 0).getDate();

  // Interpolate between current and next month
  const t = (day - 1) / daysInMonth;
  const nextMonth = (month + 1) % 12;
  return adjustedFactors[month] * (1 - t) + adjustedFactors[nextMonth] * t;
}

/** Interpolate COP for a heat pump type at a given outdoor temperature */
export function getHeatPumpCOP(
  pumpType: "luftluft" | "luftvatten" | "bergvarme",
  outdoorTemp: number
): number {
  const curve = HEAT_PUMP_COP_CURVES[pumpType];
  if (outdoorTemp <= curve[0][0]) return curve[0][1];
  if (outdoorTemp >= curve[curve.length - 1][0])
    return curve[curve.length - 1][1];

  for (let i = 0; i < curve.length - 1; i++) {
    const [t0, cop0] = curve[i];
    const [t1, cop1] = curve[i + 1];
    if (outdoorTemp >= t0 && outdoorTemp <= t1) {
      const frac = (outdoorTemp - t0) / (t1 - t0);
      return cop0 + frac * (cop1 - cop0);
    }
  }
  return 3.0; // fallback
}

/**
 * Interpolate COP from a custom curve (same logic as getHeatPumpCOP but
 * works with any [temp, cop][] array — used for variant overrides).
 */
function interpolateCOP(curve: [number, number][], outdoorTemp: number): number {
  if (curve.length === 0) return 3.0;
  if (outdoorTemp <= curve[0][0]) return curve[0][1];
  if (outdoorTemp >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [t0, cop0] = curve[i];
    const [t1, cop1] = curve[i + 1];
    if (outdoorTemp >= t0 && outdoorTemp <= t1) {
      const frac = (outdoorTemp - t0) / (t1 - t0);
      return cop0 + frac * (cop1 - cop0);
    }
  }
  return 3.0;
}

/**
 * Apply all active upgrades to a single hour's base consumption.
 *
 * When `assumptions` contains variant overrides (copCurveOverride,
 * reductionOverrides, heatingCoverageOverride), those take precedence
 * over the hardcoded defaults. This enables head-to-head comparison
 * of different product variants without changing the catalog.
 */
export function applyUpgradesToHour(
  baseKwh: number,
  hour: number,
  date: Date,
  activeUpgrades: ActiveUpgrades,
  refinement: RefinementAnswers,
  seZone: SEZone = "SE3",
  assumptions?: Assumptions
): number {
  const heatingShare = getBlendedHeatingShare(refinement.heatingTypes)
    ?? (refinement.heatingType ? HEATING_SHARE[refinement.heatingType] : 0.5);

  const seasonFactor = getSeasonFactorForDate(date, refinement, seZone);
  // Heating fraction is higher in winter
  const heatingFraction = Math.max(0, Math.min(1, heatingShare * Math.max(0, seasonFactor - 0.3)));

  let heatingKwh = baseKwh * heatingFraction;
  const hotWaterKwh = baseKwh * HOT_WATER_SHARE;
  let otherKwh = baseKwh * (1 - heatingFraction - HOT_WATER_SHARE);
  if (otherKwh < 0) otherKwh = 0;

  // Resolve reduction factors — variant overrides take precedence
  const reductions = assumptions?.reductionOverrides ?? REDUCTION_FACTORS;
  const getReduction = (id: string): number =>
    reductions[id] ?? REDUCTION_FACTORS[id] ?? 0;

  // Apply insulation/window/fireplace reductions to heating portion
  if (activeUpgrades.tillaggsisolering) {
    heatingKwh *= 1 - getReduction("tillaggsisolering");
  }
  if (activeUpgrades.fonsterbyte) {
    heatingKwh *= 1 - getReduction("fonsterbyte");
  }
  if (activeUpgrades.eldstad) {
    heatingKwh *= 1 - getReduction("eldstad");
  }

  // Apply heat pump COP to heating portion (and hot water for waterborne systems)
  const outdoorTemp = getTemperature(seZone, date, hour);
  const customCOP = assumptions?.copCurveOverride;
  const coverage = assumptions?.heatingCoverageOverride ?? 1.0;

  // Track whether the heat pump also handles hot water (bergvärme & luftvatten do)
  let heatPumpHandlesHotWater = false;

  if (activeUpgrades.bergvarme) {
    const cop = customCOP ? interpolateCOP(customCOP, outdoorTemp) : getHeatPumpCOP("bergvarme", outdoorTemp);
    heatingKwh /= cop;
    heatPumpHandlesHotWater = true;
  } else if (activeUpgrades.luftvatten) {
    const cop = customCOP ? interpolateCOP(customCOP, outdoorTemp) : getHeatPumpCOP("luftvatten", outdoorTemp);
    heatingKwh /= cop;
    heatPumpHandlesHotWater = true;
  } else if (activeUpgrades.luftluft) {
    const cop = customCOP ? interpolateCOP(customCOP, outdoorTemp) : getHeatPumpCOP("luftluft", outdoorTemp);
    // Luft-luft only covers a fraction of heating (open plan, not ducted)
    const coveredKwh = heatingKwh * coverage;
    const uncoveredKwh = heatingKwh * (1 - coverage);
    heatingKwh = coveredKwh / cop + uncoveredKwh;
    // Luft-luft does NOT handle hot water — it just blows warm air
  }

  // Apply hot water reduction
  let adjustedHotWater = hotWaterKwh;
  if (heatPumpHandlesHotWater) {
    // Bergvärme / luftvatten produce hot water too via the waterborne system.
    // Hot water COP is lower than space heating COP because the heat pump
    // must reach ~55-60°C (vs ~35-45°C for floor heating / radiators).
    // Rule of thumb: hot water COP ≈ heating COP × 0.75
    const heatingCOP = customCOP
      ? interpolateCOP(customCOP, outdoorTemp)
      : getHeatPumpCOP(
          activeUpgrades.bergvarme ? "bergvarme" : "luftvatten",
          outdoorTemp
        );
    const hotWaterCOP = Math.max(1.5, heatingCOP * 0.75);
    adjustedHotWater /= hotWaterCOP;
  } else if (activeUpgrades.varmvattenpump) {
    // Standalone hot water heat pump (fristående varmvattenberedare)
    adjustedHotWater *= 1 - getReduction("varmvattenpump");
  }

  let total = heatingKwh + adjustedHotWater + otherKwh;

  // Smart control reduces overall consumption
  if (activeUpgrades.smartstyrning) {
    total *= 1 - getReduction("smartstyrning");
  }

  return Math.max(0, total);
}

/** Helper: Build a set of existing equipment as "active upgrades" based on refinement */
export function buildExistingEquipmentUpgrades(refinement: RefinementAnswers): ActiveUpgrades {
  const existingUpgrades: ActiveUpgrades = { ...DEFAULT_ACTIVE_UPGRADES };

  if (refinement.hasSolar) {
    existingUpgrades.solceller = true;
  }
  if (refinement.hasBattery) {
    existingUpgrades.batteri = true;
  }

  // Include existing heating type as "upgrade" if it's a heat pump
  const existingHeatingTypes = refinement.heatingTypes ?? (refinement.heatingType ? [refinement.heatingType] : []);
  for (const ht of existingHeatingTypes) {
    if (ht === 'luftluft' || ht === 'luftvatten' || ht === 'bergvarme') {
      existingUpgrades[ht] = true;
    }
  }

  // Include dynamic pricing if user already has it
  if (refinement.elContractType === "dynamic") {
    existingUpgrades.dynamiskt_elpris = true;
  }

  return existingUpgrades;
}

/** No-upgrades identity for base peak calculation */
export const NO_UPGRADES: ActiveUpgrades = {
  solceller: false,
  batteri: false,
  luftluft: false,
  luftvatten: false,
  bergvarme: false,
  tillaggsisolering: false,
  eldstad: false,
  smartstyrning: false,
  varmvattenpump: false,
  fonsterbyte: false,
  dynamiskt_elpris: false,
};
