# CURSOR-PROMPT-8: Separata momsrader + energiskatt under Elhandel

## Bakgrund

Tre problem med nuvarande fakturavyn:

1. **Momsen är osynlig** — alla belopp visas inkl moms utan att momsen syns som en separat post. Momsen utgör 20% av totalkostnaden och bör synas tydligt.
2. **Energiskatten ligger under Elnät** — men den är egentligen en statlig skatt på elförbrukning, inte en nätavgift. Den bör ligga under Elhandel med en fotnot "*betalas via nätfakturan".
3. **Spotpriset anges inte som exkl moms** — det är viktigt att tydliggöra att spotpriset (det man ser på Nord Pool) är exkl moms.

## Princip

Alla belopp i `MonthlyCostBreakdown` och `AnnualCostComponents` lagras redan **inkl moms** (× 1.25). Vi ändrar INTE datamodellen. Istället beräknar vi i UI:t:
- `exklMoms = belopp / 1.25`
- `moms = belopp - exklMoms` (= belopp × 0.2)

## Steg 1: Uppdatera InvoiceExplainerCard

### `app/simulator/components/InvoiceExplainerCard.tsx`

Ersätt hela komponenten med denna version. Nyckelförändringar:
- Alla InvoiceLine-belopp visas **exkl moms**
- Energiskatt flyttad till Elhandel-kolumnen med fotnot
- Separata "Moms 25%"-rader per faktura
- Spotpris-raden tydliggör "exkl moms"

```tsx
"use client";

import { useState } from "react";
import type { AnnualCostComponents } from "../types";

export interface InvoiceExplainerCardProps {
  components: AnnualCostComponents;
  yearlyKwh: number;
  calculationDetails: {
    seZone: string;
    gridOperator?: string;
    spotPrices: number[];
    monthlyKwh: number[];
    monthlyPeakKw?: number[];
    transferFeeOre: number;
    markupOre: number;
    energyTaxOre: number;
    gridFixedFeeKr: number;
    powerChargeKrPerKw: number;
    hasPowerCharge: boolean;
    elhandelMonthlyFeeKr: number;
  };
}

/** Divide inkl-moms amount into exkl and moms parts */
function splitVat(inklMoms: number) {
  const exkl = inklMoms / 1.25;
  return { exkl: Math.round(exkl), moms: Math.round(inklMoms - exkl) };
}

export default function InvoiceExplainerCard({
  components,
  yearlyKwh,
  calculationDetails,
}: InvoiceExplainerCardProps) {
  const [showDetailedCalc, setShowDetailedCalc] = useState(false);

  const d = calculationDetails;

  // Elhandel: spotpris + påslag + månadsavgift + energiskatt (moved here)
  const elhandelItemsInkl = components.spotCostKr + components.markupCostKr
    + components.elhandelMonthlyFeeKr + components.energyTaxKr;
  const elhandelExkl = Math.round(elhandelItemsInkl / 1.25);
  const elhandelMoms = Math.round(elhandelItemsInkl - elhandelExkl);

  // Elnät: överföring + fast avgift + effektavgift (energiskatt moved away)
  const elnatItemsInkl = components.gridTransferFeeKr + components.gridFixedFeeKr
    + components.gridPowerChargeKr;
  const elnatExkl = Math.round(elnatItemsInkl / 1.25);
  const elnatMoms = Math.round(elnatItemsInkl - elnatExkl);

  // Influence calculation (same as before, but energiskatt is not influenceable)
  const canInfluence = components.spotCostKr + components.gridTransferFeeKr + components.gridPowerChargeKr;
  const cannotInfluence = components.energyTaxKr + components.gridFixedFeeKr
    + components.elhandelMonthlyFeeKr + components.markupCostKr;
  const influencePercent = (canInfluence + cannotInfluence) > 0
    ? Math.round((canInfluence / (canInfluence + cannotInfluence)) * 100)
    : 0;

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
              <p className="text-[10px] text-text-muted">Faktura 1 — din elhandlare</p>
            </div>
          </div>

          <div className="space-y-2">
            <InvoiceLine
              label="Spotpris"
              description="Rörligt elpris (exkl moms)"
              amount={splitVat(components.spotCostKr).exkl}
              color="text-blue-300"
              canInfluence={true}
              influenceHow="Timpris + smart styrning"
            />
            <InvoiceLine
              label="Påslag"
              description="Elhandlarens marginal (exkl moms)"
              amount={splitVat(components.markupCostKr).exkl}
              color="text-blue-300"
              canInfluence={false}
            />
            {components.elhandelMonthlyFeeKr > 0 && (
              <InvoiceLine
                label="Månadsavgift"
                description="Fast avgift (exkl moms)"
                amount={splitVat(components.elhandelMonthlyFeeKr).exkl}
                color="text-blue-300"
                canInfluence={false}
              />
            )}
            <InvoiceLine
              label="Energiskatt"
              description={`Statlig skatt ${d.energyTaxOre} öre/kWh (exkl moms)`}
              amount={splitVat(components.energyTaxKr).exkl}
              color="text-blue-300"
              canInfluence={false}
              footnote="* Betalas via nätfakturan"
            />

            {/* Moms */}
            <div className="border-t border-blue-500/10 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Moms 25%</span>
                <span className="text-xs font-semibold text-blue-300 tabular-nums">
                  {elhandelMoms.toLocaleString("sv-SE")} kr
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-blue-500/20 pt-2 flex justify-between">
            <span className="text-xs font-semibold text-blue-300">Summa elhandel</span>
            <span className="text-sm font-bold text-blue-200">
              {Math.round(elhandelItemsInkl).toLocaleString("sv-SE")} kr/år
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
              description={`Rörlig nätavgift ${d.transferFeeOre} öre/kWh (exkl moms)`}
              amount={splitVat(components.gridTransferFeeKr).exkl}
              color="text-amber-300"
              canInfluence={true}
              influenceHow="Solceller minskar import"
            />
            <InvoiceLine
              label="Fast nätavgift"
              description="Abonnemangsavgift (exkl moms)"
              amount={splitVat(components.gridFixedFeeKr).exkl}
              color="text-amber-300"
              canInfluence={false}
            />
            {components.gridPowerChargeKr > 0 && (
              <InvoiceLine
                label="Effektavgift"
                description="Baseras på din toppeffekt (exkl moms)"
                amount={splitVat(components.gridPowerChargeKr).exkl}
                color="text-amber-300"
                canInfluence={true}
                influenceHow="Batteri kapar toppar"
              />
            )}

            {/* Moms */}
            <div className="border-t border-amber-500/10 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Moms 25%</span>
                <span className="text-xs font-semibold text-amber-300 tabular-nums">
                  {elnatMoms.toLocaleString("sv-SE")} kr
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-amber-500/20 pt-2 flex justify-between">
            <span className="text-xs font-semibold text-amber-300">Summa elnät</span>
            <span className="text-sm font-bold text-amber-200">
              {Math.round(elnatItemsInkl).toLocaleString("sv-SE")} kr/år
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

      {/* Total + moms summary + influence */}
      <div className="rounded-xl bg-surface-light/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-text-secondary">Totalt per år</span>
          <span className="text-xl font-bold text-text-primary">
            {Math.round(components.totalKr).toLocaleString("sv-SE")} kr
          </span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-text-muted">varav moms</span>
          <span className="text-xs text-text-muted tabular-nums">
            {(elhandelMoms + elnatMoms).toLocaleString("sv-SE")} kr
            ({Math.round(((elhandelMoms + elnatMoms) / components.totalKr) * 100)}% av totalen)
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
  footnote,
}: {
  label: string;
  description: string;
  amount: number;
  color: string;
  canInfluence: boolean;
  influenceHow?: string;
  footnote?: string;
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
              &rarr; {influenceHow}
            </p>
          )}
          {footnote && (
            <p className="text-[10px] text-text-muted/50 italic leading-tight">
              {footnote}
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
                    {d.monthlyKwh[i]?.toLocaleString("sv-SE") ?? "\u2014"}
                  </td>
                  <td className="py-0.5 px-1 text-right tabular-nums text-text-muted">
                    {d.spotPrices[i]?.toFixed(0) ?? "\u2014"}
                  </td>
                  {d.monthlyPeakKw && (
                    <td className="py-0.5 px-1 text-right tabular-nums text-text-muted">
                      {d.monthlyPeakKw[i]?.toFixed(1) ?? "\u2014"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-text-muted/50">Spotpriser anges exkl moms</p>
      </div>

      {/* Section: Calculation formulas */}
      <div>
        <h4 className="font-semibold text-text-secondary mb-2">Så beräknas varje post (exkl moms)</h4>
        <div className="space-y-3">
          <CalcFormula
            label="Spotpris"
            formula={`\u03A3 (månadskWh \u00D7 spotpris öre/kWh)`}
            example={`Ex. januari: ${d.monthlyKwh[0]?.toLocaleString("sv-SE") ?? "?"} kWh \u00D7 ${d.spotPrices[0]?.toFixed(0) ?? "?"} öre/kWh`}
            result={Math.round(components.spotCostKr / 1.25)}
          />
          <CalcFormula
            label="Påslag elhandlare"
            formula={`${yearlyKwh.toLocaleString("sv-SE")} kWh \u00D7 ${d.markupOre} öre/kWh`}
            result={Math.round(components.markupCostKr / 1.25)}
          />
          {components.elhandelMonthlyFeeKr > 0 && (
            <CalcFormula
              label="Månadsavgift elhandel"
              formula={`${d.elhandelMonthlyFeeKr} kr/mån \u00D7 12`}
              result={Math.round(components.elhandelMonthlyFeeKr / 1.25)}
            />
          )}
          <CalcFormula
            label="Energiskatt"
            formula={`${yearlyKwh.toLocaleString("sv-SE")} kWh \u00D7 ${d.energyTaxOre} öre/kWh`}
            result={Math.round(components.energyTaxKr / 1.25)}
          />
          <CalcFormula
            label="Överföringsavgift"
            formula={`${yearlyKwh.toLocaleString("sv-SE")} kWh \u00D7 ${d.transferFeeOre} öre/kWh`}
            result={Math.round(components.gridTransferFeeKr / 1.25)}
          />
          <CalcFormula
            label="Fast nätavgift"
            formula={`${d.gridFixedFeeKr} kr/mån \u00D7 12`}
            result={Math.round(components.gridFixedFeeKr / 1.25)}
          />
          {d.hasPowerCharge && (
            <CalcFormula
              label="Effektavgift"
              formula={`\u03A3 (månadens toppeffekt kW \u00D7 ${d.powerChargeKrPerKw} kr/kW)`}
              example="Baseras på högsta timeffekten per månad"
              result={Math.round(components.gridPowerChargeKr / 1.25)}
            />
          )}

          {/* Moms summary */}
          <div className="rounded bg-surface-light/30 p-2 border-l-2 border-text-muted/30">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-text-secondary">Moms 25%</p>
                <p className="text-text-muted text-[10px] mt-0.5">
                  25% på samtliga poster ovan (inkl energiskatt)
                </p>
              </div>
              <span className="font-semibold text-text-primary tabular-nums whitespace-nowrap">
                = {(Math.round(components.totalKr - components.totalKr / 1.25 + (components.exportRevenueKr < 0 ? -(components.exportRevenueKr - components.exportRevenueKr / 1.25) : 0))).toLocaleString("sv-SE")} kr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sources */}
      <div className="border-t border-white/5 pt-2">
        <p className="text-[10px] text-text-muted/60">
          <strong>Källor:</strong> Spotpriser — Nord Pool (genomsnitt 2023-2025) &middot; Energiskatt — Skatteverket &middot;
          Nätavgifter — Elpriskollen/Energimarknadsinspektionen &middot; Säsongsfaktorer — SMHI (1991-2020 normaler)
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

## Steg 2: Uppdatera CostBreakdownCard — energiskatt under Elhandel

### `app/simulator/components/CostBreakdownCard.tsx`

Flytta `energyTaxKr` från `"elnat"` till `"elhandel"` i COST_ITEMS-arrayen:

```typescript
const COST_ITEMS: {
  key: keyof AnnualCostComponents;
  label: string;
  sublabel: string;
  color: string;
  invoice: "elhandel" | "elnat";
}[] = [
  { key: "spotCostKr",           label: "Spotpris",              sublabel: "Rörligt elpris per kWh",          color: "#60a5fa", invoice: "elhandel" },
  { key: "markupCostKr",         label: "Elhandlarens påslag",   sublabel: "Fast påslag per kWh",             color: "#818cf8", invoice: "elhandel" },
  { key: "elhandelMonthlyFeeKr", label: "Månadsavgift elhandel", sublabel: "Fast avgift till elhandlaren",    color: "#a78bfa", invoice: "elhandel" },
  { key: "energyTaxKr",          label: "Energiskatt",           sublabel: "Statlig skatt på el *",           color: "#ec4899", invoice: "elhandel" },  // <-- FLYTTAD från elnat
  { key: "gridTransferFeeKr",    label: "Överföringsavgift",     sublabel: "Rörlig nätavgift per kWh",        color: "#f59e0b", invoice: "elnat" },
  { key: "gridFixedFeeKr",       label: "Fast nätavgift",        sublabel: "Abonnemangsavgift till nätägare", color: "#f97316", invoice: "elnat" },
  { key: "gridPowerChargeKr",    label: "Effektavgift",          sublabel: "Baseras på din toppeffekt (kW)",  color: "#ef4444", invoice: "elnat" },
];
```

Lägg även till en fotnot under kostnadslistan i donut-sektionen. Hitta stället efter Elnät-gruppen (runt rad 145) och lägg till:

```tsx
          {/* Footnote about energiskatt */}
          <p className="text-[10px] text-text-muted/50 mt-2">
            * Energiskatten är en statlig skatt på elförbrukning men betalas via nätfakturan
          </p>
```

Uppdatera även rubrikerna för Elhandel/Elnät-grupperna så de visar "(inkl moms)":

```tsx
// Ändra:
Elhandel ({Math.round(elhandelTotal).toLocaleString("sv-SE")} kr)
// Till:
Elhandel ({Math.round(elhandelTotal).toLocaleString("sv-SE")} kr inkl moms)

// Ändra:
Elnät ({Math.round(elnatTotal).toLocaleString("sv-SE")} kr)
// Till:
Elnät ({Math.round(elnatTotal).toLocaleString("sv-SE")} kr inkl moms)
```

## Verifiering

1. Kontrollera att fakturavyn nu visar:
   - Alla belopp **exkl moms** per rad
   - En "Moms 25%"-rad längst ner på varje faktura
   - Summa-raden inkl moms
   - Energiskatt under Elhandel med italic fotnot "* Betalas via nätfakturan"
2. Kontrollera att "varav moms" visas under totalen — den ska vara ~20% av totalkostnaden
3. Kontrollera donut-grafen — energiskatt ska nu ha rosa färg (#ec4899) i Elhandel-gruppen
4. Kör `npx tsc --noEmit` — inga typfel förväntas (inga datamodellsändringar)

## Sammanfattning

| Fil | Ändring |
|-----|---------|
| `InvoiceExplainerCard.tsx` | Belopp exkl moms + momsrad per faktura + energiskatt till Elhandel + fotnot |
| `CostBreakdownCard.tsx` | Energiskatt flyttad till "elhandel" i COST_ITEMS + fotnot + "inkl moms" i rubriker |

Inga ändringar i datamodellen — allt beräknas i UI:t via `splitVat()`.
