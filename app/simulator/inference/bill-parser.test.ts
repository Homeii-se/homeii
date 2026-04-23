import { describe, expect, it } from "vitest";
import { calculateSeasonFactors } from "../climate";
import {
  calculateSpotPriceRatio,
  mergeBillData,
  parsedInvoiceToBillData,
  validateExtraction,
  type ParsedInvoice,
} from "./bill-parser";
import type { BillData } from "../types";

describe("parsedInvoiceToBillData", () => {
  it("prioritizes annualKwh over single period kWh", () => {
    const parsed: ParsedInvoice = {
      annualKwh: 24000,
      kwhForPeriod: 3200,
      totalCostInklMoms: 3200,
      seZone: "SE3",
    };

    const result = parsedInvoiceToBillData(parsed);
    expect(result.annualKwh).toBe(24000);
    expect(result.kwhPerMonth).toBe(2000);
    expect(result.invoicePeriodKwh).toBe(3200);
    expect(result.costPerMonth).toBe(3200);
  });

  it("de-seasonalizes kwhForPeriod when invoice month exists", () => {
    const parsed: ParsedInvoice = {
      kwhForPeriod: 3000,
      invoiceMonth: 0,
      seZone: "SE3",
    };

    const result = parsedInvoiceToBillData(parsed);
    const factors = calculateSeasonFactors("SE3", 0.5);
    const expected = Math.round(3000 / factors[0]);

    expect(result.kwhPerMonth).toBe(expected);
  });
});

describe("mergeBillData", () => {
  it("protects elhandel calibration fields when merging elnat data", () => {
    const existing: BillData = {
      kwhPerMonth: 1800,
      costPerMonth: 2500,
      annualKwh: 21600,
      uploadedInvoiceTypes: ["elhandel"],
      invoiceMonth: 1,
      invoiceYear: 2025,
      invoiceSpotPriceOre: 95,
      historicalSpotPriceOre: 100,
      elContractType: "dynamic",
      elhandlare: "Tibber",
    };

    const incoming: Partial<BillData> = {
      uploadedInvoiceTypes: ["elnat"],
      invoiceMonth: 3,
      invoiceYear: 2026,
      kwhPerMonth: 2500,
      annualKwh: 30000,
      invoiceElnatTotalKr: 900,
      invoiceElhandelTotalKr: 1500,
    };

    const merged = mergeBillData(existing, incoming);

    expect(merged.invoiceMonth).toBe(1);
    expect(merged.invoiceYear).toBe(2025);
    expect(merged.invoiceSpotPriceOre).toBe(95);
    expect(merged.kwhPerMonth).toBe(1800);
    expect(merged.annualKwh).toBe(21600);
    expect(merged.costPerMonth).toBe(2400);
    expect(merged.uploadedInvoiceTypes).toEqual(["elhandel", "elnat"]);
  });

  it("keeps the lower annualKwh on large conflict", () => {
    const existing: BillData = {
      kwhPerMonth: 1500,
      costPerMonth: 2000,
      annualKwh: 18000,
      uploadedInvoiceTypes: ["elnat"],
    };
    const incoming: Partial<BillData> = {
      annualKwh: 36000,
      uploadedInvoiceTypes: ["elnat"],
    };

    const merged = mergeBillData(existing, incoming);
    expect(merged.annualKwh).toBe(18000);
    expect(merged.kwhPerMonth).toBe(1500);
  });

  it("protects annualized kwhPerMonth against single-period overwrite", () => {
    const existing: BillData = {
      kwhPerMonth: 2000,
      costPerMonth: 2600,
      annualKwh: 24000,
      uploadedInvoiceTypes: ["elnat"],
    };
    const incoming: Partial<BillData> = {
      kwhPerMonth: 2600,
      uploadedInvoiceTypes: ["elnat"],
    };

    const merged = mergeBillData(existing, incoming);
    expect(merged.kwhPerMonth).toBe(2000);
    expect(merged.annualKwh).toBe(24000);
  });

  it("prioritizes elhandel calibration fields when elhandel arrives after elnat", () => {
    const existing: BillData = {
      kwhPerMonth: 1700,
      costPerMonth: 2500,
      uploadedInvoiceTypes: ["elnat"],
      invoiceMonth: 0,
      seZone: "SE3",
    };
    const incoming: Partial<BillData> = {
      uploadedInvoiceTypes: ["elhandel"],
      invoiceMonth: 2,
      invoiceYear: 2025,
      invoiceSpotPriceOre: 110,
      kwhPerMonth: 1500,
      annualKwh: 18000,
    };

    const merged = mergeBillData(existing, incoming);
    expect(merged.invoiceMonth).toBe(2);
    expect(merged.invoiceYear).toBe(2025);
    expect(merged.kwhPerMonth).toBe(1500);
    expect(merged.annualKwh).toBe(18000);
    expect(merged.uploadedInvoiceTypes).toEqual(["elnat", "elhandel"]);
  });
});

describe("validation and ratio", () => {
  it("flags missing consumption as error", () => {
    const result = validateExtraction({ totalCostInklMoms: 1000 });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("calculates spot ratio from historical price when spot is missing", () => {
    const ratio = calculateSpotPriceRatio({
      kwhPerMonth: 1000,
      costPerMonth: 1500,
      seZone: "SE3",
      invoiceMonth: 0,
      historicalSpotPriceOre: 80,
    });

    expect(ratio).toBeTypeOf("number");
    expect(ratio).toBeGreaterThan(0);
  });

  it("returns undefined spot ratio for out-of-range values", () => {
    const ratio = calculateSpotPriceRatio({
      kwhPerMonth: 1000,
      costPerMonth: 1500,
      seZone: "SE3",
      invoiceMonth: 0,
      invoiceSpotPriceOre: 1000,
      historicalSpotPriceOre: 100,
    });

    expect(ratio).toBeUndefined();
  });

  it("flags suspiciously high cost per kWh as extraction error", () => {
    const result = validateExtraction({
      invoiceType: "combined",
      kwhForPeriod: 200,
      totalCostInklMoms: 2000,
    });

    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.field === "totalCostInklMoms" && i.severity === "error")
    ).toBe(true);
  });
});
