/**
 * Bill parser — convert LLM extraction results into BillData fields,
 * and merge multiple invoices into a single BillData.
 */

import type { BillData, ElContractType, SEZone } from "../types";
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { calculateSeasonFactors } from "../climate";

/** Shape returned by /api/parse-invoice */
export interface ParsedInvoice {
  invoiceType?: "elhandel" | "elnat" | "combined";
  kwhForPeriod?: number;
  totalCostInklMoms?: number;
  annualKwh?: number;
  seZone?: string;
  natAgare?: string;
  elhandlare?: string;
  contractType?: string;
  spotPriceOreExMoms?: number;
  markupOreExMoms?: number;
  monthlyFeeKrExMoms?: number;
  invoiceMonth?: number;
  invoiceYear?: number;
  gridFixedFeeKrExMoms?: number;
  gridTransferFeeOreExMoms?: number;
  gridPowerChargeKrPerKwExMoms?: number;
  /** Actual average peak kW from the invoice (e.g. Ellevio's "Snitt effekttoppar") */
  gridPeakKw?: number;
  /** Top 3 peak kW values if listed on invoice (e.g. Ellevio's "Dina 3 högsta effekttoppar") */
  gridTop3PeakKw?: number[];
  energyTaxOreExMoms?: number;
  hasProductionRevenue?: boolean;
  solarExportKwh?: number;
  solarExportRevenueKr?: number;
  confidence?: number;
  /** Historical zone-average spot price for the invoice month (öre/kWh exkl moms) — fetched server-side */
  historicalSpotPriceOre?: number;
  /** Delivery address from invoice */
  address?: string;
  /** Street and number portion */
  street?: string;
  /** 5-digit postal code without spaces */
  postalCode?: string;
  /** City name */
  city?: string;
  /** 18-digit anläggnings-ID / mätpunkts-ID, digits only */
  anlaggningsId?: string;
  /** Latitude from geocoded address (server-side) */
  latitude?: number;
  /** Longitude from geocoded address (server-side) */
  longitude?: number;
}

/**
 * Convert a single parsed invoice into partial BillData.
 * Uses annualKwh / 12 as kwhPerMonth if available (more accurate than single-month kWh).
 */
export function parsedInvoiceToBillData(parsed: ParsedInvoice): Partial<BillData> {
  const result: Partial<BillData> = {};

  console.log('[BILL-PARSER] parsedInvoiceToBillData input:', JSON.stringify({
    annualKwh: parsed.annualKwh,
    kwhForPeriod: parsed.kwhForPeriod,
    totalCostInklMoms: parsed.totalCostInklMoms,
    invoiceMonth: parsed.invoiceMonth,
    seZone: parsed.seZone,
    natAgare: parsed.natAgare,
    invoiceType: parsed.invoiceType,
    spotPriceOreExMoms: parsed.spotPriceOreExMoms,
    historicalSpotPriceOre: parsed.historicalSpotPriceOre,
  }));

  // Annual consumption → monthly average (preferred over single-month value)
  if (parsed.annualKwh && parsed.annualKwh > 0) {
    result.annualKwh = parsed.annualKwh;
    result.kwhPerMonth = Math.round(parsed.annualKwh / 12);
    console.log(`[BILL-PARSER] Using annualKwh: ${parsed.annualKwh} → kwhPerMonth: ${result.kwhPerMonth}`);
  } else if (parsed.kwhForPeriod && parsed.kwhForPeriod > 0) {
    // De-seasonalize: a single month's consumption is NOT the annual average.
    // January (peak) treated as average → 50% overestimation.
    // July (trough) treated as average → 40% underestimation.
    // Fix: divide by the neutral season factor for that month.
    if (parsed.invoiceMonth !== undefined) {
      const zone: SEZone = (parsed.seZone as SEZone) ?? "SE3";
      const NEUTRAL_HEATING_SHARE = 0.5;
      const neutralFactors = calculateSeasonFactors(zone, NEUTRAL_HEATING_SHARE);
      const monthFactor = neutralFactors[parsed.invoiceMonth];
      if (monthFactor > 0) {
        result.kwhPerMonth = Math.round(parsed.kwhForPeriod / monthFactor);
        console.log(`[BILL-PARSER] De-seasonalized kwhPerMonth: ${parsed.kwhForPeriod} kWh (month ${parsed.invoiceMonth}, factor ${monthFactor.toFixed(3)}) → ${result.kwhPerMonth} kWh/month avg → ${result.kwhPerMonth * 12} kWh/year`);
      } else {
        result.kwhPerMonth = parsed.kwhForPeriod;
      }
    } else {
      result.kwhPerMonth = parsed.kwhForPeriod;
    }
  }

  // Preserve actual period kWh for seasonal calibration (even when annualKwh is used)
  if (parsed.kwhForPeriod && parsed.kwhForPeriod > 0) {
    result.invoicePeriodKwh = parsed.kwhForPeriod;
  }

  // Total cost → costPerMonth
  if (parsed.totalCostInklMoms && parsed.totalCostInklMoms > 0) {
    result.costPerMonth = Math.round(parsed.totalCostInklMoms);
  }

  // Zone and operators
  if (parsed.seZone && ["SE1", "SE2", "SE3", "SE4"].includes(parsed.seZone)) {
    result.seZone = parsed.seZone as SEZone;
  }
  if (parsed.natAgare) result.natAgare = parsed.natAgare;
  if (parsed.elhandlare) result.elhandlare = parsed.elhandlare;

  // Contract type
  if (parsed.contractType && ["dynamic", "monthly", "fixed"].includes(parsed.contractType)) {
    result.elContractType = parsed.contractType as ElContractType;
  }

  // Elhandel details
  if (parsed.spotPriceOreExMoms !== undefined) result.invoiceSpotPriceOre = parsed.spotPriceOreExMoms;
  if (parsed.markupOreExMoms !== undefined) result.invoiceMarkupOre = parsed.markupOreExMoms;
  if (parsed.monthlyFeeKrExMoms !== undefined) result.invoiceMonthlyFeeKr = parsed.monthlyFeeKrExMoms;
  if (parsed.invoiceMonth !== undefined) result.invoiceMonth = parsed.invoiceMonth;
  if (parsed.invoiceYear !== undefined) result.invoiceYear = parsed.invoiceYear;
  if (parsed.invoiceType === "elhandel" && parsed.totalCostInklMoms) {
    result.invoiceElhandelTotalKr = parsed.totalCostInklMoms;
  }

  // Elnät details
  if (parsed.gridFixedFeeKrExMoms !== undefined) result.gridFixedFeeKr = parsed.gridFixedFeeKrExMoms;
  if (parsed.gridTransferFeeOreExMoms !== undefined) result.gridTransferFeeOre = parsed.gridTransferFeeOreExMoms;
  if (parsed.gridPowerChargeKrPerKwExMoms !== undefined) {
    result.gridPowerChargeKrPerKw = parsed.gridPowerChargeKrPerKwExMoms;
    result.gridHasPowerCharge = true;
  }
  if (parsed.gridPeakKw !== undefined) {
    result.invoicePeakKw = parsed.gridPeakKw;
    console.log(`[BILL-PARSER] Invoice peak kW (snitt): ${parsed.gridPeakKw}`);
  }
  if (parsed.gridTop3PeakKw !== undefined && Array.isArray(parsed.gridTop3PeakKw)) {
    result.invoiceTop3PeakKw = parsed.gridTop3PeakKw;
    console.log(`[BILL-PARSER] Invoice top-3 peaks: ${parsed.gridTop3PeakKw.join(', ')} kW`);
  }
  if (parsed.energyTaxOreExMoms !== undefined) result.invoiceEnergyTaxOre = parsed.energyTaxOreExMoms;
  if (parsed.invoiceType === "elnat" && parsed.totalCostInklMoms) {
    result.invoiceElnatTotalKr = parsed.totalCostInklMoms;
  }

  // Solar
  if (parsed.hasProductionRevenue) result.hasProductionRevenue = true;
  if (parsed.solarExportKwh !== undefined) result.solarExportKwh = parsed.solarExportKwh;
  if (parsed.solarExportRevenueKr !== undefined) result.solarExportRevenueKr = parsed.solarExportRevenueKr;

  // Historical spot price (server-side fetched)
  if (parsed.historicalSpotPriceOre !== undefined) result.historicalSpotPriceOre = parsed.historicalSpotPriceOre;

  // Address fields (from invoice)
  if (parsed.address !== undefined) result.address = parsed.address;
  if (parsed.street !== undefined) result.street = parsed.street;
  if (parsed.postalCode !== undefined) result.postalCode = parsed.postalCode;
  if (parsed.city !== undefined) result.city = parsed.city;
  if (parsed.anlaggningsId !== undefined) result.anlaggningsId = parsed.anlaggningsId;

  // Geocoded coordinates (server-side)
  if (parsed.latitude !== undefined) result.latitude = parsed.latitude;
  if (parsed.longitude !== undefined) result.longitude = parsed.longitude;

  // Metadata
  if (parsed.confidence !== undefined) result.parserConfidence = parsed.confidence;
  if (parsed.invoiceType === "elhandel" || parsed.invoiceType === "elnat") {
    result.uploadedInvoiceTypes = [parsed.invoiceType];
  } else if (parsed.invoiceType === "combined") {
    result.uploadedInvoiceTypes = ["elhandel", "elnat"];
  }

  console.log('[BILL-PARSER] parsedInvoiceToBillData result:', JSON.stringify({
    kwhPerMonth: result.kwhPerMonth,
    annualKwh: result.annualKwh,
    costPerMonth: result.costPerMonth,
    seZone: result.seZone,
    natAgare: result.natAgare,
    invoiceMonth: result.invoiceMonth,
    invoiceSpotPriceOre: result.invoiceSpotPriceOre,
    historicalSpotPriceOre: result.historicalSpotPriceOre,
    uploadedInvoiceTypes: result.uploadedInvoiceTypes,
  }));

  return result;
}

/**
 * Merge new parsed data into existing BillData.
 * New values overwrite old ones where present.
 * uploadedInvoiceTypes is merged (union).
 * costPerMonth: if we have both elhandel and elnät totals, sum them.
 */
export function mergeBillData(existing: BillData, newData: Partial<BillData>): BillData {
  // Merge uploaded invoice types
  const existingTypes = existing.uploadedInvoiceTypes ?? [];
  const newTypes = newData.uploadedInvoiceTypes ?? [];
  const mergedTypes = [...new Set([...existingTypes, ...newTypes])];

  // --- Protect kwhPerMonth/annualKwh from inconsistent data across invoices ---
  //
  // The elnät invoice's "beräknad årsförbrukning" can differ significantly from
  // the elhandel invoice's actual consumption (e.g. Ellevio reports 45,000 kWh
  // while actual is ~23,000 kWh).
  //
  // Three cases:
  // A) Both have annualKwh → keep the LOWER value
  // B) Existing has kwhPerMonth (from actual invoice), new brings annualKwh
  //    that would change kwhPerMonth by >30% → keep existing kwhPerMonth
  // C) Only new has data → accept it (first invoice)
  const bothHaveAnnual =
    existing.annualKwh && existing.annualKwh > 0 &&
    newData.annualKwh && newData.annualKwh > 0;
  const annualConflict = bothHaveAnnual &&
    Math.abs(newData.annualKwh! - existing.annualKwh!) / Math.min(newData.annualKwh!, existing.annualKwh!) > 0.3;

  // Case B: existing has kwhPerMonth but no annualKwh, new brings annualKwh
  const existingHasKwh = existing.kwhPerMonth && existing.kwhPerMonth > 0;
  const newBringsAnnual = newData.annualKwh && newData.annualKwh > 0;
  const newImpliedKwhPerMonth = newBringsAnnual ? Math.round(newData.annualKwh! / 12) : 0;
  const kwhPerMonthConflict = !bothHaveAnnual && existingHasKwh && newBringsAnnual &&
    Math.abs(newImpliedKwhPerMonth - existing.kwhPerMonth!) / Math.min(newImpliedKwhPerMonth, existing.kwhPerMonth!) > 0.3;

  // --- Determine invoice type context for smart merge ---
  const existingIsElhandel = existingTypes.includes("elhandel");
  const newIsElnat = newTypes.includes("elnat");
  const newIsElhandel = newTypes.includes("elhandel");
  const existingIsElnat = existingTypes.includes("elnat");

  // --- Protect elhandel-specific fields from elnät overwrite ---
  // invoiceMonth + invoiceSpotPriceOre MUST correspond to each other (both from
  // the elhandel invoice). If elnät has a different month, it must NOT overwrite
  // invoiceMonth, because that breaks the spotPriceRatio calculation.
  //
  // Similarly, kwhPerMonth from elhandel (paired with spot data for ratio calc)
  // should not be overwritten by elnät's kwhForPeriod from a different month.
  const elhandelFields: Partial<BillData> = {};
  if (existingIsElhandel && newIsElnat) {
    // Preserve elhandel's calibration fields when merging elnät on top
    if (existing.invoiceMonth !== undefined) elhandelFields.invoiceMonth = existing.invoiceMonth;
    if (existing.invoiceYear !== undefined) elhandelFields.invoiceYear = existing.invoiceYear;
    if (existing.invoiceSpotPriceOre !== undefined) elhandelFields.invoiceSpotPriceOre = existing.invoiceSpotPriceOre;
    if (existing.invoiceMarkupOre !== undefined) elhandelFields.invoiceMarkupOre = existing.invoiceMarkupOre;
    if (existing.invoiceMonthlyFeeKr !== undefined) elhandelFields.invoiceMonthlyFeeKr = existing.invoiceMonthlyFeeKr;
    if (existing.historicalSpotPriceOre !== undefined) elhandelFields.historicalSpotPriceOre = existing.historicalSpotPriceOre;
    if (existing.elhandlare) elhandelFields.elhandlare = existing.elhandlare;
    if (existing.elContractType) elhandelFields.elContractType = existing.elContractType;

    // Protect kwhPerMonth if elhandel had it (from a different month than elnät)
    if (existing.kwhPerMonth && existing.kwhPerMonth > 0) {
      elhandelFields.kwhPerMonth = existing.kwhPerMonth;
      if (existing.annualKwh) elhandelFields.annualKwh = existing.annualKwh;
    }

    console.log('[MERGE] protecting elhandel fields from elnät overwrite:', Object.keys(elhandelFields).join(', '));
  }

  // Build merged object — spread newData over existing, then restore protected fields
  const merged: BillData = {
    ...existing,
    ...newData,
    ...elhandelFields,
    uploadedInvoiceTypes: mergedTypes.length > 0 ? (mergedTypes as ("elhandel" | "elnat")[]) : undefined,
  };

  // --- kwhPerMonth/annualKwh conflict resolution (same-type merges) ---
  // Only applies when both invoices are the same type or neither is elnät-protected above.

  // Case A: Both have annualKwh → keep the LOWER value
  if (annualConflict) {
    const keepExisting = existing.annualKwh! <= newData.annualKwh!;
    const kept = keepExisting ? existing.annualKwh! : newData.annualKwh!;
    const rejected = keepExisting ? newData.annualKwh! : existing.annualKwh!;
    console.log('[MERGE] annualKwh conflict (case A): keeping', kept, ', rejecting', rejected);
    merged.annualKwh = kept;
    merged.kwhPerMonth = Math.round(kept / 12);
  }
  // Case B: New annualKwh would inflate existing kwhPerMonth — reject it
  else if (kwhPerMonthConflict) {
    console.log('[MERGE] kwhPerMonth conflict (case B): keeping existing kwhPerMonth', existing.kwhPerMonth,
      ', rejecting annualKwh', newData.annualKwh, '(implied', newImpliedKwhPerMonth, '/mo)');
    merged.kwhPerMonth = existing.kwhPerMonth!;
    merged.annualKwh = existing.kwhPerMonth! * 12;
  }

  // Case C: Existing has annualized kwhPerMonth (from annualKwh), new brings only
  // a single-period kwhPerMonth (no annualKwh). A single winter month like January
  // can be 2x the annual average — don't let it overwrite the annualized value.
  const existingHasAnnualized = existing.annualKwh && existing.annualKwh > 0 && existing.kwhPerMonth && existing.kwhPerMonth > 0;
  const newHasOnlyPeriodKwh = !newData.annualKwh && newData.kwhPerMonth && newData.kwhPerMonth > 0;
  if (existingHasAnnualized && newHasOnlyPeriodKwh && !annualConflict && !kwhPerMonthConflict) {
    console.log('[MERGE] protecting annualized kwhPerMonth (case C): keeping', existing.kwhPerMonth,
      ', ignoring period kwhPerMonth', newData.kwhPerMonth);
    merged.kwhPerMonth = existing.kwhPerMonth!;
    merged.annualKwh = existing.annualKwh!;
  }

  // --- When elhandel arrives AFTER elnät, elhandel should take priority for
  // calibration fields (invoiceMonth, spotPrice, kwhPerMonth). The spread
  // already does this (newData overwrites existing), but we need to make sure
  // elnät's kwhPerMonth doesn't stick around if elhandel brings a better one.
  if (existingIsElnat && newIsElhandel && !existingIsElhandel) {
    if (newData.invoiceMonth !== undefined) merged.invoiceMonth = newData.invoiceMonth;
    if (newData.invoiceYear !== undefined) merged.invoiceYear = newData.invoiceYear;
    if (newData.kwhPerMonth && newData.kwhPerMonth > 0) {
      merged.kwhPerMonth = newData.kwhPerMonth;
      if (newData.annualKwh) merged.annualKwh = newData.annualKwh;
    }
    console.log('[MERGE] elhandel arrived after elnät — elhandel calibration fields take priority');
  }

  // If we have both elhandel and elnät totals, compute combined monthly cost
  const elhandelTotal = merged.invoiceElhandelTotalKr ?? newData.invoiceElhandelTotalKr ?? existing.invoiceElhandelTotalKr;
  const elnatTotal = merged.invoiceElnatTotalKr ?? newData.invoiceElnatTotalKr ?? existing.invoiceElnatTotalKr;
  if (elhandelTotal && elnatTotal) {
    merged.costPerMonth = Math.round(elhandelTotal + elnatTotal);
  }

  // Preserve invoicePeriodKwh from whichever invoice has it
  if (newData.invoicePeriodKwh) {
    merged.invoicePeriodKwh = newData.invoicePeriodKwh;
  } else if (existing.invoicePeriodKwh && !newData.invoicePeriodKwh) {
    merged.invoicePeriodKwh = existing.invoicePeriodKwh;
  }

  // Calculate spot price ratio (smartness factor) if we have enough data
  console.log('[MERGE] ratio inputs:', {
    invoiceSpotPriceOre: merged.invoiceSpotPriceOre,
    invoiceMonth: merged.invoiceMonth,
    seZone: merged.seZone,
  });
  merged.spotPriceRatio = calculateSpotPriceRatio(merged);
  console.log('[MERGE] spotPriceRatio result:', merged.spotPriceRatio);

  return merged;
}

/**
 * Calculate the user's "spot price ratio" — how their actual spot price
 * compares to the zone average for that month.
 *
 * ratio < 1.0 → user pays less than average (smart consumption, e.g. EV night charging)
 * ratio = 1.0 → average consumption pattern
 * ratio > 1.0 → user consumes more during expensive hours
 *
 * Only meaningful for dynamic (timpris) contracts where hourly prices vary.
 * For monthly/fixed contracts we still compute it as a price correction factor
 * (our model's spot data vs the invoice's actual spot price).
 */
export function calculateSpotPriceRatio(bill: BillData): number | undefined {
  if (bill.invoiceMonth === undefined || !bill.seZone) return undefined;

  // Case A: No invoice spot price (elnät-only) — use historical zone average
  // as a price-level correction so we don't apply 2026 forecast prices to a
  // 2025 invoice. This doesn't capture user behavior (smart/dumb), only the
  // price level difference.
  if (bill.invoiceSpotPriceOre === undefined || bill.invoiceSpotPriceOre <= 0) {
    if (bill.historicalSpotPriceOre && bill.historicalSpotPriceOre > 0) {
      const forecastPrice = SE_ZONE_SPOT_PRICE[bill.seZone]?.[bill.invoiceMonth];
      if (forecastPrice && forecastPrice > 0) {
        const ratio = bill.historicalSpotPriceOre / forecastPrice;
        if (ratio >= 0.3 && ratio <= 3.0) {
          console.log('[SMARTNESS] price-level ratio (no elhandel):', ratio.toFixed(3),
            '(historical:', bill.historicalSpotPriceOre, 'öre, forecast:', forecastPrice, 'öre,',
            'month:', bill.invoiceMonth, ', zone:', bill.seZone, ')');
          return Math.round(ratio * 1000) / 1000;
        }
      }
    }
    return undefined;
  }

  // Case B: Have invoice spot price (elhandel uploaded) — compare user's actual
  // price against reference (historical preferred, forecast fallback).

  // Prefer historical (actual) spot price for the invoice month/year.
  // Fall back to forecast data only if historical is unavailable.
  let referencePrice: number | undefined;
  let source: string;

  if (bill.historicalSpotPriceOre && bill.historicalSpotPriceOre > 0) {
    referencePrice = bill.historicalSpotPriceOre;
    source = "historical";
  } else {
    const zoneSpotPrices = SE_ZONE_SPOT_PRICE[bill.seZone];
    if (zoneSpotPrices) {
      referencePrice = zoneSpotPrices[bill.invoiceMonth];
      source = "forecast";
    } else {
      return undefined;
    }
  }

  if (!referencePrice || referencePrice <= 0) return undefined;

  const ratio = bill.invoiceSpotPriceOre / referencePrice;

  // Sanity check: ratio should be between 0.3 and 3.0
  // Outside this range, the data is likely wrong
  if (ratio < 0.3 || ratio > 3.0) {
    console.log('[SMARTNESS] ratio out of range:', ratio, '— ignoring');
    return undefined;
  }

  console.log('[SMARTNESS] spotPriceRatio:', ratio.toFixed(3),
    '(invoice:', bill.invoiceSpotPriceOre, 'öre, reference:', referencePrice, 'öre [' + source + '],',
    'month:', bill.invoiceMonth, ', zone:', bill.seZone, ')');

  return Math.round(ratio * 1000) / 1000; // 3 decimal precision
}

// ============================================================
// Extraction validation
// ============================================================

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate extracted invoice data for structural consistency.
 *
 * Returns { ok: true } if data looks reliable enough to use.
 * Returns { ok: false, issues } if the extraction is too unreliable —
 * the UI should ask the user to re-upload or enter data manually.
 *
 * Checks performed:
 * 1. Must have EITHER annualKwh or kwhForPeriod — without consumption
 *    data we can't calculate anything.
 * 2. kwhForPeriod reasonableness — Swedish households use 200–6 000 kWh/month.
 *    Values outside this range likely mean the LLM grabbed a wrong number.
 * 3. Cost-per-kWh cross-check — if we have both totalCostInklMoms and kWh,
 *    the implied price should be 0.50–5.00 kr/kWh inkl moms. Outside this
 *    range, one of the values is probably wrong.
 * 4. annualKwh vs kwhForPeriod consistency — if both exist, the period value
 *    should be 3–25% of the annual value (one month out of twelve, with
 *    seasonal variation).
 */
export function validateExtraction(parsed: ParsedInvoice): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Must have some consumption data
  const hasAnnual = parsed.annualKwh !== undefined && parsed.annualKwh > 0;
  const hasPeriod = parsed.kwhForPeriod !== undefined && parsed.kwhForPeriod > 0;

  if (!hasAnnual && !hasPeriod) {
    issues.push({
      severity: "error",
      field: "kwhForPeriod",
      message: "Kunde inte avläsa förbrukning (kWh) från fakturan.",
    });
  }

  // 2. kwhForPeriod reasonableness (if present)
  if (hasPeriod) {
    const kwh = parsed.kwhForPeriod!;
    if (kwh < 200 || kwh > 6000) {
      issues.push({
        severity: "error",
        field: "kwhForPeriod",
        message: `Avläst förbrukning (${Math.round(kwh)} kWh) verkar orimlig för en månad. Normalt 200–6 000 kWh.`,
      });
    }
  }

  // 2b. annualKwh reasonableness (if present)
  if (hasAnnual) {
    const annual = parsed.annualKwh!;
    if (annual < 2000 || annual > 80000) {
      issues.push({
        severity: "error",
        field: "annualKwh",
        message: `Avläst årsförbrukning (${Math.round(annual).toLocaleString("sv-SE")} kWh) verkar orimlig. Normalt 2 000–80 000 kWh/år.`,
      });
    }
  }

  // 3. Cost-per-kWh cross-check
  // Thresholds depend on invoice type:
  //   - "combined": 0.80–3.50 kr/kWh typical (elhandel + elnät + skatt)
  //   - "elhandel": 0.15–2.50 kr/kWh typical (only spot + markup + fee)
  //   - "elnat":    0.15–2.00 kr/kWh typical (only grid fees + tax)
  // Over the high threshold → kWh value is probably wrong (LLM grabbed wrong number).
  // Under the low threshold → cost or kWh may be misread.
  if (parsed.totalCostInklMoms && parsed.totalCostInklMoms > 0) {
    const kwhRef = hasPeriod ? parsed.kwhForPeriod! :
      hasAnnual ? parsed.annualKwh! / 12 : 0;
    if (kwhRef > 0) {
      const costPerKwh = parsed.totalCostInklMoms / kwhRef;
      const isPartialInvoice = parsed.invoiceType === "elhandel" || parsed.invoiceType === "elnat";
      const highThreshold = isPartialInvoice ? 3.0 : 4.0;
      const lowThreshold = isPartialInvoice ? 0.15 : 0.5;

      if (costPerKwh > highThreshold) {
        issues.push({
          severity: "error",
          field: "totalCostInklMoms",
          message: `Avläst kostnad per kWh (${costPerKwh.toFixed(1)} kr/kWh) är orimligt hög${isPartialInvoice ? ` för en ${parsed.invoiceType}-faktura` : ""}. Troligen avlästes fel värde som förbrukning.`,
        });
      } else if (costPerKwh < lowThreshold) {
        issues.push({
          severity: "warning",
          field: "totalCostInklMoms",
          message: `Avläst kostnad per kWh (${costPerKwh.toFixed(1)} kr/kWh) är ovanligt låg${isPartialInvoice ? ` för en ${parsed.invoiceType}-faktura` : ""}.`,
        });
      }
    }
  }

  // 4. annualKwh vs kwhForPeriod consistency
  if (hasAnnual && hasPeriod) {
    const ratio = parsed.kwhForPeriod! / parsed.annualKwh!;
    if (ratio > 0.25 || ratio < 0.03) {
      issues.push({
        severity: "warning",
        field: "annualKwh",
        message: `Periodförbrukning (${Math.round(parsed.kwhForPeriod!)} kWh) och årsförbrukning (${Math.round(parsed.annualKwh!)} kWh) stämmer dåligt överens.`,
      });
    }
  }

  // 5. Field-specific unit/range validation (catches LLM unit confusions)
  issues.push(...validateFieldRanges(parsed));
  // Determine overall result: any "error" → not ok
  const hasError = issues.some((i) => i.severity === "error");

  return {
    ok: !hasError,
    issues,
  };
}

/**
 * Field-specific unit and range validation.
 *
 * Catches LLM misreads where the VALUE is syntactically valid but semantically
 * absurd — usually from unit confusion (öre vs kr, öre/kWh vs kr/kWh) or from
 * the model grabbing the wrong field entirely (e.g. totalCostInklMoms as monthly fee).
 *
 * Ranges are based on Swedish electricity market realities (2024–2026).
 * "error" = value is almost certainly wrong; UI should block or demand re-upload.
 * "warning" = value is unusual but plausible; show to user, don't block.
 */
export function validateFieldRanges(parsed: ParsedInvoice): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // --- spotPrice (öre/kWh ex moms) ---
  if (parsed.spotPriceOreExMoms !== undefined) {
    const v = parsed.spotPriceOreExMoms;
    if (v < 5 || v > 1500) {
      issues.push({
        severity: "error",
        field: "spotPriceOreExMoms",
        message: `Spotpris ${v} öre/kWh är utanför rimligt intervall (5–1500 öre). Troligen fel enhet eller fel fält avläst.`,
      });
    } else if (v > 300) {
      issues.push({
        severity: "warning",
        field: "spotPriceOreExMoms",
        message: `Spotpris ${v} öre/kWh är ovanligt högt — dubbelkolla.`,
      });
    }
  }

  // --- markup (påslag, öre/kWh ex moms) ---
  if (parsed.markupOreExMoms !== undefined) {
    const v = parsed.markupOreExMoms;
    if (v < 0) {
      issues.push({
        severity: "error",
        field: "markupOreExMoms",
        message: `Negativt påslag (${v} öre/kWh) är orimligt.`,
      });
    } else if (v > 50) {
      issues.push({
        severity: "warning",
        field: "markupOreExMoms",
        message: `Påslag ${v} öre/kWh är ovanligt högt — dubbelkolla enhet.`,
      });
    }
  }

  // --- monthlyFee (månadsavgift, kr ex moms) ---
  if (parsed.monthlyFeeKrExMoms !== undefined) {
    const v = parsed.monthlyFeeKrExMoms;
    if (v < 0) {
      issues.push({
        severity: "error",
        field: "monthlyFeeKrExMoms",
        message: `Negativ månadsavgift (${v} kr) är orimlig.`,
      });
    } else if (v > 200) {
      issues.push({
        severity: "warning",
        field: "monthlyFeeKrExMoms",
        message: `Månadsavgift ${v} kr är ovanligt hög — möjligen totalkostnad avläst som månadsavgift.`,
      });
    }
  }

  // --- gridTransferFee (elöverföring, öre/kWh ex moms) ---
  // Operatörer med effektbaserad tariff kan ha mycket låg per-kWh-del (~1-3 öre);
  // huvudkostnaden ligger då i gridPowerCharge eller gridFixedFee.
  if (parsed.gridTransferFeeOreExMoms !== undefined) {
    const v = parsed.gridTransferFeeOreExMoms;
    if (v < 1 || v > 150) {
      issues.push({
        severity: "error",
        field: "gridTransferFeeOreExMoms",
        message: `Elöverföringsavgift ${v} öre/kWh är utanför rimligt intervall (1–150 öre). Troligen fel enhet (öre vs kr).`,
      });
    } else if (v < 5 || v > 100) {
      issues.push({
        severity: "warning",
        field: "gridTransferFeeOreExMoms",
        message: `Elöverföringsavgift ${v} öre/kWh är ovanlig — dubbelkolla.`,
      });
    }
  }

  // --- gridFixedFee (nätabonnemang, kr ex moms per månad) ---
  if (parsed.gridFixedFeeKrExMoms !== undefined) {
    const v = parsed.gridFixedFeeKrExMoms;
    if (v < 0) {
      issues.push({
        severity: "error",
        field: "gridFixedFeeKrExMoms",
        message: `Negativt nätabonnemang (${v} kr) är orimligt.`,
      });
    } else if (v > 800) {
      issues.push({
        severity: "warning",
        field: "gridFixedFeeKrExMoms",
        message: `Nätabonnemang ${v} kr/mån är ovanligt högt — dubbelkolla.`,
      });
    }
  }

  // --- gridPowerCharge (effektavgift, kr/kW ex moms) ---
  if (parsed.gridPowerChargeKrPerKwExMoms !== undefined) {
    const v = parsed.gridPowerChargeKrPerKwExMoms;
    if (v < 0) {
      issues.push({
        severity: "error",
        field: "gridPowerChargeKrPerKwExMoms",
        message: `Negativ effektavgift (${v} kr/kW) är orimlig.`,
      });
    } else if (v > 200) {
      issues.push({
        severity: "warning",
        field: "gridPowerChargeKrPerKwExMoms",
        message: `Effektavgift ${v} kr/kW är ovanligt hög — dubbelkolla enhet.`,
      });
    }
  }

  // --- energyTax (energiskatt, öre/kWh ex moms) ---
  // Standardskatt ~47 öre/kWh, men norrlandsrabatten (Norrbotten, Västerbotten,
  // Jämtland, Västernorrland) ger 9.6 öre/kWh — därför 5 öre som lower bound.
  if (parsed.energyTaxOreExMoms !== undefined) {
    const v = parsed.energyTaxOreExMoms;
    if (v < 5 || v > 70) {
      issues.push({
        severity: "error",
        field: "energyTaxOreExMoms",
        message: `Energiskatt ${v} öre/kWh ligger utanför reglerat intervall (5–70 öre). Troligen fel fält avläst.`,
      });
    }
  }

  // --- gridPeakKw (effekttopp, kW) ---
  if (parsed.gridPeakKw !== undefined) {
    const v = parsed.gridPeakKw;
    if (v < 0) {
      issues.push({
        severity: "error",
        field: "gridPeakKw",
        message: `Negativ effekttopp (${v} kW) är orimlig.`,
      });
    } else if (v < 0.5 || v > 50) {
      issues.push({
        severity: "warning",
        field: "gridPeakKw",
        message: `Effekttopp ${v} kW är utanför typiskt hushållsintervall (0.5–50 kW).`,
      });
    }
  }

  return issues;
}