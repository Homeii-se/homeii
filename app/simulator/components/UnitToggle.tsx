"use client";

import type { ChartUnit } from "../types";
import { STRINGS } from "../data/strings";

interface UnitToggleProps {
  unit: ChartUnit;
  onChange: (unit: ChartUnit) => void;
  disabledUnits?: ChartUnit[];
}

const UNITS: { value: ChartUnit; label: string }[] = [
  { value: "kwh", label: STRINGS.unitKwh },
  { value: "kw", label: STRINGS.unitKw },
  { value: "sek", label: STRINGS.unitSek },
];

export default function UnitToggle({ unit, onChange, disabledUnits = [] }: UnitToggleProps) {
  return (
    <div className="card inline-flex rounded-xl p-1">
      {UNITS.map((u) => {
        const disabled = disabledUnits.includes(u.value);
        return (
          <button
            key={u.value}
            onClick={() => !disabled && onChange(u.value)}
            disabled={disabled}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              unit === u.value
                ? "bg-brand-50 text-text-primary shadow-sm"
                : disabled
                  ? "text-text-muted/40 cursor-not-allowed"
                  : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {u.label}
          </button>
        );
      })}
    </div>
  );
}
