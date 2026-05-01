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

/**
 * Insight bubble copy — picked by segment from
 * lib/comparison/insight.ts -> resolveInsightCopy().
 *
 * Each segment renders as { title } in bold + { body } as continuation.
 * Helper functions below assemble interpolated bodies.
 *
 * Tone: Sofia-persona — kronor before percent, "snitthuset i ditt område"
 * not jargon, warm vardagston, no exclamation marks. Hög räkning vänds till
 * en möjlighet ("goda nyheter"), inte ett misslyckande.
 */
export const INSIGHT_BUBBLE = {
  // Titles per segment.
  titles: {
    wellBelow: "Snyggt jobbat",
    wellBelowFjarrvarme: "Du har fjärrvärme",
    below: "Lite mindre än grannarna",
    near: "Mitt i mängden",
    above: "Lite mer än grannarna",
    wellAbove: "Här finns mest att vinna",
  },
  // Body builders — receive resolved data, return body string.
  bodyWellBelow: (data: { percentMore: number; hasFjarrvarme: boolean }) => {
    if (data.hasFjarrvarme) {
      return "Din elräkning är låg eftersom värmen kommer från fjärrvärme. Den syns inte här, så hela energinotan kan se annorlunda ut.";
    }
    return `Bara ${data.percentMore} av 100 villor i ditt område drar mindre el än din. Något ni gör fungerar.`;
  },
  bodyBelow: (data: { diffKr: number }) =>
    `Du betalar runt ${formatKr(data.diffKr)} kr mindre per år än snitthuset i ditt område. Det märks i plånboken.`,
  bodyNear: () =>
    "Din räkning är ungefär lika stor som de flesta i ditt område. Inget oroande — men det går nästan alltid att hitta några tusen att kapa.",
  bodyAbove: (data: { diffKr: number; savingsKr?: number }) => {
    const savings = data.savingsKr
      ? ` Vi har räknat fram att ${formatKr(data.savingsKr)} kr/år går att kapa — utan att behöva frysa.`
      : " Det är oftast små vanor som ger den skillnaden.";
    return `Du betalar runt ${formatKr(data.diffKr)} kr mer per år än snitthuset i ditt område.${savings}`;
  },
  bodyWellAbove: (data: { savingsKr?: number }) => {
    const savings = data.savingsKr
      ? ` Vi har räknat fram att ${formatKr(data.savingsKr)} kr/år går att kapa.`
      : " Det betyder att det finns mycket att vinna med rätt åtgärder.";
    return `Räkningen är hög — och det är faktiskt goda nyheter.${savings}`;
  },
} as const;

function formatKr(n: number): string {
  return new Intl.NumberFormat("sv-SE").format(Math.round(n));
}

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
