import { describe, expect, it } from "vitest";
import { calculateMonthlyCost } from "./cost-model";

describe("calculateMonthlyCost", () => {
  it("calculates expected monthly breakdown with explicit overrides", () => {
    const result = calculateMonthlyCost({
      gridImportKwh: 1000,
      gridExportKwh: 100,
      peakGridKw: 5,
      month: 0,
      seZone: "SE3",
      spotPriceOre: 100,
      elhandelMarkupOre: 10,
      elhandelMonthlyFeeKr: 50,
      gridFixedFeeKr: 200,
      gridTransferFeeOre: 20,
      gridPowerChargeKrPerKw: 30,
      gridHasPowerCharge: true,
      energyTaxOre: 40,
      elContractType: "monthly",
    });

    expect(result.spotCostKr).toBe(1250);
    expect(result.markupCostKr).toBe(125);
    expect(result.elhandelMonthlyFeeKr).toBe(63);
    expect(result.totalElhandelKr).toBe(1438);
    expect(result.gridFixedFeeKr).toBe(250);
    expect(result.gridTransferFeeKr).toBe(250);
    expect(result.gridPowerChargeKr).toBe(188);
    expect(result.energyTaxKr).toBe(500);
    expect(result.totalElnatKr).toBe(1188);
    expect(result.exportRevenueKr).toBe(-100);
    expect(result.totalKr).toBe(2525);
  });

  it("uses hourly spot cost for dynamic contracts when provided", () => {
    const dynamic = calculateMonthlyCost({
      gridImportKwh: 800,
      gridExportKwh: 0,
      peakGridKw: 0,
      month: 3,
      seZone: "SE3",
      spotPriceOre: 300,
      hourlySpotCostKrExMoms: 500,
      elContractType: "dynamic",
      gridHasPowerCharge: false,
      gridFixedFeeKr: 0,
      gridTransferFeeOre: 0,
      energyTaxOre: 0,
      elhandelMarkupOre: 0,
      elhandelMonthlyFeeKr: 0,
    });

    expect(dynamic.spotCostKr).toBe(625);
  });

  it("uses fixedPriceOre for fixed contracts", () => {
    const fixed = calculateMonthlyCost({
      gridImportKwh: 1000,
      gridExportKwh: 0,
      peakGridKw: 0,
      month: 5,
      seZone: "SE3",
      fixedPriceOre: 60,
      spotPriceOre: 180,
      elContractType: "fixed",
      gridHasPowerCharge: false,
      gridFixedFeeKr: 0,
      gridTransferFeeOre: 0,
      energyTaxOre: 0,
      elhandelMarkupOre: 0,
      elhandelMonthlyFeeKr: 0,
    });

    expect(fixed.spotCostKr).toBe(750);
    expect(fixed.effectiveSpotOre).toBe(60);
  });

  it("falls back to spotPriceOre when dynamic hourly cost is missing", () => {
    const dynamicFallback = calculateMonthlyCost({
      gridImportKwh: 1000,
      gridExportKwh: 0,
      peakGridKw: 0,
      month: 6,
      seZone: "SE3",
      spotPriceOre: 120,
      elContractType: "dynamic",
      gridHasPowerCharge: false,
      gridFixedFeeKr: 0,
      gridTransferFeeOre: 0,
      energyTaxOre: 0,
      elhandelMarkupOre: 0,
      elhandelMonthlyFeeKr: 0,
    });

    expect(dynamicFallback.spotCostKr).toBe(1500);
    expect(dynamicFallback.effectiveSpotOre).toBe(120);
  });

  it("keeps effective total ore at 0 when there is no grid import", () => {
    const zeroImport = calculateMonthlyCost({
      gridImportKwh: 0,
      gridExportKwh: 200,
      peakGridKw: 0,
      month: 4,
      seZone: "SE3",
      spotPriceOre: 100,
      gridHasPowerCharge: false,
      gridFixedFeeKr: 0,
      gridTransferFeeOre: 0,
      energyTaxOre: 0,
      elhandelMarkupOre: 0,
      elhandelMonthlyFeeKr: 0,
    });

    expect(zeroImport.effectiveTotalOrePerKwh).toBe(0);
  });
});
