/**
 * Energiflödes-simulering för svenska villa-hushåll.
 *
 * Modulen simulerar ett dygn (24 timsteg) med varierande utrustning:
 * värmepump, solpaneler, hembatteri, elbil med V2H, smart styrning.
 * Hanterar tre säsonger (vinter, vår·höst, sommar) och två prismodeller
 * (månadsmedel, dynamiskt).
 *
 * Används primärt av visualiseringen i `app/kunskap/energiguiden/`.
 *
 * @example
 * ```ts
 * import { buildScenario, allocate, buildNarrative } from "@/lib/energy-flow";
 *
 * const scenario = buildScenario({
 *   season: "vinter",
 *   hasHP: true, hasEV: true, hasSol: true, hasBat: true, hasSmart: true,
 *   prismodell: "dynamiskt",
 * });
 * console.log(`Dagskostnad: ${scenario.dayCost} kr`);
 * console.log(`Peak: ${scenario.peakKw} kW`);
 *
 * const flows = allocate(scenario.hours[12]);  // klockan 12 — proportionell allokering
 * ```
 */

export { buildScenario } from "./build-scenario";
export { allocate } from "./allocate";
export { buildNarrative } from "./narrative";
export { computeAnnualSaving } from "./annual-saving";

export {
  PRICES,
  SOL_HOURS,
  STODTJANST_EVENTS,
  STODTJANST_DAY_TOTAL,
  BAT_CAP,
  BAT_RATE,
  EV_CAP,
  EV_MIL_MIN,
  EV_MIL_MAX,
  KWH_PER_MIL,
  EV_RATE,
  V2H_RATE,
  DRIVE_PER_HOUR,
  COP_HEAT,
  COP_COOL,
  COOLING_THRESHOLD,
  SEASON_DAYS,
  MAX_KW,
  EFFEKTAVGIFT_PER_KW_PER_DAY,
  PEAK_CAP,
} from "./constants";

export type {
  Season,
  PriceModel,
  Settings,
  HourSnapshot,
  Scenario,
  AllocationKey,
  Allocation,
  Narrative,
  StodtjanstEvent,
  AnnualSaving,
} from "./types";
