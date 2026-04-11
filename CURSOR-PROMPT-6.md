# CURSOR-PROMPT-6: "Förstå din faktura" — pedagogisk fakturavyn + expanderbara uträkningar

## Bakgrund

I CURSOR-PROMPT-5 byggde vi `CostBreakdownCard` med en donut-graf och en grundläggande "Så räknade vi"-sektion. Nu utökar vi det med en vy som visualiserar **de två separata fakturorna** sida vid sida — precis som de verkliga fakturorna ser ut — och en expanderbar sektion med detaljerade uträkningar.

Strukturen blir tre nivåer som användaren aktivt klickar sig nedåt i:

1. **Donut-graf + kostnadslista** (redan synlig i CostBreakdownCard)
2. **"Förstå din faktura"** — visar elhandel vs elnät som två separata "fakturor" med förklaringar
3. **"Se detaljerade uträkningar"** — visar exakt hur varje kostnad beräknats (formler, antaganden, kWh × öre)

## Steg 1: Skapa InvoiceExplainerCard-komponent

Skapa `app/simulator/components/InvoiceExplainerCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { AnnualCostComponents } from "../types";

interface InvoiceExplainerCardProps {
  components: AnnualCostComponents;
  yearlyKwh: number;
  /** Details used in calculations — passed through for "Se detaljerade uträkningar" */
  calculationDetails: {
    seZone: string;
    gridOperator?: string;
    spotPrices: number[];       // 12 monthly spot prices (öre/kWh exkl moms)
    monthlyKwh: number[];       // 12 monthly consumption values
    monthlyPeakKw?: number[];   // 12 monthly peak values
    transferFeeOre: number;
    markupOre: number;
    energyTaxOre: number;
    gridFixedFeeKr: number;     // per month exkl moms
    powerChargeKrPerKw: number;
    hasPowerCharge: boolean;
    elhandelMonthlyFeeKr: number; // per month exkl moms
  };
}

export default function InvoiceExplainerCard({
  components,
  yearlyKwh,
  calculationDetails,
}: InvoiceExplainerCardProps) {
  const [showDetailedCalc, setShowDetailedCalc] = useState(false);

  const elhandelTotal =
    components.spotCostKr + components.markupCostKr + components.elhandelMonthlyFeeKr;
  const elnatTotal =
    components.gridFixedFeeKr + components.gridTransferFeeKr +
    components.gridPowerChargeKr + components.energyTaxKr;

  // Calculate what the user CAN vs CANNOT influence
  const canInfluence = components.spotCostKr + components.gridTransferFeeKr + components.gridPowerChargeKr;
  const cannotInfluence = components.energyTaxKr + components.gridFixedFeeKr +
    components.elhandelMonthlyFeeKr + components.markupCostKr;
  const influencePercent = Math.round((canInfluence / (canInfluence + cannotInfluence)) * 100);

  const d = calculationDetails;

  return (
    <div className="space-y-4">
      {/* Two invoices side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* LEFT: Elhandel */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20">
              <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-300">Elhandel</p>
              <p className="text-[10px] text-text-muted">
                {d.gridOperator ? `Faktura 1 — t.ex. Tibber` : "Faktura 1 — din elhandlare"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <InvoiceLine
              label="Spotpris"
              description="Marknadens rörliga elpris"
              amount={components.spotCostKr}
              color="text-blue-300"
              canInfluence={true}
              influenceHow="Timpris + smart styrning"
            />
            <InvoiceLine
              label="Påslag"
              description="Elhandlarens marginal"
              amount={components.markupCostKr}
              color="text-blue-300"
              canInfluence={false}
            />
            <InvoiceLine
              label="Månadsavgift"
              description="Fast avgift till elhandlaren"
              amount={components.elhandelMonthlyFeeKr}
              color="text-blue-300"
              canInfluence={false}
            />
          </div>

          <div className="mt-3 border-t border-blue-500/20 pt-2 flex justify-between">
            <span className="text-xs font-semibold text-blue-300">Summa elhandel</span>
            <span className="text-sm font-bold text-blue-200">
              {Math.round(elhandelTotal).toLocaleString("sv-SE")} kr/år
            </span>
          </div>
        </div>

        {/* RIGHT: Elnät */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20">
              <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-300">Elnät</p>
              <p className="text-[10px] text-text-muted">
                Faktura 2 — {d.gridOperator || "din nätägare"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <InvoiceLine
              label="Överföring"
              description="Rörlig nätavgift per kWh"
              amount={components.gridTransferFeeKr}
              color="text-amber-300"
              canInfluence={true}
              influenceHow="Solceller minskar import"
            />
            <InvoiceLine
              label="Fast nätavgift"
              description="Abonnemangsavgift"
              amount={components.gridFixedFeeKr}
              color="text-amber-300"
              canInfluence={false}
            />
            {components.gridPowerChargeKr > 0 && (
              <InvoiceLine
                label="Effektavgift"
                description="Baseras på din toppeffekt"
                amount={components.gridPowerChargeKr}
                color="text-amber-300"
                canInfluence={true}
                influenceHow="Batteri kapar toppar"
              />
            )}
            <InvoiceLine
              label="Energiskatt"
              description="Statlig skatt på el"
              amount={components.energyTaxKr}
              color="text-amber-300"
              canInfluence={false}
            />
          </div>

          <div className="mt-3 border-t border-amber-500/20 pt-2 flex justify-between">
            <span className="text-xs font-semibold text-amber-300">Summa elnät</span>
            <span className="text-sm font-bold text-amber-200">
              {Math.round(elnatTotal).toLocaleString("sv-SE")} kr/år
            </span>
          </div>
        </div>
      </div>

      {/* Solar revenue (if applicable) */}
      {components.exportRevenueKr < 0 && (
        <div className="flex items-center justify-between rounded-xl border border-energy-green/20 bg-energy-green/5 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-energy-green/20">
              <svg className="h-3 w-3 text-energy-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs text-text-secondary">Solproduktion (intäkt)</span>
          </div>
          <span className="text-sm font-bold text-energy-green">
            {Math.round(components.exportRevenueKr).toLocaleString("sv-SE")} kr/år
          </span>
        </div>
      )}

      {/* Total + influence summary */}
      <div className="rounded-xl bg-surface-light/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text-secondary">Totalt per år</span>
          <span className="text-xl font-bold text-text-primary">
            {Math.round(components.totalKr).toLocaleString("sv-SE")} kr
          </span>
        </div>

        {/* Influence bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-energy-green font-medium">
              {influencePercent}% kan du påverka med rätt åtgärder
            </span>
            <span className="text-text-muted">
              {100 - influencePercent}% fasta kostnader
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-light overflow-hidden flex">
            <div
              className="h-full rounded-l-full bg-energy-green/60"
              style={{ width: `${influencePercent}%` }}
            />
            <div
              className="h-full rounded-r-full bg-white/10"
              style={{ width: `${100 - influencePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expandable: detailed calculations */}
      <div className="border-t border-white/10 pt-2">
        <button
          onClick={() => setShowDetailedCalc(!showDetailedCalc)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs transition-colors hover:bg-surface-light/50"
        >
          <span className="font-medium text-text-muted">Se detaljerade uträkningar</span>
          <svg
            className={`h-4 w-4 text-text-muted transition-transform ${showDetailedCalc ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDetailedCalc && (
          <DetailedCalculations
            components={components}
            yearlyKwh={yearlyKwh}
            details={d}
          />
        )}
      </div>
    </div>
  );
}

/** Single line item on an invoice */
function InvoiceLine({
  label,
  description,
  amount,
  color,
  canInfluence,
  influenceHow,
}: {
  label: string;
  description: string;
  amount: number;
  color: string;
  canInfluence: boolean;
  influenceHow?: string;
}) {
  return (
    <div className="group relative">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{label}</span>
            {canInfluence && (
              <span className="inline-flex items-center rounded-full bg-energy-green/10 px-1.5 py-0 text-[9px] font-medium text-energy-green leading-tight">
                Påverkbar
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-muted leading-tight">{description}</p>
          {canInfluence && influenceHow && (
            <p className="text-[10px] text-energy-green/70 leading-tight">
              → {influenceHow}
            </p>
          )}
        </div>
        <span className={`text-xs font-semibold ${color} tabular-nums whitespace-nowrap`}>
          {Math.round(amount).toLocaleString("sv-SE")} kr
        </span>
      </div>
    </div>
  );
}

/** Expandable detailed calculations section */
function DetailedCalculations({
  components,
  yearlyKwh,
  details: d,
}: {
  components: AnnualCostComponents;
  yearlyKwh: number;
  details: InvoiceExplainerCardProps["calculationDetails"];
}) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

  return (
    <div className="mt-2 space-y-4 rounded-lg bg-surface-light/20 p-4 text-xs">
      {/* Section: Input data */}
      <div>
        <h4 className="font-semibold text-text-secondary mb-2">Ingångsdata</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-text-muted">
          <span>Elområde:</span>
          <span className="text-text-secondary font-medium">{d.seZone}</span>
          {d.gridOperator && (
            <>
              <span>Nätägare:</span>
              <span className="text-text-secondary font-medium">{d.gridOperator}</span>
            </>
          )}
          <span>Total årsförbrukning:</span>
          <span className="text-text-secondary font-medium">{yearlyKwh.toLocaleString("sv-SE")} kWh</span>
        </div>
      </div>

      {/* Section: Monthly breakdown table */}
      <div>
        <h4 className="font-semibold text-text-secondary mb-2">Månadsvis fördelning</h4>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-text-muted">
                <th className="text-left py-1 px-1 font-medium">Mån</th>
                <th className="text-right py-1 px-1 font-medium">kWh</th>
                <th className="text-right py-1 px-1 font-medium">Spot öre</th>
                {d.monthlyPeakKw && <th className="text-right py-1 px-1 font-medium">Topp kW</th>}
              </tr>
            </thead>
            <tbody>
              {monthNames.map((name, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="py-0.5 px-1 text-text-secondary">{name}</td>
                  <td className="py-0.5 px-1 text-right tabular-nums text-text-muted">
                    {d.monthlyKwh[i]?.toLocaleString("sv-SE") ?? "—"}
                  </td>
                  <td className="py-0.5 px-1 text-right tabular-nums text-text-muted">
                    {d.spotPrices[i]?.toFixed(0) ?? "—"}
                  </td>
                  {d.monthlyPeakKw && (
                    <td className="py-0.5 px-1 text-right tabular-nums text-text-muted">
                      {d.monthlyPeakKw[i]?.toFixed(1) ?? "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Calculation formulas */}
      <div>
        <h4 className="font-semibold text-text-secondary mb-2">Så beräknas varje post</h4>
        <div className="space-y-3">
          <CalcFormula
            label="Spotpris"
            formula={`Σ (månadskWh × spotpris × 1.25 moms)`}
            example={`Ex. januari: ${d.monthlyKwh[0]?.toLocaleString("sv-SE") ?? "?"} kWh × ${d.spotPrices[0]?.toFixed(0) ?? "?"} öre/kWh × 1.25`}
            result={components.spotCostKr}
          />
          <CalcFormula
            label="Påslag elhandlare"
            formula={`${yearlyKwh.toLocaleString("sv-SE")} kWh × ${d.markupOre} öre/kWh × 1.25 moms`}
            result={components.markupCostKr}
          />
          <CalcFormula
            label="Månadsavgift elhandel"
            formula={`${d.elhandelMonthlyFeeKr} kr/mån × 12 × 1.25 moms`}
            result={components.elhandelMonthlyFeeKr}
          />
          <CalcFormula
            label="Överföringsavgift"
            formula={`${yearlyKwh.toLocaleString("sv-SE")} kWh × ${d.transferFeeOre} öre/kWh × 1.25 moms`}
            result={components.gridTransferFeeKr}
          />
          <CalcFormula
            label="Fast nätavgift"
            formula={`${d.gridFixedFeeKr} kr/mån × 12 × 1.25 moms`}
            result={components.gridFixedFeeKr}
          />
          {d.hasPowerCharge && (
            <CalcFormula
              label="Effektavgift"
              formula={`Σ (månadens toppeffekt kW × ${d.powerChargeKrPerKw} kr/kW × 1.25 moms)`}
              example={`Baseras på högsta timeffekten per månad`}
              result={components.gridPowerChargeKr}
            />
          )}
          <CalcFormula
            label="Energiskatt"
            formula={`${yearlyKwh.toLocaleString("sv-SE")} kWh × ${d.energyTaxOre} öre/kWh × 1.25 moms`}
            result={components.energyTaxKr}
          />
        </div>
      </div>

      {/* Sources */}
      <div className="border-t border-white/5 pt-2">
        <p className="text-[10px] text-text-muted/60">
          <strong>Källor:</strong> Spotpriser — Nord Pool (genomsnitt 2023-2025) · Energiskatt — Skatteverket ·
          Nätavgifter — Elpriskollen/Energimarknadsinspektionen · Säsongsfaktorer — SMHI (1991-2020 normaler)
        </p>
      </div>
    </div>
  );
}

/** A single calculation formula with label, formula string, and result */
function CalcFormula({
  label,
  formula,
  example,
  result,
}: {
  label: string;
  formula: string;
  example?: string;
  result: number;
}) {
  return (
    <div className="rounded bg-surface-light/30 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-text-secondary">{label}</p>
          <p className="text-text-muted font-mono text-[10px] mt-0.5">{formula}</p>
          {example && (
            <p className="text-text-muted/70 text-[10px] mt-0.5">{example}</p>
          )}
        </div>
        <span className="font-semibold text-text-primary tabular-nums whitespace-nowrap">
          = {Math.round(result).toLocaleString("sv-SE")} kr
        </span>
      </div>
    </div>
  );
}
```

## Steg 2: Utöka CostBreakdownCard att inkludera InvoiceExplainerCard

### `app/simulator/components/CostBreakdownCard.tsx`

Uppdatera den befintliga `CostBreakdownCard` (från CURSOR-PROMPT-5) att innehålla fakturavyn som en expanderbar sektion **mellan** donut-grafen och "Så räknade vi". Strukturen blir:

1. Donut-graf + kostnadslista (alltid synlig)
2. **"Förstå din faktura"** (expanderbar) → visar `InvoiceExplainerCard`
3. Inne i `InvoiceExplainerCard` finns sedan **"Se detaljerade uträkningar"** (ytterligare expanderbar)

Ersätt den befintliga `showExplanation`-sektionen i `CostBreakdownCard`:

```tsx
import InvoiceExplainerCard from "./InvoiceExplainerCard";

// I CostBreakdownCardProps — lägg till:
interface CostBreakdownCardProps {
  title: string;
  components: AnnualCostComponents;
  yearlyKwh?: number;
  calculationDetails?: InvoiceExplainerCardProps["calculationDetails"];
}

// I CostBreakdownCard — ersätt den gamla "Så räknade vi"-sektionen:

      {/* Expandable: "Förstå din faktura" */}
      {calculationDetails && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-surface-light/50"
          >
            <span className="font-medium text-text-muted">
              {expanded ? "Dölj fakturadetaljer" : "Förstå din faktura"}
            </span>
            <svg
              className={`h-4 w-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="mt-3">
              <InvoiceExplainerCard
                components={components}
                yearlyKwh={yearlyKwh ?? 0}
                calculationDetails={calculationDetails}
              />
            </div>
          )}
        </div>
      )}
```

## Steg 3: Tråda igenom calculationDetails från RecommendationResults

### `app/simulator/components/RecommendationResults.tsx`

Uppdatera CostBreakdownCard-anropet att skicka med beräkningsdetaljer:

```tsx
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { getEnergyTaxRate } from "../data/energy-tax";
import { getGridPricing, DEFAULT_GRID_PRICING } from "../data/grid-operators";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";

// Inuti komponenten, bygg calculationDetails:
const calculationDetails = useMemo(() => {
  if (!seZone || !threeScenarios) return undefined;

  const gridPricing = assumptions?.gridOperator
    ? getGridPricing(assumptions.gridOperator)
    : (billData.natAgare ? getGridPricing(billData.natAgare) : DEFAULT_GRID_PRICING);

  // Get monthly kWh from the scenario (if available from annualCostBreakdown)
  const monthlyKwh = threeScenarios.currentSituation.costComponents
    ? distributeAnnualKwh(threeScenarios.currentSituation.yearlyKwh, seZone)
    : new Array(12).fill(threeScenarios.currentSituation.yearlyKwh / 12);

  return {
    seZone,
    gridOperator: assumptions?.gridOperator ?? billData.natAgare,
    spotPrices: SE_ZONE_SPOT_PRICE[seZone] ?? new Array(12).fill(80),
    monthlyKwh,
    transferFeeOre: assumptions?.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh,
    markupOre: assumptions?.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh,
    energyTaxOre: getEnergyTaxRate(seZone, false),
    gridFixedFeeKr: assumptions?.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth,
    powerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw ?? gridPricing.powerChargeKrPerKw,
    hasPowerCharge: assumptions?.gridHasPowerCharge ?? gridPricing.hasPowerCharge,
    elhandelMonthlyFeeKr: ELHANDEL_DEFAULTS.avgMonthlyFeeKr,
  };
}, [seZone, threeScenarios, assumptions, billData]);

// Hjälpfunktion (lägg utanför komponenten):
function distributeAnnualKwh(yearlyKwh: number, seZone: SEZone): number[] {
  // Simplified seasonal distribution based on zone
  const winterWeight = seZone === "SE1" || seZone === "SE2" ? 1.8 : 1.5;
  const summerWeight = 0.6;
  const weights = [
    winterWeight, winterWeight * 0.95, 1.2, 0.9, 0.7, summerWeight,
    summerWeight, summerWeight * 1.05, 0.8, 1.0, 1.3, winterWeight,
  ];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => Math.round((yearlyKwh * w) / totalWeight));
}

// Uppdatera CostBreakdownCard-anropet:
<CostBreakdownCard
  title="Din nuvarande situation"
  components={threeScenarios.currentSituation.costComponents}
  yearlyKwh={threeScenarios.currentSituation.yearlyKwh}
  calculationDetails={calculationDetails}
/>
```

> **OBS:** `distributeAnnualKwh()` är en förenkling. Om `threeScenarios` innehåller månadsvisa data via `annualCostBreakdown.months`, använd `months[i].gridImportKwh` istället — det är mer exakt. Kontrollera om `ScenarioDetail` har tillgång till detta.

## Steg 4: Uppdatera ThreeScenarioSummary att inkludera månadsdata

### `app/simulator/types.ts`

Utöka `ScenarioDetail` med optional månadsdata:

```typescript
export interface ScenarioDetail {
  yearlyKwh: number;
  yearlyCostKr: number;
  yearlyTotalCostKr: number;
  costComponents: AnnualCostComponents;
  /** Monthly kWh breakdown (12 values) — for detailed calculations view */
  monthlyKwh?: number[];
  /** Monthly peak kW (12 values) — for detailed calculations view */
  monthlyPeakKw?: number[];
}
```

### `app/simulator/simulation/scenarios.ts`

I `buildScenarioDetail()`, fyll i månadsdata:

```typescript
function buildScenarioDetail(summary: AnnualSummary, useAfter: boolean): ScenarioDetail {
  const breakdown = summary.annualCostBreakdown;
  return {
    yearlyKwh: useAfter ? summary.yearlyKwhAfter : summary.yearlyKwhBase,
    yearlyCostKr: useAfter ? summary.yearlyEnergyCostAfter : summary.yearlyEnergyCostBase,
    yearlyTotalCostKr: useAfter ? summary.yearlyTotalCostAfter : summary.yearlyTotalCostBase,
    costComponents: extractCostComponents(summary),
    monthlyKwh: breakdown?.months.map((m) => m.gridImportKwh),
    monthlyPeakKw: breakdown?.months.map((m) => m.peakGridKw),
  };
}
```

Då kan `calculationDetails` i RecommendationResults använda riktiga månadsdata:

```typescript
monthlyKwh: threeScenarios.currentSituation.monthlyKwh
  ?? distributeAnnualKwh(threeScenarios.currentSituation.yearlyKwh, seZone),
monthlyPeakKw: threeScenarios.currentSituation.monthlyPeakKw,
```

## Verifiering

1. `npx tsc --noEmit` — kontrollera typfel
2. Kolla att "Förstå din faktura" expanderar korrekt och visar två fakturor sida vid sida
3. Kolla att "Se detaljerade uträkningar" expanderar innanför fakturavyn
4. Kontrollera att "Påverkbar"-badges visas rätt (spotpris, överföring, effektavgift — ja; skatt, fasta avgifter, påslag — nej)
5. Kontrollera att %-stapeln "kan du påverka" summerar korrekt
6. Kontrollera att formler i detalj-sektionen matchar faktiska beräkningar i `cost-model.ts`

## Sammanfattning av ändringar

| Fil | Ändring |
|-----|---------|
| `components/InvoiceExplainerCard.tsx` | **NY** — "Förstå din faktura" med dubbelfaktura-vy + detaljerade uträkningar |
| `components/CostBreakdownCard.tsx` | Ersätt "Så räknade vi" med expanderbar "Förstå din faktura" |
| `components/RecommendationResults.tsx` | Bygg `calculationDetails` från data-lagret, skicka till CostBreakdownCard |
| `types.ts` | Lägg till `monthlyKwh` + `monthlyPeakKw` i `ScenarioDetail` |
| `simulation/scenarios.ts` | Tråda igenom månadsdata i `buildScenarioDetail()` |

## UX-flöde (tre nivåer)

```
┌─────────────────────────────────────────┐
│  Din nuvarande situation                │
│  52 340 kr/år                           │
│  [Donut] + kostnadslista                │ ← Nivå 1: alltid synlig
│                                         │
│  ▼ Förstå din faktura                   │ ← Klick → expandera
│  ┌───────────────┬──────────────────┐   │
│  │ ⚡ Elhandel    │ 🔌 Elnät         │   │ ← Nivå 2: fakturavyn
│  │ Spotpris      │ Överföring      │   │
│  │ Påslag        │ Fast avgift     │   │
│  │ Månadsavgift  │ Effektavgift    │   │
│  │               │ Energiskatt     │   │
│  └───────────────┴──────────────────┘   │
│  X% kan du påverka med rätt åtgärder    │
│                                         │
│  ▼ Se detaljerade uträkningar           │ ← Klick → expandera
│  ┌──────────────────────────────────┐   │
│  │ Ingångsdata: SE3, Ellevio, ...   │   │ ← Nivå 3: formler
│  │ Månadsvis: kWh, spot, peak       │   │
│  │ Spotpris = Σ(kWh × öre × 1.25)  │   │
│  │ Överföring = kWh × 10 öre × 1.25│   │
│  │ ...                              │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```
