# CURSOR-PROMPT-7: REPARATION — Fixa 7 trunkerade filer

## VIKTIGT — LÄS DETTA FÖRST

Sju filer har blivit trunkerade (avklippta mitt i koden, troligen pga null-bytes). Varje fil nedan anger **exakt var den klipps** och ger **komplett kod att lägga till efter klippunkten**.

**Instruktion för varje fil:**
1. Öppna filen
2. Hitta den sista raden som matchar "KLIPPS VID"-texten
3. Radera allt EFTER den raden (det kan finnas osynliga null-bytes)
4. Klistra in koden under "LÄGG TILL EFTER KLIPPUNKTEN"
5. Spara

Kör `npx tsc --noEmit` efter alla filer är fixade.

---

## FIL 1: `app/simulator/types.ts`

**KLIPPS VID rad 187:** `/** Detailed co`

**RADERA rad 187 och allt efter. LÄGG TILL ISTÄLLET:**

```typescript
  /** Detailed cost breakdown from new cost model */
  costBreakdown: MonthlyCostBreakdown;
  /** Detailed cost breakdown for base scenario (no upgrades) */
  costBreakdownBase: MonthlyCostBreakdown;
}

import type { MonthlyCostBreakdown, AnnualCostBreakdown } from "./simulation/cost-model";

export interface YearlyDataPoint {
  year: number;
  label: string;
  kwh: number;
  cost: number;
  isEstimate: boolean;
}

/** Aggregated annual cost breakdown for display — 7 components */
export interface AnnualCostComponents {
  spotCostKr: number;
  markupCostKr: number;
  elhandelMonthlyFeeKr: number;
  gridFixedFeeKr: number;
  gridTransferFeeKr: number;
  gridPowerChargeKr: number;
  energyTaxKr: number;
  exportRevenueKr: number;
  totalKr: number;
}

export interface ScenarioDetail {
  yearlyKwh: number;
  yearlyCostKr: number;
  yearlyTotalCostKr: number;
  costComponents: AnnualCostComponents;
  monthlyKwh?: number[];
  monthlyPeakKw?: number[];
}

export interface ThreeScenarioSummary {
  withoutInvestments: ScenarioDetail;
  currentSituation: ScenarioDetail;
  afterRecommendations: ScenarioDetail;
  existingSavingsKr: number;
  potentialSavingsKr: number;
}

export interface AnnualSummary {
  yearlyKwhBase: number;
  yearlyKwhAfter: number;
  yearlyEnergyCostBase: number;
  yearlyEnergyCostAfter: number;
  yearlyGridFeeCost: number;
  yearlyPowerFeeCostBase: number;
  yearlyPowerFeeCostAfter: number;
  yearlyTotalCostBase: number;
  yearlyTotalCostAfter: number;
  totalInvestmentCost: number;
  paybackYears: number;
  solarProductionYearlyKwh: number;
  annualCostBreakdown?: AnnualCostBreakdown;
}
```

> **OBS:** Om `YearlyDataPoint`, `AnnualSummary`, `ThreeScenarioSummary` etc redan finns definierade tidigare i filen (de borde inte — de var troligen efter klippunkten), undvik dubbletter.

---

## FIL 2: `app/simulator/data/energy-prices.ts`

**KLIPPS VID rad 40:** `[  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.45`

**RADERA rad 40 och allt efter. LÄGG TILL ISTÄLLET:**

```typescript
  // January — deep winter, strong double peak, cold mornings
  //  00    01    02    03    04    05    06    07    08    09    10    11
  [  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.45, 1.30, 1.15, 1.05,
  //  12    13    14    15    16    17    18    19    20    21    22    23
     1.00, 0.98, 0.95, 1.00, 1.15, 1.42, 1.48, 1.35, 1.15, 0.95, 0.78, 0.68],

  // February
  [  0.63, 0.59, 0.56, 0.56, 0.61, 0.76, 1.02, 1.32, 1.42, 1.28, 1.12, 1.02,
     0.98, 0.95, 0.93, 0.97, 1.12, 1.38, 1.45, 1.32, 1.12, 0.93, 0.77, 0.68],

  // March
  [  0.65, 0.62, 0.58, 0.58, 0.63, 0.78, 1.00, 1.25, 1.32, 1.18, 1.05, 0.95,
     0.90, 0.88, 0.88, 0.92, 1.08, 1.32, 1.38, 1.25, 1.10, 0.95, 0.80, 0.70],

  // April
  [  0.68, 0.64, 0.60, 0.60, 0.65, 0.78, 0.98, 1.18, 1.22, 1.10, 0.95, 0.85,
     0.80, 0.78, 0.80, 0.88, 1.05, 1.28, 1.35, 1.22, 1.08, 0.95, 0.82, 0.72],

  // May
  [  0.70, 0.66, 0.63, 0.63, 0.68, 0.80, 0.95, 1.12, 1.15, 1.02, 0.88, 0.78,
     0.72, 0.70, 0.72, 0.82, 1.00, 1.25, 1.32, 1.20, 1.05, 0.95, 0.82, 0.75],

  // June — pronounced duck curve
  [  0.75, 0.70, 0.68, 0.68, 0.72, 0.82, 0.92, 1.05, 1.05, 0.92, 0.78, 0.68,
     0.65, 0.62, 0.65, 0.78, 0.98, 1.25, 1.35, 1.22, 1.08, 0.95, 0.85, 0.78],

  // July — deepest duck curve
  [  0.78, 0.73, 0.70, 0.70, 0.73, 0.82, 0.90, 1.02, 1.00, 0.88, 0.75, 0.65,
     0.62, 0.60, 0.62, 0.75, 0.95, 1.22, 1.32, 1.20, 1.08, 0.95, 0.85, 0.80],

  // August
  [  0.75, 0.70, 0.68, 0.68, 0.72, 0.82, 0.93, 1.08, 1.08, 0.95, 0.82, 0.72,
     0.68, 0.65, 0.68, 0.80, 1.00, 1.28, 1.35, 1.22, 1.08, 0.95, 0.82, 0.78],

  // September
  [  0.68, 0.64, 0.60, 0.60, 0.65, 0.78, 0.98, 1.18, 1.25, 1.12, 0.98, 0.88,
     0.85, 0.82, 0.85, 0.92, 1.08, 1.32, 1.38, 1.25, 1.10, 0.95, 0.82, 0.72],

  // October
  [  0.65, 0.60, 0.58, 0.58, 0.62, 0.78, 1.00, 1.28, 1.35, 1.22, 1.08, 0.98,
     0.95, 0.92, 0.92, 0.98, 1.12, 1.38, 1.42, 1.28, 1.12, 0.95, 0.80, 0.68],

  // November
  [  0.62, 0.58, 0.55, 0.55, 0.60, 0.78, 1.05, 1.35, 1.42, 1.28, 1.12, 1.02,
     0.98, 0.95, 0.95, 1.00, 1.15, 1.40, 1.45, 1.32, 1.12, 0.95, 0.78, 0.68],

  // December — strongest peaks
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

/**
 * Average spot price per SE-zone and month (öre/kWh, EXKL moms, skatt och nätavgifter).
 * Detta är BARA spotpriset — inte konsumentpriset.
 *
 * @source Nord Pool / Elpriskollen — genomsnitt 2023-2025
 * @updated 2026-04-04
 */
export const SE_ZONE_SPOT_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [   28,   25,   20,   15,   12,   10,   10,   12,   15,   18,   22,   28],
  SE2: [   32,   28,   22,   17,   14,   12,   12,   14,   18,   22,   26,   32],
  SE3: [   75,   68,   50,   30,   22,   18,   16,   18,   28,   38,   52,   70],
  SE4: [   95,   85,   62,   35,   25,   20,   18,   22,   32,   48,   68,   90],
};

/**
 * Default grid fee and power fee — legacy constants for backwards compatibility.
 * New code should use grid-operators.ts instead.
 */
export const DEFAULT_GRID_FEE_KR_PER_MONTH = 320;
export const DEFAULT_POWER_FEE_KR_PER_KW = 44;
```

---

## FIL 3: `app/simulator/simulation/hourly.ts`

**KLIPPS VID rad 177:** `gridImpo`

**RADERA rad 177 och allt efter. LÄGG TILL ISTÄLLET:**

```typescript
      gridImportKwh: batteryResult.gridImport[h],
      gridExportKwh: batteryResult.gridExport[h],
      costOre: Math.round(costOre * 100) / 100,
      spotPriceOre: Math.round(hourlyPrice[h] * 100) / 100,
    });
  }

  return result;
}
```

---

## FIL 4: `app/simulator/simulation/monthly.ts`

**KLIPPS VID rad 112:** (efter `solarProductionKwh: monthlySolar,`)

**RADERA rad 112 och allt efter. LÄGG TILL ISTÄLLET:**

```typescript
      solarProductionKwh: monthlySolar,
      gridImportKwh: monthlyGridImport,
      gridExportKwh: monthlyGridExport,
      peakKw: Math.round(peakKw * 10) / 10,
      peakKwBase: Math.round(peakKwBase * 10) / 10,
      costBase,
      costAfterUpgrades: costAfter,
      savingsKr: costBase - costAfter,
      // Legacy fields (deprecated — use costBreakdown/costBreakdownBase instead)
      gridFeeCostKr: costBreakdown.gridFixedFeeKr + costBreakdown.gridTransferFeeKr,
      powerFeeCostKr: costBreakdown.gridPowerChargeKr,
      totalCostKr: costAfter,
      totalCostBaseKr: costBase,
      costBreakdown,
      costBreakdownBase,
    };
  });
}
```

---

## FIL 5: `app/simulator/simulation/scenarios.ts`

**KLIPPS VID rad 72:** `seZ` (mitt i funktionssignaturen)

**RADERA rad 72 och allt efter. LÄGG TILL ISTÄLLET:**

```typescript
  seZone: SEZone,
  assumptions: Assumptions,
  recommendedUpgrades?: UpgradeId[]
): ThreeScenarioSummary {
  // Scenario A: Without any existing investments (all false)
  const withoutInvestmentsSummary = calculateAnnualSummary(
    billData, refinement, NO_UPGRADES, seZone, assumptions
  );

  // Scenario B: Current situation (with existing equipment)
  const existingEquipmentUpgrades = buildExistingEquipmentUpgrades(refinement);
  const currentSituationSummary = calculateAnnualSummary(
    billData, refinement, existingEquipmentUpgrades, seZone, assumptions
  );

  // Scenario C: After recommended upgrades (existing + new recommendations)
  const afterRecommendationsUpgrades: ActiveUpgrades = { ...existingEquipmentUpgrades };
  if (recommendedUpgrades) {
    for (const upgradeId of recommendedUpgrades) {
      afterRecommendationsUpgrades[upgradeId] = true;
    }
  }
  const afterRecommendationsSummary = calculateAnnualSummary(
    billData, refinement, afterRecommendationsUpgrades, seZone, assumptions
  );

  return {
    withoutInvestments: buildScenarioDetail(withoutInvestmentsSummary, false),
    currentSituation: buildScenarioDetail(currentSituationSummary, true),
    afterRecommendations: buildScenarioDetail(afterRecommendationsSummary, true),
    existingSavingsKr:
      withoutInvestmentsSummary.yearlyTotalCostBase - currentSituationSummary.yearlyTotalCostAfter,
    potentialSavingsKr:
      currentSituationSummary.yearlyTotalCostAfter - afterRecommendationsSummary.yearlyTotalCostAfter,
  };
}
```

---

## FIL 6: `app/simulator/simulation/annual.ts`

**KLIPPS VID rad 200:** `totalKr` (mitt i annualCostBreakdown-objektet)

**RADERA rad 200 och allt efter. LÄGG TILL ISTÄLLET:**

```typescript
          totalKr: monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0),
          avgMonthlyKr: Math.round(monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0) / 12),
          effectiveOrePerKwh: yearlyKwhAfter > 0
            ? Math.round((monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0) / yearlyKwhAfter) * 100 * 10) / 10
            : 0,
  };

  return {
    yearlyKwhBase,
    yearlyKwhAfter,
    yearlyEnergyCostBase,
    yearlyEnergyCostAfter,
    yearlyGridFeeCost,
    yearlyPowerFeeCostBase,
    yearlyPowerFeeCostAfter,
    yearlyTotalCostBase,
    yearlyTotalCostAfter,
    totalInvestmentCost,
    paybackYears: Math.round(paybackYears * 10) / 10,
    solarProductionYearlyKwh,
    annualCostBreakdown,
  };
}
```

---

## FIL 7: `app/simulator/components/RecommendationResults.tsx`

**KLIPPS VID rad 198:** `Med åtgär` (mitt i texten "Med åtgärder")

**RADERA rad 198 och allt efter. LÄGG TILL ISTÄLLET:**

```tsx
            <span className="text-xs text-text-muted">Med åtgärder</span>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-text-primary font-medium">
          {score.message}
        </p>
      </div>

      {/* Total savings highlight */}
      {totalYearlySavings > 0 && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-brand-500/10 to-brand-600/10 border border-brand-400/20 p-4 text-center">
          <span className="text-sm text-text-secondary">Total potentiell besparing</span>
          <div className="mt-1 text-3xl font-bold text-brand-300">
            {totalYearlySavings.toLocaleString("sv-SE")} kr/år
          </div>
        </div>
      )}

      {/* Recommendation cards */}
      <div className="flex flex-col gap-4 mb-6">
        {recommendations.recommendations.map((rec) => (
          <RecommendationCard key={rec.upgradeId} recommendation={rec} />
        ))}
      </div>

      {recommendations.recommendations.length === 0 && (
        <div className="glass-card-strong rounded-2xl p-8 text-center mb-6">
          <p className="text-text-secondary">
            Din energiprofil ser redan bra ut! Vi hittade inga tydliga besparingsåtgärder.
          </p>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex flex-col gap-3 mb-8">
        <button
          onClick={onViewDashboard}
          className="w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          {STRINGS.viewDetailedAnalysis}
        </button>
        <button
          onClick={() => setShowAccountModal(true)}
          className="w-full rounded-xl border-2 border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-brand-300 hover:text-text-primary"
        >
          {STRINGS.createAccount}
        </button>
        <button
          onClick={onRestart}
          className="w-full rounded-xl px-6 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-bright"
        >
          Börja om
        </button>
      </div>

      <AccountModal open={showAccountModal} onClose={() => setShowAccountModal(false)} />
    </div>
  );
}
```

---

## VERIFIERING

Efter att alla 7 filer är fixade, kör:

```bash
npx tsc --noEmit
```

Vanligaste kvarvarande problem:
1. **Import-ordning i types.ts** — `import type { MonthlyCostBreakdown }` måste ligga före det används. Om TypeScript klagar på cirkulär import, flytta importen till toppen av filen.
2. **Duplicerade typdefinitioner** — Om `YearlyDataPoint`, `AnnualSummary` etc redan fanns i filen före klippunkten (kontrollera!), ta bort dubbletten.
3. **`DEFAULT_GRID_FEE_KR_PER_MONTH` / `DEFAULT_POWER_FEE_KR_PER_KW`** — dessa exporteras nu från `energy-prices.ts` och används i `RecommendationResults.tsx`. Om de importeras från annat ställe, justera.
4. **Null-bytes** — Sök igenom alla filer efter `\x00` (null-bytes) och radera dem. I VS Code: sök med regex `\x00` eller `\0`.

### Snabbtest efter fix

Ladda sidan i webbläsaren. Kontrollera att:
- "Din nuvarande situation" visar en totalsumma som verkar rimlig (~25 000-55 000 kr/år för en svensk villa)
- Donut-grafen visar alla kostnadsposter i olika färger
- "Förstå din faktura" expanderar och visar Elhandel vs Elnät sida vid sida
- "Se detaljerade uträkningar" expanderar innanför fakturavyn
- Rekommendationskorten visas under kostnadsöversikten
