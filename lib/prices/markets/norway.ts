/**
 * HOMEii – Prismodul: Norge (stub)
 * =================================
 * Placeholder för framtida implementation.
 *
 * Norge har 5 elområden: NO1 (Oslo), NO2 (Kristiansand),
 * NO3 (Molde), NO4 (Tromsø), NO5 (Bergen).
 * Datakälla: ENTSO-E (samma API, andra EIC-koder) + Nordpool.
 *
 * TODO: Implementera när ni expanderar till Norge.
 */

import type { MarketConfig } from "../types";

export const NORWAY_MARKET: MarketConfig = {
  id:                 "NO",
  name:               "Norge",
  currency:           "NOK",
  supportsLivePrices: false, // Inte implementerat ännu
  historicalFrom:     2020,
  sources:            ["entsoe"],
  zones: [
    { id:"NO1", label:"Oslo",         shortLabel:"Oslo",         countryCode:"NO" },
    { id:"NO2", label:"Kristiansand", shortLabel:"Kristiansand", countryCode:"NO" },
    { id:"NO3", label:"Molde",        shortLabel:"Molde",        countryCode:"NO" },
    { id:"NO4", label:"Tromsø",       shortLabel:"Tromsø",       countryCode:"NO" },
    { id:"NO5", label:"Bergen",       shortLabel:"Bergen",       countryCode:"NO" },
  ],
};
