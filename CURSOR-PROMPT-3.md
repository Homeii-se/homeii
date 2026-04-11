# Homeii — Steg 3: Ny kostnadsmodell baserad på verkliga fakturor

Den nuvarande kostnadsmodellen underskattar verkliga elkostnader med ~60%. Orsaken är att den klumpar ihop alla kostnader i ett "öre/kWh"-pris per SE-zon, men missar att **elnätsfakturan ofta kostar mer än elhandeln** — energiskatt, effektavgift och fasta avgifter är stora poster som inte fångas.

Denna prompt ersätter kostnadsberäkningen med en modell som speglar hur svenska hushåll *faktiskt faktureras*.

## Bakgrund: Så ser en svensk hushållskunds fakturor ut

En kund får **två separata fakturor** varje månad:

**Elräkning (elhandlare — t.ex. Tibber, Soldags, Green Hero):**
- Spotpris × kWh (varierar per timme/månad/zon)
- Elhandlarens påslag (rörligt, öre/kWh)
- Elhandlarens fasta påslag (öre/kWh, finns hos vissa)
- Månadsavgift (kr/mån, ofta 0-49 kr)
- Elproduktionsersättning (om solceller — intäkt)
- Moms 25%

**Elnätsfaktura (nätägare — t.ex. Ellevio, E.ON, Vattenfall):**
- Fast abonnemangsavgift (kr/mån, beror på säkring)
- Rörlig överföringsavgift (öre/kWh)
- Effektavgift (kr/kW/mån × månadens toppeffekt) — *inte alla nätägare har detta ännu*
- Energiskatt (45 öre/kWh inkl moms 2026, nationellt fastställd)
- Moms 25% på allt

## Ny datamodell: `data/grid-operators.ts`

Skapa filen `app/simulator/data/grid-operators.ts`:

```typescript
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

import type { SEZone } from "../types";

/**
 * De ~10 största nätägarna täcker ca 70% av svenska hushåll.
 * För okänd nätägare används DEFAULT_GRID_PRICING.
 */
export const GRID_OPERATORS: GridOperatorPricing[] = [
  {
    name: "Ellevio",
    aliases: ["ellevio", "ellevio ab"],
    zones: ["SE3"],
    fixedFeeKrPerMonth: 316,
    transferFeeOrePerKwh: 5.6,
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
```

## Ny datamodell: `data/energy-tax.ts`

Skapa `app/simulator/data/energy-tax.ts`:

```typescript
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
```

## Ny datamodell: `data/elhandel-defaults.ts`

Skapa `app/simulator/data/elhandel-defaults.ts`:

```typescript
/**
 * Default electricity retailer (elhandlare) pricing.
 *
 * Elhandlarens påslag varierar kraftigt:
 * - Tibber: ~6 öre fast påslag + 3-4 öre rörligt = ~10 öre totalt
 * - Soldags: ~4 öre fast påslag + 7 öre rörligt = ~11 öre totalt
 * - Green Hero: liknande Soldags
 * - Stora handlare (Vattenfall, E.ON): 5-15 öre beroende på avtal
 *
 * @source Elpriskollen / Energimarknadsinspektionen
 * @updated 2026-04-04
 * @notes Genomsnittligt påslag för rörliga/timavtal. Fastprisavtal har
 *        påslaget inbakat i priset och modelleras annorlunda.
 */

export const ELHANDEL_DEFAULTS = {
  /** Genomsnittligt påslag (rörligt + fast per kWh) exkl moms (öre/kWh) */
  avgMarkupOrePerKwh: 8.0,
  /** Typisk månadsavgift exkl moms (kr/mån) — många har 0-39 kr */
  avgMonthlyFeeKr: 0,
  /** Spotprisersättning för producerad/exporterad el (andel av spotpris) */
  productionCompensationRate: 0.80,
} as const;
```

## Ny beräkningsfunktion: `simulation/cost-model.ts`

Skapa `app/simulator/simulation/cost-model.ts`. Denna fil är **kärnan i den nya kostnadsmodellen**.

```typescript
/**
 * Cost model — calculates real electricity costs for Swedish households.
 *
 * Models the ACTUAL invoice structure:
 * 1. Elhandel: spotpris + påslag + månadsavgift
 * 2. Elnät: fast avgift + överföring + effektavgift + energiskatt
 * 3. Moms: 25% on everything
 * 4. Solproduktion: intäkt från exporterad el
 *
 * @source Swedish invoice structure, verified against real Ellevio/Tibber/Soldags invoices
 * @updated 2026-04-04
 */

import type { SEZone } from "../types";
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { getGridPricing, DEFAULT_GRID_PRICING } from "../data/grid-operators";
import { getEnergyTaxRate } from "../data/energy-tax";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";

const VAT = 1.25;

/**
 * All inputs needed to calculate monthly cost.
 * Some fields are optional — the model fills in defaults.
 */
export interface MonthlyCostInput {
  /** kWh consumed from grid this month */
  gridImportKwh: number;
  /** kWh exported to grid this month (solar surplus) */
  gridExportKwh: number;
  /** Peak power draw from grid this month (kW) */
  peakGridKw: number;
  /** Month index 0-11 */
  month: number;
  /** SE zone */
  seZone: SEZone;

  // --- Optional overrides (from elnätsfaktura or user input) ---
  /** Grid operator name — used to look up pricing */
  gridOperator?: string;
  /** Override: fixed grid fee (kr/mån exkl moms) */
  gridFixedFeeKr?: number;
  /** Override: transfer fee (öre/kWh exkl moms) */
  gridTransferFeeOre?: number;
  /** Override: power charge (kr/kW exkl moms) — set to 0 if not applicable */
  gridPowerChargeKrPerKw?: number;
  /** Override: does this grid operator have power charges? */
  gridHasPowerCharge?: boolean;
  /** Override: energy tax (öre/kWh exkl moms) */
  energyTaxOre?: number;
  /** Override: elhandel markup (öre/kWh exkl moms) */
  elhandelMarkupOre?: number;
  /** Override: elhandel monthly fee (kr/mån exkl moms) */
  elhandelMonthlyFeeKr?: number;
  /** Override: spot price for this month (öre/kWh exkl moms) */
  spotPriceOre?: number;
}

/**
 * Detailed cost breakdown for one month.
 * All values in kr, inkl moms unless noted.
 */
export interface MonthlyCostBreakdown {
  // --- Elhandel ---
  /** Spotpris × kWh (inkl moms) */
  spotCostKr: number;
  /** Elhandlarens påslag × kWh (inkl moms) */
  markupCostKr: number;
  /** Elhandlarens månadsavgift (inkl moms) */
  elhandelMonthlyFeeKr: number;
  /** Summa elhandel (inkl moms) */
  totalElhandelKr: number;

  // --- Elnät ---
  /** Fast nätavgift (inkl moms) */
  gridFixedFeeKr: number;
  /** Rörlig överföringsavgift (inkl moms) */
  gridTransferFeeKr: number;
  /** Effektavgift (inkl moms) — 0 om nätägaren inte har det */
  gridPowerChargeKr: number;
  /** Energiskatt (inkl moms) */
  energyTaxKr: number;
  /** Summa elnät (inkl moms) */
  totalElnatKr: number;

  // --- Produktion ---
  /** Intäkt från exporterad el (negativt = intäkt) */
  exportRevenueKr: number;

  // --- Totalt ---
  /** Total månadskostnad (inkl moms, efter exportintäkt) */
  totalKr: number;

  // --- Metadata ---
  /** Effective spot price used (öre/kWh exkl moms) */
  effectiveSpotOre: number;
  /** Total effective price per kWh inkl allt (öre/kWh inkl moms) */
  effectiveTotalOrePerKwh: number;
  /** Grid import this month */
  gridImportKwh: number;
  /** Peak kW this month */
  peakGridKw: number;
}

/**
 * Calculate the full monthly cost for a Swedish household.
 *
 * This function mirrors the actual Swedish invoice structure:
 * - Elhandel: spot + markup + monthly fee
 * - Elnät: fixed + transfer + power charge + energy tax
 * - Production: export revenue
 * - VAT: 25% on everything
 */
export function calculateMonthlyCost(input: MonthlyCostInput): MonthlyCostBreakdown {
  const {
    gridImportKwh,
    gridExportKwh,
    peakGridKw,
    month,
    seZone,
  } = input;

  // --- Resolve pricing ---
  const gridPricing = input.gridOperator
    ? getGridPricing(input.gridOperator)
    : DEFAULT_GRID_PRICING;

  const spotPriceOre = input.spotPriceOre
    ?? SE_ZONE_SPOT_PRICE[seZone]?.[month]
    ?? 80; // fallback

  const markupOre = input.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh;
  const elhandelFee = input.elhandelMonthlyFeeKr ?? ELHANDEL_DEFAULTS.avgMonthlyFeeKr;

  const gridFixedFee = input.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth;
  const transferFee = input.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh;
  const hasPowerCharge = input.gridHasPowerCharge ?? gridPricing.hasPowerCharge;
  const powerCharge = hasPowerCharge
    ? (input.gridPowerChargeKrPerKw ?? gridPricing.powerChargeKrPerKw)
    : 0;
  const energyTax = input.energyTaxOre ?? getEnergyTaxRate(seZone, false);

  // --- Elhandel ---
  const spotCostKr = (gridImportKwh * spotPriceOre / 100) * VAT;
  const markupCostKr = (gridImportKwh * markupOre / 100) * VAT;
  const elhandelMonthlyFeeKr = elhandelFee * VAT;
  const totalElhandelKr = spotCostKr + markupCostKr + elhandelMonthlyFeeKr;

  // --- Elnät ---
  const gridFixedFeeKr = gridFixedFee * VAT;
  const gridTransferFeeKr = (gridImportKwh * transferFee / 100) * VAT;
  const gridPowerChargeKr = (peakGridKw * powerCharge) * VAT;
  const energyTaxKr = (gridImportKwh * energyTax / 100) * VAT;
  const totalElnatKr = gridFixedFeeKr + gridTransferFeeKr + gridPowerChargeKr + energyTaxKr;

  // --- Export revenue ---
  const exportRevenueKr = -(gridExportKwh * spotPriceOre * ELHANDEL_DEFAULTS.productionCompensationRate / 100) * VAT;

  // --- Total ---
  const totalKr = totalElhandelKr + totalElnatKr + exportRevenueKr;

  // --- Metadata ---
  const effectiveTotalOrePerKwh = gridImportKwh > 0
    ? (totalKr / gridImportKwh) * 100
    : 0;

  return {
    spotCostKr: Math.round(spotCostKr),
    markupCostKr: Math.round(markupCostKr),
    elhandelMonthlyFeeKr: Math.round(elhandelMonthlyFeeKr),
    totalElhandelKr: Math.round(totalElhandelKr),
    gridFixedFeeKr: Math.round(gridFixedFeeKr),
    gridTransferFeeKr: Math.round(gridTransferFeeKr),
    gridPowerChargeKr: Math.round(gridPowerChargeKr),
    energyTaxKr: Math.round(energyTaxKr),
    totalElnatKr: Math.round(totalElnatKr),
    exportRevenueKr: Math.round(exportRevenueKr),
    totalKr: Math.round(totalKr),
    effectiveSpotOre: spotPriceOre,
    effectiveTotalOrePerKwh: Math.round(effectiveTotalOrePerKwh * 10) / 10,
    gridImportKwh,
    peakGridKw,
  };
}

/**
 * Calculate annual cost from 12 monthly breakdowns.
 */
export interface AnnualCostBreakdown {
  months: MonthlyCostBreakdown[];
  totalElhandelKr: number;
  totalElnatKr: number;
  totalExportRevenueKr: number;
  totalKr: number;
  avgMonthlyKr: number;
  effectiveOrePerKwh: number;
}

export function calculateAnnualCost(
  monthlyInputs: MonthlyCostInput[]
): AnnualCostBreakdown {
  const months = monthlyInputs.map(calculateMonthlyCost);

  const totalElhandelKr = months.reduce((s, m) => s + m.totalElhandelKr, 0);
  const totalElnatKr = months.reduce((s, m) => s + m.totalElnatKr, 0);
  const totalExportRevenueKr = months.reduce((s, m) => s + m.exportRevenueKr, 0);
  const totalKr = months.reduce((s, m) => s + m.totalKr, 0);
  const totalKwh = months.reduce((s, m) => s + m.gridImportKwh, 0);

  return {
    months,
    totalElhandelKr,
    totalElnatKr,
    totalExportRevenueKr,
    totalKr,
    avgMonthlyKr: Math.round(totalKr / 12),
    effectiveOrePerKwh: totalKwh > 0 ? Math.round((totalKr / totalKwh) * 100 * 10) / 10 : 0,
  };
}
```

## Ny datakälla: Spotpriser per zon (renodlat)

Uppdatera `data/energy-prices.ts` så att spotpris hålls **separat** från den totala konsumentprisen. Behåll den gamla `SE_ZONE_TOTAL_CONSUMER_PRICE` tills vidare (för bakåtkompatibilitet) men lägg till:

```typescript
/**
 * Average spot price per SE-zone and month (öre/kWh, EXKL moms, skatt och nätavgifter).
 * Detta är BARA spotpriset — inte konsumentpriset.
 *
 * @source Nord Pool / Elpriskollen — genomsnitt 2023-2025
 * @updated 2026-04-04
 * @notes Spotpriset är det enda som varierar per timme.
 *        Alla andra avgifter (skatt, nät, påslag) är fasta eller per-kWh.
 */
export const SE_ZONE_SPOT_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [   28,   25,   20,   15,   12,   10,   10,   12,   15,   18,   22,   28],
  SE2: [   32,   28,   22,   17,   14,   12,   12,   14,   18,   22,   26,   32],
  SE3: [   75,   68,   50,   30,   22,   18,   16,   18,   28,   38,   52,   70],
  SE4: [   95,   85,   62,   35,   25,   20,   18,   22,   32,   48,   68,   90],
};
```

## Integration: Uppdatera simuleringsmotorn

### 1. `simulation/monthly.ts` — använd nya kostnadsmodellen

I `simulateMonthsWithUpgrades()`, ersätt den befintliga kostnadsberäkningen med `calculateMonthlyCost()`. Varje månads kostnad ska beräknas med den fullständiga modellen:

```typescript
import { calculateMonthlyCost } from "./cost-model";

// I simulateMonthsWithUpgrades, för varje månad:
const costBreakdown = calculateMonthlyCost({
  gridImportKwh: monthlyGridImport,
  gridExportKwh: monthlyGridExport,
  peakGridKw: peakKw,
  month: monthIdx,
  seZone,
  gridOperator: assumptions?.gridOperator,
  gridFixedFeeKr: assumptions?.gridFixedFeeKr,
  gridTransferFeeOre: assumptions?.gridTransferFeeOre,
  gridPowerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw,
  gridHasPowerCharge: assumptions?.gridHasPowerCharge,
});
```

### 2. Uppdatera `Assumptions`-typen i `types.ts`

```typescript
export interface Assumptions {
  // Existing
  solarSizeKw: number;
  batterySizeKwh: number;

  // NEW: Elnät — populated from grid operator lookup or elnätsfaktura
  gridOperator?: string;
  gridFixedFeeKr?: number;          // kr/mån exkl moms
  gridTransferFeeOre?: number;      // öre/kWh exkl moms
  gridHasPowerCharge?: boolean;
  gridPowerChargeKrPerKw?: number;  // kr/kW exkl moms

  // NEW: Elhandel
  elhandelMarkupOre?: number;       // öre/kWh exkl moms

  // REMOVED: These are now calculated by cost-model.ts
  // gridFeeKrPerMonth — replaced by gridFixedFeeKr
  // powerFeeKrPerKw — replaced by gridPowerChargeKrPerKw
}
```

### 3. Uppdatera `MonthlyDataPointExtended` i `types.ts`

Lägg till kostnadsbrytnigen per månad:

```typescript
export interface MonthlyDataPointExtended {
  // ... existing fields ...

  // NEW: Detaljerad kostnadsbrytning
  costBreakdown?: MonthlyCostBreakdown;
}
```

### 4. Uppdatera `AnnualSummary` i `types.ts`

```typescript
export interface AnnualSummary {
  // ... existing fields ...

  // NEW: Detaljerad årlig kostnadsbrytning
  annualCostBreakdown?: AnnualCostBreakdown;
}
```

## Uppdatera `data/index.ts`

Lägg till exports:

```typescript
export * from "./grid-operators";
export * from "./energy-tax";
export * from "./elhandel-defaults";
```

## Uppdatera `simulation/index.ts`

Lägg till export:

```typescript
export { calculateMonthlyCost, calculateAnnualCost } from "./cost-model";
export type { MonthlyCostInput, MonthlyCostBreakdown, AnnualCostBreakdown } from "./cost-model";
```

## Verifiering: Testfall

Verifiera mot Gustafs faktiska faktura (januari 2026):

```typescript
// Testfall: Gustaf, Dalvägen 10, Täby
// Ellevio, SE3, januari 2026
// Faktisk förbrukning: 3748 kWh, effekttopp: 9.53 kW
const testInput: MonthlyCostInput = {
  gridImportKwh: 3748,
  gridExportKwh: 2,
  peakGridKw: 9.53,
  month: 0, // januari
  seZone: "SE3",
  gridOperator: "Ellevio",
  spotPriceOre: 82.5,  // 103.16 öre inkl påslag → spot ~82.5 öre
};

const result = calculateMonthlyCost(testInput);

// Förväntat (från faktisk faktura):
// Elhandel: ~5400 kr (inkl moms)
// Elnät: ~3118 kr (inkl moms)
// Total: ~8530 kr
//
// Modellens resultat ska vara inom ±10% av dessa värden.
console.log("Total:", result.totalKr, "Förväntat: ~8530");
console.log("Elhandel:", result.totalElhandelKr, "Förväntat: ~5400");
console.log("Elnät:", result.totalElnatKr, "Förväntat: ~3118");
```

## Refaktoreringsordning

1. Skapa `data/grid-operators.ts`, `data/energy-tax.ts`, `data/elhandel-defaults.ts`
2. Skapa `simulation/cost-model.ts` med `calculateMonthlyCost()` och `calculateAnnualCost()`
3. Uppdatera `types.ts` — utöka `Assumptions`, `MonthlyDataPointExtended`, `AnnualSummary`
4. Uppdatera `data/index.ts` och `simulation/index.ts` med nya exports
5. Integrera `calculateMonthlyCost()` i `simulation/monthly.ts`
6. Uppdatera `simulation/annual.ts` att använda den nya kostnadsbrytningen
7. Kör testfallet ovan — verifiera att januari-kostnaden landar nära 8 500 kr
8. Kör `npx tsc --noEmit` — 0 fel

**VIKTIGT**: Den gamla `SE_ZONE_TOTAL_CONSUMER_PRICE` ska INTE tas bort ännu — den används av flera befintliga funktioner. Den nya kostnadsmodellen läggs till parallellt och kopplas in steg för steg.
