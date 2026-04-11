/**
 * Parameterized upgrade catalog — the core of the investment comparison engine.
 *
 * Architecture:
 * - UpgradeType: A category (e.g. "bergvärme", "solceller") defining what
 *   the upgrade does and how savings are calculated.
 * - UpgradeVariant: A specific product/configuration within a type, with
 *   its own cost, performance, and lifespan.
 *
 * The recommendation engine evaluates ALL variants per relevant type and
 * picks the best ROI option. Users can also explore alternatives head-to-head.
 *
 * Future: variant data can come from an API (e.g. real NIBE/IVT prices),
 * replacing the static defaults below.
 *
 * @source Energimyndighetens värmepumpslista, Boverket, branschdata 2025-2026
 * @updated 2026-04-10
 */

// ============================================================
// Core types
// ============================================================

/** How savings are calculated for this upgrade type */
export type SavingsModel =
  | "cop"            // Heat pumps: COP curve reduces heating electricity
  | "solar"          // Solar panels: self-consumption + export
  | "battery"        // Battery: shifts solar to evening, increases self-consumption
  | "reduction"      // Passive: fixed % reduction of a consumption portion
  | "pricing"        // Contract change: hourly pricing enables load shifting
  ;

/** Which portion of consumption the reduction applies to */
export type ReductionTarget = "heating" | "hotwater" | "total";

/** An upgrade category — defines the physics model */
export interface UpgradeType {
  /** Unique type identifier (matches legacy UpgradeId where possible) */
  id: string;
  /** Swedish display name */
  label: string;
  /** Plain-language explanation of what this upgrade type is and how it works */
  explanation: string;
  /** How savings are modeled */
  savingsModel: SavingsModel;
  /** Upgrade types that are mutually exclusive with this one */
  incompatibleWith?: string[];
  /** Exclude this type if the user already has one of these types installed
   *  (e.g. varmvattenpump is pointless if you have luftvatten/bergvärme) */
  excludeIfExistingType?: string[];
  /** Required upgrade type (e.g. battery requires solar) */
  requires?: string;
  /** Exclude this type for certain housing types */
  excludeForHousing?: ("villa" | "radhus" | "lagenhet")[];
  /** Icon for UI */
  icon: string;
  /** Category for grouping in UI */
  category: "varmepump" | "solenergi" | "isolering" | "styrning" | "elavtal";
}

/**
 * A specific product/configuration within an upgrade type.
 *
 * This is the unit of comparison — the engine evaluates each variant
 * independently to find the best investment for this household.
 */
export interface UpgradeVariant {
  /** Unique variant identifier (e.g. "bergvarme_premium") */
  id: string;
  /** Which upgrade type this belongs to */
  typeId: string;
  /** Swedish display name (e.g. "Bergvärme — NIBE S1255") */
  label: string;
  /** Short description */
  description: string;
  /** Tier for UI sorting: budget < standard < premium */
  tier: "budget" | "standard" | "premium";
  /** Investment cost (SEK inkl moms, efter ROT-avdrag) */
  investmentCostSEK: number;
  /** Expected lifespan (years) */
  lifespanYears: number;

  // --- Heat pump parameters (savingsModel: "cop") ---
  /** COP curve: [outdoorTemp °C, COP] pairs */
  copCurve?: [number, number][];
  /** Share of heating demand covered (1.0 = 100%, 0.7 = supplement only) */
  heatingCoverage?: number;

  // --- Solar parameters (savingsModel: "solar") ---
  /** System size in kWp */
  systemSizeKw?: number;

  // --- Battery parameters (savingsModel: "battery") ---
  /** Usable capacity in kWh */
  capacityKwh?: number;
  /** Max charge rate kW */
  maxChargeRateKw?: number;
  /** Max discharge rate kW */
  maxDischargeRateKw?: number;
  /** Round-trip efficiency (0-1) */
  roundTripEfficiency?: number;

  // --- Passive reduction parameters (savingsModel: "reduction") ---
  /** Fraction reduction (0-1) */
  reductionFactor?: number;
  /** Which consumption portion to reduce */
  reductionTarget?: ReductionTarget;

  // --- Metadata for future API integration ---
  /** External product ID (for linking to supplier API) */
  externalProductId?: string;
  /** Supplier/manufacturer name */
  supplier?: string;
  /** Data source URL */
  sourceUrl?: string;
}


// ============================================================
// Upgrade Types
// ============================================================

export const UPGRADE_TYPES: UpgradeType[] = [
  // --- Värmepumpar ---
  {
    id: "bergvarme",
    label: "Bergvärme",
    explanation: "Värmepump som hämtar värme ur berggrunden via ett borrhål (100–200 m djupt). Stabil verkningsgrad året runt eftersom bergtemperaturen är konstant. Hanterar hela husets uppvärmning och varmvatten via vattenburet system (radiatorer eller golvvärme).",
    savingsModel: "cop",
    incompatibleWith: ["luftluft", "luftvatten"],
    excludeForHousing: ["lagenhet"],
    icon: "⛰️",
    category: "varmepump",
  },
  {
    id: "luftvatten",
    label: "Luft-vatten värmepump",
    explanation: "Värmepump som tar värme ur utomhusluften och levererar den till husets vattenburna värmesystem (radiatorer/golvvärme). Hanterar både uppvärmning och varmvatten. Verkningsgraden sjunker vid kyla, men moderna modeller klarar ner till -20°C.",
    savingsModel: "cop",
    incompatibleWith: ["luftluft", "bergvarme"],
    excludeForHousing: ["lagenhet"],
    icon: "🌡️",
    category: "varmepump",
  },
  {
    id: "luftluft",
    label: "Luft-luft värmepump",
    explanation: "Värmepump som tar värme ur utomhusluften och blåser in den som varm luft inomhus. Enklaste och billigaste värmepumpen — kompletterar befintlig uppvärmning men ersätter den inte helt. Bäst i öppna planlösningar. Hanterar inte varmvatten.",
    savingsModel: "cop",
    incompatibleWith: ["luftvatten", "bergvarme"],
    icon: "💨",
    category: "varmepump",
  },

  // --- Solenergi ---
  {
    id: "solceller",
    label: "Solceller",
    explanation: "Solpaneler på taket som producerar el av solljus. Egenproducerad el minskar nätimporten direkt, och överskottselen säljs tillbaka till nätet. Störst produktion april–september. Systemet kräver inget underhåll och har 25+ års livslängd.",
    savingsModel: "solar",
    icon: "☀️",
    category: "solenergi",
  },
  {
    id: "batteri",
    label: "Hembatteri",
    explanation: "Batterilagring som sparar solel från dagtid till kvälls- och nattförbrukning. Ökar andelen egenanvänd solel från ~30% till ~60–80% och minskar nätimporten ytterligare. Kräver solceller för att vara meningsfullt.",
    savingsModel: "battery",
    requires: "solceller",
    icon: "🔋",
    category: "solenergi",
  },

  // --- Isolering & passiva åtgärder ---
  {
    id: "tillaggsisolering",
    label: "Tilläggsisolering",
    explanation: "Förbättring av husets klimatskal genom att lägga till isoleringsmaterial i vindsbjälklag, fasad eller grund. Minskar värmeförlusterna och sänker uppvärmningsbehovet permanent utan rörliga delar eller underhåll.",
    savingsModel: "reduction",
    excludeForHousing: ["lagenhet"],
    icon: "🧱",
    category: "isolering",
  },
  {
    id: "fonsterbyte",
    label: "Fönsterbyte 3-glas",
    explanation: "Byte från äldre 2-glasfönster till moderna 3-glasfönster med lågt U-värde (~1.0). Minskar drag, köldbryggor och värmeförlust genom fönstren. Lång livslängd men hög investeringskostnad.",
    savingsModel: "reduction",
    excludeForHousing: ["lagenhet"],
    icon: "🪟",
    category: "isolering",
  },
  {
    id: "eldstad",
    label: "Eldstad / kamin",
    explanation: "Modern braskamin med hög verkningsgrad (>80%) som komplement till eluppvärmningen. Värmer effektivt under kalla dagar och minskar elbehovet för uppvärmning. Kräver vedeldning och skorsten.",
    savingsModel: "reduction",
    excludeForHousing: ["lagenhet"],
    icon: "🔥",
    category: "isolering",
  },
  {
    id: "varmvattenpump",
    label: "Varmvattenberedare med värmepumpsteknik",
    explanation: "En fristående varmvattenberedare med inbyggd liten värmepump (COP ~2.5–3). Ersätter en vanlig elpatronberedare och minskar elförbrukningen för tappvarmvatten med ca 65%. Separat enhet — inte samma sak som en luft-vatten värmepump.",
    savingsModel: "reduction",
    excludeIfExistingType: ["luftvatten", "bergvarme"],
    icon: "🚿",
    category: "isolering",
  },

  // --- Styrning & elavtal ---
  {
    id: "smartstyrning",
    label: "Smart styrning",
    explanation: "Smarta termostater och styrenheter (t.ex. Tibber, Greenely) som optimerar uppvärmning och elanvändning baserat på timpris, väderprognos och vanor. Sänker förbrukningen ~8% utan komfortförlust.",
    savingsModel: "reduction",
    icon: "🤖",
    category: "styrning",
  },
  {
    id: "dynamiskt_elpris",
    label: "Byt till dynamiskt elpris",
    explanation: "Byte från fast eller rörligt månadsmedelpris till timprisavtal. Ger möjlighet att styra förbrukning (tvätt, laddning, varmvatten) till timmar med lågt elpris. Ingen investeringskostnad — bara avtalsbyte.",
    savingsModel: "pricing",
    icon: "⚡",
    category: "elavtal",
  },
];


// ============================================================
// Upgrade Variants — the actual products/configurations
// ============================================================

export const UPGRADE_VARIANTS: UpgradeVariant[] = [

  // ========== BERGVÄRME ==========
  // Prices: inkl moms, efter ROT-avdrag (50% on labor 2025, max 50 000 kr/person)
  // Components: borrning 40-90k + pump 80-120k + installation 30-60k
  // After ROT: typically 110 000 – 250 000 kr depending on house, bore depth, pump
  // Source: Energimyndigheten, Husgrunder.com, VVS-Forum 2025-2026
  {
    id: "bergvarme_budget",
    typeId: "bergvarme",
    label: "Bergvärme — budget",
    description: "CTC EcoHeat eller Thermia Calibra. SCOP ~3.2. Kort borrhål, enklare installation.",
    tier: "budget",
    investmentCostSEK: 140_000,
    lifespanYears: 20,
    copCurve: [[-20, 2.6], [-10, 2.9], [0, 3.2], [7, 3.5], [15, 3.8]],
    heatingCoverage: 1.0,
    supplier: "CTC / Thermia",
  },
  {
    id: "bergvarme_standard",
    typeId: "bergvarme",
    label: "Bergvärme — standard",
    description: "NIBE F1255 eller motsvarande. SCOP ~3.6. Marknadens mest sålda.",
    tier: "standard",
    investmentCostSEK: 185_000,
    lifespanYears: 25,
    copCurve: [[-20, 3.2], [-10, 3.4], [0, 3.6], [7, 4.0], [15, 4.2]],
    heatingCoverage: 1.0,
    supplier: "NIBE",
  },
  {
    id: "bergvarme_premium",
    typeId: "bergvarme",
    label: "Bergvärme — premium",
    description: "NIBE S1255 / IVT Greenline. SCOP ~4.0. Bäst verkningsgrad, inverterdrift.",
    tier: "premium",
    investmentCostSEK: 240_000,
    lifespanYears: 25,
    copCurve: [[-20, 3.5], [-10, 3.8], [0, 4.0], [7, 4.3], [15, 4.5]],
    heatingCoverage: 1.0,
    supplier: "NIBE / IVT",
  },

  // ========== LUFT-VATTEN VÄRMEPUMP ==========
  {
    id: "luftvatten_budget",
    typeId: "luftvatten",
    label: "Luft-vatten — budget",
    description: "Bosch, Samsung eller liknande. SCOP ~2.8. Prisvärt alternativ.",
    tier: "budget",
    investmentCostSEK: 100_000,
    lifespanYears: 15,
    copCurve: [[-20, 1.2], [-10, 1.7], [0, 2.4], [7, 3.1], [15, 3.8]],
    heatingCoverage: 1.0,
    supplier: "Bosch / Samsung",
  },
  {
    id: "luftvatten_standard",
    typeId: "luftvatten",
    label: "Luft-vatten — standard",
    description: "NIBE F2120 eller motsvarande. SCOP ~3.2. Populärt val.",
    tier: "standard",
    investmentCostSEK: 130_000,
    lifespanYears: 20,
    copCurve: [[-20, 1.5], [-10, 2.1], [0, 2.8], [7, 3.6], [15, 4.3]],
    heatingCoverage: 1.0,
    supplier: "NIBE",
  },
  {
    id: "luftvatten_premium",
    typeId: "luftvatten",
    label: "Luft-vatten — premium",
    description: "NIBE S2125 / Daikin Altherma. SCOP ~3.5. Tyst, effektiv vid kyla.",
    tier: "premium",
    investmentCostSEK: 170_000,
    lifespanYears: 20,
    copCurve: [[-20, 1.8], [-10, 2.5], [0, 3.2], [7, 3.9], [15, 4.5]],
    heatingCoverage: 1.0,
    supplier: "NIBE / Daikin",
  },

  // ========== LUFT-LUFT VÄRMEPUMP ==========
  {
    id: "luftluft_budget",
    typeId: "luftluft",
    label: "Luft-luft — budget",
    description: "Midea, Gree eller liknande. COP ~2.3. Enklaste värmepumpslösningen.",
    tier: "budget",
    investmentCostSEK: 20_000,
    lifespanYears: 12,
    copCurve: [[-20, 1.0], [-10, 1.4], [0, 2.2], [7, 2.8], [15, 3.5]],
    heatingCoverage: 0.6, // Supplements existing heating, doesn't replace
  },
  {
    id: "luftluft_standard",
    typeId: "luftluft",
    label: "Luft-luft — standard",
    description: "Mitsubishi, Daikin eller liknande. COP ~2.8. Bra allroundval.",
    tier: "standard",
    investmentCostSEK: 35_000,
    lifespanYears: 15,
    copCurve: [[-20, 1.3], [-10, 1.8], [0, 2.6], [7, 3.3], [15, 4.0]],
    heatingCoverage: 0.7,
  },
  {
    id: "luftluft_premium",
    typeId: "luftluft",
    label: "Luft-luft — premium",
    description: "Mitsubishi Kirigamine / Daikin Ururu Sarara. COP ~3.2. Bäst i klassen.",
    tier: "premium",
    investmentCostSEK: 50_000,
    lifespanYears: 18,
    copCurve: [[-20, 1.6], [-10, 2.2], [0, 3.0], [7, 3.6], [15, 4.3]],
    heatingCoverage: 0.75,
  },

  // ========== SOLCELLER ==========
  // Prices per kWp: ~11-14 kr/Wp inkl installation, efter grönt avdrag (15%)
  {
    id: "solceller_6kw",
    typeId: "solceller",
    label: "Solceller 6 kW",
    description: "Litet system, passar radhus eller mindre villatak. ~16 paneler.",
    tier: "budget",
    investmentCostSEK: 85_000,
    lifespanYears: 25,
    systemSizeKw: 6,
  },
  {
    id: "solceller_10kw",
    typeId: "solceller",
    label: "Solceller 10 kW",
    description: "Standardstorlek för villa. ~25 paneler. Bästa kr/kWp-förhållande.",
    tier: "standard",
    investmentCostSEK: 140_000,
    lifespanYears: 25,
    systemSizeKw: 10,
  },
  {
    id: "solceller_15kw",
    typeId: "solceller",
    label: "Solceller 15 kW",
    description: "Stort system, kräver bra takyta. ~38 paneler. Mer export.",
    tier: "premium",
    investmentCostSEK: 195_000,
    lifespanYears: 25,
    systemSizeKw: 15,
  },

  // ========== HEMBATTERI ==========
  // Prices: marknadspriser 2025-2026, inkl installation
  {
    id: "batteri_10kwh",
    typeId: "batteri",
    label: "Hembatteri 10 kWh",
    description: "Huawei LUNA 2000 eller liknande. Räcker för kvälls/nattförbrukning.",
    tier: "budget",
    investmentCostSEK: 55_000,
    lifespanYears: 15,
    capacityKwh: 10,
    maxChargeRateKw: 2.5,
    maxDischargeRateKw: 2.5,
    roundTripEfficiency: 0.92,
    supplier: "Huawei",
  },
  {
    id: "batteri_25kwh",
    typeId: "batteri",
    label: "Hembatteri 25 kWh",
    description: "Tesla Powerwall 3 eller motsvarande. Populäraste storleken.",
    tier: "standard",
    investmentCostSEK: 110_000,
    lifespanYears: 15,
    capacityKwh: 25,
    maxChargeRateKw: 5,
    maxDischargeRateKw: 5,
    roundTripEfficiency: 0.92,
    supplier: "Tesla",
  },
  {
    id: "batteri_40kwh",
    typeId: "batteri",
    label: "Hembatteri 40 kWh",
    description: "BYD HVS eller dubbel Powerwall. Maximal självförsörjning.",
    tier: "premium",
    investmentCostSEK: 165_000,
    lifespanYears: 15,
    capacityKwh: 40,
    maxChargeRateKw: 8,
    maxDischargeRateKw: 8,
    roundTripEfficiency: 0.90,
    supplier: "BYD / Tesla",
  },

  // ========== TILLÄGGSISOLERING ==========
  {
    id: "tillaggsisolering_standard",
    typeId: "tillaggsisolering",
    label: "Tilläggsisolering — vindbjälklag",
    description: "Tilläggsisolering av vindsbjälklag med lösull. Vanligaste åtgärden.",
    tier: "standard",
    investmentCostSEK: 50_000,
    lifespanYears: 40,
    reductionFactor: 0.12,
    reductionTarget: "heating",
  },
  {
    id: "tillaggsisolering_premium",
    typeId: "tillaggsisolering",
    label: "Tilläggsisolering — hel klimatskärm",
    description: "Vindsbjälklag + fasad + grund. Större besparing men högre kostnad.",
    tier: "premium",
    investmentCostSEK: 150_000,
    lifespanYears: 40,
    reductionFactor: 0.25,
    reductionTarget: "heating",
  },

  // ========== FÖNSTERBYTE ==========
  {
    id: "fonsterbyte_standard",
    typeId: "fonsterbyte",
    label: "Fönsterbyte 3-glas",
    description: "Byte till 3-glasfönster. U-värde ~1.0. Minskar drag och värmeförlust.",
    tier: "standard",
    investmentCostSEK: 130_000,
    lifespanYears: 30,
    reductionFactor: 0.10,
    reductionTarget: "heating",
  },

  // ========== ELDSTAD ==========
  {
    id: "eldstad_standard",
    typeId: "eldstad",
    label: "Eldstad / braskamin",
    description: "Modern braskamin med hög verkningsgrad (>80%). Kompletterar elen.",
    tier: "standard",
    investmentCostSEK: 50_000,
    lifespanYears: 30,
    reductionFactor: 0.15,
    reductionTarget: "heating",
  },

  // ========== SMARTSTYRNING ==========
  {
    id: "smartstyrning_standard",
    typeId: "smartstyrning",
    label: "Smart styrning",
    description: "Tibber/Greenely + smarta termostater. Optimerar förbrukning per timme.",
    tier: "standard",
    investmentCostSEK: 12_000,
    lifespanYears: 10,
    reductionFactor: 0.08,
    reductionTarget: "total",
  },

  // ========== VARMVATTENPUMP ==========
  {
    id: "varmvattenpump_standard",
    typeId: "varmvattenpump",
    label: "Varmvattenberedare med värmepump",
    description: "Fristående beredare med inbyggd värmepump (COP ~2.5–3). Ersätter elpatronberedare.",
    tier: "standard",
    investmentCostSEK: 35_000,
    lifespanYears: 15,
    reductionFactor: 0.65,
    reductionTarget: "hotwater",
    supplier: "Thermia / Ariston",
  },

  // ========== DYNAMISKT ELPRIS ==========
  {
    id: "dynamiskt_elpris_standard",
    typeId: "dynamiskt_elpris",
    label: "Byt till dynamiskt elpris",
    description: "Timpris via Tibber, Greenely m.fl. Ingen investeringskostnad.",
    tier: "standard",
    investmentCostSEK: 0,
    lifespanYears: 99,
  },
];


// ============================================================
// Lookup helpers
// ============================================================

/** Get all variants for a given upgrade type */
export function getVariantsForType(typeId: string): UpgradeVariant[] {
  return UPGRADE_VARIANTS.filter(v => v.typeId === typeId);
}

/** Get a specific variant by ID */
export function getVariant(variantId: string): UpgradeVariant | undefined {
  return UPGRADE_VARIANTS.find(v => v.id === variantId);
}

/** Get the upgrade type definition */
export function getUpgradeType(typeId: string): UpgradeType | undefined {
  return UPGRADE_TYPES.find(t => t.id === typeId);
}

/** Get the "standard" variant for a type (default recommendation) */
export function getStandardVariant(typeId: string): UpgradeVariant | undefined {
  return UPGRADE_VARIANTS.find(v => v.typeId === typeId && v.tier === "standard");
}

/**
 * Get all type IDs that are relevant for a given household.
 * Filters out types excluded by housing type and existing equipment.
 */
export function getRelevantTypeIds(
  housingType: "villa" | "radhus" | "lagenhet" = "villa",
  existingEquipment: string[] = []
): string[] {
  return UPGRADE_TYPES
    .filter(t => {
      // Exclude by housing type
      if (t.excludeForHousing?.includes(housingType)) return false;
      // Exclude if user already has this type
      if (existingEquipment.includes(t.id)) return false;
      // Exclude if incompatible with existing equipment
      if (t.incompatibleWith?.some(inc => existingEquipment.includes(inc))) return false;
      // Exclude if the user already has a type that makes this one pointless
      // (e.g. varmvattenpump is unnecessary if you have luftvatten/bergvärme)
      if (t.excludeIfExistingType?.some(dep => existingEquipment.includes(dep))) return false;
      return true;
    })
    .map(t => t.id);
}


// ============================================================
// Bridge to legacy system
// ============================================================

/**
 * Convert a variant selection to the legacy ActiveUpgrades format.
 * This allows the new variant system to work with existing simulation code
 * during the transition period.
 */
export function variantToLegacyUpgradeId(variant: UpgradeVariant): string {
  return variant.typeId;
}

/**
 * Get legacy-compatible parameters from a variant.
 * Returns an object that can be spread into Assumptions to override defaults.
 */
export function variantToAssumptions(variant: UpgradeVariant): Record<string, number> {
  const overrides: Record<string, number> = {};

  if (variant.systemSizeKw !== undefined) {
    overrides.solarSizeKw = variant.systemSizeKw;
  }
  if (variant.capacityKwh !== undefined) {
    overrides.batterySizeKwh = variant.capacityKwh;
  }

  return overrides;
}
