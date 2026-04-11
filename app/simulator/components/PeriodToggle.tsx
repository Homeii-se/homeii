"use client";

import type { Period } from "../types";
import { STRINGS } from "../data/strings";

interface PeriodToggleProps {
  period: Period;
  onChange: (period: Period) => void;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "dag", label: STRINGS.periodDay },
  { value: "manad", label: STRINGS.periodMonth },
  { value: "ar", label: STRINGS.periodYear },
];

export default function PeriodToggle({ period, onChange }: PeriodToggleProps) {
  return (
    <div className="glass-card inline-flex rounded-xl p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            period === p.value
              ? "bg-white/10 text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}