"use client";

/**
 * "Mot dina grannar" card — shows the user's electricity bill position
 * relative to a distribution of similar villas in their area.
 *
 * Optional inputs:
 *  - area:         total heated floor area (m²). Enables size-adjusted
 *                  comparison + shrinks sample size to the size bucket.
 *  - heatingTypes: if includes "fjarrvarme", shows a disclaimer that the
 *                  electricity bill is naturally lower due to district
 *                  heating and the comparison may be misleading.
 *
 * Backend: lib/comparison/computeComparison() — modeled distribution per
 * län from Energimyndigheten 2024 T3.12 + T3.2.
 */

import { useMemo } from "react";
import { computeComparison, resolveLan, getAvgAreaM2 } from "../../../../lib/comparison";
import { SE_ZONE_CENTROIDS } from "../../data/geocoding";
import type { SEZone, HeatingType } from "../../types";
import { MOT_GRANNAR } from "./strings";

interface MotGrannarProps {
  /** User's annual electricity cost (kr inkl moms). */
  yearlyKr: number;
  /** Geocoded latitude — falls back to SE-zone centroid if missing. */
  latitude?: number;
  /** Geocoded longitude — falls back to SE-zone centroid if missing. */
  longitude?: number;
  /** SE-zone — used as fallback location when lat/lon is missing. */
  seZone?: SEZone;
  /** Total heated floor area (m²) — enables size-adjusted comparison. */
  area?: number;
  /** Heating types — used to detect fjärrvärme and show a disclaimer. */
  heatingTypes?: HeatingType[];
}

/**
 * Bell-curve path. Curve is inset to x=60–300 so endpoints + peak align with
 * the centers of the three stat columns (1/6, 1/2, 5/6 of full width).
 */
const BELL_PATH =
  "M 60 88 C 77 87.7, 93 86.5, 110 80 C 123 73, 133 60, 143 47 C 153 33, 163 20, 173 14 C 177 12.5, 183 12.5, 187 14 C 197 20, 207 33, 217 47 C 227 60, 237 73, 250 80 C 267 86.5, 283 87.7, 300 88 Z";

/** Gaussian approximation of the bell-path's y-value at a given x. */
function bellY(x: number): number {
  const peak = 12;
  const baseline = 88;
  const sigma = 50;
  const peakX = 180;
  return baseline - (baseline - peak) * Math.exp(-Math.pow((x - peakX) / sigma, 2));
}

/** Map percentile (0–100) to x-coordinate on the bell curve (60–300). */
function percentileToX(percentile: number): number {
  const clamped = Math.max(0, Math.min(100, percentile));
  return 60 + (clamped / 100) * 240;
}

function formatKr(kr: number): string {
  return new Intl.NumberFormat("sv-SE").format(Math.round(kr));
}

export default function MotGrannar({
  yearlyKr,
  latitude,
  longitude,
  seZone,
  area,
  heatingTypes,
}: MotGrannarProps) {
  const result = useMemo(() => {
    let lat = latitude;
    let lon = longitude;
    if ((lat == null || lon == null) && seZone) {
      const centroid = SE_ZONE_CENTROIDS[seZone];
      lat = centroid.lat;
      lon = centroid.lon;
    }
    if (lat == null || lon == null) return null;
    const r = computeComparison({ yearlyKr, latitude: lat, longitude: lon, area });
    const lanCode = resolveLan(lat, lon);
    const lanAvgM2 = getAvgAreaM2(lanCode);
    return { ...r, lanAvgM2 };
  }, [yearlyKr, latitude, longitude, seZone, area]);

  if (!result) return null;

  const { distribution, user, scope, lanAvgM2 } = result;
  const isUnder = user.diffFraction < 0;
  const diffPercentAbs = Math.max(1, Math.round(Math.abs(user.diffFraction * 100)));
  const aboveBelowText = isUnder ? MOT_GRANNAR.underAverage : MOT_GRANNAR.aboveAverage;
  const isSizeAdjusted = area != null && area > 0;

  // "X % of villas pay more/less than you."
  const insightPercent = isUnder
    ? Math.round(100 - user.percentile)
    : Math.round(user.percentile);
  const insightDirection = isUnder
    ? MOT_GRANNAR.insightDirectionMore
    : MOT_GRANNAR.insightDirectionLess;

  const userX = percentileToX(user.percentile);
  const userY = bellY(userX);
  const hasFjarrvarme = heatingTypes?.includes("fjarrvarme") ?? false;

  return (
    <section className="mb-4 rounded-[18px] border border-border bg-surface p-4 shadow-sm md:p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {MOT_GRANNAR.cardLabel}
          </div>
          <div className="text-[11px] text-text-secondary">
            {MOT_GRANNAR.modeledPrefix}
            {scope.sampleSize.toLocaleString("sv-SE")}
            {MOT_GRANNAR.modeledSuffix}
          </div>
        </div>
        <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700">
          {MOT_GRANNAR.betaTag}
        </span>
      </div>

      {hasFjarrvarme && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] leading-relaxed text-amber-800">
          <strong className="font-semibold">{MOT_GRANNAR.fjarrvarmeNoteTitle}</strong>{" "}
          {MOT_GRANNAR.fjarrvarmeNoteBody}
        </div>
      )}

      <div className="relative mb-1">
        <div className="pointer-events-none absolute inset-y-0 left-2 z-10 flex flex-col justify-center pb-3 sm:left-4">
          <div className="text-3xl font-extrabold leading-none tracking-tight text-brand-500 sm:text-4xl">
            ~{diffPercentAbs} %
          </div>
          <div className="mt-2 text-sm font-bold text-text-primary sm:text-base">
            {aboveBelowText}
          </div>
        </div>

        <svg viewBox="0 0 360 110" className="w-full">
          <path d={BELL_PATH} fill="#d9eedf" stroke="#6ebb85" strokeWidth="1.4" />
          <line
            x1={userX}
            y1={userY}
            x2={userX}
            y2="88"
            stroke="#6ebb85"
            strokeWidth="1.5"
            strokeDasharray="3,2.5"
          />
          <circle cx={userX} cy={userY} r="5" fill="#2E7D52" stroke="#fff" strokeWidth="2" />
          <text
            x={userX}
            y="100"
            fontSize="9"
            fill="#1A3C2A"
            fontWeight="700"
            textAnchor="middle"
          >
            {MOT_GRANNAR.duLabel}
          </text>
        </svg>
      </div>

      <div className="mb-2.5 grid grid-cols-3 border-y border-border py-2 text-center">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
            {MOT_GRANNAR.buckets.p10}
          </div>
          <div className="text-xs font-semibold tabular-nums text-text-primary">
            {formatKr(distribution.p10)} kr
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
            {MOT_GRANNAR.buckets.p50}
          </div>
          <div className="text-xs font-semibold tabular-nums text-text-primary">
            {formatKr(distribution.p50)} kr
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
            {MOT_GRANNAR.buckets.p90}
          </div>
          <div className="text-xs font-semibold tabular-nums text-text-primary">
            {formatKr(distribution.p90)} kr
          </div>
        </div>
      </div>

      {isSizeAdjusted && (
        <div className="mb-2.5 text-[10px] text-text-muted">
          {MOT_GRANNAR.sizeAdjustmentNote(area!, scope.label, lanAvgM2)}
        </div>
      )}

      <p className="text-xs leading-snug text-text-secondary">
        <strong className="font-semibold text-text-primary">{insightPercent} %</strong>{" "}
        {MOT_GRANNAR.insightMore} {scope.label} {insightDirection}.
      </p>
    </section>
  );
}
