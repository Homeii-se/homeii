"use client";

import { useState } from "react";
import type { Assumptions } from "../types";
import { STRINGS } from "../data/strings";

interface AssumptionsPanelProps {
  assumptions: Assumptions;
  onChange: (assumptions: Assumptions) => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  formula?: string;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step, unit, formula, onChange }: SliderRowProps) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm font-bold text-brand-300">
          {value.toLocaleString("sv-SE")} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-text-muted">{min.toLocaleString("sv-SE")} {unit}</span>
        {formula && (
          <span className="text-xs text-text-muted italic">{formula}</span>
        )}
        <span className="text-xs text-text-muted">{max.toLocaleString("sv-SE")} {unit}</span>
      </div>
    </div>
  );
}

export default function AssumptionsPanel({ assumptions, onChange }: AssumptionsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (key: keyof Assumptions, value: number) => {
    onChange({ ...assumptions, [key]: value });
  };

  return (
    <div className="glass-card rounded-2xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Antaganden & inställningar
            </h3>
            <p className="text-xs text-text-muted">
              Justera grundantagandena i kalkylen
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4">
          <SliderRow
            label={STRINGS.gridFee}
            value={assumptions.gridFeeKrPerMonth}
            min={0}
            max={800}
            step={25}
            unit="kr/mån"
            formula="fast avgift till nätägaren"
            onChange={(v) => update("gridFeeKrPerMonth", v)}
          />
          <SliderRow
            label={STRINGS.powerFee}
            value={assumptions.powerFeeKrPerKw}
            min={0}
            max={200}
            step={5}
            unit="kr/kW"
            formula="per kW toppeffekt"
            onChange={(v) => update("powerFeeKrPerKw", v)}
          />
          <SliderRow
            label="Solcellssystem"
            value={assumptions.solarSizeKw}
            min={0}
            max={20}
            step={0.5}
            unit="kW"
            formula="installerad toppeffekt"
            onChange={(v) => update("solarSizeKw", v)}
          />
          <SliderRow
            label="Hembatteri"
            value={assumptions.batterySizeKwh}
            min={5}
            max={50}
            step={1}
            unit="kWh"
            formula="lagringskapacitet"
            onChange={(v) => update("batterySizeKwh", v)}
          />

          <div className="mt-3 rounded-xl bg-brand-500/10 p-3">
            <h4 className="text-xs font-semibold text-text-secondary mb-2">Så räknar vi</h4>
            <div className="space-y-1 text-xs text-text-muted leading-relaxed">
              <p><strong>Energikostnad</strong> = kWh nätimport x spotpris per timme</p>
              <p><strong>{STRINGS.gridFee}</strong> = {assumptions.gridFeeKrPerMonth} kr/mån (fast avgift)</p>
              <p><strong>{STRINGS.powerFee}</strong> = toppeffekt (kW) x {assumptions.powerFeeKrPerKw} kr/kW</p>
              <p><strong>{STRINGS.totalCost}</strong> = energi + grundavgift + effektavgift</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
