"use client";

/**
 * "Din energyscore" card — gauge with warm gradient + improvement potential
 * expressed in kronor.
 *
 * Score is derived from the user's percentile in the lib/comparison
 * distribution: lower cost than peers ⇒ higher energyscore.
 *
 * "Möjlighet att förbättra" preferentially comes from
 * threeScenarios.potentialSavingsKr (concrete savings from recommended
 * upgrades). It falls back to gap-vs-p25 only if upgrade data is missing.
 */

import { useMemo } from "react";
import { computeComparison } from "../../../../lib/comparison";
import { SE_ZONE_CENTROIDS } from "../../data/geocoding";
import type { SEZone } from "../../types";
import { ENERGYSCORE } from "./strings";

interface EnergyscoreProps {
  /** User's annual electricity cost (kr inkl moms). */
  yearlyKr: number;
  /** Geocoded latitude — falls back to SE-zone centroid if missing. */
  latitude?: number;
  /** Geocoded longitude — falls back to SE-zone centroid if missing. */
  longitude?: number;
  /** SE-zone — used as fallback location when lat/lon is missing. */
  seZone?: SEZone;
  /**
   * Concrete savings from recommended upgrades (solar, heat pump, etc.).
   * Comes from threeScenarios.potentialSavingsKr in /analys flow.
   * If null, falls back to gap-vs-p25.
   */
  potentialSavingsKr?: number;
}

function formatKr(kr: number): string {
  return new Intl.NumberFormat("sv-SE").format(Math.round(kr));
}

export default function Energyscore({
  yearlyKr,
  latitude,
  longitude,
  seZone,
  potentialSavingsKr,
}: EnergyscoreProps) {
  const result = useMemo(() => {
    let lat = latitude;
    let lon = longitude;
    if ((lat == null || lon == null) && seZone) {
      const centroid = SE_ZONE_CENTROIDS[seZone];
      lat = centroid.lat;
      lon = centroid.lon;
    }
    if (lat == null || lon == null) return null;
    return computeComparison({ yearlyKr, latitude: lat, longitude: lon });
  }, [yearlyKr, latitude, longitude, seZone]);

  if (!result) return null;

  const { distribution, user } = result;

  // Energyscore: invert the percentile so low cost = high score.
  // User at percentile 58 (above median) → score 42.
  // User at percentile 18 (below median, cheap) → score 82.
  const score = Math.round(100 - user.percentile);

  // Improvement potential: prefer concrete savings from recommended upgrades
  // (threeScenarios.potentialSavingsKr). Fall back to gap-vs-p25 only if
  // upgrade data is missing — placeholder until the dedicated upgrade-analysis
  // work-package lands.
  const fallbackP25 = distribution.p10 + 0.375 * (distribution.p50 - distribution.p10);
  const savings =
    potentialSavingsKr != null && potentialSavingsKr > 0
      ? Math.round(potentialSavingsKr)
      : Math.max(0, Math.round(yearlyKr - fallbackP25));

  // Needle rotation: -90° (left, score=0, most expensive) → +90° (right, score=100, cheapest).
  const needleRotation = -90 + (score / 100) * 180;

  return (
    <section className="mb-4 rounded-[18px] border border-border bg-surface-bright p-4 shadow-sm md:p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-500">
          {ENERGYSCORE.cardLabel}
        </div>
        <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700">
          {ENERGYSCORE.betaTag}
        </span>
      </div>

      <div className="-mb-2 -mt-2 flex justify-center">
        <svg viewBox="0 0 320 195" className="w-full max-w-[200px]">
          <defs>
            <linearGradient id="energyscoreGauge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E8824A" />
              <stop offset="33%" stopColor="#eab308" />
              <stop offset="66%" stopColor="#6ebb85" />
              <stop offset="100%" stopColor="#2E7D52" />
            </linearGradient>
          </defs>
          <path
            d="M 40 165 A 120 120 0 0 1 280 165"
            stroke="rgba(26, 60, 42, 0.06)"
            strokeWidth="26"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 40 165 A 120 120 0 0 1 280 165"
            stroke="url(#energyscoreGauge)"
            strokeWidth="22"
            fill="none"
            strokeLinecap="round"
          />
          <g transform={`rotate(${needleRotation} 160 165)`}>
            <line
              x1="160"
              y1="165"
              x2="160"
              y2="65"
              stroke="#1A3C2A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </g>
          <circle cx="160" cy="165" r="13" fill="#1A3C2A" />
          <circle cx="160" cy="165" r="6" fill="#fff" />
        </svg>
      </div>

      <div className="mb-3 text-center">
        <div className="text-xs text-text-secondary">{ENERGYSCORE.positionLabel}</div>
      </div>

      <div className="mb-3 border-t border-border" />

      <div className="mb-3 text-center">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          {ENERGYSCORE.improvementLabel}
        </div>
        {savings > 0 ? (
          <>
            <div className="mb-1.5 text-5xl font-extrabold leading-[0.95] tracking-tight text-brand-500 md:text-6xl">
              −{formatKr(savings)} kr
            </div>
            <div className="text-sm font-medium text-text-primary">
              {ENERGYSCORE.perYearSuffix}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {ENERGYSCORE.aspirational}
            </div>
          </>
        ) : (
          <div className="my-2 text-base font-medium text-text-primary">
            {ENERGYSCORE.alreadyTopText}
          </div>
        )}
      </div>

      <button
        type="button"
        className="mb-2 w-full rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        {ENERGYSCORE.ctaShowActions}
      </button>

      <div className="text-center">
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent text-[12px] font-semibold text-brand-500 hover:underline"
        >
          {ENERGYSCORE.howIsThisCalculated}
        </button>
      </div>
    </section>
  );
}
