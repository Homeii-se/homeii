/**
 * Swedish energy tax (energiskatt på el).
 *
 * @source Skatteverket / Energimarknadsbyrån
 * @url https://www.energimarknadsbyran.se/nyheter/nyhetsarkiv/2025/sankt-energiskatt-pa-el-2026/
 * @updated 2026-04-04
 * @notes Sänkt 1 januari 2026 från 42,8 till 36,0 öre/kWh (exkl moms).
 *        Reducerad skatt i vissa nordliga kommuner.
 */

export const ENERGY_TAX = {
  /** Standard energiskatt exkl moms (öre/kWh), gäller de flesta hushåll */
  standardOrePerKwhExclVat: 36.0,
  /** Standard energiskatt inkl moms (öre/kWh) */
  standardOrePerKwhInclVat: 45.0,
  /** Reducerad energiskatt exkl moms (öre/kWh) — nordliga kommuner */
  reducedOrePerKwhExclVat: 26.4,
  /** Reducerad energiskatt inkl moms (öre/kWh) */
  reducedOrePerKwhInclVat: 33.0,
  /** Regioner med reducerad skatt */
  reducedRegions: ["Norrbotten", "Västerbotten", "Jämtland"] as const,
  /** Vilken SE-zon som typiskt har reducerad skatt */
  reducedZones: ["SE1", "SE2"] as string[],
  /** Gäller from datum */
  effectiveFrom: "2026-01-01",
} as const;

/**
 * Get energy tax rate for a zone (öre/kWh, exkl moms).
 * SE1 and SE2 may qualify for reduced rate.
 */
export function getEnergyTaxRate(seZone: string, inclVat: boolean = false): number {
  const isReduced = ENERGY_TAX.reducedZones.includes(seZone);
  if (inclVat) {
    return isReduced ? ENERGY_TAX.reducedOrePerKwhInclVat : ENERGY_TAX.standardOrePerKwhInclVat;
  }
  return isReduced ? ENERGY_TAX.reducedOrePerKwhExclVat : ENERGY_TAX.standardOrePerKwhExclVat;
}
