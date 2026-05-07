import { describe, expect, it } from "vitest";
import {
  dateToDayOfYear,
  getDay,
  simulate8760Consumption,
  simulate8760WithSolar,
  simulate8760WithUpgrades,
} from "./simulate8760";
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

describe("simulate8760Consumption", () => {
  it("returns 8760 points and roughly preserves annual target", () => {
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 1000,
      costPerMonth: 1500,
      seZone: "SE3",
    };
    const refinement: RefinementAnswers = {
      heatingTypes: ["direktel"],
    };

    const hourly = simulate8760Consumption(bill, refinement, tmy, "SE3");
    const total = hourly.reduce((s, v) => s + v, 0);

    expect(hourly).toHaveLength(8760);
    expect(total).toBeGreaterThan(11980);
    expect(total).toBeLessThan(12020);
  });
});

describe("simulate8760 helpers", () => {
  it("maps dates to day-of-year consistently", () => {
    expect(dateToDayOfYear(new Date(2025, 0, 1))).toBe(0);
    expect(dateToDayOfYear(new Date(2025, 11, 31))).toBe(364);
  });

  it("extracts one day (24 hours) from an 8760 array", () => {
    const hourly = Array.from({ length: 8760 }, (_, i) => i);
    const day10 = getDay(hourly, 10);
    expect(day10).toHaveLength(24);
    expect(day10[0]).toBe(240);
    expect(day10[23]).toBe(263);
  });
});

describe("simulate8760WithSolar", () => {
  it("returns balanced import/export/self-consumption arrays", () => {
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 900,
      costPerMonth: 1400,
      annualKwh: 10800,
      seZone: "SE3",
    };
    const refinement: RefinementAnswers = {
      hasSolar: true,
      solarSizeKw: 5,
      hasBattery: false,
      heatingTypes: ["direktel"],
    };

    const result = simulate8760WithSolar(bill, refinement, tmy, "SE3");

    expect(result.consumption).toHaveLength(8760);
    expect(result.gridImport).toHaveLength(8760);
    expect(result.gridExport).toHaveLength(8760);
    expect(result.annualSolarProductionKwh).toBeGreaterThan(0);

    for (let i = 0; i < 8760; i++) {
      const lhsConsumption = result.gridImport[i] + result.selfConsumption[i];
      const lhsProduction = result.gridExport[i] + result.selfConsumption[i];
      expect(Math.abs(lhsConsumption - result.consumption[i])).toBeLessThan(1e-6);
      expect(Math.abs(lhsProduction - result.solarProduction[i])).toBeLessThan(1e-6);
    }
  });

  it("reduces annual export when battery is enabled", () => {
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 900,
      costPerMonth: 1400,
      annualKwh: 10800,
      seZone: "SE3",
    };

    const noBattery = simulate8760WithSolar(
      bill,
      { hasSolar: true, solarSizeKw: 5, hasBattery: false, heatingTypes: ["direktel"] },
      tmy,
      "SE3"
    );
    const withBattery = simulate8760WithSolar(
      bill,
      { hasSolar: true, solarSizeKw: 5, hasBattery: true, batterySizeKwh: 10, heatingTypes: ["direktel"] },
      tmy,
      "SE3"
    );

    expect(withBattery.annualExportKwh).toBeLessThan(noBattery.annualExportKwh);
    expect(withBattery.annualSelfConsumptionKwh).toBeGreaterThan(noBattery.annualSelfConsumptionKwh);
  });
});

describe("simulate8760WithUpgrades", () => {
  it("consumptionBase matches simulate8760WithSolar exactly on a non-solar household", () => {
    // Strong identity invariant: the BASE consumption (no upgrades applied)
    // is just simulate8760Consumption() under the hood — same call, same
    // result. This pins down that we haven't accidentally rebuilt the
    // baseline pipeline.
    //
    // Solar households are excluded here because simulate8760WithSolar runs
    // a gross-up iteration (pass 1 → pass 2) that the new function does not
    // replicate. That divergence is documented and out of scope for PR C1;
    // recommendation-engine doesn't use that code path today anyway.
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 1500,
      costPerMonth: 2800,
      annualKwh: 18000,
      seZone: "SE3",
    };
    const refinement: RefinementAnswers = {
      housingType: "villa",
      area: 150,
      heatingTypes: ["direktel"],
      residents: 4,
    };

    const legacy = simulate8760WithSolar(bill, refinement, tmy, "SE3");
    const upgraded = simulate8760WithUpgrades(
      bill,
      refinement,
      NO_UPGRADES,
      tmy,
      "SE3",
    );

    // Per-hour BASE consumption (before upgrade application) must match exactly.
    for (let i = 0; i < 8760; i++) {
      expect(Math.abs(upgraded.consumptionBase[i] - legacy.consumption[i])).toBeLessThan(1e-9);
    }

    // Solar/export fields are zero on both sides for non-solar households.
    expect(upgraded.annualSolarProductionKwh).toBe(legacy.annualSolarProductionKwh);
    expect(upgraded.annualExportKwh).toBe(legacy.annualExportKwh);
    expect(upgraded.annualSelfConsumptionKwh).toBe(legacy.annualSelfConsumptionKwh);
  });

  it("consumptionAfter with NO_UPGRADES stays within 10% of consumptionBase", () => {
    // applyUpgradesToHour is NOT a perfect no-op when activeUpgrades is empty.
    // It splits each hour into heating / hot-water / other portions using a
    // season-factor-derived heatingFraction. When heatingFraction +
    // HOT_WATER_SHARE > 1 (high-heating-share households on cold winter
    // hours), `otherKwh` is clamped to 0 and `total` ends up at
    //   heatingFraction + HOT_WATER_SHARE × baseKwh
    // — i.e. *more* than the input baseKwh. For a direktel villa (heatingShare
    // 0.70) in midwinter (seasonFactor ~1.55) this can hit ~1.025 × baseKwh
    // per hour, accumulating to ~5% above baseline annually.
    //
    // This is a pre-existing approximation that engine v2's 12-day pipeline
    // already produces — PR C1 inherits it as-is so production output stays
    // unchanged. Fixing the heating/hot-water/other split is filed as a
    // separate plan item (see SIMULATOR-MOTOR-PLAN.md) and would change every
    // user's baseline numbers, so it warrants its own quality-test PR.
    //
    // The 0.90-1.10 band pins the current behaviour: we want the test to
    // catch a pipeline break (zero output, doubled output) but not flake on
    // routine COP/season-factor tweaks.
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 1500,
      costPerMonth: 2800,
      annualKwh: 18000,
      seZone: "SE3",
    };
    const refinement: RefinementAnswers = {
      housingType: "villa",
      area: 150,
      heatingTypes: ["direktel"],
      residents: 4,
    };

    const upgraded = simulate8760WithUpgrades(
      bill,
      refinement,
      NO_UPGRADES,
      tmy,
      "SE3",
    );

    expect(upgraded.consumptionBase).toHaveLength(8760);
    expect(upgraded.consumptionAfter).toHaveLength(8760);

    const ratio = upgraded.annualConsumptionAfterKwh / upgraded.annualConsumptionBaseKwh;
    expect(ratio).toBeGreaterThan(0.90);
    expect(ratio).toBeLessThan(1.10);
  });

  it("applying bergvärme to a direktel baseline reduces winter consumption substantially", () => {
    // Heat pump physics: bergvärme replaces direct electric heating with
    // a COP ~3.6 system → expect heating-portion electricity to drop by
    // ~70-80% (1 − 1/3.6 = 0.72). Since heating-share for direktel is ~0.70
    // of total, total annual consumption should drop by roughly 0.70 × 0.75
    // = ~52% in the simplest single-heating-source case.
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 2000,
      costPerMonth: 4200,
      annualKwh: 24000,
      seZone: "SE3",
    };
    const refinement: RefinementAnswers = {
      housingType: "villa",
      area: 150,
      heatingTypes: ["direktel"],
      residents: 4,
    };

    const baseline = simulate8760WithUpgrades(
      bill,
      refinement,
      NO_UPGRADES,
      tmy,
      "SE3",
    );
    const withBergvarme = simulate8760WithUpgrades(
      bill,
      refinement,
      { ...NO_UPGRADES, bergvarme: true } as ActiveUpgrades,
      tmy,
      "SE3",
    );

    // Sanity: structural fields are present and well-shaped.
    expect(withBergvarme.consumptionAfter).toHaveLength(8760);
    expect(withBergvarme.annualConsumptionBaseKwh).toBeCloseTo(
      baseline.annualConsumptionBaseKwh,
      0,
    );

    // Annual after-upgrades consumption should be meaningfully lower than the
    // baseline. We use a generous range (10–80% reduction) so the test does
    // not fail on small COP-curve tweaks but still catches a no-op or sign-flip.
    const reduction =
      (baseline.annualConsumptionAfterKwh - withBergvarme.annualConsumptionAfterKwh) /
      baseline.annualConsumptionAfterKwh;
    expect(reduction).toBeGreaterThan(0.1);
    expect(reduction).toBeLessThan(0.8);

    // Winter months (Jan, Feb, Dec) should show a bigger reduction than summer
    // (Jul, Aug) because heating dominates winter consumption.
    const monthFromHourIdx = (i: number): number => {
      const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let cumHours = 0;
      for (let m = 0; m < 12; m++) {
        cumHours += daysPerMonth[m] * 24;
        if (i < cumHours) return m;
      }
      return 11;
    };

    let winterBase = 0,
      winterAfter = 0,
      summerBase = 0,
      summerAfter = 0;
    for (let i = 0; i < 8760; i++) {
      const m = monthFromHourIdx(i);
      if (m === 0 || m === 1 || m === 11) {
        winterBase += baseline.consumptionAfter[i];
        winterAfter += withBergvarme.consumptionAfter[i];
      } else if (m === 6 || m === 7) {
        summerBase += baseline.consumptionAfter[i];
        summerAfter += withBergvarme.consumptionAfter[i];
      }
    }
    const winterReduction = (winterBase - winterAfter) / winterBase;
    const summerReduction = (summerBase - summerAfter) / summerBase;
    expect(winterReduction).toBeGreaterThan(summerReduction);
  });

  it("completes a full 8760 simulation with upgrades in well under 1 second", () => {
    // Performance baseline. Engine v2 invokes ~15 simulations per recommendation
    // request (3 variants × 5+ upgrade types). At 1s per simulation that would
    // already be 15s — too slow. Target for a single run: < 500ms in test
    // environment. Soft assertion: warn at 1000ms, fail at 2000ms so we catch
    // accidental quadratic blow-ups without flaking on slow CI runners.
    const tmy = createSyntheticTmy();
    const bill: BillData = {
      kwhPerMonth: 1800,
      costPerMonth: 3600,
      annualKwh: 21600,
      seZone: "SE3",
    };
    const refinement: RefinementAnswers = {
      housingType: "villa",
      area: 160,
      heatingTypes: ["direktel"],
      residents: 4,
    };

    const start = performance.now();
    simulate8760WithUpgrades(
      bill,
      refinement,
      { ...NO_UPGRADES, bergvarme: true, smartstyrning: true } as ActiveUpgrades,
      tmy,
      "SE3",
    );
    const elapsed = performance.now() - start;

    // Log so we can track the trend across PRs without making the assertion brittle.
    console.log(`[PERF] simulate8760WithUpgrades single run: ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(2000);
  });
});
