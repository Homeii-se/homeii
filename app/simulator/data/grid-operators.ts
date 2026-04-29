/**
 * Swedish grid operator (nätägare) pricing database.
 *
 * Avgifterna varierar per nätägare, säkringsstorlek och abonnemangstyp.
 * Värdena nedan är typiska för ett villahushåll med 16-35A säkring.
 *
 * @source Respektive nätägares prislista 2026
 * @source Energimarknadsinspektionen (Ei) — elnätsavgifter
 * @updated 2026-04-27
 *
 * @notes
 *   2026-04-27: Stor verifieringsrunda. 19 bolag verifierade direkt mot
 *   bolagens publicerade prislistor (inkl moms-värden konverterade till
 *   exkl moms via ÷ 1.25). Ellevio är pre-1-juni-state — bolaget tar
 *   bort effekttariff 1 juni 2026 och prislistan ändras då. E.ON och
 *   Tekniska verken splittade i regioner. Multi-region disambiguering
 *   sker via SE-zon i findGridOperator(name, zone?).
 *
 *   Sex distinkta effekttariff-modeller representeras: 1-topp (Mälarenergi),
 *   3-topp (Ellevio, Göteborg, Nacka, SEOM, Telge), 5-topp (Tekniska verken).
 *   Två formel-baserade överföringar (Kraftringen, Öresundskraft) — basvärdet
 *   lagras, formeln dokumenterad i source-fältet.
 */

import type { SEZone } from "../types";

export const VAT_RATE = 0.25;

export function withVat(amountExklVat: number): number {
  return amountExklVat * (1 + VAT_RATE);
}

export type FuseSize = 16 | 20 | 25 | 35 | 50 | 63;

export const WINTER_MONTHS = [11, 12, 1, 2, 3] as const;
export const SUMMER_MONTHS = [4, 5, 6, 7, 8, 9, 10] as const;

export interface PowerChargeModel {
  numberOfPeaks: 1 | 3 | 5;
  aggregation: "average" | "max" | "median";
  measurementWindow: {
    fromHour: number;
    toHour: number;
    days: "weekdays" | "all";
    weightOutsideWindow?: number;
  };
  seasonal?: {
    winter: { months: number[]; krPerKw: number };
    summer: { months: number[]; krPerKw: number };
  };
  maxOnePeakPerDay?: boolean;
}

export interface GridOperatorPricing {
  name: string;
  aliases: string[];
  zones: SEZone[];
  fixedFeeKrPerMonth: number;
  fixedFeesByFuseSize?: Partial<Record<FuseSize, number>>;
  transferFeeOrePerKwh: number;
  transferFeeBySeason?: {
    winter: { months: number[]; orePerKwh: number };
    summer: { months: number[]; orePerKwh: number };
  };
  hasPowerCharge: boolean;
  powerChargeKrPerKw: number;
  powerChargeModel?: PowerChargeModel;
  powerChargeModelVerified?: boolean;
  approximateCustomers: number;
  source: string;
  lastVerified: string;
}

export const GRID_OPERATORS: GridOperatorPricing[] = [
  {
    name: "Ellevio",
    aliases: ["ellevio", "ellevio ab"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 316,
    fixedFeesByFuseSize: { 16: 316, 20: 316, 25: 316, 35: 792 },
    transferFeeOrePerKwh: 5.6,
    hasPowerCharge: true,
    powerChargeKrPerKw: 65,
    powerChargeModel: {
      numberOfPeaks: 3,
      aggregation: "average",
      measurementWindow: {
        fromHour: 6,
        toHour: 22,
        days: "all",
        weightOutsideWindow: 0.5,
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 1000000,
    source: "Ellevio prislista 2026 (pre-1-juni). OBS: effekttariff tas bort 1 juni 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Vattenfall Eldistribution",
    aliases: ["vattenfall", "vattenfall eldistribution"],
    zones: ["SE2", "SE3"],
    fixedFeeKrPerMonth: 539,
    fixedFeesByFuseSize: { 16: 385, 20: 539, 25: 675, 35: 926 },
    transferFeeOrePerKwh: 35.6,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 900000,
    source: "Vattenfall Eldistribution prislista 2026 (enkeltariff E4).",
    lastVerified: "2026-04-27",
  },
  {
    name: "E.ON Energidistribution Syd",
    aliases: ["e.on syd", "eon syd", "e.on energidistribution syd"],
    zones: ["SE4"],
    fixedFeeKrPerMonth: 656,
    fixedFeesByFuseSize: { 16: 498, 20: 656, 25: 847, 35: 1239 },
    transferFeeOrePerKwh: 25.84,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 600000,
    source: "E.ON Energidistribution Syd prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "E.ON Energidistribution Stockholm",
    aliases: ["e.on stockholm", "eon stockholm", "e.on energidistribution stockholm"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 562,
    fixedFeesByFuseSize: { 16: 399, 20: 562, 25: 756, 35: 1175 },
    transferFeeOrePerKwh: 21.04,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 100000,
    source: "E.ON Energidistribution Stockholm prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "E.ON Energidistribution Nord",
    aliases: ["e.on nord", "eon nord", "e.on energidistribution nord"],
    zones: ["SE1", "SE2"],
    fixedFeeKrPerMonth: 714,
    fixedFeesByFuseSize: { 16: 558, 20: 714, 25: 905, 35: 1292 },
    transferFeeOrePerKwh: 21.04,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 100000,
    source: "E.ON Energidistribution Nord prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Göteborg Energi",
    aliases: ["göteborg energi", "goteborg energi"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 164,
    fixedFeesByFuseSize: { 16: 164, 20: 164, 25: 164, 35: 164 },
    transferFeeOrePerKwh: 18.4,
    hasPowerCharge: true,
    powerChargeKrPerKw: 39.2,
    powerChargeModel: {
      numberOfPeaks: 3,
      aggregation: "average",
      measurementWindow: {
        fromHour: 0,
        toHour: 24,
        days: "all",
        weightOutsideWindow: 1,
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 260000,
    source: "Göteborg Energi prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Kraftringen",
    aliases: ["kraftringen", "kraftringen nät"],
    zones: ["SE4"],
    fixedFeeKrPerMonth: 864,
    fixedFeesByFuseSize: { 16: 548, 20: 864, 25: 1076, 35: 1412 },
    transferFeeOrePerKwh: 16,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 150000,
    source: "Kraftringen prislista 2026. SPECIAL: överföring = 16 öre + 5% av spotpriset.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Tekniska verken Linköping",
    aliases: ["tekniska verken linköping", "tekniska verken linkoping", "tekniska verken"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 184,
    fixedFeesByFuseSize: { 16: 132, 20: 184, 25: 248, 35: 400 },
    transferFeeOrePerKwh: 11.92,
    hasPowerCharge: true,
    powerChargeKrPerKw: 18.4,
    powerChargeModel: {
      numberOfPeaks: 5,
      aggregation: "average",
      measurementWindow: {
        fromHour: 0,
        toHour: 24,
        days: "all",
        weightOutsideWindow: 1,
      },
      seasonal: {
        summer: { months: [4, 5, 6, 7, 8, 9, 10], krPerKw: 18.4 },
        winter: { months: [11, 12, 1, 2, 3], krPerKw: 36 },
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 80000,
    source: "Tekniska verken Linköping prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Tekniska verken Katrineholm",
    aliases: ["tekniska verken katrineholm"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 348,
    fixedFeesByFuseSize: { 16: 272, 20: 348, 25: 472, 35: 632 },
    transferFeeOrePerKwh: 14.64,
    hasPowerCharge: true,
    powerChargeKrPerKw: 27.2,
    powerChargeModel: {
      numberOfPeaks: 5,
      aggregation: "average",
      measurementWindow: {
        fromHour: 0,
        toHour: 24,
        days: "all",
        weightOutsideWindow: 1,
      },
      seasonal: {
        summer: { months: [4, 5, 6, 7, 8, 9, 10], krPerKw: 27.2 },
        winter: { months: [11, 12, 1, 2, 3], krPerKw: 52.8 },
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 20000,
    source: "Tekniska verken Katrineholm prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Nacka Energi",
    aliases: ["nacka energi"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 354.80,
    fixedFeesByFuseSize: { 16: 220.40, 20: 354.80, 25: 439.27, 35: 901.07 },
    transferFeeOrePerKwh: 7.36,
    hasPowerCharge: true,
    powerChargeKrPerKw: 45.22,
    powerChargeModel: {
      numberOfPeaks: 3,
      aggregation: "average",
      measurementWindow: {
        fromHour: 0,
        toHour: 24,
        days: "all",
        weightOutsideWindow: 1,
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 40000,
    source: "Nacka Energi prislista 2026. SPECIAL: tidstariff på överföring (LL/HL).",
    lastVerified: "2026-04-27",
  },
  {
    name: "Mälarenergi Elnät",
    aliases: ["mälarenergi", "malarenergi", "mälarenergi elnät"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 318,
    fixedFeesByFuseSize: { 16: 281, 20: 318, 25: 346, 35: 438 },
    transferFeeOrePerKwh: 17.2,
    hasPowerCharge: true,
    powerChargeKrPerKw: 47.4,
    powerChargeModel: {
      numberOfPeaks: 1,
      aggregation: "max",
      measurementWindow: {
        fromHour: 7,
        toHour: 19,
        days: "weekdays",
        weightOutsideWindow: 0,
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 80000,
    source: "Mälarenergi Elnät prislista 2026. 1-topps-modell.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Öresundskraft",
    aliases: ["öresundskraft", "oresundskraft"],
    zones: ["SE4"],
    fixedFeeKrPerMonth: 568.34,
    fixedFeesByFuseSize: { 16: 344, 20: 568.34, 25: 692.66, 35: 1052.34 },
    transferFeeOrePerKwh: 13.6,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 80000,
    source: "Öresundskraft prislista 2026. SPECIAL: överföring + 5.57% av MMU.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Skellefteå Kraft Elnät",
    aliases: ["skellefteå kraft", "skelleftea kraft", "skellefteå kraft elnät"],
    zones: ["SE1"],
    fixedFeeKrPerMonth: 545.34,
    fixedFeesByFuseSize: { 16: 377.34, 20: 545.34, 25: 661.34, 35: 843.34 },
    transferFeeOrePerKwh: 8.8,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 70000,
    source: "Skellefteå Kraft Elnät prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Umeå Energi Elnät",
    aliases: ["umeå energi", "umea energi", "umeå energi elnät"],
    zones: ["SE1"],
    fixedFeeKrPerMonth: 273,
    fixedFeesByFuseSize: { 16: 182.40, 20: 273, 25: 340.60, 35: 459.86 },
    transferFeeOrePerKwh: 18.4,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 60000,
    source: "Umeå Energi Elnät prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Jämtkraft Elnät",
    aliases: ["jämtkraft", "jamtkraft", "jämtkraft elnät"],
    zones: ["SE2"],
    fixedFeeKrPerMonth: 622.66,
    fixedFeesByFuseSize: { 16: 380, 20: 622.66, 25: 792, 35: 1129.34 },
    transferFeeOrePerKwh: 6,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 50000,
    source: "Jämtkraft Elnät prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Borås Elnät",
    aliases: ["borås elnät", "boras elnat", "borås elnät ab", "nätkraft borås", "natkraft boras"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 469,
    fixedFeesByFuseSize: { 16: 268, 20: 469, 25: 492, 35: 672 },
    transferFeeOrePerKwh: 12.56,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 50000,
    source: "Borås Elnät / Nätkraft Borås prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Eskilstuna Energi och Miljö",
    aliases: ["eskilstuna energi", "eskilstuna energi och miljö", "eem", "eem elnät"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 429,
    fixedFeesByFuseSize: { 16: 324.34, 20: 429, 25: 523 },
    transferFeeOrePerKwh: 23.52,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 45000,
    source: "Eskilstuna Energi & Miljö prislista 2026 (säkringspris 16-25A). 35A+ använder separat effektpris-tariff.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Sollentuna Energi och Miljö",
    aliases: ["sollentuna energi", "seom", "sollentuna energi och miljö"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 118.66,
    fixedFeesByFuseSize: { 16: 118.66, 20: 118.66, 25: 118.66, 35: 211.66 },
    transferFeeOrePerKwh: 4,
    hasPowerCharge: true,
    powerChargeKrPerKw: 58,
    powerChargeModel: {
      numberOfPeaks: 3,
      aggregation: "average",
      measurementWindow: {
        fromHour: 7,
        toHour: 19,
        days: "weekdays",
        weightOutsideWindow: 0,
      },
      seasonal: {
        summer: { months: [4, 5, 6, 7, 8, 9, 10], krPerKw: 58 },
        winter: { months: [11, 12, 1, 2, 3], krPerKw: 116 },
      },
      maxOnePeakPerDay: true,
    },
    powerChargeModelVerified: true,
    approximateCustomers: 30000,
    source: "Sollentuna Energi & Miljö (SEOM) prislista 2026. SPECIAL: max 1 effekttopp per dygn.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Boo Energi",
    aliases: ["boo energi"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 303.20,
    fixedFeesByFuseSize: { 16: 266.40, 20: 303.20, 25: 352, 35: 464 },
    transferFeeOrePerKwh: 24.8,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 10000,
    source: "Boo Energi prislista 2026.",
    lastVerified: "2026-04-27",
  },
  {
    name: "Telge Nät",
    aliases: ["telge nät", "telge nat", "telge"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 402.40,
    fixedFeesByFuseSize: { 16: 370.06, 20: 402.40, 25: 442.80, 35: 523.66 },
    transferFeeOrePerKwh: 5.6,
    hasPowerCharge: true,
    powerChargeKrPerKw: 100.08,
    powerChargeModel: {
      numberOfPeaks: 3,
      aggregation: "average",
      measurementWindow: {
        fromHour: 7,
        toHour: 20,
        days: "weekdays",
        weightOutsideWindow: 0,
      },
      seasonal: {
        summer: { months: [4, 5, 6, 7, 8, 9, 10], krPerKw: 0 },
        winter: { months: [11, 12, 1, 2, 3], krPerKw: 100.08 },
      },
    },
    powerChargeModelVerified: true,
    approximateCustomers: 50000,
    source: "Telge Nät prislista 2026. SPECIAL: effektavgift bara nov-mars.",
    lastVerified: "2026-04-27",
  },
];

export const DEFAULT_GRID_PRICING: Omit<GridOperatorPricing, "name" | "aliases" | "zones" | "approximateCustomers" | "source" | "lastVerified"> = {
  fixedFeeKrPerMonth: 400,
  transferFeeOrePerKwh: 14,
  hasPowerCharge: false,
  powerChargeKrPerKw: 0,
};

export function findGridOperator(
  name: string,
  zone?: SEZone
): GridOperatorPricing | null {
  if (!name || name.trim().length === 0) return null;
  const normalized = name.trim().toLowerCase();

  const matches: GridOperatorPricing[] = [];
  for (const op of GRID_OPERATORS) {
    if (op.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      matches.push(op);
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  if (zone) {
    const zoneMatch = matches.find(op => op.zones.includes(zone));
    if (zoneMatch) return zoneMatch;
  }

  if (zone && (normalized === "e.on" || normalized === "eon" || normalized === "e.on energidistribution")) {
    if (zone === "SE4") return GRID_OPERATORS.find(o => o.name === "E.ON Energidistribution Syd") ?? null;
    if (zone === "SE3") return GRID_OPERATORS.find(o => o.name === "E.ON Energidistribution Stockholm") ?? null;
    if (zone === "SE1" || zone === "SE2") return GRID_OPERATORS.find(o => o.name === "E.ON Energidistribution Nord") ?? null;
  }

  if (normalized === "tekniska verken" || normalized === "tekniska verken ab") {
    return GRID_OPERATORS.find(o => o.name === "Tekniska verken Linköping") ?? null;
  }

  return matches[0];
}

export function inferZoneFromGridOperator(gridOperatorName?: string): SEZone | undefined {
  if (!gridOperatorName) return undefined;
  const operator = findGridOperator(gridOperatorName);
  return operator?.zones[0];
}

export function getGridPricing(gridOperatorName?: string): typeof DEFAULT_GRID_PRICING {
  const operator = gridOperatorName ? findGridOperator(gridOperatorName) : null;
  if (operator) {
    return {
      fixedFeeKrPerMonth: operator.fixedFeeKrPerMonth,
      transferFeeOrePerKwh: operator.transferFeeOrePerKwh,
      hasPowerCharge: operator.hasPowerCharge,
      powerChargeKrPerKw: operator.powerChargeKrPerKw,
    };
  }
  return { ...DEFAULT_GRID_PRICING };
}

export function getFixedFee(
  operator: GridOperatorPricing,
  fuseSize?: FuseSize
): number {
  if (fuseSize !== undefined && operator.fixedFeesByFuseSize?.[fuseSize] !== undefined) {
    return operator.fixedFeesByFuseSize[fuseSize]!;
  }
  return operator.fixedFeeKrPerMonth;
}

export function getTransferFee(
  operator: GridOperatorPricing,
  monthOneIndexed?: number
): number {
  const seasonal = operator.transferFeeBySeason;
  if (seasonal && monthOneIndexed !== undefined) {
    return seasonal.winter.months.includes(monthOneIndexed)
      ? seasonal.winter.orePerKwh
      : seasonal.summer.orePerKwh;
  }
  return operator.transferFeeOrePerKwh;
}

export function getPowerChargeKrPerKw(
  operator: GridOperatorPricing,
  monthOneIndexed?: number
): number {
  const seasonal = operator.powerChargeModel?.seasonal;
  if (seasonal && monthOneIndexed !== undefined) {
    return seasonal.winter.months.includes(monthOneIndexed)
      ? seasonal.winter.krPerKw
      : seasonal.summer.krPerKw;
  }
  return operator.powerChargeKrPerKw;
}

export function getPowerChargeModel(
  gridOperatorName?: string,
  zone?: SEZone
): PowerChargeModel | null {
  if (!gridOperatorName) return null;
  const operator = findGridOperator(gridOperatorName, zone);
  if (!operator || !operator.hasPowerCharge || !operator.powerChargeModel) return null;
  if (!operator.powerChargeModelVerified) return null;
  return operator.powerChargeModel;
}

export function describePowerChargeModel(model: PowerChargeModel): string[] {
  const aggregateLabel: Record<PowerChargeModel["aggregation"], string> = {
    average: "Snittet av",
    max: "Maxvärdet av",
    median: "Medianen av",
  };
  const peaksLabel = model.numberOfPeaks === 1 ? "din högsta timme" : `dina ${model.numberOfPeaks} högsta timmar`;
  const lines: string[] = [
    `${aggregateLabel[model.aggregation]} ${peaksLabel} varje månad räknas`,
  ];
  const { fromHour, toHour, days, weightOutsideWindow } = model.measurementWindow;
  const dayLabel = days === "weekdays" ? "på vardagar" : "alla dagar";
  const fromStr = String(fromHour).padStart(2, "0");
  const toStr = String(toHour).padStart(2, "0");
  const fullWindow = fromHour === 0 && toHour === 24 && days === "all";
  if (fullWindow) {
    lines.push("Mätning sker dygnet runt, alla dagar");
  } else {
    lines.push(`Full kostnad mellan ${fromStr}:00–${toStr}:00 ${dayLabel}`);
    const outside = weightOutsideWindow ?? 0;
    if (outside === 0) {
      lines.push("Inte på kvällar, nätter eller helger");
    } else if (outside === 0.5) {
      lines.push("Halv kostnad på kvällar, nätter och helger");
    } else if (outside === 1) {
      lines.push("Samma kostnad även på kvällar, nätter och helger");
    } else {
      const pct = Math.round(outside * 100);
      lines.push(`${pct} % av kostnaden på kvällar, nätter och helger`);
    }
  }
  if (model.seasonal) {
    if (model.seasonal.summer.krPerKw === 0) {
      lines.push("Bara på vintern (nov–mars) — sommarmånader gratis");
    } else if (model.seasonal.winter.krPerKw > model.seasonal.summer.krPerKw) {
      const winterPct = Math.round((model.seasonal.winter.krPerKw / model.seasonal.summer.krPerKw - 1) * 100);
      lines.push(`Vinter (nov–mars) ${winterPct} % dyrare än sommar`);
    }
  }
  if (model.maxOnePeakPerDay) {
    lines.push("Max en topp per dygn räknas");
  }
  return lines;
}
