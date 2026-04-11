import type { SimulatorState } from "./types";
import { DEFAULT_STATE, DEFAULT_ASSUMPTIONS } from "./data/defaults";
import { DEFAULT_ACTIVE_UPGRADES } from "./data/upgrade-catalog";

const STORAGE_KEY = "homeii-state";
const OLD_STORAGE_KEY = "energy-buddy-state";

export function loadState(): SimulatorState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    // Try new key first, then migrate from old key
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) {
        // Migrate: save under new key and remove old
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(OLD_STORAGE_KEY);
      }
    }
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);

    // Remove obsolete email field
    delete parsed.email;

    // Migrate old "varmepump" → "luftluft"
    if (parsed.refinement?.heatingType === "varmepump") {
      parsed.refinement.heatingType = "luftluft";
    }

    // Migrate heatingType (singular) → heatingTypes (array)
    if (parsed.refinement?.heatingType && !parsed.refinement?.heatingTypes) {
      parsed.refinement.heatingTypes = [parsed.refinement.heatingType];
    }
    // Migrate old "varmepump" values in heatingTypes array
    if (parsed.refinement?.heatingTypes) {
      parsed.refinement.heatingTypes = parsed.refinement.heatingTypes.map(
        (ht: string) => ht === "varmepump" ? "luftluft" : ht
      );
    }

    // Migrate elCar → bigConsumers
    if (parsed.refinement?.elCar === "ja" && !parsed.refinement?.bigConsumers) {
      parsed.refinement.bigConsumers = ["elbil"];
    }

    // Migrate: ensure inferredProfile has hasSolar
    if (parsed.inferredProfile && !parsed.inferredProfile.hasSolar) {
      parsed.inferredProfile.hasSolar = {
        value: false,
        confidence: "low",
        reasoning: "Inga solcellsindikatorer på fakturan",
      };
    }

    // Migrate: ensure new fields have defaults
    return {
      ...DEFAULT_STATE,
      ...parsed,
      activeUpgrades: {
        ...DEFAULT_ACTIVE_UPGRADES,
        ...(parsed.activeUpgrades ?? {}),
      },
      seZone: parsed.seZone ?? DEFAULT_STATE.seZone,
      selectedDate: parsed.selectedDate ?? DEFAULT_STATE.selectedDate,
      assumptions: {
        ...DEFAULT_ASSUMPTIONS,
        ...(parsed.assumptions ?? {}),
      },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: SimulatorState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}