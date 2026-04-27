"use client";

import { useState } from "react";
import type { RecommendationResult, BillData, RefinementAnswers, SEZone, Assumptions } from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import ScenarioTeaserCard from "./ScenarioTeaserCard";
import { STRINGS } from "../data/strings";
import RecommendationCard from "./RecommendationCard";

interface RecommendationResultsProps {
  recommendations: RecommendationResult;
  billData: BillData;
  refinement?: RefinementAnswers;
  seZone?: SEZone;
  onViewDashboard: () => void;
  onRestart: () => void;
  assumptions?: Assumptions;
  tmyData?: TmyHourlyData[];
}

/** Build a shareable URL encoding the analysis parameters */
function buildShareUrl(
  billData: BillData,
  refinement?: RefinementAnswers,
  seZone?: SEZone
): string {
  const params = new URLSearchParams();
  params.set("kwh", String(billData.kwhPerMonth));
  params.set("cost", String(billData.costPerMonth));
  params.set("zone", seZone || "SE3");

  if (refinement?.housingType) params.set("ht", refinement.housingType);
  if (refinement?.area) params.set("a", String(refinement.area));
  if (refinement?.heatingTypes?.length) params.set("heat", refinement.heatingTypes.join(","));
  if (refinement?.residents) params.set("r", String(refinement.residents));
  if (refinement?.hasSolar) params.set("sol", "1");
  if (refinement?.solarSizeKw) params.set("solkw", String(refinement.solarSizeKw));

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export default function RecommendationResults({ recommendations, billData, refinement, seZone, onViewDashboard, onRestart, assumptions, tmyData }: RecommendationResultsProps) {
  const [shareCopied, setShareCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const recCount = recommendations.recommendations.length;
  const totalYearlySavings = recommendations.totalYearlySavingsKr;

  const displayedRecs = showAll
    ? recommendations.recommendations
    : recommendations.recommendations.slice(0, 3);
  const hasMore = recCount > 3;

  const handleShare = async () => {
    const url = buildShareUrl(billData, refinement, seZone);
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("Kopiera länken:", url);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-text-primary">Det här rekommenderar vi för dig</h2>
        {recCount > 0 && totalYearlySavings > 0 && (
          <p className="mt-1 text-sm text-text-secondary">
            {STRINGS.recommendedActions}{" "}
            <span className="font-semibold text-brand-600">
              {recCount} {STRINGS.actionsThatSave}{" "}
              {totalYearlySavings.toLocaleString("sv-SE")} kr/år
            </span>
          </p>
        )}
      </div>

      {/* Scenario-teaser — alarmerar och väcker nyfikenhet */}
      {billData && seZone && assumptions && refinement && (
        <div className="mb-5">
          <ScenarioTeaserCard
            billData={billData}
            refinement={refinement}
            seZone={seZone}
            assumptions={assumptions}
            tmyData={tmyData}
            onExplore={onViewDashboard}
          />
        </div>
      )}

      {/* Recommendation cards */}
      {recCount > 0 ? (
        <div className="flex flex-col gap-4 mb-4">
          {displayedRecs.map((rec) => (
            <RecommendationCard key={rec.upgradeId} recommendation={rec} />
          ))}
        </div>
      ) : (
        <div className="card-strong rounded-2xl p-8 text-center mb-6">
          <p className="text-text-secondary">
            Din energiprofil ser redan bra ut! Vi hittade inga tydliga besparingsåtgärder.
          </p>
        </div>
      )}

      {/* Show all toggle */}
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mb-4 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-brand-500 hover:text-text-primary"
        >
          Visa alla {recCount} rekommendationer
        </button>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-text-muted mb-4 px-1">
        Alla belopp är uppskattningar baserade på din faktura, dina uppgifter och aktuella energipriser. Verkliga besparingar kan avvika beroende på väder, elprisutveckling och förbrukningsmönster.
      </p>

      {/* CTA block */}
      <div className="flex flex-col gap-3 mb-8">
        <button
          onClick={handleShare}
          className="w-full rounded-2xl bg-cta-orange px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          {shareCopied ? `✓ ${STRINGS.shareCopied}` : STRINGS.shareAnalysis}
        </button>
        <button
          onClick={onViewDashboard}
          className="w-full rounded-xl border-2 border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-brand-500 hover:text-text-primary"
        >
          {STRINGS.viewDetailedAnalysis}
        </button>
        <button
          onClick={onRestart}
          className="w-full rounded-xl px-6 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-bright"
        >
          {STRINGS.startOver}
        </button>
      </div>
    </div>
  );
}
