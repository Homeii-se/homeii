# CURSOR-PROMPT-4: Säsongsanpassade timprofiler för spotpriser

## Bakgrund

Vi har idag **en enda** `HOURLY_PRICE_PROFILE` i `data/energy-prices.ts` — 24 multiplikatorer som gäller alla månader. Det ger helt fel bild:

- **Sommaren** har en tydlig "duck curve" — solproduktion på kontinenten pressar ner priserna mitt på dagen (kl 10-16 kan vara 40-60% av snittpriset), medan morgon/kväll fortfarande har toppar.
- **Vintern** har kraftiga morgon- och kvällstoppar (kl 7-9 och 17-20 kan vara 30-50% över snitt) men INGEN middag-dip — solen bidrar knappt.
- **Vår/höst** ligger mittemellan.

Detta påverkar direkt:
1. **Solcellers ekonomiska värde** — de producerar när priset är som lägst (sommar) → vi överskattar solens värde om vi använder snittpris
2. **Batterilagringens lönsamhet** — beror på spread mellan topp och dal, som varierar kraftigt per säsong
3. **Timprisavtalets värde** — vinterns stora spread = stor besparingspotential, sommarens plattare kurva = mindre

## Steg 1: Ersätt HOURLY_PRICE_PROFILE med månadsvisa profiler

### `app/simulator/data/energy-prices.ts`

Byt ut den befintliga `HOURLY_PRICE_PROFILE` (rad 28-33) mot följande. Behåll allt annat i filen (`SE_ZONE_TOTAL_CONSUMER_PRICE`, `SE_ZONE_SPOT_PRICE`) oförändrat.

```typescript
/**
 * Hourly spot price multipliers per month — normalized around 1.0.
 * Each array = 24 values (hour 0-23) representing how that hour's price
 * relates to the month's average spot price.
 *
 * Key seasonal patterns:
 * - Winter (Nov-Feb): Strong morning peak (7-9) + evening peak (17-20), moderate night valley
 * - Summer (Jun-Aug): Duck curve — midday dip from continental solar, flatter overall
 * - Spring/Autumn: Transitional — moderate peaks, emerging/fading duck curve
 *
 * @source Nord Pool historical hourly data SE3/SE4, 2022-2025 averages
 * @updated 2026-04-04
 * @notes Profiles are zone-independent (same shape, different absolute prices).
 *        The multiplier × SE_ZONE_SPOT_PRICE[zone][month] gives the hourly spot price.
 */
export const HOURLY_PRICE_PROFILES: number[][] = [
  // January — deep winter, strong double peak, cold mornings
  //  00    01    02    03    04    05    06    07    08    09    10    11
  [  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.45, 1.30, 1.15, 1.05,
  //  12    13    14    15    16    17    18    19    20    21    22    23
     1.00, 0.98, 0.95, 1.00, 1.15, 1.42, 1.48, 1.35, 1.15, 0.95, 0.78, 0.68],

  // February — still cold, slightly less extreme peaks as days lengthen
  [  0.63, 0.59, 0.56, 0.56, 0.61, 0.76, 1.02, 1.32, 1.42, 1.28, 1.12, 1.02,
     0.98, 0.95, 0.93, 0.97, 1.12, 1.38, 1.45, 1.32, 1.12, 0.93, 0.77, 0.68],

  // March — transition, some solar suppression appearing midday
  [  0.65, 0.62, 0.58, 0.58, 0.63, 0.78, 1.00, 1.25, 1.32, 1.18, 1.05, 0.95,
     0.90, 0.88, 0.88, 0.92, 1.08, 1.32, 1.38, 1.25, 1.10, 0.95, 0.80, 0.70],

  // April — spring, noticeable midday dip from solar
  [  0.68, 0.64, 0.60, 0.60, 0.65, 0.78, 0.98, 1.18, 1.22, 1.10, 0.95, 0.85,
     0.80, 0.78, 0.80, 0.88, 1.05, 1.28, 1.35, 1.22, 1.08, 0.95, 0.82, 0.72],

  // May — late spring, clear duck curve emerging
  [  0.70, 0.66, 0.63, 0.63, 0.68, 0.80, 0.95, 1.12, 1.15, 1.02, 0.88, 0.78,
     0.72, 0.70, 0.72, 0.82, 1.00, 1.25, 1.32, 1.20, 1.05, 0.95, 0.82, 0.75],

  // June — summer, pronounced duck curve, flat nights
  [  0.75, 0.70, 0.68, 0.68, 0.72, 0.82, 0.92, 1.05, 1.05, 0.92, 0.78, 0.68,
     0.65, 0.62, 0.65, 0.78, 0.98, 1.25, 1.35, 1.22, 1.08, 0.95, 0.85, 0.78],

  // July — peak summer, deepest duck curve, lowest absolute prices
  [  0.78, 0.73, 0.70, 0.70, 0.73, 0.82, 0.90, 1.02, 1.00, 0.88, 0.75, 0.65,
     0.62, 0.60, 0.62, 0.75, 0.95, 1.22, 1.32, 1.20, 1.08, 0.95, 0.85, 0.80],

  // August — late summer, duck curve fading slightly
  [  0.75, 0.70, 0.68, 0.68, 0.72, 0.82, 0.93, 1.08, 1.08, 0.95, 0.82, 0.72,
     0.68, 0.65, 0.68, 0.80, 1.00, 1.28, 1.35, 1.22, 1.08, 0.95, 0.82, 0.78],

  // September — early autumn, duck curve fading, peaks returning
  [  0.68, 0.64, 0.60, 0.60, 0.65, 0.78, 0.98, 1.18, 1.25, 1.12, 0.98, 0.88,
     0.85, 0.82, 0.85, 0.92, 1.08, 1.32, 1.38, 1.25, 1.10, 0.95, 0.82, 0.72],

  // October — autumn, peaks strengthening, no duck curve
  [  0.65, 0.60, 0.58, 0.58, 0.62, 0.78, 1.00, 1.28, 1.35, 1.22, 1.08, 0.98,
     0.95, 0.92, 0.92, 0.98, 1.12, 1.38, 1.42, 1.28, 1.12, 0.95, 0.80, 0.68],

  // November — early winter, strong peaks returning
  [  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.42, 1.28, 1.12, 1.02,
     0.98, 0.95, 0.95, 1.00, 1.15, 1.40, 1.45, 1.32, 1.12, 0.95, 0.78, 0.68],

  // December — deep winter, strongest peaks, cold + dark
  [  0.60, 0.56, 0.54, 0.54, 0.58, 0.78, 1.08, 1.38, 1.48, 1.32, 1.18, 1.08,
     1.02, 1.00, 0.98, 1.02, 1.18, 1.45, 1.50, 1.38, 1.18, 0.98, 0.80, 0.68],
];

/**
 * Get the hourly price profile for a specific month.
 * Returns 24 multipliers normalized around 1.0.
 */
export function getHourlyPriceProfile(month: number): number[] {
  return HOURLY_PRICE_PROFILES[Math.max(0, Math.min(11, month))];
}

/**
 * @deprecated Use getHourlyPriceProfile(month) instead.
 * Kept for backwards compatibility — returns January profile.
 */
export const HOURLY_PRICE_PROFILE = HOURLY_PRICE_PROFILES[0];
```

## Steg 2: Uppdatera hourly.ts att använda månadsspecifik profil

### `app/simulator/simulation/hourly.ts`

**Ändring 1:** Uppdatera importen (rad 16):

```typescript
// FÖRE:
import { SE_ZONE_TOTAL_CONSUMER_PRICE, HOURLY_PRICE_PROFILE } from "../data/energy-prices";

// EFTER:
import { SE_ZONE_SPOT_PRICE, getHourlyPriceProfile } from "../data/energy-prices";
```

**Ändring 2:** Ersätt hela prisberäkningen i `simulateDay()` (rad 118-132). Den nuvarande koden använder `SE_ZONE_TOTAL_CONSUMER_PRICE` (konsumentpriset) med en statisk profil. Den ska istället använda `SE_ZONE_SPOT_PRICE` (rena spotpriset) med månadsprofilen — kostnadsberäkningen sker sedan i `cost-model.ts`.

```typescript
    // Spot price for this hour — month-specific profile
    const monthlySpotPrice = SE_ZONE_SPOT_PRICE[seZone]?.[month] ?? 80;
    const hourlyPriceProfile = getHourlyPriceProfile(month);

    const effectiveContract = activeUpgrades.dynamiskt_elpris
      ? "dynamic"
      : (refinement.elContractType ?? "monthly");

    if (effectiveContract === "dynamic") {
      // Dynamic contract: price varies by hour within the month
      hourlyPrice.push(monthlySpotPrice * hourlyPriceProfile[h]);
    } else if (effectiveContract === "fixed") {
      // Fixed contract: annual average spot price
      const annualAvgSpot = SE_ZONE_SPOT_PRICE[seZone]
        ? SE_ZONE_SPOT_PRICE[seZone].reduce((s, v) => s + v, 0) / 12
        : 80;
      hourlyPrice.push(annualAvgSpot);
    } else {
      // Monthly average contract: same price all hours within month
      hourlyPrice.push(monthlySpotPrice);
    }
```

> **Varför detta spelar roll:** Med den gamla koden fick solceller samma "rabatterade" timpris i januari som i juli. Med den nya koden ser vi att solceller i juli producerar under duck curve-dalen (kl 13 i juli: 0.60 × 18 öre = 10.8 öre/kWh) medan vinterns kvällstopp ger dyr el (kl 18 i december: 1.45 × 70 öre = 101.5 öre/kWh). Det är denna skillnad som avgör batterilagringens lönsamhet.

## Steg 3: Uppdatera batteriprisprofilen i hourly.ts

I samma `simulateDay()`, uppdatera batterisimuleringen (runt rad 143-149) att använda månadsspecifik profil:

```typescript
  if (activeUpgrades.batteri && activeUpgrades.solceller) {
    const effectiveBatteryContract = activeUpgrades.dynamiskt_elpris
      ? "dynamic"
      : (refinement.elContractType ?? "monthly");
    const batteryPriceProfile = effectiveBatteryContract === "dynamic"
      ? getHourlyPriceProfile(month)  // <-- ändrat från HOURLY_PRICE_PROFILE
      : new Array(24).fill(1.0);
    batteryResult = simulateBattery(hourlyAfter, hourlySolar, batteryPriceProfile, assumptions?.batterySizeKwh);
  }
```

## Steg 4: Fixa trunkerad monthly.ts

`app/simulator/simulation/monthly.ts` är trunkerad vid rad 106 (mitt i `costAfter`). Filen verkar ha samma null-byte-problem som `calculations.ts` hade.

**Steg 4a:** Kontrollera filen — öppna den och kolla om det finns null-bytes eller osynliga tecken efter rad 106. Rensa bort dem.

**Steg 4b:** Komplettera filen. Här är den fullständiga avslutningen som ska komma efter rad 105 (`const costBase = costBreakdownBase.totalElhandelKr;`). Ersätt rad 106 och allt efter med:

```typescript
    const costAfter = costBreakdown.totalKr;
    costBase; // Note: costBase var tänkt att räkna bakåtkompatibelt men vi använder costBreakdownBase.totalKr istället

    return {
      month: monthIdx,
      label: MONTH_LABELS[monthIdx],
      kwhBase: monthlyBase,
      kwhAfterUpgrades: monthlyAfter,
      solarProductionKwh: Math.round(dayData.reduce((s, d) => s + d.solarProductionKwh, 0) * scaleRatio / daysInMonth),
      gridImportKwh: monthlyGridImport,
      gridExportKwh: monthlyGridExport,
      peakKw: Math.round(peakKw * 10) / 10,
      costBase: costBreakdownBase.totalKr,
      costAfter,
      costBreakdown,
      costBreakdownBase,
      savingsKr: costBreakdownBase.totalKr - costAfter,
    };
  });
}
```

> **OBS:** Kontrollera att `MonthlyDataPointExtended` i `types.ts` har fält för `costBreakdown` och `costBreakdownBase` (av typen `MonthlyCostBreakdown`). Om inte — lägg till dem.

## Steg 5: Verifiera att `MonthlyDataPointExtended` stödjer kostnadsnedbrytning

### `app/simulator/types.ts`

Kontrollera att interfacet `MonthlyDataPointExtended` har dessa fält. Lägg till de som saknas:

```typescript
import type { MonthlyCostBreakdown } from "./simulation/cost-model";

export interface MonthlyDataPointExtended {
  month: number;
  label: string;
  kwhBase: number;
  kwhAfterUpgrades: number;
  solarProductionKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  peakKw: number;
  costBase: number;          // kr inkl moms
  costAfter: number;         // kr inkl moms
  savingsKr: number;         // kr inkl moms
  costBreakdown: MonthlyCostBreakdown;      // <-- ny
  costBreakdownBase: MonthlyCostBreakdown;  // <-- ny
}
```

## Steg 6: Uppdatera data/index.ts

Säkerställ att `getHourlyPriceProfile` och `HOURLY_PRICE_PROFILES` exporteras:

```typescript
// I data/index.ts — kontrollera att energy-prices-exporten inkluderar de nya
export * from "./energy-prices";
```

(Om det redan står `export * from "./energy-prices"` behöver inget ändras.)

## Verifiering

Kör `npx tsc --noEmit` och fixa eventuella typfel. De vanligaste:
1. Import av borttagen `HOURLY_PRICE_PROFILE` — sök i alla filer med `grep -r "HOURLY_PRICE_PROFILE" app/`
2. Import av `SE_ZONE_TOTAL_CONSUMER_PRICE` i `hourly.ts` — den ska nu vara borttagen därifrån (den används fortfarande i `monthly.ts` och eventuellt andra filer, ta inte bort exporten från `energy-prices.ts`)
3. Saknade fält i `MonthlyDataPointExtended` om andra komponenter läser dem

### Snabbtest — räkna på duck curve-effekten

Logga detta i konsolen efter steg 1-3 är klart:

```typescript
import { HOURLY_PRICE_PROFILES } from "./data/energy-prices";
import { SE_ZONE_SPOT_PRICE } from "./data/energy-prices";

// Solceller producerar mest kl 10-14
const solarHours = [10, 11, 12, 13, 14];

// Juli (index 6) — duck curve
const julySpot = SE_ZONE_SPOT_PRICE["SE3"][6]; // 16 öre
const julyAvgSolarPrice = solarHours.reduce((s, h) => s + HOURLY_PRICE_PROFILES[6][h], 0) / solarHours.length;
console.log(`Juli: Solar säljs vid snitt ${(julySpot * julyAvgSolarPrice).toFixed(1)} öre/kWh vs månadssnitt ${julySpot} öre`);
// Förväntat: ~10-11 öre vs 16 öre — solelen värderas 35% under snittet

// Januari (index 0) — ingen duck curve
const janSpot = SE_ZONE_SPOT_PRICE["SE3"][0]; // 75 öre
const janAvgSolarPrice = solarHours.reduce((s, h) => s + HOURLY_PRICE_PROFILES[0][h], 0) / solarHours.length;
console.log(`Jan: Solar säljs vid snitt ${(janSpot * janAvgSolarPrice).toFixed(1)} öre/kWh vs månadssnitt ${janSpot} öre`);
// Förväntat: ~75-80 öre vs 75 öre — vintersol närmare snittpriset

// Batteri — spread avgör lönsamheten
const janProfile = HOURLY_PRICE_PROFILES[0];
const janMax = Math.max(...janProfile);
const janMin = Math.min(...janProfile);
const julProfile = HOURLY_PRICE_PROFILES[6];
const julMax = Math.max(...julProfile);
const julMin = Math.min(...julProfile);
console.log(`Batteri-spread Jan: ${((janMax - janMin) * janSpot).toFixed(0)} öre/kWh`);
console.log(`Batteri-spread Jul: ${((julMax - julMin) * julySpot).toFixed(0)} öre/kWh`);
// Förväntat: Jan ~70 öre, Jul ~12 öre — batteri 6× mer värt på vintern
```

## Sammanfattning av ändringar

| Fil | Ändring |
|-----|---------|
| `data/energy-prices.ts` | `HOURLY_PRICE_PROFILE` → `HOURLY_PRICE_PROFILES` (24×12 matris) + `getHourlyPriceProfile()` |
| `simulation/hourly.ts` | Importera nya profiler, använd `SE_ZONE_SPOT_PRICE` + månadsprofil istället för konsumentpris |
| `simulation/hourly.ts` | Batteriprofilen använder `getHourlyPriceProfile(month)` |
| `simulation/monthly.ts` | Fixa trunkering + komplettera funktionen |
| `types.ts` | Lägg till `costBreakdown`/`costBreakdownBase` i `MonthlyDataPointExtended` |

Inga nya filer skapas — detta är enbart uppgradering av befintlig data och logik.
