/**
 * Swedish grid operator (nätägare) pricing database.
 *
 * Avgifterna varierar per nätägare, säkringsstorlek och abonnemangstyp.
 * Värdena nedan är typiska för ett villahushåll med 16-25A säkring.
 *
 * @source Respektive nätägares prislista 2026
 * @source Energimarknadsinspektionen (Ei) — elnätsavgifter
 * @source Svea Solar — effektavgift per nätägare (sveasolar.se/blogg/effektavgift-elnat-lista-datum)
 * @updated 2026-04-04
 * @notes Regeringen stoppade kravet på obligatorisk effektavgift i mars 2026.
 *        Nätägare som redan infört den behåller den, övriga avvaktar.
 */

import type { SEZone } from "../types";

export interface GridOperatorPricing {
  /** Nätägarens namn (som det visas på fakturan) */
  name: string;
  /** Vanliga varianter av namnet (för fuzzy matching) */
  aliases: string[];
  /** SE-zon(er) som nätägaren verkar i */
  zones: SEZone[];
  /** Fast abonnemangsavgift exkl moms (kr/mån) — typisk villa 16-25A */
  fixedFeeKrPerMonth: number;
  /** Rörlig överföringsavgift exkl moms (öre/kWh) */
  transferFeeOrePerKwh: number;
  /** Har effektavgift? */
  hasPowerCharge: boolean;
  /** Effektavgift exkl moms (kr/kW/mån) — 0 om hasPowerCharge=false */
  powerChargeKrPerKw: number;
  /** Antal kunder (för att vikta defaultvärden) */
  approximateCustomers: number;
  /** Källa för prisdata */
  source: string;
  /** Senast verifierad */
  lastVerified: string;
}

/**
 * De ~10 största nätägarna täcker ca 70% av svenska hushåll.
 * För okänd nätägare används DEFAULT_GRID_PRICING.
 */
export const GRID_OPERATORS: GridOperatorPricing[] = [
  {
    name: "Ellevio",
    aliases: ["ellevio", "ellevio ab"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 395,
    transferFeeOrePerKwh: 7.0,
    hasPowerCharge: true,
    powerChargeKrPerKw: 65,
    approximateCustomers: 1000000,
    source: "Ellevio prislista 2026, ellevio.se/priser",
    lastVerified: "2026-04-04",
  },
  {
    name: "Vattenfall Eldistribution",
    aliases: ["vattenfall", "vattenfall eldistribution"],
    zones: ["SE2", "SE3"],
    fixedFeeKrPerMonth: 384,
    transferFeeOrePerKwh: 35.6,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 900000,
    source: "Vattenfall Eldistribution prislista 2026",
    lastVerified: "2026-04-04",
  },
  {
    name: "E.ON Energidistribution",
    aliases: ["e.on", "eon", "e.on energidistribution"],
    zones: ["SE3", "SE4"],
    fixedFeeKrPerMonth: 280,
    transferFeeOrePerKwh: 25.0,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 800000,
    source: "E.ON Energidistribution prislista 2026",
    lastVerified: "2026-04-04",
  },
  {
    name: "Göteborg Energi",
    aliases: ["göteborg energi", "goteborg energi"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 300,
    transferFeeOrePerKwh: 20.0,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 260000,
    source: "Göteborg Energi prislista 2026",
    lastVerified: "2026-04-04",
  },
  {
    name: "Kraftringen",
    aliases: ["kraftringen", "kraftringen nät"],
    zones: ["SE4"],
    fixedFeeKrPerMonth: 260,
    transferFeeOrePerKwh: 22.0,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 150000,
    source: "Kraftringen prislista 2026",
    lastVerified: "2026-04-04",
  },
  {
    name: "Tekniska verken",
    aliases: ["tekniska verken", "tekniska verken linköping"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 280,
    transferFeeOrePerKwh: 18.0,
    hasPowerCharge: false,
    powerChargeKrPerKw: 0,
    approximateCustomers: 100000,
    source: "Tekniska verken prislista 2026",
    lastVerified: "2026-04-04",
  },
  {
    name: "Nacka Energi",
    aliases: ["nacka energi"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 300,
    transferFeeOrePerKwh: 8.0,
    hasPowerCharge: true,
    powerChargeKrPerKw: 55,
    approximateCustomers: 40000,
    source: "Nacka Energi prislista 2026",
    lastVerified: "2026-04-04",
  },
];

/**
 * Standardvärden för okänd nätägare.
 * Baserat på viktat genomsnitt av de största nätägarna.
 *
 * @source Energimarknadsinspektionen — Elnätsavgifter i Sverige 2025
 * @updated 2026-04-04
 * @notes Överföringsavgiften satt till 10 öre som konservativt genomsnitt.
 *        Nätägare utan effektavgift kompenserar med högre överföring.
 *        Nätägare med effektavgift har ofta lägre överföring (5-8 öre).
 */
export const DEFAULT_GRID_PRICING: Omit<GridOperatorPricing, "name" | "aliases" | "zones" | "approximateCustomers" | "source" | "lastVerified"> = {
  fixedFeeKrPerMonth: 320,
  transferFeeOrePerKwh: 10.0,
  hasPowerCharge: false,
  powerChargeKrPerKw: 0,
};

/**
 * Fuzzy-match a grid operator name against known operators.
 * Returns the matching operator or null.
 */
export function findGridOperator(name: string): GridOperatorPricing | null {
  if (!name || name.trim().length === 0) return null;
  const normalized = name.trim().toLowerCase();

  for (const op of GRID_OPERATORS) {
    if (op.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      return op;
    }
  }
  return null;
}

/**
 * Infer SE zone from grid operator name.
 * Most operators serve a single zone; returns the first zone if multiple.
 */
export function inferZoneFromGridOperator(gridOperatorName?: string): SEZone | undefined {
  if (!gridOperatorName) return undefined;
  const operator = findGridOperator(gridOperatorName);
  return operator?.zones[0];
}

/**
 * Get grid pricing for a household.
 * If grid operator is known, use their pricing. Otherwise use defaults.
 */
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
