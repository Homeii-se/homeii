"use client";

import { useState } from "react";
import type { Recommendation } from "../types";
import { STRINGS } from "../data/strings";
import { UPGRADE_DEFINITIONS } from "../data/upgrade-catalog";

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const upgrade = UPGRADE_DEFINITIONS.find((u) => u.id === recommendation.upgradeId);
  if (!upgrade) return null;

  const label = recommendation.upgradeId === "solceller" ? "Solceller + hembatteri" : upgrade.label;
  const description = recommendation.upgradeId === "solceller"
    ? "Producera egen el och lagra överskottet i ett hembatteri"
    : upgrade.description;

  return (
    <div
      className={`card-strong rounded-2xl overflow-hidden transition-all ${
        recommendation.isTopPick ? "ring-2 ring-brand-500/30" : ""
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
            recommendation.isTopPick
              ? "bg-brand-500 shadow-md"
              : "bg-card-green"
          }`}>
            {upgrade.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-text-primary">{label}</h3>
              {recommendation.isTopPick && (
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {STRINGS.topPick}
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mb-3">{description}</p>

            {/* Key metrics */}
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-xl font-bold text-energy-green">
                  {recommendation.yearlySavingsKr.toLocaleString("sv-SE")} kr
                </span>
                <span className="text-xs text-text-muted block">besparing/år</span>
              </div>
              {recommendation.investmentKr > 0 && (
                <div>
                  <span className="text-sm font-semibold text-text-primary">
                    {recommendation.investmentKr.toLocaleString("sv-SE")} kr
                  </span>
                  <span className="text-xs text-text-muted block">investering</span>
                </div>
              )}
              {recommendation.investmentKr > 0 ? (
                <div>
                  <span className="text-sm font-semibold text-text-primary">
                    {recommendation.paybackYears} {STRINGS.years}
                  </span>
                  <span className="text-xs text-text-muted block">återbetalningstid</span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-semibold text-energy-green">Gratis</span>
                  <span className="text-xs text-text-muted block">ingen investering</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <p className="mt-3 text-sm text-text-secondary italic">
          {recommendation.reasoning}
        </p>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-500"
        >
          {expanded ? "Dölj detaljer" : "Visa detaljer"}
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border bg-surface-dim/20 px-5 py-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-text-muted">Förbrukningminskning</span>
              <span className="block font-medium text-text-primary">
                {recommendation.kwhReductionPercent > 0
                  ? `${recommendation.kwhReductionPercent}%`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-text-muted">Effektminskning</span>
              <span className="block font-medium text-text-primary">
                {recommendation.peakReductionPercent > 0
                  ? `${recommendation.peakReductionPercent}%`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Reasoning preview */}
      <p className="mt-2 px-5 pb-4 text-xs text-text-muted leading-relaxed">
        {recommendation.reasoning}
      </p>
    </div>
  );
}