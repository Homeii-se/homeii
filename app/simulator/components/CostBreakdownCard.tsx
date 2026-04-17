"use client";

import { useState, useMemo } from "react";
import type { AnnualCostComponents } from "../types";
import InvoiceExplainerCard from "./InvoiceExplainerCard";
import type { InvoiceExplainerCardProps } from "./InvoiceExplainerCard";

interface CostBreakdownCardProps {
  /** Label, e.g. "Din nuvarande situation" */
  title: string;
  components: AnnualCostComponents;
  /** Total yearly kWh for this scenario */
  yearlyKwh?: number;
  /** Calculation details for InvoiceExplainerCard drill-down */
  calculationDetails?: InvoiceExplainerCardProps["calculationDetails"];
}

/** Cost component display config */
const COST_ITEMS: {
  key: keyof AnnualCostComponents;
  label: string;
  sublabel: string;
  color: string;
  invoice: "elhandel" | "elnat";
  /** "kwh" = divide by yearly kWh to get öre/kWh, "fixed" = divide by 12 for kr/mån, "kw" = show as kr/kW */
  unitType: "kwh" | "fixed" | "kw";
}[] = [
  { key: "spotCostKr",           label: "Spotpris",              sublabel: "Rörligt elpris per kWh",          color: "#60a5fa", invoice: "elhandel", unitType: "kwh" },
  { key: "markupCostKr",         label: "Elhandlarens påslag",   sublabel: "Fast påslag per kWh",             color: "#818cf8", invoice: "elhandel", unitType: "kwh" },
  { key: "elhandelMonthlyFeeKr", label: "Månadsavgift elhandel", sublabel: "Fast avgift till elhandlaren",    color: "#a78bfa", invoice: "elhandel", unitType: "fixed" },
  { key: "energyTaxKr",          label: "Energiskatt",           sublabel: "Statlig skatt på el *",           color: "#ec4899", invoice: "elhandel", unitType: "kwh" },
  { key: "gridTransferFeeKr",    label: "Överföringsavgift",     sublabel: "Rörlig nätavgift per kWh",        color: "#f59e0b", invoice: "elnat",    unitType: "kwh" },
  { key: "gridFixedFeeKr",       label: "Fast nätavgift",        sublabel: "Abonnemangsavgift till nätägare", color: "#f97316", invoice: "elnat",    unitType: "fixed" },
  { key: "gridPowerChargeKr",    label: "Effektavgift",          sublabel: "Baseras på din toppeffekt (kW)",  color: "#ef4444", invoice: "elnat",    unitType: "kw" },
];

/** Format a per-unit string for a cost item. Returns e.g. "80 öre/kWh" or "395 kr/mån" */
function formatUnitPrice(value: number, unitType: "kwh" | "fixed" | "kw", yearlyKwh?: number): string | null {
  if (unitType === "kwh" && yearlyKwh && yearlyKwh > 0) {
    const orePerKwh = (value / yearlyKwh) * 100; // kr → öre
    return `${orePerKwh.toFixed(1)} öre/kWh`;
  }
  if (unitType === "fixed") {
    const perMonth = value / 12;
    return `${Math.round(perMonth)} kr/mån`;
  }
  if (unitType === "kw") {
    // We don't have peak kW here, but we can show kr/mån
    const perMonth = value / 12;
    return `${Math.round(perMonth)} kr/mån`;
  }
  return null;
}

export default function CostBreakdownCard({
  title,
  components,
  yearlyKwh,
  calculationDetails,
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
  const positiveTotal = items.reduce((s, i) => s + Math.max(0, i.value), 0);

  return (
    <div className="card-strong rounded-2xl p-5">
      <h3 className="mb-1 text-sm font-semibold text-text-secondary">{title}</h3>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-text-primary">
          {Math.round(components.totalKr).toLocaleString("sv-SE")} kr/år
        </span>
        <span className="text-[10px] text-text-muted">inkl. moms</span>
      </div>

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
              Elhandel ({Math.round(elhandelTotal).toLocaleString("sv-SE")} kr inkl moms)
            </p>
            {items.filter((i) => i.invoice === "elhandel").map((item) => {
              const unit = formatUnitPrice(item.value, item.unitType, yearlyKwh);
              return (
                <div key={item.key} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-text-secondary">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {unit && <span className="text-[10px] text-text-muted">{unit}</span>}
                    <span className="text-xs font-semibold text-text-primary tabular-nums">
                      {Math.round(item.value).toLocaleString("sv-SE")} kr
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Elnät group */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">
              Elnät ({Math.round(elnatTotal).toLocaleString("sv-SE")} kr inkl moms)
            </p>
            {items.filter((i) => i.invoice === "elnat").map((item) => {
              const unit = formatUnitPrice(item.value, item.unitType, yearlyKwh);
              return (
                <div key={item.key} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-text-secondary">{item.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    {unit && <span className="text-[10px] text-text-muted">{unit}</span>}
                    <span className="text-xs font-semibold text-text-primary tabular-nums">
                      {Math.round(item.value).toLocaleString("sv-SE")} kr
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footnote about energiskatt */}
          <p className="text-[9px] text-text-muted/70 italic">
            * Energiskatten är en statlig skatt på elförbrukning men betalas via nätfakturan
          </p>

          {/* Export revenue (if applicable) */}
          {components.exportRevenueKr < 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-1">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-energy-green" />
                <span className="text-xs text-text-secondary">Försäljning överskottsproduktion</span>
              </div>
              <div className="flex items-baseline gap-2">
                {components.exportKwh && components.exportKwh > 0 && (
                  <span className="text-[10px] text-text-muted">
                    {Math.round(components.exportKwh)} kWh á {(Math.abs(components.exportRevenueKr) / components.exportKwh * 100).toFixed(0)} öre
                  </span>
                )}
                <span className="text-xs font-semibold text-energy-green tabular-nums">
                  {Math.round(components.exportRevenueKr).toLocaleString("sv-SE")} kr
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable: "Förstå din faktura" → InvoiceExplainerCard */}
      {calculationDetails && (
        <div className="mt-4 border-t border-gray-200 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-gray-100"
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
    </div>
  );
}