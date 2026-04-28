"use client";

/**
 * ScenarioTeaserCard – kompakt "light dashboard" som varnar och väcker.
 * Visar värsta och bästa framtidsscenariot som två siffror + CTA till full analys.
 * Placeras på RecommendationResults för att trigga Sofia att klicka vidare.
 */

import { useEffect, useMemo, useState } from "react";
import type { BillData, RefinementAnswers, SEZone, Assumptions } from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { calculateAnnualSummary } from "../simulation/annual";
import { NO_UPGRADES } from "../simulation/upgrades";
import { simulate8760WithSolar } from "../simulation/simulate8760";
import { getPresetById } from "../data/scenarios-presets";
import { computeScenarioFromPreset } from "../simulation/future-scenario";

interface Props {
  billData: BillData;
  refinement: RefinementAnswers;
  seZone: SEZone;
  assumptions: Assumptions;
  tmyData?: TmyHourlyData[];
  onExplore: () => void;
}

function formatKrShort(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 10000) return `${(v / 1000).toFixed(1)}k kr`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k kr`;
  return `${v} kr`;
}

export default function ScenarioTeaserCard({
  billData, refinement, seZone, assumptions, tmyData, onExplore,
}: Props) {
  const [worstDelta, setWorstDelta] = useState<number | null>(null);
  const [bestDelta, setBestDelta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Baseline UTAN åtgärder — samma beräkning som Kostnadsfördelning
  const baselineKr = useMemo(() => {
    const minRef: RefinementAnswers = { elContractType: refinement.elContractType };
    const s = calculateAnnualSummary(billData, minRef, NO_UPGRADES, seZone, assumptions, true);
    return s.annualCostBreakdown?.totalKr ?? s.yearlyTotalCostBase ?? 0;
  }, [billData, refinement.elContractType, seZone, assumptions]);

  const sim8760 = useMemo(() => {
    if (!tmyData || tmyData.length < 8760) return null;
    return simulate8760WithSolar(billData, refinement, tmyData, seZone);
  }, [billData, refinement, tmyData, seZone]);

  useEffect(() => {
    const gridImport = sim8760?.gridImport ?? null;
    if (!gridImport || gridImport.length !== 8760) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function run() {
      if (!gridImport) return;
      const worstPreset = getPresetById("energikrisen-2022");
      const bestPreset = getPresetById("fornybar-expansion");
      if (!worstPreset || !bestPreset) return;

      try {
        const [worst, best] = await Promise.all([
          computeScenarioFromPreset(worstPreset, gridImport, seZone, "hourly"),
          computeScenarioFromPreset(bestPreset, gridImport, seZone, "hourly"),
        ]);
        if (cancelled) return;
        // non-spot är konstant — delta = bara spot-diff (baselineKr innehåller
        // nuvarande totalKr inkl nuvarande spot, så vi behöver räkna skillnaden
        // mellan scenario-spot och baseline-spot). Förenklat: vi räknar ungefär
        // med total-jämförelse baserat på non-spot = konstant.
        // Lånar beräkning från full vy: scenarioTotal = scenarioSpot + non-spot
        // Vi approximerar non-spot genom att subtrahera en uppskattad spot-del
        // från baselineKr. För teasern räcker approximation.
        const approxBaselineSpotKr = baselineKr * 0.38; // ~38 % spot i en typisk SE3-räkning
        const approxNonSpot = baselineKr - approxBaselineSpotKr;
        const worstTotal = worst.result.totalSpotCostKr + approxNonSpot;
        const bestTotal = best.result.totalSpotCostKr + approxNonSpot;
        setWorstDelta(worstTotal - baselineKr);
        setBestDelta(bestTotal - baselineKr);
      } catch (e) {
        console.warn("[ScenarioTeaser] ", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [sim8760, seZone, baselineKr]);

  const hasData = worstDelta !== null || bestDelta !== null;

  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-[#F7F3EE] to-[#E8F0E8] border border-[#2E7D52]/20 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[#1A3C2A]/60 font-semibold">
            Så kan din elräkning påverkas
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#1A3C2A] leading-tight mt-0.5">
            Två framtider — två mycket olika räkningar
          </h3>
        </div>
      </div>

      {loading && (
        <div className="py-4 text-xs text-[#1A3C2A]/60 text-center">
          Räknar scenarier för din profil…
        </div>
      )}

      {!loading && !hasData && (
        <div className="py-4 text-xs text-[#1A3C2A]/60">
          Scenariografen blir tillgänglig när vi har din timprofil. Öppna detaljerad analys för att se dem.
        </div>
      )}

      {!loading && hasData && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Värsta */}
            <div className="rounded-xl bg-white border-2 border-[#E05C5C]/40 p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-wide text-[#E05C5C] font-semibold mb-1">
                Risk — om 2022 kommer tillbaka
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#E05C5C]">
                {worstDelta !== null && worstDelta > 0 ? "+" : ""}
                {worstDelta !== null ? formatKrShort(worstDelta) : "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-[#1A3C2A]/60 mt-1">
                mer per år
              </div>
            </div>

            {/* Bästa */}
            <div className="rounded-xl bg-white border-2 border-[#2E7D52]/40 p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-wide text-[#2E7D52] font-semibold mb-1">
                Möjlighet — grön omställning
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#2E7D52]">
                {bestDelta !== null ? formatKrShort(bestDelta) : "—"}
              </div>
              <div className="text-[10px] sm:text-xs text-[#1A3C2A]/60 mt-1">
                mindre per år med smart styrning
              </div>
            </div>
          </div>

          <p className="text-xs text-[#1A3C2A]/70 mt-3 leading-relaxed">
            Din räkning är lika mycket beroende av <strong>framtiden</strong> som av <strong>dina åtgärder idag</strong>.
            Vi har räknat igenom fem olika scenarier — inklusive stålindustrin i norr och EU:s klimatmål.
          </p>

          <button
            onClick={onExplore}
            className="mt-3 w-full rounded-xl bg-[#F4A261] hover:bg-[#F4A261]/90 px-4 py-2.5 text-sm font-semibold text-[#1A3C2A] transition inline-flex items-center justify-center gap-2"
          >
            Se alla 5 scenarier + åtgärder som skyddar
            <span aria-hidden>→</span>
          </button>
        </>
      )}
    </div>
  );
}
