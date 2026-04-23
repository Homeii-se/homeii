import { describe, expect, it } from "vitest";
import { simulate8760Consumption, simulate8760WithSolar } from "./simulate8760";
import type { BillData, RefinementAnswers } from "../types";
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
});
