# CURSOR-PROMPT-5: Detaljerad kostnadsnedbrytning + graf i "Din nuvarande situation"

## Bakgrund

"Din nuvarande situation" i `RecommendationResults.tsx` visar idag bara **en enda siffra** — årskostnaden. Användaren har ingen aning om vad som utgör den kostnaden. Kostnadsmodellen (`cost-model.ts`) producerar redan en komplett nedbrytning i 7 komponenter via `MonthlyCostBreakdown` — men dessa data försvinner i scenariosystemet och når aldrig UI:t.

Målet: visa användaren exakt vad som utgör deras elräkning, med en graf och en expanderbar "Så räknade vi"-sektion.

## Steg 1: Tråda igenom kostnadsnedbrytning till scenarierna

### `app/simulator/types.ts`

Lägg till ett nytt interface och utöka `ThreeScenarioSummary`:

```typescript
import type { AnnualCostBreakdown } from "./simulation/cost-model";

/** Aggregated annual cost breakdown for display — 7 components */
export interface AnnualCostComponents {
  spotCostKr: number;           // Spotpris (elhandel)
  markupCostKr: number;         // Elhandlarens påslag
  elhandelMonthlyFeeKr: number; // Elhandlarens månadsavgift × 12
  gridFixedFeeKr: number;       // Fast nätavgift
  gridTransferFeeKr: number;    // Rörlig överföringsavgift
  gridPowerChargeKr: number;    // Effektavgift
  energyTaxKr: number;          // Energiskatt
  exportRevenueKr: number;      // Solproduktion (negativt = intäkt)
  totalKr: number;              // Totalt inkl moms
}

export interface ScenarioDetail {
  yearlyKwh: number;
  yearlyCostKr: number;
  yearlyTotalCostKr: number;
  /** Detailed cost breakdown — NEW */
  costComponents: AnnualCostComponents;
}

export interface ThreeScenarioSummary {
  withoutInvestments: ScenarioDetail;
  currentSituation: ScenarioDetail;
  afterRecommendations: ScenarioDetail;
  existingSavingsKr: number;
  potentialSavingsKr: number;
}
```

> **OBS:** `ScenarioDetail` ersätter de nuvarande inline-objekten i `ThreeScenarioSummary`. Uppdatera befintlig kod som refererar till `threeScenarios.currentSituation.yearlyTotalCostKr` etc — den formen behålls, men nu finns även `.costComponents`.

### `app/simulator/simulation/scenarios.ts`

Uppdatera `calculateThreeScenarios()` att bygga `AnnualCostComponents` från `AnnualSummary`:

```typescript
import type {
  BillData, RefinementAnswers, ThreeScenarioSummary, ScenarioDetail,
  AnnualCostComponents, ActiveUpgrades, Assumptions, SEZone, UpgradeId,
} from "../types";
import { buildExistingEquipmentUpgrades, NO_UPGRADES } from "./upgrades";
import { calculateAnnualSummary } from "./annual";

export { PRICE_SCENARIOS, projectCostsOverTime, calculateNPV } from "../climate";
export type { PriceScenario } from "../climate";

/** Extract annual cost components from AnnualSummary */
function extractCostComponents(summary: AnnualSummary): AnnualCostComponents {
  // If annualCostBreakdown exists (new cost model), use it directly
  if (summary.annualCostBreakdown) {
    const b = summary.annualCostBreakdown;
    const months = b.months;
    return {
      spotCostKr: months.reduce((s, m) => s + m.spotCostKr, 0),
      markupCostKr: months.reduce((s, m) => s + m.markupCostKr, 0),
      elhandelMonthlyFeeKr: months.reduce((s, m) => s + m.elhandelMonthlyFeeKr, 0),
      gridFixedFeeKr: months.reduce((s, m) => s + m.gridFixedFeeKr, 0),
      gridTransferFeeKr: months.reduce((s, m) => s + m.gridTransferFeeKr, 0),
      gridPowerChargeKr: months.reduce((s, m) => s + m.gridPowerChargeKr, 0),
      energyTaxKr: months.reduce((s, m) => s + m.energyTaxKr, 0),
      exportRevenueKr: months.reduce((s, m) => s + m.exportRevenueKr, 0),
      totalKr: b.totalKr,
    };
  }

  // Fallback: estimate from legacy fields
  return {
    spotCostKr: summary.yearlyEnergyCostAfter ?? summary.yearlyEnergyCostBase,
    markupCostKr: 0,
    elhandelMonthlyFeeKr: 0,
    gridFixedFeeKr: summary.yearlyGridFeeCost ?? 0,
    gridTransferFeeKr: 0,
    gridPowerChargeKr: summary.yearlyPowerFeeCostAfter ?? summary.yearlyPowerFeeCostBase ?? 0,
    energyTaxKr: 0,
    exportRevenueKr: 0,
    totalKr: summary.yearlyTotalCostAfter ?? summary.yearlyTotalCostBase,
  };
}

function buildScenarioDetail(summary: AnnualSummary, useAfter: boolean): ScenarioDetail {
  return {
    yearlyKwh: useAfter ? summary.yearlyKwhAfter : summary.yearlyKwhBase,
    yearlyCostKr: useAfter ? summary.yearlyEnergyCostAfter : summary.yearlyEnergyCostBase,
    yearlyTotalCostKr: useAfter ? summary.yearlyTotalCostAfter : summary.yearlyTotalCostBase,
    costComponents: extractCostComponents(summary),
  };
}

export function calculateThreeScenarios(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions,
  recommendedUpgrades?: UpgradeId[]
): ThreeScenarioSummary {
  const withoutInvestmentsSummary = calculateAnnualSummary(
    billData, refinement, NO_UPGRADES, seZone, assumptions
  );

  const existingEquipmentUpgrades = buildExistingEquipmentUpgrades(refinement);
  const currentSituationSummary = calculateAnnualSummary(
    billData, refinement, existingEquipmentUpgrades, seZone, assumptions
  );

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

### `app/simulator/simulation/annual.ts`

Säkerställ att `AnnualSummary` har fältet `annualCostBreakdown`:

```typescript
// I AnnualSummary-interfacet (i types.ts), lägg till:
export interface AnnualSummary {
  // ... befintliga fält ...

  /** Detailed cost breakdown from new cost model */
  annualCostBreakdown?: AnnualCostBreakdown;  // <-- NY
}
```

Säkerställ att `calculateAnnualSummary()` returnerar det. Det verkar redan beräknas runt rad 195-200 i `annual.ts` — kontrollera att det faktiskt inkluderas i return-objektet. Om filen är trunkerad (null-bytes), rensa den och komplettera return-satsen.

## Steg 2: Ny komponent — CostBreakdownCard

Skapa `app/simulator/components/CostBreakdownCard.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import type { AnnualCostComponents } from "../types";

interface CostBreakdownCardProps {
  /** Label, e.g. "Din nuvarande situation" */
  title: string;
  components: AnnualCostComponents;
  /** Optional: show "Så räknade vi" expandable section */
  showExplanation?: boolean;
  /** Optional: assumptions used for the explanation */
  assumptions?: {
    gridOperator?: string;
    spotPriceSource?: string;
    energyTaxOre?: number;
    transferFeeOre?: number;
    markupOre?: number;
  };
}

/** Cost component display config */
const COST_ITEMS: {
  key: keyof AnnualCostComponents;
  label: string;
  sublabel: string;
  color: string;
  invoice: "elhandel" | "elnat";
}[] = [
  { key: "spotCostKr",           label: "Spotpris",             sublabel: "Rörligt elpris per kWh",          color: "#60a5fa", invoice: "elhandel" },
  { key: "markupCostKr",         label: "Elhandlarens påslag",  sublabel: "Fast påslag per kWh",             color: "#818cf8", invoice: "elhandel" },
  { key: "elhandelMonthlyFeeKr", label: "Månadsavgift elhandel",sublabel: "Fast avgift till elhandlaren",    color: "#a78bfa", invoice: "elhandel" },
  { key: "gridTransferFeeKr",    label: "Överföringsavgift",    sublabel: "Rörlig nätavgift per kWh",        color: "#f59e0b", invoice: "elnat" },
  { key: "gridFixedFeeKr",       label: "Fast nätavgift",       sublabel: "Abonnemangsavgift till nätägare", color: "#f97316", invoice: "elnat" },
  { key: "gridPowerChargeKr",    label: "Effektavgift",         sublabel: "Baseras på din toppeffekt (kW)",  color: "#ef4444", invoice: "elnat" },
  { key: "energyTaxKr",          label: "Energiskatt",          sublabel: "Statlig skatt 36 öre/kWh + moms", color: "#ec4899", invoice: "elnat" },
];

export default function CostBreakdownCard({
  title,
  components,
  showExplanation = true,
  assumptions,
}: CostBreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter out zero-value items and calculate totals
  const { items, elhandelTotal, elnatTotal } = useMemo(() => {
    const items = COST_ITEMS
      .map((item) => ({ ...item, value: components[item.key] as number }))
      .filter((item) => Math.abs(item.value) > 0);

    const elhandelTotal = items
      .filter((i) => i.invoice === "elhandel")
      .reduce((s, i) => s + i.value, 0);
    const elnatTotal = items
      .filter((i) => i.invoice === "elnat")
      .reduce((s, i) => s + i.value, 0);

    return { items, elhandelTotal, elnatTotal };
  }, [components]);

  // Donut chart data
  const total = components.totalKr + (components.exportRevenueKr < 0 ? components.exportRevenueKr : 0);
  const positiveTotal = items.reduce((s, i) => s + Math.max(0, i.value), 0);

  return (
    <div className="glass-card-strong rounded-2xl p-5">
      <h3 className="mb-1 text-sm font-semibold text-text-secondary">{title}</h3>
      <p className="mb-4 text-2xl font-bold text-text-primary">
        {Math.round(components.totalKr).toLocaleString("sv-SE")} kr/år
      </p>

      {/* Two-column: donut chart + list */}
      <div className="flex gap-6">
        {/* Donut chart */}
        <div className="relative h-36 w-36 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            {(() => {
              let cumulative = 0;
              const circumference = Math.PI * 80; // r=40
              return items
                .filter((i) => i.value > 0)
                .map((item, idx) => {
                  const pct = item.value / positiveTotal;
                  const dashLength = pct * circumference;
                  const dashOffset = cumulative * circumference;
                  cumulative += pct;
                  return (
                    <circle
                      key={idx}
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="16"
                      strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                      strokeDashoffset={-dashOffset}
                    />
                  );
                });
            })()}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-text-muted">per månad</span>
            <span className="text-sm font-bold text-text-primary">
              {Math.round(components.totalKr / 12).toLocaleString("sv-SE")} kr
            </span>
          </div>
        </div>

        {/* Cost items list — grouped by invoice */}
        <div className="flex-1 space-y-3">
          {/* Elhandel group */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Elhandel ({Math.round(elhandelTotal).toLocaleString("sv-SE")} kr)
            </p>
            {items.filter((i) => i.invoice === "elhandel").map((item) => (
              <div key={item.key} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-text-secondary">{item.label}</span>
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  {Math.round(item.value).toLocaleString("sv-SE")} kr
                </span>
              </div>
            ))}
          </div>

          {/* Elnät group */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Elnät ({Math.round(elnatTotal).toLocaleString("sv-SE")} kr)
            </p>
            {items.filter((i) => i.invoice === "elnat").map((item) => (
              <div key={item.key} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-text-secondary">{item.label}</span>
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  {Math.round(item.value).toLocaleString("sv-SE")} kr
                </span>
              </div>
            ))}
          </div>

          {/* Export revenue (if applicable) */}
          {components.exportRevenueKr < 0 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-1">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-energy-green" />
                <span className="text-xs text-text-secondary">Solproduktion</span>
              </div>
              <span className="text-xs font-semibold text-energy-green">
                {Math.round(components.exportRevenueKr).toLocaleString("sv-SE")} kr
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable: "Så räknade vi" */}
      {showExplanation && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-surface-light/50"
          >
            <span className="font-medium text-text-muted">Så räknade vi</span>
            <svg
              className={`h-4 w-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 rounded-lg bg-surface-light/30 p-3 text-xs text-text-muted">
              <p>
                Kostnadsberäkningen baseras på den svenska elräkningsstrukturen med
                två separata fakturor: <strong className="text-text-secondary">elhandel</strong> (spotpris
                + påslag) och <strong className="text-text-secondary">elnät</strong> (överföring
                + effekt + energiskatt).
              </p>
              <div className="space-y-1">
                <p className="font-medium text-text-secondary">Antaganden:</p>
                <ul className="ml-3 space-y-0.5 list-disc">
                  <li>Spotpriser: Genomsnittliga Nord Pool-priser per zon och månad (2023-2025)</li>
                  <li>Elhandlarens påslag: {assumptions?.markupOre ?? 8} öre/kWh</li>
                  <li>Överföringsavgift: {assumptions?.transferFeeOre ?? 10} öre/kWh</li>
                  <li>Energiskatt: {assumptions?.energyTaxOre ?? 36} öre/kWh (+ 25% moms)</li>
                  {assumptions?.gridOperator && (
                    <li>Nätägare: {assumptions.gridOperator}</li>
                  )}
                  <li>Moms: 25% på samtliga poster</li>
                </ul>
              </div>
              <p>
                Din årsförbrukning fördelas över 12 månader med säsongsfaktorer baserade
                på SMHI:s temperaturdata för din zon. Varje månads kostnad beräknas separat
                med det månadens spotpris.
              </p>
              <p className="text-[10px] text-text-muted/60">
                Källa: Nord Pool, Elpriskollen (Energimarknadsinspektionen), SMHI, Skatteverket
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Steg 3: Integrera i RecommendationResults

### `app/simulator/components/RecommendationResults.tsx`

Ersätt den befintliga "Din nuvarande situation"-sektionen (rad 93-126) med den nya komponenten:

```tsx
// Lägg till import högst upp:
import CostBreakdownCard from "./CostBreakdownCard";

// Ersätt sektionen "Vad dina befintliga investeringar sparar" (rad 93-126) med:

      {/* Cost breakdown: current situation */}
      {threeScenarios && (
        <div className="mb-6">
          <CostBreakdownCard
            title="Din nuvarande situation"
            components={threeScenarios.currentSituation.costComponents}
            showExplanation={true}
            assumptions={{
              gridOperator: assumptions?.gridOperator ?? billData.natAgare,
              markupOre: assumptions?.elhandelMarkupOre ?? 8,
              transferFeeOre: assumptions?.gridTransferFeeOre ?? 10,
              energyTaxOre: 36,
            }}
          />

          {/* Existing investments savings (if applicable) */}
          {hasExistingEquipment && (
            <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-energy-green/5 border border-energy-green/10 px-4 py-2">
              <svg className="h-4 w-4 text-energy-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-text-secondary">
                Dina befintliga investeringar sparar redan{" "}
                <strong className="text-energy-green">
                  {threeScenarios.existingSavingsKr.toLocaleString("sv-SE")} kr/år
                </strong>
                {" "}jämfört med{" "}
                <span className="text-text-muted">
                  {threeScenarios.withoutInvestments.yearlyTotalCostKr.toLocaleString("sv-SE")} kr/år utan dem
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Fallback when no scenarios available */}
      {!threeScenarios && (
        <div className="glass-card-strong mb-6 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-text-secondary">Din nuvarande situation</h3>
          <p className="text-2xl font-bold text-text-primary">
            {(billData.costPerMonth * 12).toLocaleString("sv-SE")} kr/år
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Baserat på {billData.kwhPerMonth} kWh/mån × 12
          </p>
        </div>
      )}
```

## Steg 4: Uppdatera AnnualSummaryBar (Dashboard-vyn)

### `app/simulator/components/AnnualSummaryBar.tsx`

Dashboarden har redan en "Scenario-jämförelse". Lägg till en `CostBreakdownCard` ovanför den:

```tsx
// Lägg till import:
import CostBreakdownCard from "./CostBreakdownCard";

// Lägg till efter <h3>-taggen för årssammanfattning, före det befintliga if-blocket:
      {threeScenarios && (
        <div className="mb-4">
          <CostBreakdownCard
            title="Kostnadsfördelning — nuläge"
            components={threeScenarios.currentSituation.costComponents}
            showExplanation={false}
          />
        </div>
      )}
```

## Verifiering

1. Kör `npx tsc --noEmit` — vanligaste felen:
   - `AnnualCostComponents` saknas i types.ts
   - `costComponents` saknas i befintlig kod som läser `ThreeScenarioSummary`
   - `annualCostBreakdown` saknas i `AnnualSummary` return-typ

2. Kontrollera att donut-chart:en renderar korrekt:
   - Total av alla segment bör = 100% av cirkeln
   - Färgerna ska vara distinkta och läsbara mot mörk bakgrund
   - Småposter (t.ex. månadsavgift ~600 kr/år) ska fortfarande synas som tunna segment

3. Kolla att "Så räknade vi"-sektionen visar rätt antaganden baserat på vad som passas in

## Sammanfattning av ändringar

| Fil | Ändring |
|-----|---------|
| `types.ts` | Nytt `AnnualCostComponents` + `ScenarioDetail` interface, utökat `ThreeScenarioSummary` och `AnnualSummary` |
| `simulation/scenarios.ts` | `extractCostComponents()` + `buildScenarioDetail()` — trådar igenom nedbrytning |
| `components/CostBreakdownCard.tsx` | **NY** — donut-chart + kostnadslista + expanderbar "Så räknade vi" |
| `components/RecommendationResults.tsx` | Ersätt gammal "nuvarande situation" med `CostBreakdownCard` |
| `components/AnnualSummaryBar.tsx` | Lägg till `CostBreakdownCard` i dashboard-vyn |

Inga nya beroenden — donut-chart:en är ren SVG.
