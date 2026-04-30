/**
 * UI strings for ResultV2 components — collected centrally to make future
 * i18n work mechanical rather than archaeology (see CLAUDE.md conventions).
 *
 * All Swedish today. Keys are stable identifiers; values are user-facing copy.
 */

export const MOT_GRANNAR = {
  cardLabel: "Mot dina grannar",
  betaTag: "⚠ Beta",
  modeledPrefix: "Modellerad jämförelse · ~",
  modeledSuffix: " villor",
  underAverage: "under snittet",
  aboveAverage: "över snittet",
  buckets: {
    p10: "Topp 10 %",
    p50: "Snitt",
    p90: "Topp 10 % dyraste",
  },
  duLabel: "Du",
  fjarrvarmeNoteTitle: "Du har fjärrvärme.",
  fjarrvarmeNoteBody:
    "Din elräkning är naturligt lägre eftersom uppvärmningen sker via " +
    "fjärrvärme. Total energianvändning kan vara annorlunda — den jämförelsen " +
    "fångar inte denna vy.",
  sizeAdjustmentNote: (userArea: number, lanLabel: string, lanAvg: number) =>
    `Justerat för din husstorlek (${userArea} m² inkl. biarea) — jämförs mot ` +
    `villor av liknande storlek i ${lanLabel} (snitt ${lanAvg} m²).`,
  insightMore: "av husen i",
  insightDirectionMore: "betalar mer än du",
  insightDirectionLess: "betalar mindre än du",
} as const;

export const ENERGYSCORE = {
  cardLabel: "Din energyscore",
  betaTag: "⚠ Beta",
  positionLabel: "Så ligger ditt hus till",
  improvementLabel: "Möjlighet att förbättra",
  perYearSuffix: "per år som du kan spara",
  aspirational: "Ett steg närmare en uppgraderad sommarsemester",
  alreadyTopText: "Du är redan i toppskiktet bland villor i ditt område.",
  ctaShowActions: "Visa hur du kan spara →",
  howIsThisCalculated: "Hur räknas detta? →",
} as const;
