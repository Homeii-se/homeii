/**
 * CO2 emission factors per energy source (g CO2e/kWh).
 *
 * Stub — full implementation in next iteration.
 *
 * @source Naturvårdsverket, Energimyndigheten
 * @updated 2026-04-04
 * @notes Genomsnittliga emissionsfaktorer för svensk elproduktion
 */

/** Gram CO2-equivalent per kWh for different energy sources */
export const CO2_FACTORS = {
  /** Swedish grid average (mostly hydro + nuclear) */
  gridAverageSE: 45,
  /** Solar PV (lifecycle including manufacturing) */
  solarPV: 20,
  /** Wind power (lifecycle) */
  wind: 12,
  /** Nordic residual mix (for contracts without origin guarantee) */
  nordicResidualMix: 350,
  /** Direct electric heating (grid average) */
  directElectric: 45,
  /** District heating (Swedish average) */
  districtHeating: 70,
} as const;

export type CO2Source = keyof typeof CO2_FACTORS;
