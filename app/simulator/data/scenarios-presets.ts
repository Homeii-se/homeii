/**
 * HOMEii – Scenario-presetkatalog (v3)
 * =====================================
 * Basår 2025, zonspecifika multipliers, fem scenarier inklusive
 * en "snäll" framtid där förnybar el byggs ut snabbare än efterfrågan.
 */

import type { SEZone } from "../types";

export type ScenarioCategory = "history" | "future" | "special";

export interface ScenarioSource {
  label: string;
  url: string;
  retrievedAt: string;
}

interface ScenarioPresetBase {
  id: string;
  label: string;
  subtitle?: string;
  description: string;
  sofiaHook: string;
  category: ScenarioCategory;
  defaultPriceResolution: "hourly" | "monthly";
  updatedAt: string;
  sources: ScenarioSource[];
  methodNote?: string;
}

export interface HistoricalYearPreset extends ScenarioPresetBase {
  kind: "historical-year";
  year: number;
  zone: SEZone;
}

export interface ForeignMarketPreset extends ScenarioPresetBase {
  kind: "foreign-market";
  referenceYear: number;
  foreignMarketId: "DE" | "NL" | "FR" | "FI" | "NO" | "DK";
  foreignZoneId: string;
}

export interface ProjectionPreset extends ScenarioPresetBase {
  kind: "projection";
  baseYear: number;
  baseZone: SEZone;
  priceMultiplier: number;
  priceMultiplierByZone?: Partial<Record<SEZone, number>>;
  horizonYears: number;
}

export type ScenarioPreset =
  | HistoricalYearPreset
  | ForeignMarketPreset
  | ProjectionPreset;

const SRC_ENTSOE: ScenarioSource = {
  label: "ENTSO-E Transparency Platform, Day-Ahead Prices",
  url: "https://transparency.entsoe.eu/",
  retrievedAt: "2026-04-24",
};

const SRC_EU_FIT55: ScenarioSource = {
  label: "EU Fit-for-55, European Green Deal",
  url: "https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/european-green-deal/delivering-european-green-deal_en",
  retrievedAt: "2026-04-24",
};

const SRC_EM_LANGTID: ScenarioSource = {
  label: "Energimyndigheten – Långsiktiga scenarier över energisystemet",
  url: "https://www.energimyndigheten.se/statistik/prognoser-och-scenarier/",
  retrievedAt: "2026-04-24",
};

const SRC_SVK_SYSTEMPLAN: ScenarioSource = {
  label: "Svenska kraftnät – Systemutvecklingsplan 2024–2033",
  url: "https://www.svk.se/utveckling-av-kraftsystemet/",
  retrievedAt: "2026-04-24",
};

const SRC_STEGRA: ScenarioSource = {
  label: "Stegra (H2 Green Steel) – fossilfri stålproduktion i Boden",
  url: "https://www.stegra.com/",
  retrievedAt: "2026-04-24",
};

const SRC_HYBRIT: ScenarioSource = {
  label: "LKAB HYBRIT – fossilfri järnmalm i Gällivare",
  url: "https://www.hybritdevelopment.se/",
  retrievedAt: "2026-04-24",
};

const SRC_IEA: ScenarioSource = {
  label: "IEA – World Energy Outlook 2024 (Renewables + electricity)",
  url: "https://www.iea.org/reports/world-energy-outlook-2024",
  retrievedAt: "2026-04-24",
};

export const SCENARIO_PRESETS: ScenarioPreset[] = [

  // === HISTORIA ===
  {
    id: "energikrisen-2022",
    kind: "historical-year",
    year: 2022,
    zone: "SE3",
    category: "history",
    label: "Om 2022-krisen upprepas",
    subtitle: "Rekordhöga priser när Europas gas försvann",
    description:
      "Hösten 2022 föll Rysslands gasleveranser bort och hela Europa fick skyhöga elpriser. SE3 låg på 138 öre/kWh i snitt för hela året – september toppade på 203 öre. Ett värdefullt worst-case att förbereda sig för: vad händer om det kommer tillbaka?",
    sofiaHook:
      "Så hög skulle din räkning bli om elkrisen kom tillbaka. Är du förberedd?",
    methodNote:
      "Använder faktiska ENTSO-E day-ahead-priser för din elzon under hela 2022. Ingen projektion – bara rak uppspelning på din nuvarande förbrukningsprofil. Nätavgifter, elskatt och fasta avgifter hålls på dagens nivå så du ser den isolerade effekten av marknadspriset.",
    defaultPriceResolution: "hourly",
    updatedAt: "2026-04-24",
    sources: [SRC_ENTSOE],
  },

  // === GRANNMARKNAD ===
  {
    id: "eu-sammankoppling",
    kind: "foreign-market",
    referenceYear: 2025,
    foreignMarketId: "DE",
    foreignZoneId: "DE-LU",
    category: "special",
    label: "Sammankopplat elnät med kontinenten",
    subtitle: "Prisnivå som Tyskland 2025",
    description:
      "EU vill bygga ut överföringskablarna mellan Norden och kontinenten för att stabilisera marknaden. När det händer närmar sig svenska priser tyska – som idag är nästan dubbelt så höga som svenska. Vattenkraftens prisfördel för Sverige minskar i takt med att kablarna byggs ut.",
    sofiaHook:
      "Om kablarna till Europa byggs ut närmar sig din räkning tyska nivåer. Så skulle det se ut redan idag.",
    methodNote:
      "Använder faktiska tyska (DE-LU) day-ahead-priser från hela 2025 via ENTSO-E. Vi tillämpar dem på din svenska förbrukningsprofil – vilket visar vad DU skulle betala om svenska priser låg på tysk nivå. Profilen är oförändrad; bara prissättningen byts.",
    defaultPriceResolution: "hourly",
    updatedAt: "2026-04-24",
    sources: [SRC_ENTSOE],
  },

  // === FRAMTID: POSITIV ===
  {
    id: "fornybar-expansion",
    kind: "projection",
    baseYear: 2025,
    baseZone: "SE3",
    priceMultiplier: 0.82,
    priceMultiplierByZone: {
      SE1: 0.88,  // norr har redan mycket vattenkraft, mindre relativ effekt
      SE2: 0.85,
      SE3: 0.80,  // störst vinst — här byggs sol+vind mest
      SE4: 0.85,  // närmast kontinenten, prisspridning från Europa
    },
    horizonYears: 5,
    category: "future",
    label: "Grön omställning lyckas",
    subtitle: "Sol, vind och lagring växer snabbare än efterfrågan",
    description:
      "Om utbyggnaden av förnybar kraft (solceller, vindkraft och batterilagring) går snabbare än efterfrågetillväxten sjunker genomsnittspriset med cirka 20 %. MEN timvariationerna ökar kraftigt: när det blåser och solen skiner är elen nästan gratis; vid vindstilla vintermorgnar blir den dyr. Vinnarna är de med timavtal och smart styrning – förlorarna är de som inte anpassar sig.",
    sofiaHook:
      "Blåsiga dagar nästan gratis, vindstilla morgnar dyrt. Med timavtal och smart styrning kan din räkning bli betydligt lägre än idag.",
    methodNote:
      "Utgår från 2025 års faktiska timpriser och multiplicerar med 0,80–0,88 beroende på elzon. Detta motsvarar IEA:s scenarier för snabb förnybar utbyggnad där genomsnittspriset sjunker men volatiliteten ökar. Värdet av timavtal blir betydligt större i detta scenario – kör toggeln mellan Timavtal och Månadsavtal för att se skillnaden.",
    defaultPriceResolution: "hourly",
    updatedAt: "2026-04-24",
    sources: [SRC_IEA, SRC_EM_LANGTID],
  },

  // === FRAMTID: NEGATIV (svensk industri) ===
  {
    id: "norra-sverige-stalboom",
    kind: "projection",
    baseYear: 2025,
    baseZone: "SE3",
    priceMultiplier: 1.40,
    priceMultiplierByZone: {
      SE1: 2.20,
      SE2: 2.10,
      SE3: 1.40,
      SE4: 1.25,
    },
    horizonYears: 5,
    category: "future",
    label: "Stålboomen i norra Sverige",
    subtitle: "Stegra, HYBRIT och H2 Green Steel driver upp priset",
    description:
      "Stora satsningar på fossilfri stålproduktion i norra Sverige: Stegra i Boden (~5 TWh/år), LKAB HYBRIT i Gällivare (upp till 55 TWh/år vid 2050) och H2 Green Steel i Luleå. Elefterfrågan i SE1/SE2 mångdubblas innan utbyggnaden av produktion och överföring hinner med. Gapet mellan norra och södra Sverige minskar – eller vänds helt. Svenska kraftnäts prognoser pekar på pristryck uppåt för hela landet.",
    sofiaHook:
      "När ståljättarna i norr startar påverkas din elräkning – mest om du bor i norr, men effekten sprider sig till hela landet.",
    methodNote:
      "Utgår från 2025 års faktiska timpriser per SE-zon och applicerar zonspecifika multipliers: SE1 ×2,2 (lokal effekt), SE2 ×2,1, SE3 ×1,4, SE4 ×1,25. Baserat på Svenska kraftnäts 'hög-efterfrågan'-scenario 2030 där elkonsumtionen i norra Sverige fördubblas och flaskhalsar i överföringsnätet gör att priserna jämnas ut mellan zonerna. Obs: detta är en försiktig medelnivå – peak-timmar kan bli betydligt högre.",
    defaultPriceResolution: "hourly",
    updatedAt: "2026-04-24",
    sources: [SRC_SVK_SYSTEMPLAN, SRC_STEGRA, SRC_HYBRIT],
  },

  // === FRAMTID: EU-koppling ===
  {
    id: "eu-2030-mal",
    kind: "projection",
    baseYear: 2025,
    baseZone: "SE3",
    priceMultiplier: 1.35,
    priceMultiplierByZone: {
      SE1: 1.40,
      SE2: 1.40,
      SE3: 1.35,
      SE4: 1.30,
    },
    horizonYears: 5,
    category: "future",
    label: "EU:s klimatmål 2030",
    subtitle: "Fit-for-55 driver upp efterfrågan i hela Europa",
    description:
      "Om EU driver igenom klimatmålen till 2030 ökar efterfrågan på el kraftigt i hela Europa. Transport, industri och uppvärmning elektrifieras snabbare än ny produktion hinner byggas. Energimyndighetens huvudscenario räknar med 3–5 % årlig prisökning – vi använder +35 % kumulativt till 2030 som trovärdig medelnivå.",
    sofiaHook:
      "När Europa drar upp tempot på klimatomställningen får du också högre elräkning.",
    methodNote:
      "Utgår från 2025 års faktiska timpriser och applicerar zonspecifika multipliers (SE1/SE2 ×1,40, SE3 ×1,35, SE4 ×1,30). Norra Sverige drabbas lite mer pga elintensiv industri; södra Sverige är redan närmare kontinental prisnivå så relativ ökning blir mindre. Multipliers ligger i övre halvan av Energimyndighetens huvudscenario för årlig prisutveckling 2025–2030.",
    defaultPriceResolution: "hourly",
    updatedAt: "2026-04-24",
    sources: [SRC_EU_FIT55, SRC_EM_LANGTID],
  },
];

export function getPresetById(id: string): ScenarioPreset | undefined {
  return SCENARIO_PRESETS.find((p) => p.id === id);
}

export function getPresetsByCategory(category: ScenarioCategory): ScenarioPreset[] {
  return SCENARIO_PRESETS.filter((p) => p.category === category);
}

export function sortedPresetsForUI(): ScenarioPreset[] {
  // Visa positiva framtidsscenarier först, sedan history, sedan grannmarknad, sedan negativa framtidsscenarier
  // Men enklast: history -> special -> future (positiv först, negativ sist)
  const CATEGORY_ORDER: Record<ScenarioCategory, number> = { history: 1, special: 2, future: 3 };
  return [...SCENARIO_PRESETS].sort((a, b) => {
    const c = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (c !== 0) return c;
    // Inom future: sortera positiva först (mult < 1) sedan negativa (mult > 1)
    if (a.category === "future" && a.kind === "projection" && b.kind === "projection") {
      return a.priceMultiplier - b.priceMultiplier;
    }
    const ya = "year" in a ? a.year : "referenceYear" in a ? a.referenceYear : "baseYear" in a ? a.baseYear : 0;
    const yb = "year" in b ? b.year : "referenceYear" in b ? b.referenceYear : "baseYear" in b ? b.baseYear : 0;
    return yb - ya;
  });
}

export function presetMeta(p: ScenarioPreset): { dataSource: string; lastUpdated: string } {
  return {
    dataSource: p.sources.map((s) => s.label).join(", "),
    lastUpdated: p.updatedAt,
  };
}

export function getProjectionMultiplier(preset: ProjectionPreset, userZone: SEZone): number {
  return preset.priceMultiplierByZone?.[userZone] ?? preset.priceMultiplier;
}
