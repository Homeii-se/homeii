/**
 * Integration tests for `simulateMonthsWithUpgrades` (PR C3).
 *
 * Verifies the routing layer:
 *   1. Without tmyData → falls back to legacy 12-day pipeline
 *      (same output as before C3 — regression-safe)
 *   2. With tmyData → routes to 8760 pipeline
 *      (same output as direct simulate8760WithUpgrades + aggregateMonthsFrom8760)
 *
 * The actual physics correctness of each pipeline is tested in their own
 * unit-test files (simulate8760.test.ts, monthly-from-8760.test.ts).
 * This file only validates that the routing in monthly.ts dispatches
 * correctly based on the tmyData parameter.
 */
import { describe, expect, it } from "vitest";
import { simulateMonthsWithUpgrades } from "./monthly";
import { simulate8760WithUpgrades } from "./simulate8760";
import { aggregateMonthsFrom8760 } from "./monthly-from-8760";
import { NO_UPGRADES } from "./upgrades";
import type {
  ActiveUpgrades,
  BillData,
  RefinementAnswers,
} from "../types";
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

describe("simulateMonthsWithUpgrades — routing", () => {
  it("without tmyData returns 12 months (legacy pipeline path)", () => {
    // Smoke test for the legacy fallback. Detailed legacy correctness is
    // covered by engine.test.ts (PR B) which exercises the same code path
    // through generateRecommendations.
    const months = simulateMonthsWithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      "SE3",
    );

    expect(months).toHaveLength(12);
    months.forEach((m, i) => {
      expect(m.month).toBe(i);
      expect(m.kwhBase).toBeGreaterThan(0);
      expect(m.kwhAfterUpgrades).toBeGreaterThan(0);
      expect(typeof m.totalCostKr).toBe("number");
      expect(typeof m.totalCostBaseKr).toBe("number");
    });
  });

  it("with tmyData routes to 8760 pipeline and matches direct call", () => {
    // The dispatcher must produce the same result as calling
    // aggregateMonthsFrom8760(simulate8760WithUpgrades(...)) directly.
    // This pins down that no transformation is added or lost in the routing.
    const tmy = createSyntheticTmy();

    const dispatched = simulateMonthsWithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      "SE3",
      undefined,
      tmy,
    );

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
      NO_UPGRADES,
      tmy,
      "SE3",
    );
    const direct = aggregateMonthsFrom8760({
      baseSim,
      afterSim,
      bill: STANDARD_BILL,
      refinement: STANDARD_REFINEMENT,
      activeUpgrades: NO_UPGRADES,
      seZone: "SE3",
    });

    expect(dispatched).toHaveLength(direct.length);
    for (let i = 0; i < dispatched.length; i++) {
      expect(dispatched[i].month).toBe(direct[i].month);
      expect(dispatched[i].kwhBase).toBe(direct[i].kwhBase);
      expect(dispatched[i].kwhAfterUpgrades).toBe(direct[i].kwhAfterUpgrades);
      expect(dispatched[i].totalCostKr).toBe(direct[i].totalCostKr);
      expect(dispatched[i].totalCostBaseKr).toBe(direct[i].totalCostBaseKr);
      expect(dispatched[i].peakKw).toBeCloseTo(direct[i].peakKw, 9);
    }
  });

  it("with tmyData and bergvärme upgrade produces lower after-upgrades cost than baseline", () => {
    // End-to-end smoke: a real upgrade scenario through the full 8760 path
    // should produce positive savings. This catches if the dispatcher
    // accidentally calls the same scenario as both base and after.
    const tmy = createSyntheticTmy();

    const months = simulateMonthsWithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      { ...NO_UPGRADES, bergvarme: true } as ActiveUpgrades,
      "SE3",
      undefined,
      tmy,
    );

    expect(months).toHaveLength(12);
    const totalSavings = months.reduce((s, m) => s + m.savingsKr, 0);
    expect(totalSavings).toBeGreaterThan(0);

    // Total after-cost must be lower than total base-cost.
    const totalAfter = months.reduce((s, m) => s + m.totalCostKr, 0);
    const totalBase = months.reduce((s, m) => s + m.totalCostBaseKr, 0);
    expect(totalAfter).toBeLessThan(totalBase);
  });

  it("tmyData with fewer than 8760 records falls through to legacy pipeline", () => {
    // Defensive routing: a partial TMY array (e.g. due to PVGIS API hiccup)
    // should not blow up — it should fall back to the legacy pipeline so
    // the user still gets a recommendation. Only complete 8760 records
    // trigger the new pipeline.
    const partialTmy = createSyntheticTmy().slice(0, 100);

    const monthsPartial = simulateMonthsWithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      "SE3",
      undefined,
      partialTmy,
    );
    const monthsLegacy = simulateMonthsWithUpgrades(
      STANDARD_BILL,
      STANDARD_REFINEMENT,
      NO_UPGRADES,
      "SE3",
    );

    // Both should produce identical monthly costs since both fell through
    // to the legacy pipeline.
    expect(monthsPartial).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(monthsPartial[i].totalCostKr).toBe(monthsLegacy[i].totalCostKr);
    }
  });
});
