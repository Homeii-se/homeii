"use client";

import { useEffect, useState, useMemo } from "react";
import type {
  BillData,
  RefinementAnswers,
  Period,
  ChartUnit,
  SEZone,
  ActiveUpgrades,
  Assumptions,
} from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";
import { STRINGS } from "../data/strings";
import { SE_ZONE_SPOT_PRICE, getHourlyPriceProfile } from "../data/energy-prices";
import { simulateDay } from "../simulation/hourly";
import { simulate8760WithSolar, getDay, dateToDayOfYear } from "../simulation/simulate8760";
import { simulateMonthsWithUpgrades } from "../simulation/monthly";
import { getYearlyData } from "../simulation/annual";
import EnergyChart from "./EnergyChart";
import PeriodToggle from "./PeriodToggle";
import DatePicker from "./DatePicker";
import UnitToggle from "./UnitToggle";
import type { MonthlyDataPointExtended } from "../types";

interface SimulationExplorerProps {
  billData: BillData;
  refinement?: RefinementAnswers;
  seZone: SEZone;
  activeUpgrades?: ActiveUpgrades;
  assumptions?: Assumptions;
  selectedDate: string;
  onDateChange: (date: string) => void;
  tmyData?: TmyHourlyData[];
  /** Start with day view instead of month view */
  defaultPeriod?: Period;
}

export default function SimulationExplorer({
  billData,
  refinement,
  seZone,
  activeUpgrades = {} as ActiveUpgrades,
  assumptions = {} as Assumptions,
  selectedDate,
  onDateChange,
  tmyData,
  defaultPeriod = "manad",
}: SimulationExplorerProps) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [chartUnit, setChartUnit] = useState<ChartUnit>("kwh");
  const [actualSpotPricesOre, setActualSpotPricesOre] = useState<number[] | null>(null);

  const hasUpgrades = Object.values(activeUpgrades).some(Boolean);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    if (p === "ar" && chartUnit === "kw") {
      setChartUnit("kwh");
    }
  };

  const disabledUnits: ChartUnit[] = period === "ar" ? ["kw"] : [];

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate > today) {
      return;
    }

    let cancelled = false;
    fetch(`/api/spot-prices?zone=${seZone}&date=${selectedDate}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled) return;
        const prices = data?.pricesOreExMoms;
        if (Array.isArray(prices) && prices.length > 0) {
          setActualSpotPricesOre(prices as number[]);
        } else {
          setActualSpotPricesOre(null);
        }
      })
      .catch(() => {
        if (!cancelled) setActualSpotPricesOre(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, seZone]);

  const effectiveSpotPricesOre = useMemo(
    () => (selectedDate > new Date().toISOString().slice(0, 10) ? null : actualSpotPricesOre),
    [actualSpotPricesOre, selectedDate]
  );

  // Full 8760-hour simulation — anchored to ACTUAL bill (no inflation)
  const sim8760 = useMemo(() => {
    if (!tmyData || tmyData.length < 8760 || !refinement) return null;
    return simulate8760WithSolar(billData, refinement, tmyData, seZone);
  }, [billData, refinement, tmyData, seZone]);

  // Day data
  const daySimulation = useMemo(() => {
    const date = new Date(selectedDate + "T12:00:00");

    if (sim8760) {
      const dayOfYear = dateToDayOfYear(date);
      const consumption = getDay(sim8760.consumption, dayOfYear);
      const solar = getDay(sim8760.solarProduction, dayOfYear);
      const gridImport = getDay(sim8760.gridImport, dayOfYear);
      const gridExport = getDay(sim8760.gridExport, dayOfYear);
      const month = date.getMonth();
      const monthAvgSpotOre = SE_ZONE_SPOT_PRICE[seZone]?.[month] ?? 60;
      const priceProfile = getHourlyPriceProfile(month);

      return Array.from({ length: 24 }, (_, h) => {
        const spotOre = effectiveSpotPricesOre?.[h] ?? (monthAvgSpotOre * priceProfile[h]);
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

    if (!refinement) return null;
    return simulateDay(billData, refinement, date, activeUpgrades, seZone, assumptions, effectiveSpotPricesOre ?? undefined);
  }, [sim8760, selectedDate, billData, refinement, activeUpgrades, seZone, assumptions, effectiveSpotPricesOre]);

  const monthlyExtended = useMemo(() => {
    if (!refinement) return null;
    const result = simulateMonthsWithUpgrades(billData, refinement, activeUpgrades, seZone, assumptions);

    // If 8760 simulation is available, override peakKw with actual hourly max
    // from the 8760 data. The legacy simulateDay gives average hourly kWh which
    // underestimates peaks. The 8760 sim has temperature-driven hourly variation.
    if (sim8760) {
      const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let dayStart = 0;
      for (let m = 0; m < 12; m++) {
        const days = DAYS_IN_MONTH[m];
        let maxGridImport = 0;
        let maxGridImportBase = 0;
        for (let d = 0; d < days; d++) {
          const dayOfYear = dayStart + d;
          const gridImport = getDay(sim8760.gridImport, dayOfYear);
          const consumption = getDay(sim8760.consumption, dayOfYear);
          for (let h = 0; h < 24; h++) {
            if (gridImport[h] > maxGridImport) maxGridImport = gridImport[h];
            if (consumption[h] > maxGridImportBase) maxGridImportBase = consumption[h];
          }
        }
        result[m].peakKw = Math.round(maxGridImport * 10) / 10;
        result[m].peakKwBase = Math.round(maxGridImportBase * 10) / 10;
        dayStart += days;
      }
      console.log("[SimExplorer] 8760-based peaks:", result.map((m: MonthlyDataPointExtended) => m.peakKw.toFixed(1)));
    }

    return result;
  }, [billData, refinement, activeUpgrades, seZone, assumptions, sim8760]);

  const yearlyData = useMemo(
    () => refinement ? getYearlyData(billData, refinement) : null,
    [billData, refinement]
  );

  const currentMonth = new Date().getMonth();

  const chartData = useMemo(() => {
    if (period === "dag") {
      if (!daySimulation) return [];
      if (chartUnit === "sek") {
        return daySimulation.map((d) => ({
          label: `${String(d.hour).padStart(2, "0")}`,
          value: Math.round((d.costOre / 100) * 100) / 100,
          baseline: undefined,
        }));
      }
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
      if (!monthlyExtended) return [];
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
    // Year view
    if (!yearlyData) return [];
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

  const selectedDateObj = new Date(selectedDate + "T12:00:00");
  const dateFormatted = selectedDateObj.toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      {/* Chart controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <PeriodToggle period={period} onChange={handlePeriodChange} />
        <UnitToggle unit={chartUnit} onChange={setChartUnit} disabledUnits={disabledUnits} />
      </div>

      {period === "dag" && (
        <div className="mb-2">
          <DatePicker selectedDate={selectedDate} onChange={onDateChange} />
        </div>
      )}

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
      {period === "dag" && sim8760 && daySimulation && (
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
    </div>
  );
}
