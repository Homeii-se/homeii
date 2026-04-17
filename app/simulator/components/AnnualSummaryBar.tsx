"use client";

import { useState, useMemo } from "react";
import type { AnnualSummary, BillData, RefinementAnswers, SEZone, Assumptions, UpgradeId } from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { STRINGS } from "../data/strings";
import { DEFAULT_GRID_FEE_KR_PER_MONTH, DEFAULT_POWER_FEE_KR_PER_KW } from "../data/energy-prices";
import { calculateThreeScenarios } from "../simulation/scenarios";
import CostBreakdownCard from "./CostBreakdownCard";

interface AnnualSummaryBarProps {
  summary: AnnualSummary;
  hasUpgrades: boolean;
  billData?: BillData;
  refinement?: RefinementAnswers;
  seZone?: SEZone;
  assumptions?: Assumptions;
  recommendedUpgradeIds?: UpgradeId[];
  tmyData?: TmyHourlyData[];
}

export default function AnnualSummaryBar({
  summary,
  hasUpgrades,
  billData,
  refinement,
  seZone,
  assumptions,
  recommendedUpgradeIds,
  tmyData,
}: AnnualSummaryBarProps) {
  const [expandThreeScenarios, setExpandThreeScenarios] = useState(false);

  const threeScenarios = useMemo(() => {
    if (!billData || !refinement || !seZone) return null;
    const assumptionsToUse = assumptions || {
      gridFeeKrPerMonth: DEFAULT_GRID_FEE_KR_PER_MONTH,
      powerFeeKrPerKw: DEFAULT_POWER_FEE_KR_PER_KW,
      solarSizeKw: refinement.solarSizeKw ?? 10,
      batterySizeKwh: refinement.batterySizeKwh ?? 10,
    };
    return calculateThreeScenarios(billData, refinement, seZone, assumptionsToUse, recommendedUpgradeIds, tmyData);
  }, [billData, refinement, seZone, assumptions, recommendedUpgradeIds, tmyData]);
  const savings = summary.yearlyTotalCostBase - summary.yearlyTotalCostAfter;

  return (
    <div className="card-strong rounded-2xl p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-secondary">
        {STRINGS.annualSummary}
      </h3>

      {/* Cost breakdown donut chart */}
      {threeScenarios && (
        <div className="mb-4">
          <CostBreakdownCard
            title="Kostnadsfördelning — nuläge"
            components={threeScenarios.currentSituation.costComponents}
            yearlyKwh={threeScenarios.currentSituation.yearlyKwh}
          />
        </div>
      )}

      {!hasUpgrades ? (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-text-muted">{STRINGS.totalCost} / år (utan utrustning)</span>
              <p className="text-xl font-bold text-text-primary">
                {summary.yearlyTotalCostBase.toLocaleString("sv-SE")} kr
              </p>
            </div>
            <div>
              <span className="text-xs text-text-muted">Beräknad förbrukning utan utrustning</span>
              <p className="text-xl font-bold text-text-primary">
                {summary.yearlyKwhBase.toLocaleString("sv-SE")} kWh
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>{STRINGS.energyCost}: {summary.yearlyEnergyCostBase.toLocaleString("sv-SE")} kr</span>
            <span>{STRINGS.gridFee}: {summary.yearlyGridFeeCost.toLocaleString("sv-SE")} kr</span>
            <span>{STRINGS.powerFee}: {summary.yearlyPowerFeeCostBase.toLocaleString("sv-SE")} kr</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <span className="text-xs text-text-muted">Före</span>
              <p className="text-lg font-bold text-text-primary">
                {summary.yearlyTotalCostBase.toLocaleString("sv-SE")} kr
              </p>
            </div>
            <div>
              <span className="text-xs text-text-muted">Efter</span>
              <p className="text-lg font-bold text-energy-green">
                {summary.yearlyTotalCostAfter.toLocaleString("sv-SE")} kr
              </p>
            </div>
            <div>
              <span className="text-xs text-text-muted">{STRINGS.yearlySavings}</span>
              <p className="text-lg font-bold text-energy-green">
                {savings > 0 ? "−" : ""}{Math.abs(savings).toLocaleString("sv-SE")} kr
              </p>
            </div>
            <div>
              <span className="text-xs text-text-muted">{STRINGS.totalInvestment}</span>
              <p className="text-lg font-bold text-text-primary">
                {summary.totalInvestmentCost.toLocaleString("sv-SE")} kr
              </p>
              {summary.paybackYears > 0 && (
                <span className="text-xs text-text-muted">
                  {summary.paybackYears} {STRINGS.years} återbetalningstid
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <span>{STRINGS.energyCost}: {summary.yearlyEnergyCostAfter.toLocaleString("sv-SE")} kr</span>
            <span>{STRINGS.gridFee}: {summary.yearlyGridFeeCost.toLocaleString("sv-SE")} kr</span>
            <span>{STRINGS.powerFee}: {summary.yearlyPowerFeeCostAfter.toLocaleString("sv-SE")} kr</span>
          </div>
        </div>
      )}

      {/* Three-scenario breakdown */}
      {threeScenarios && hasUpgrades && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <button
            onClick={() => setExpandThreeScenarios(!expandThreeScenarios)}
            className="flex w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-100"
          >
            <span className="text-sm font-semibold text-text-secondary">Scenario-jämförelse</span>
            <svg
              className={`h-5 w-5 text-text-muted transition-transform ${expandThreeScenarios ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {expandThreeScenarios && (
            <div className="mt-3 space-y-3">
              {/* Scenario A: Without investments */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">A) Utan investeringar</span>
                  <span className="font-semibold text-text-primary">
                    {threeScenarios.withoutInvestments.yearlyTotalCostKr.toLocaleString("sv-SE")} kr
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-red-500/60"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {/* Scenario B: Current situation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">B) Din nuvarande situation</span>
                  <span className="font-semibold text-text-primary">
                    {threeScenarios.currentSituation.yearlyTotalCostKr.toLocaleString("sv-SE")} kr
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-yellow-500/60"
                    style={{
                      width: `${
                        (threeScenarios.currentSituation.yearlyTotalCostKr /
                          threeScenarios.withoutInvestments.yearlyTotalCostKr) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Scenario C: After recommendations */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">C) Efter rekommendationer</span>
                  <span className="font-semibold text-energy-green">
                    {threeScenarios.afterRecommendations.yearlyTotalCostKr.toLocaleString("sv-SE")} kr
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-energy-green/60"
                    style={{
                      width: `${
                        (threeScenarios.afterRecommendations.yearlyTotalCostKr /
                          threeScenarios.withoutInvestments.yearlyTotalCostKr) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Savings breakdown */}
              <div className="mt-3 space-y-2 rounded-lg bg-gray-200/50 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Befintlig utrustning sparar:</span>
                  <span className="font-semibold text-energy-green">
                    {threeScenarios.existingSavingsKr.toLocaleString("sv-SE")} kr/år
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Ytterligare besparingspotential:</span>
                  <span className="font-semibold text-brand-600">
                    {threeScenarios.potentialSavingsKr.toLocaleString("sv-SE")} kr/år
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost breakdown card */}
      {threeScenarios && (
        <div className="mt-4">
          <CostBreakdownCard
            title="Kostnadsuppdelning — nuläge"
            components={threeScenarios.currentSituation.costComponents}
            yearlyKwh={threeScenarios.currentSituation.yearlyKwh}
          />
        </div>
      )}
    </div>
  );
}
         