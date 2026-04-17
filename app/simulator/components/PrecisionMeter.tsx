"use client";

import { STRINGS } from "../data/strings";

interface PrecisionMeterProps {
  precision: number; // 0–100
}

export default function PrecisionMeter({ precision }: PrecisionMeterProps) {
  const safePrecision = Number.isFinite(precision) ? precision : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safePrecision / 100) * circumference;

  const color =
    precision >= 80
      ? "var(--color-energy-green)"
      : precision >= 60
      ? "var(--color-energy-yellow)"
      : "var(--color-energy-red)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(26,60,42,0.1)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-text-primary">{safePrecision}%</span>
        </div>
      </div>
      <span className="text-sm font-medium text-text-secondary">{STRINGS.precision}</span>
    </div>
  );
}