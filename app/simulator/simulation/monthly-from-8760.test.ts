/**
 * Tests for `aggregateMonthsFrom8760` (PR C2).
 *
 * Verifies four invariants:
 *   1. Monthly aggregates sum to annual totals (no kWh is dropped)
 *   2. Peak per month is the maximum of that month's hourly grid imports
 *   3. Identity: feeding the same sim as both `baseSim` and `afterSim`
 *      yields zero savings and matching cost breakdowns
 *   4. Upgrade impact: bergvärme as the after-scenario produces strictly
 *      positive savings vs a NO_UPGRADES baseline
 */
import { describe, expect, it } from "vitest";
import { aggregateMonthsFrom8760 } from "./monthly-from-8760";
import { simulate8760WithUpgrades } from "./simulate8760";
import { NO_UPGRADES } from "./upgrades";
import type { ActiveUpgrades, BillData, RefinementAnswers } from "../types";
import type { TmyHourlyData } from "../data/pvgis-tmy";

function createSyntheticTmy(): TmyHourlyData[] {
  const records: TmyHourlyData[] = [];
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(2025, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      for (let hour = 0; hour < 24; hour++) {
        records.push({
          time: `2025${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}:${String(hour).padStart(2, "0")}00`,
          ghi: hour >= 8 && hour <= 16 ? 300 : 0,
          dni: hour >= 8 && hour <= 16 ? 250 : 0,
          dhi: hour >= 8 && hour <= 16 ? 50 : 0,
          tempC: month < 2 || month > 10 ? -2 : 8,
          windMs: 3,
          month,
          hour,
          dayOfYear: 0,
        });
      }
    }
  }
  return records.slice(0, 8760);
}

const STANDARD_BILL: BillData = {
  kwhPerMonth: 1500,
  costPerMonth: 2800,
  annualKwh: 18000,
  seZone: "SE3",
};

const STANDARD_REFINEMENT: RefinementAnswers = {
  housingType: "villa",
  area: 150,
  heatingTypes: ["direktel"],
  residents: 4,
  elContractType: "monthly",
};

describe("aggregateMonthsFrom8760", () => {
  it("monthly aggregates sum to annual totals (kWh conservation)", () => {
    const tmy = createSyntheticTmy();
    const sim = simulate8760WithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      tmy,
      "SE3",
    );

    const months = aggregateMonthsFrom8760({
      baseSim: sim,
      afterSim: sim,
      bill: STANDARD_BILL,
      refinement: STANDARD_REFINEMENT,
      activeUpgrades: NO_UPGRADES,
      seZone: "SE3",
    });

    expect(months).toHaveLength(12);

    const sumGridImport = months.reduce((s, m) => s + m.gridImportKwh, 0);
    const annualGridImport = sim.annualGridImportKwh;

    // Allow for rounding in monthly Math.round vs annual sum.
    expect(Math.abs(sumGridImport - annualGridImport)).toBeLessThan(15);

    const sumKwhAfter = months.reduce((s, m) => s + m.kwhAfterUpgrades, 0);
    expect(Math.abs(sumKwhAfter - sim.annualConsumptionAfterKwh)).toBeLessThan(15);
  });

  it("peak kW per month equals the max hourly grid import in that month", () => {
    const tmy = createSyntheticTmy();
    const sim = simulate8760WithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      tmy,
      "SE3",
    );

    const months = aggregateMonthsFrom8760({
      baseSim: sim,
      afterSim: sim,
      bill: STANDARD_BILL,
      refinement: STANDARD_REFINEMENT,
      activeUpgrades: NO_UPGRADES,
      seZone: "SE3",
    });

    // For each month, scan the hourly array directly and verify the max
    // matches what the aggregator reported.
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let cursor = 0;
    for (let m = 0; m < 12; m++) {
      const start = cursor;
      const end = start + daysPerMonth[m] * 24;
      let directMax = 0;
      for (let i = start; i < end; i++) {
        if (sim.gridImport[i] > directMax) directMax = sim.gridImport[i];
      }
      expect(months[m].peakKw).toBeCloseTo(directMax, 9);
      cursor = end;
    }
  });

  it("identity: same sim as base and after yields zero savings everywhere", () => {
    // When baseSim and afterSim are the same simulation result, every
    // month's cost breakdown should be identical and savingsKr should be
    // exactly zero. This is the strongest pin against accidental drift
    // between the two cost paths inside the aggregator.
    const tmy = createSyntheticTmy();
    const sim = simulate8760WithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      tmy,
      "SE3",
    );

    const months = aggregateMonthsFrom8760({
      baseSim: sim,
      afterSim: sim,
      bill: STANDARD_BILL,
      refinement: STANDARD_REFINEMENT,
      activeUpgrades: NO_UPGRADES,
      seZone: "SE3",
    });

    for (const month of months) {
      expect(month.savingsKr).toBe(0);
      expect(month.totalCostKr).toBe(month.totalCostBaseKr);
      expect(month.costBreakdown.totalKr).toBe(month.costBreakdownBase.totalKr);
      expect(month.kwhBase).toBe(month.kwhAfterUpgrades);
      expect(month.peakKw).toBeCloseTo(month.peakKwBase, 9);
    }
  });

  it("bergvärme as after-scenario produces strictly positive savings", () => {
    const tmy = createSyntheticTmy();
    const baseSim = simulate8760WithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      tmy,
      "SE3",
    );
    const afterSim = simulate8760WithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      { ...NO_UPGRADES, bergvarme: true } as ActiveUpgrades,
      tmy,
      "SE3",
    );

    const months = aggregateMonthsFrom8760({
      baseSim,
      afterSim,
      bill: STANDARD_BILL,
      refinement: STANDARD_REFINEMENT,
      activeUpgrades: { ...NO_UPGRADES, bergvarme: true } as ActiveUpgrades,
      seZone: "SE3",
    });

    // Total annual savings should be positive.
    const totalSavings = months.reduce((s, m) => s + m.savingsKr, 0);
    expect(totalSavings).toBeGreaterThan(0);

    // Every winter month (Jan, Feb, Dec) should show a positive saving —
    // bergvärme replaces direct electric heating in the heating-dominated
    // months, so reductions there should always be positive.
    expect(months[0].savingsKr).toBeGreaterThan(0);
    expect(months[1].savingsKr).toBeGreaterThan(0);
    expect(months[11].savingsKr).toBeGreaterThan(0);

    // After-grid-import should be lower than base-grid-import in winter.
    expect(months[0].gridImportKwh).toBeLessThan(months[0].kwhBase);
    expect(months[11].gridImportKwh).toBeLessThan(months[11].kwhBase);
  });

  it("uses top-3 average peak when grid operator has power charge", () => {
    // The aggregator applies the average of the 3 highest monthly peaks
    // uniformly across all months for power-charge calculation. This is
    // the same convention the legacy 12-day pipeline uses, so output stays
    // comparable. Verify by checking that gridPowerChargeKr is identical
    // across all months in the same scenario when hasPowerCharge is true.
    const tmy = createSyntheticTmy();
    const billWithPowerCharge: BillData = {
      ...STANDARD_BILL,
      gridHasPowerCharge: true,
      gridPowerChargeKrPerKw: 50, // 50 kr/kW excl moms
      natAgare: "Ellevio",
    };

    const sim = simulate8760WithUpgrades(
      billWithPowerCharge,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      tmy,
      "SE3",
    );

    const months = aggregateMonthsFrom8760({
      baseSim: sim,
      afterSim: sim,
      bill: billWithPowerCharge,
      refinement: STANDARD_REFINEMENT,
      activeUpgrades: NO_UPGRADES,
      seZone: "SE3",
    });

    const powerCharges = months.map((m) => m.costBreakdown.gridPowerChargeKr);
    // All twelve months should report the same gridPowerChargeKr — the
    // effective top-3-average peak is applied uniformly.
    const first = powerCharges[0];
    for (const charge of powerCharges) {
      expect(charge).toBe(first);
    }
    expect(first).toBeGreaterThan(0);
  });
});
