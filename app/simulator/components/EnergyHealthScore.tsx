"use client";

import { useMemo } from "react";
import type { AnnualSummary } from "../types";
import { calculateEnergyScore } from "../simulation/scoring";

interface EnergyHealthScoreProps {
  summary: AnnualSummary;
  hasUpgrades: boolean;
  monthlyPeakKwAvg: number;
}

export default function EnergyHealthScore({ summary, hasUpgrades, monthlyPeakKwAvg }: EnergyHealthScoreProps) {
  const score = useMemo(() => {
    const yearlyKwh = hasUpgrades ? summary.yearlyKwhAfter : summary.yearlyKwhBase;
    const yearlyCost = hasUpgrades ? summary.yearlyTotalCostAfter : summary.yearlyTotalCostBase;
    const savingsPercent = summary.yearlyTotalCostBase > 0
      ? ((summary.yearlyTotalCostBase - summary.yearlyTotalCostAfter) / summary.yearlyTotalCostBase) * 100
      : 0;
    return calculateEnergyScore(yearlyKwh, yearlyCost, monthlyPeakKwAvg, hasUpgrades, savingsPercent);
  }, [summary, hasUpgrades, monthlyPeakKwAvg]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.total / 100) * circumference;

  const categories = [
    { label: "Elpris", score: score.priceScore, max: 30 },
    { label: "Förbrukning", score: score.consumptionScore, max: 30 },
    { label: "Effekttopp", score: score.peakScore, max: 20 },
    { label: "Optimering", score: score.optimizationScore, max: 20 },
  ];

  return (
    <div className="glass-card-strong rounded-2xl p-5">
      <div className="flex items-center gap-5">
        {/* Score circle */}
        <div className="relative h-28 w-28 flex-shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={score.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color: score.color }}>{score.grade}</span>
            <span className="text-xs text-text-muted">{score.total}/100</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-secondary mb-1">Energihälsa</h3>
          <p className="text-sm text-text-primary font-medium mb-3">{score.message}</p>

          {/* Category bars */}
          <div className="space-y-1.5">
            {categories.map((cat) => {
              const pct = cat.max > 0 ? (cat.score / cat.max) * 100 : 0;
              return (
                <div key={cat.label} className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-20 flex-shrink-0">{cat.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: score.color }}
                    />
                  </div>
                  <span className="text-xs text-text-muted w-8 text-right">{cat.score}/{cat.max}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}