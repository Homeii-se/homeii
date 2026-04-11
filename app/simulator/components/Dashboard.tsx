"use client";

import { useState, useMemo } from "react";
import type {
  BillData,
  RefinementAnswers,
  Period,
  ChartUnit,
  SEZone,
  ActiveUpgrades,
  UpgradeId,
  Assumptions,
} from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { STRINGS } from "../data/strings";
import { SE_ZONE_TOTAL_CONSUMER_PRICE } from "../data/energy-prices";
import { calculateDailyKwh, getYearlyData, getPrecision, calculateAnnualSummary } from "../simulation/annual";
import { simulateDay } from "../simulation/hourly";
import { simulate8760WithSolar, getDay, dateToDayOfYear } from "../simulation/simulate8760";
import { SE_ZONE_SPOT_PRICE, getHourlyPriceProfile } from "../data/energy-prices";
import { simulateMonthsWithUpgrades } from "../simulation/monthly";
import EnergyChart from "./EnergyChart";
import ConsumptionCard from "./ConsumptionCard";
import PeriodToggle from "./PeriodToggle";
import PrecisionMeter from "./PrecisionMeter";
import SEZoneSelector from "./SEZoneSelector";
import DatePicker from "./DatePicker";
import UnitToggle from "./UnitToggle";
import UpgradePanel from "./UpgradePanel";
import AnnualSummaryBar from "./AnnualSummaryBar";
import EnergyHealthScore from "./EnergyHealthScore";
import AssumptionsPanel from "./AssumptionsPanel";
import MethodologyPanel from "./MethodologyPanel";

interface DashboardProps {
  billData: BillData;
  refinement: RefinementAnswers;
  answeredQuestions: number;
  seZone: SEZone;
  onSEZoneChange: (zone: SEZone) => void;
  activeUpgrades: ActiveUpgrades;
  onUpgradeToggle: (id: UpgradeId) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  assumptions: Assumptions;
  onAssumptionsChange: (assumptions: Assumptions) => void;
  onBackToRecommendations: () => void;
  recommendedUpgradeIds?: UpgradeId[];
  tmyData?: TmyHourlyData[];
}

export default function Dashboard({
  billData,
  refinement,
  answeredQuestions,
  seZone,
  onSEZoneChange,
  activeUpgrades,
  onUpgradeToggle,
  selectedDate,
  onDateChange,
  assumptions,
  onAssumptionsChange,
  onBackToRecommendations,
  recommendedUpgradeIds,
  tmyData,
}: DashboardProps) {
  const [period, setPeriod] = useState<Period>("manad");
  const [chartUnit, setChartUnit] = useState<ChartUnit>("kwh");
  const precision = getPrecision(answeredQuestions);
  const hasUpgrades = Object.values(activeUpgrades).some(Boolean);

  // kW unit not available in year view — auto-reset
  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    if (p === "ar" && chartUnit === "kw") {
      setChartUnit("kwh");
    }
  };

  const disabledUnits: ChartUnit[] = period === "ar" ? ["kw"] : [];

  // Memoized calculations — anchored to ACTUAL bill (no inflation)
  const annualSummary = useMemo(
    () => calculateAnnualSummary(billData, refinement, activeUpgrades, seZone, assumptions, true),
    [billData, refinement, activeUpgrades, seZone, assumptions]
  );

  // Full 8760-hour simulation (memoized, runs once when tmyData is available)
  const sim8760 = useMemo(() => {
    if (!tmyData || tmyData.length < 8760) return null;
    return simulate8760WithSolar(billData, refinement, tmyData, seZone);
  }, [billData, refinement, tmyData, seZone]);

  // Day data: 8760-driven (unique per day) or fallback to simulateDay
  const daySimulation = useMemo(() => {
    const date = new Date(selectedDate + "T12:00:00");

    if (sim8760) {
      const dayOfYear = dateToDayOfYear(date);
      const consumption = getDay(sim8760.consumption, dayOfYear);
      const solar = getDay(sim8760.solarProduction, dayOfYear);
      const selfCons = getDay(sim8760.selfConsumption, dayOfYear);
      const gridImport = getDay(sim8760.gridImport, dayOfYear);
      const gridExport = getDay(sim8760.gridExport, dayOfYear);
      const month = date.getMonth();
      const monthAvgSpotOre = SE_ZONE_SPOT_PRICE[seZone]?.[month] ?? 60;
      const priceProfile = getHourlyPriceProfile(month);

      return Array.from({ length: 24 }, (_, h) => {
        const spotOre = monthAvgSpotOre * priceProfile[h];
        return {
          hour: h,
          kwhBase: consumption[h],
          kwhAfterUpgrades: consumption[h],
          solarProductionKwh: solar[h],
          batteryChargeKwh: 0,
          batteryStateKwh: 0,
          gridImportKwh: gridImport[h],
          gridExportKwh: gridExport[h],
          costOre: gridImport[h] * spotOre,
          spotPriceOre: Math.round(spotOre * 10) / 10,
        };
      });
    }

    // Fallback: legacy simulateDay (identical per month)
    return simulateDay(billData, refinement, date, activeUpgrades, seZone, assumptions);
  }, [sim8760, selectedDate, billData, refinement, activeUpgrades, seZone, assumptions]);

  const monthlyExtended = useMemo(
    () => simulateMonthsWithUpgrades(billData, refinement, activeUpgrades, seZone, assumptions),
    [billData, refinement, activeUpgrades, seZone, assumptions]
  );

  // Legacy data for year view
  const yearlyData = useMemo(
    () => getYearlyData(billData, refinement),
    [billData, refinement]
  );

  // Key metrics
  const dailyKwh = calculateDailyKwh(billData);
  const currentMonth = new Date().getMonth();
  const avgMonthlyPriceOre = SE_ZONE_TOTAL_CONSUMER_PRICE[seZone][currentMonth];
  const pricePerKwhKr = avgMonthlyPriceOre / 100;
  const monthlyCostSEZone = Math.round(billData.kwhPerMonth * pricePerKwhKr);

  // Chart data based on period + chartUnit
  const chartData = useMemo(() => {
    if (period === "dag") {
      if (chartUnit === "sek") {
        return daySimulation.map((d) => ({
          label: `${String(d.hour).padStart(2, "0")}`,
          value: Math.round((d.costOre / 100) * 100) / 100,
          baseline: undefined,
        }));
      }
      // kWh and kW are identical at 1h resolution
      return daySimulation.map((d) => ({
        label: `${String(d.hour).padStart(2, "0")}`,
        value: Math.round(d.kwhAfterUpgrades * 100) / 100,
        overlay: d.solarProductionKwh > 0 ? d.solarProductionKwh : undefined,
        baseline:
          hasUpgrades && d.kwhBase !== d.kwhAfterUpgrades
            ? d.kwhBase
            : undefined,
        lineValue: d.spotPriceOre > 0 ? Math.round(d.spotPriceOre * 10) / 10 : undefined,
      }));
    }
    if (period === "manad") {
      if (chartUnit === "kw") {
        return monthlyExtended.map((d, i) => ({
          label: d.label,
          value: d.peakKw,
          highlight: i === currentMonth,
          baseline: hasUpgrades ? d.peakKwBase : undefined,
        }));
      }
      if (chartUnit === "sek") {
        return monthlyExtended.map((d, i) => ({
          label: d.label,
          value: hasUpgrades ? d.totalCostKr : d.totalCostBaseKr,
          highlight: i === currentMonth,
          baseline: hasUpgrades ? d.totalCostBaseKr : undefined,
        }));
      }
      return monthlyExtended.map((d, i) => ({
        label: d.label,
        value: hasUpgrades ? d.kwhAfterUpgrades : d.kwhBase,
        secondary: hasUpgrades ? d.costAfterUpgrades : d.costBase,
        highlight: i === currentMonth,
        baseline: hasUpgrades ? d.kwhBase : undefined,
      }));
    }
    // Year view (kW disabled)
    if (chartUnit === "sek") {
      return yearlyData.map((d) => ({
        label: d.label,
        value: d.cost,
        highlight: !d.isEstimate,
      }));
    }
    return yearlyData.map((d) => ({
      label: d.label,
      value: d.kwh,
      secondary: d.cost,
      highlight: !d.isEstimate,
    }));
  }, [period, chartUnit, daySimulation, monthlyExtended, yearlyData, hasUpgrades, currentMonth]);

  const displayUnit = chartUnit === "sek" ? "kr" : chartUnit === "kw" ? "kW" : STRINGS.kwhUnit;
  const secondaryUnit = period !== "dag" && chartUnit === "kwh" ? STRINGS.costUnit : undefined;

  // Average monthly peak kW for health score
  const avgPeakKw = useMemo(() => {
    const peaks = monthlyExtended.map((m) => hasUpgrades ? m.peakKw : m.peakKwBase);
    return peaks.reduce((s, v) => s + v, 0) / peaks.length;
  }, [monthlyExtended, hasUpgrades]);

  // Format selected date for display
  const selectedDateObj = new Date(selectedDate + "T12:00:00");
  const dateFormatted = selectedDateObj.toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBackToRecommendations}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:text-brand-200 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {STRINGS.backToRecommendations}
      </button>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-2xl font-bold text-text-primary">
          {STRINGS.dashboardTitle}
        </h2>
        <PrecisionMeter precision={precision} />
      </div>

      {/* Energy Health Score */}
      <div className="mb-4">
        <EnergyHealthScore summary={annualSummary} hasUpgrades={hasUpgrades} monthlyPeakKwAvg={avgPeakKw} />
      </div>

      {/* SE Zone selector */}
      <div className="mb-4">
        <SEZoneSelector zone={seZone} onChange={onSEZoneChange} />
      </div>

      {/* Annual summary */}
      <div className="mb-4">
        <AnnualSummaryBar
          summary={annualSummary}
          hasUpgrades={hasUpgrades}
          billData={billData}
          refinement={refinement}
          seZone={seZone}
          assumptions={assumptions}
          recommendedUpgradeIds={recommendedUpgradeIds}
          tmyData={tmyData}
        />
      </div>

      {/* Key metrics */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ConsumptionCard
          label={STRINGS.consumption}
          value={dailyKwh.toFixed(1)}
          unit={STRINGS.kwhUnit}
          subtitle={STRINGS.perDay}
        />
        <ConsumptionCard
          label={STRINGS.estimatedCost}
          value={monthlyCostSEZone.toLocaleString("sv-SE")}
          unit={STRINGS.costUnit}
          subtitle={`${STRINGS.perMonth} (${seZone})`}
        />
        <ConsumptionCard
          label="Elpris"
          value={pricePerKwhKr.toFixed(2)}
          unit="kr/kWh"
          subtitle={seZone}
          color="text-energy-yellow"
        />
        <ConsumptionCard
          label="Årsförbrukning"
          value={(billData.annualKwh ?? billData.kwhPerMonth * 12).toLocaleString("sv-SE")}
          unit={STRINGS.kwhUnit}
          subtitle={STRINGS.perYear}
        />
      </div>

      {/* Chart controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <PeriodToggle period={period} onChange={handlePeriodChange} />
        <UnitToggle unit={chartUnit} onChange={setChartUnit} disabledUnits={disabledUnits} />
        {period === "dag" && (
          <DatePicker selectedDate={selectedDate} onChange={onDateChange} />
        )}
      </div>

      {/* Date info for day view */}
      {period === "dag" && (
        <p className="mb-2 text-sm text-text-secondary capitalize">
          {dateFormatted}
        </p>
      )}

      {/* Chart */}
      <div className="glass-card-strong rounded-2xl p-4">
        <EnergyChart
          data={chartData}
          unit={displayUnit}
          secondaryUnit={secondaryUnit}
          lineUnit={period === "dag" && chartUnit !== "sek" ? "öre" : undefined}
          height={period === "dag" ? 200 : 260}
        />
      </div>

      {/* Day summary (only when 8760-driven) */}
      {period === "dag" && sim8760 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-text-muted">Förbrukning</p>
            <p className="font-semibold text-text-primary">
              {daySimulation.reduce((s: number, d: { kwhAfterUpgrades: number }) => s + d.kwhAfterUpgrades, 0).toFixed(1)} kWh
            </p>
          </div>
          <div>
            <p className="text-text-muted">Solproduktion</p>
            <p className="font-semibold text-energy-yellow">
              {daySimulation.reduce((s: number, d: { solarProductionKwh: number }) => s + d.solarProductionKwh, 0).toFixed(1)} kWh
            </p>
          </div>
          <div>
            <p className="text-text-muted">Nätexport</p>
            <p className="font-semibold text-energy-green">
              {daySimulation.reduce((s: number, d: { gridExportKwh?: number }) => s + (d.gridExportKwh ?? 0), 0).toFixed(1)} kWh
            </p>
          </div>
        </div>
      )}

      {/* Period info */}
      <div className="mt-3 text-center text-xs text-text-muted">
        {period === "dag" && chartUnit !== "sek" &&
          (sim8760 ? "Simulerad förbrukning baserad på verkliga väderdata (PVGIS TMY)" : "Simulerad förbrukning för valt datum med säsongsanpassning")}
        {period === "dag" && chartUnit === "sek" &&
          "Timkostnad (energi). Grundavgift och effektavgift tillkommer per månad."}
        {period === "manad" && chartUnit === "kwh" &&
          "Månadsvis fördelning med svensk säsongsvariation"}
        {period === "manad" && chartUnit === "kw" &&
          "Toppeffekt (max kW under en timme) per månad — högre på vintern"}
        {period === "manad" && chartUnit === "sek" &&
          "Total månadskostnad inkl. energi, grundavgift och effektavgift"}
        {period === "ar" &&
          "Årsjämförelse — föregående år (uppskattning) och nästa år (prognos +3%)"}
      </div>

      {/* Upgrade panel */}
      <div className="mt-4">
        <UpgradePanel
          activeUpgrades={activeUpgrades}
          onToggle={onUpgradeToggle}
          annualSummary={annualSummary}
          recommendedUpgradeIds={recommendedUpgradeIds}
        />
      </div>

      {/* Assumptions panel */}
      <div className="mt-4">
        <AssumptionsPanel assumptions={assumptions} onChange={onAssumptionsChange} />
      </div>

      {/* Methodology & Sources */}
      <div className="mt-6">
        <MethodologyPanel />
      </div>

      {/* Back to recommendations */}
      <div className="mt-6 text-center">
        <button
          onClick={onBackToRecommendations}
          className="rounded-xl px-6 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-light/50"
        >
          ← Tillbaka till rekommendationer
        </button>
      </div>
    </div>
  );
}