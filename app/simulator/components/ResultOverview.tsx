"use client";

import { useMemo, useState } from "react";
import type { ThreeScenarioSummary, SEZone, BillData, Assumptions, RefinementAnswers, ActiveUpgrades } from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { getEnergyTaxRate } from "../data/energy-tax";
import { getGridPricing, DEFAULT_GRID_PRICING } from "../data/grid-operators";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";
import CostBreakdownCard from "./CostBreakdownCard";
import SimulationExplorer from "./SimulationExplorer";

interface ResultOverviewProps {
  threeScenarios: ThreeScenarioSummary;
  seZone: SEZone;
  billData: BillData;
  assumptions?: Assumptions;
  refinement?: RefinementAnswers;
  onContinue: () => void;
  tmyData?: TmyHourlyData[];
}

/** Distribute annual kWh across 12 months using simplified seasonal weights */
function distributeAnnualKwh(yearlyKwh: number, seZone: SEZone): number[] {
  const winterWeight = seZone === "SE1" || seZone === "SE2" ? 1.8 : 1.5;
  const summerWeight = 0.6;
  const weights = [
    winterWeight, winterWeight * 0.95, 1.2, 0.9, 0.7, summerWeight,
    summerWeight, summerWeight * 1.05, 0.8, 1.0, 1.3, winterWeight,
  ];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  return weights.map((w) => Math.round((yearlyKwh * w) / totalWeight));
}

export default function ResultOverview({
  threeScenarios,
  seZone,
  billData,
  assumptions,
  refinement,
  onContinue,
  tmyData,
}: ResultOverviewProps) {
  // Local date state for the simulation explorer
  const now = new Date();
  const todayMapped = `2025-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(todayMapped);
  const { currentSituation, existingSavingsKr, withoutInvestments } = threeScenarios;
  const uploadedTypes = billData.uploadedInvoiceTypes ?? [];
  const hasOnlyElnat = uploadedTypes.includes("elnat") && !uploadedTypes.includes("elhandel");
  const hasOnlyElhandel = uploadedTypes.includes("elhandel") && !uploadedTypes.includes("elnat");

  const calculationDetails = useMemo(() => {
    const gridPricing = assumptions?.gridOperator
      ? getGridPricing(assumptions.gridOperator)
      : (billData.natAgare ? getGridPricing(billData.natAgare) : DEFAULT_GRID_PRICING);

    const monthlyKwh = currentSituation.monthlyKwh
      ?? distributeAnnualKwh(currentSituation.yearlyKwh, seZone);

    return {
      seZone,
      gridOperator: assumptions?.gridOperator ?? billData.natAgare,
      spotPrices: SE_ZONE_SPOT_PRICE[seZone] ?? new Array(12).fill(80),
      monthlyKwh,
      monthlyPeakKw: currentSituation.monthlyPeakKw,
      transferFeeOre: assumptions?.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh,
      markupOre: assumptions?.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh,
      energyTaxOre: getEnergyTaxRate(seZone, false),
      gridFixedFeeKr: assumptions?.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth,
      powerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw ?? gridPricing.powerChargeKrPerKw,
      hasPowerCharge: assumptions?.gridHasPowerCharge ?? gridPricing.hasPowerCharge,
      elhandelMonthlyFeeKr: ELHANDEL_DEFAULTS.avgMonthlyFeeKr,
    };
  }, [seZone, currentSituation, assumptions, billData]);

  const hasExistingEquipment = refinement && (
    refinement.hasSolar ||
    refinement.hasBattery ||
    (refinement.heatingTypes || []).some((ht) => ht === "luftluft" || ht === "luftvatten" || ht === "bergvarme") ||
    (refinement.heatingType && (refinement.heatingType === "luftluft" || refinement.heatingType === "luftvatten" || refinement.heatingType === "bergvarme"))
  );

  return (
    <div className="mx-auto max-w-2xl px-4 animate-fade-in">
      {/* Headline */}
      <div className="card-strong rounded-2xl p-5 mb-5">
        <p className="text-sm text-text-muted mb-1">Uppskattad årlig elkostnad</p>
        <p className="text-3xl font-bold text-text-primary">
          {Math.round(currentSituation.yearlyTotalCostKr).toLocaleString("sv-SE")} kr/år
        </p>
        <p className="mt-1.5 text-xs text-text-muted">
          Baserat på din faktura, dina uppgifter och aktuella energipriser. Verklig kostnad kan avvika.
        </p>
        {(hasOnlyElnat || hasOnlyElhandel) && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">
              {hasOnlyElnat
                ? "Endast elnätsfaktura uppladdad: elnätsdelen är fakturabaserad, elhandelsdelen är estimerad."
                : "Endast elhandelsfaktura uppladdad: elhandelsdelen är fakturabaserad, elnätsdelen är estimerad."}
            </p>
          </div>
        )}
        {hasExistingEquipment && existingSavingsKr > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
            <svg className="h-4 w-4 text-energy-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Dina befintliga investeringar sparar redan{" "}
            <strong className="text-energy-green">
              {existingSavingsKr.toLocaleString("sv-SE")} kr/år
            </strong>
          </p>
        )}
      </div>

      {/* Cost breakdown — prominent, not collapsible */}
      <div className="mb-5">
        <CostBreakdownCard
          title="Kostnadsuppdelning — nuläge"
          components={currentSituation.costComponents}
          yearlyKwh={currentSituation.yearlyKwh}
          calculationDetails={calculationDetails}
        />
      </div>

      {/* Smartness insight — spot price ratio */}
      {billData.spotPriceRatio !== undefined && (
        <div className="card-strong rounded-2xl p-5 mb-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">
              {billData.spotPriceRatio < 0.95 ? "⚡" : billData.spotPriceRatio > 1.05 ? "💡" : "👍"}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-1">
                Ditt elkonsumtionsmönster
              </h3>
              {billData.spotPriceRatio < 0.95 ? (
                <p className="text-sm text-text-primary">
                  Du betalar{" "}
                  <strong className="text-energy-green">
                    {Math.round((1 - billData.spotPriceRatio) * 100)}% under
                  </strong>{" "}
                  genomsnittligt spotpris för din zon. Det tyder på att du redan
                  är smart med när du förbrukar el — t.ex. elbilsladdning på natten.
                </p>
              ) : billData.spotPriceRatio > 1.05 ? (
                <p className="text-sm text-text-primary">
                  Du betalar{" "}
                  <strong className="text-amber-600">
                    {Math.round((billData.spotPriceRatio - 1) * 100)}% över
                  </strong>{" "}
                  genomsnittligt spotpris. Genom att flytta förbrukning till
                  billigare timmar (t.ex. nattladdning, timer på torktumlare)
                  kan du sänka din elkostnad.
                </p>
              ) : (
                <p className="text-sm text-text-primary">
                  Ditt förbrukningsmönster ligger nära genomsnittet för din zon.
                  Med smartstyrning eller timprisavtal kan du potentiellt sänka kostnaden.
                </p>
              )}
              <p className="mt-1.5 text-xs text-text-muted">
                Smartness-index: {billData.spotPriceRatio.toFixed(2)} (1.00 = genomsnitt)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Before/after existing investments comparison */}
      {hasExistingEquipment && existingSavingsKr > 0 && (
        <div className="card-strong rounded-2xl p-5 mb-5">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Effekten av dina befintliga investeringar</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Utan dina investeringar</span>
              <span className="text-sm font-semibold text-text-primary">
                {Math.round(withoutInvestments.yearlyTotalCostKr).toLocaleString("sv-SE")} kr/år
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Med dina investeringar</span>
              <span className="text-sm font-semibold text-text-primary">
                {Math.round(currentSituation.yearlyTotalCostKr).toLocaleString("sv-SE")} kr/år
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-1">
              <span className="text-sm font-medium text-text-secondary">Besparing</span>
              <span className="text-sm font-bold text-energy-green">
                {existingSavingsKr.toLocaleString("sv-SE")} kr/år
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Simulation explorer */}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-text-primary mb-3">Simulerad förbrukning</h3>
        <SimulationExplorer
          billData={billData}
          refinement={refinement}
          seZone={seZone}
          activeUpgrades={{} as ActiveUpgrades}
          assumptions={assumptions}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          tmyData={tmyData}
        />
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onContinue}
          className="w-full rounded-2xl bg-cta-orange px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          Ser bra ut! Visa vad jag kan göra
        </button>
        <p className="text-xs text-text-muted text-center mt-2">
          Uppskattningen baseras på din faktura och genomsnittliga energipriser för din zon.
        </p>
      </div>
    </div>
  );
}
