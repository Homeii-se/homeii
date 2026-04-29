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

/**
 * Historisk energiskatt per år (öre/kWh exkl moms, standardnivå).
 * Reducerad nivå för SE1/SE2 = standardnivå × (26.4/36.0) ≈ 73%.
 *
 * @source Skatteverket / Energimarknadsbyrån årsarkiv
 *   https://www.skatteverket.se/foretag/skatterochavgifter/punktskatter/energiskatter
 *   https://www.energimarknadsbyran.se/nyheter/nyhetsarkiv/
 * @notes
 *   - 2020-2024: Skatten har stigit årligen via index
 *   - 2024-2025: Pausad ökning (samma nivå)
 *   - 2026: Sänkt från 42.8 till 36.0 (regeringsbeslut)
 *   - 2027: Antar oförändrat tills officiell siffra publiceras
 */
const ENERGY_TAX_BY_YEAR_STANDARD: Record<number, number> = {
  2020: 35.3,
  2021: 35.6,
  2022: 36.0,
  2023: 39.2,
  2024: 42.8,
  2025: 42.8,
  2026: 36.0,
  2027: 36.0,
};

/** Förhållande mellan reducerad och standardnivå (~73%, stabilt över tid). */
const REDUCED_TAX_RATIO = ENERGY_TAX.reducedOrePerKwhExclVat / ENERGY_TAX.standardOrePerKwhExclVat;

/**
 * Hämta energiskatt för ett specifikt år och SE-zon (öre/kWh exkl moms).
 * Faller tillbaka på närmaste tillgängliga år om input ligger utanför 2020-2027.
 */
export function getEnergyTaxRateForYear(year: number, seZone: string): number {
  const knownYears = Object.keys(ENERGY_TAX_BY_YEAR_STANDARD).map(Number);
  const minYear = Math.min(...knownYears);
  const maxYear = Math.max(...knownYears);
  const clampedYear = Math.max(minYear, Math.min(maxYear, year));
  const standardRate = ENERGY_TAX_BY_YEAR_STANDARD[clampedYear];
  const isReduced = ENERGY_TAX.reducedZones.includes(seZone);
  return isReduced ? standardRate * REDUCED_TAX_RATIO : standardRate;
}
