/**
 * Default values for assumptions and simulator state.
 */

import type { Assumptions, SimulatorState } from "../types";
import { DEFAULT_GRID_FEE_KR_PER_MONTH, DEFAULT_POWER_FEE_KR_PER_KW } from "./energy-prices";
import { DEFAULT_ACTIVE_UPGRADES } from "./upgrade-catalog";

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  gridFeeKrPerMonth: DEFAULT_GRID_FEE_KR_PER_MONTH,
  powerFeeKrPerKw: DEFAULT_POWER_FEE_KR_PER_KW,
  solarSizeKw: 10,
  batterySizeKwh: 25,
};

export const DEFAULT_STATE: SimulatorState = {
  completedStep: 0,
  refinement: {},
  answeredQuestions: 0,
  seZone: "SE3",
  activeUpgrades: { ...DEFAULT_ACTIVE_UPGRADES },
  selectedDate: "2026-03-25", // static default, overridden on client mount
  assumptions: { ...DEFAULT_ASSUMPTIONS },
};
