/**
 * Upgrade definitions, reduction factors, and recommendation config.
 */

import type { UpgradeDefinition, ActiveUpgrades } from "../types";

/**
 * Upgrade definitions — available energy improvements
 * @source Boverket & Energimyndigheten
 * @updated 2026-04-04
 * @notes Genomsnittliga installationspriser 2025-2026 inkl. moms och ROT-avdrag
 */
export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    id: "solceller",
    label: "Solceller",
    description: "Storlek justeras under Antaganden (standard 10 kW)",
    investmentCostSEK: 140000,
    lifespanYears: 25,
    icon: "☀️",
  },
  {
    id: "batteri",
    label: "Hembatteri 25 kWh",
    description: "Spara solelen så du kan använda den när du behöver den.",
    investmentCostSEK: 110000,
    lifespanYears: 15,
    requires: "solceller",
    icon: "🔋",
  },
  {
    id: "luftluft",
    label: "Luft-luft värmepump",
    description: "Värmer upp till en bråkdel av kostnaden för direktel.",
    investmentCostSEK: 35000,
    lifespanYears: 15,
    incompatibleWith: ["luftvatten", "bergvarme"],
    icon: "💨",
  },
  {
    id: "luftvatten",
    label: "Luft-vatten värmepump",
    description: "Ersätter hela uppvärmningen — mycket effektivare än direktel.",
    investmentCostSEK: 130000,
    lifespanYears: 20,
    incompatibleWith: ["luftluft", "bergvarme"],
    icon: "🌡️",
  },
  {
    id: "bergvarme",
    label: "Bergvärme",
    description: "Stabil och effektiv värme oavsett hur kallt det är ute.",
    investmentCostSEK: 180000,
    lifespanYears: 25,
    incompatibleWith: ["luftluft", "luftvatten"],
    icon: "⛰️",
  },
  {
    id: "tillaggsisolering",
    label: "Tilläggsisolering",
    description: "Minskar värmeförlusten med ca 20 %",
    investmentCostSEK: 80000,
    lifespanYears: 40,
    icon: "🧱",
  },
  {
    id: "eldstad",
    label: "Eldstad / kamin",
    description: "Minskar eluppvärmningen med ca 15 %",
    investmentCostSEK: 50000,
    lifespanYears: 30,
    icon: "🔥",
  },
  {
    id: "smartstyrning",
    label: "Smart styrning",
    description: "Låt huset sköta sig själv — smartare styrning av värme och el.",
    investmentCostSEK: 12000,
    lifespanYears: 10,
    icon: "🤖",
  },
  {
    id: "varmvattenpump",
    label: "Varmvattenpump",
    description: "Minskar varmvattenkostnaden med ca 65 %",
    investmentCostSEK: 35000,
    lifespanYears: 15,
    icon: "🚿",
  },
  {
    id: "fonsterbyte",
    label: "Fönsterbyte 3-glas",
    description: "Minskar värmeförlusten med ca 10 %",
    investmentCostSEK: 130000,
    lifespanYears: 30,
    icon: "🪟",
  },
  {
    id: "dynamiskt_elpris",
    label: "Byt till dynamiskt elpris",
    description: "Betala mindre genom att använda el när den är som billigast.",
    investmentCostSEK: 0,
    lifespanYears: 99,
    icon: "⚡",
  },
];

/**
 * Reduction factors for non-heat-pump upgrades
 * @source Energimyndigheten & Boverket
 * @updated 2026-04-04
 * @notes Uppskattade procentuella minskningar per åtgärd
 */
export const REDUCTION_FACTORS: Record<string, number> = {
  tillaggsisolering: 0.20,
  fonsterbyte: 0.10,
  smartstyrning: 0.08,
  eldstad: 0.15,
  varmvattenpump: 0.65, // applied only to hot water share
};

/**
 * Battery parameters (25 kWh home battery, 0.5C-rate)
 * @source Branschdata (Tesla Powerwall, Huawei LUNA, Pixii, BYD)
 * @updated 2026-04-29
 * @notes 0.5C = 12.5 kW peak för 25 kWh referensbatteri. Skalas
 *        proportionellt mot batterySizeKwh i simulate8760.ts:
 *        20 kWh -> 10 kW, 15 kWh -> 7.5 kW, 10 kWh -> 5 kW.
 *        0.5C ligger i mitten av dagens marknadsspann
 *        (Sonnen 0.33C - Tesla Powerwall 3 0.85C).
 */
export const BATTERY_PARAMS = {
  capacityKwh: 25,
  maxChargeRateKw: 12.5,
  maxDischargeRateKw: 12.5,
  roundTripEfficiency: 0.92,
};

/**
 * Recommendation engine configuration
 * @updated 2026-04-04
 * @notes Styr filtreringsregler och antal rekommendationer
 */
export const RECOMMENDATION_CONFIG = {
  maxRecommendations: 5,
  topPickCount: 3,
  excludeForApartment: ["tillaggsisolering", "fonsterbyte", "bergvarme", "eldstad"] as string[],
  excludeIfHeatingType: {
    bergvarme: ["luftluft", "luftvatten", "bergvarme"] as string[],
    luftluft: ["luftluft"] as string[],
    luftvatten: ["luftluft", "luftvatten"] as string[],
  } as Record<string, string[]>,
};

/**
 * Default active upgrades (all off)
 * @updated 2026-04-04
 */
export const DEFAULT_ACTIVE_UPGRADES: ActiveUpgrades = {
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
