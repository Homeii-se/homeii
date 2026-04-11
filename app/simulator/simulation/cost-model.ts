/**
 * Cost model — calculates real electricity costs for Swedish households.
 *
 * Models the ACTUAL invoice structure:
 * 1. Elhandel: spotpris + påslag + månadsavgift
 * 2. Elnät: fast avgift + överföring + effektavgift + energiskatt
 * 3. Moms: 25% on everything
 * 4. Solproduktion: intäkt från exporterad el
 *
 * @source Swedish invoice structure, verified against real Ellevio/Tibber/Soldags invoices
 * @updated 2026-04-04
 */

import type { SEZone } from "../types";
import { SE_ZONE_SPOT_PRICE } from "../data/energy-prices";
import { getGridPricing, DEFAULT_GRID_PRICING } from "../data/grid-operators";
import { getEnergyTaxRate } from "../data/energy-tax";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";

const VAT = 1.25;

/**
 * All inputs needed to calculate monthly cost.
 * Some fields are optional — the model fills in defaults.
 */
export interface MonthlyCostInput {
  /** kWh consumed from grid this month */
  gridImportKwh: number;
  /** kWh exported to grid this month (solar surplus) */
  gridExportKwh: number;
  /** Peak power draw from grid this month (kW) */
  peakGridKw: number;
  /** Month index 0-11 */
  month: number;
  /** SE zone */
  seZone: SEZone;

  // --- Optional overrides (from elnätsfaktura or user input) ---
  /** Grid operator name — used to look up pricing */
  gridOperator?: string;
  /** Override: fixed grid fee (kr/mån exkl moms) */
  gridFixedFeeKr?: number;
  /** Override: transfer fee (öre/kWh exkl moms) */
  gridTransferFeeOre?: number;
  /** Override: power charge (kr/kW exkl moms) — set to 0 if not applicable */
  gridPowerChargeKrPerKw?: number;
  /** Override: does this grid operator have power charges? */
  gridHasPowerCharge?: boolean;
  /** Override: energy tax (öre/kWh exkl moms) */
  energyTaxOre?: number;
  /** Override: elhandel markup (öre/kWh exkl moms) */
  elhandelMarkupOre?: number;
  /** Override: elhandel monthly fee (kr/mån exkl moms) */
  elhandelMonthlyFeeKr?: number;
  /** Override: spot price for this month (öre/kWh exkl moms) */
  spotPriceOre?: number;

  // --- Contract-type-aware pricing ---
  /** User's electricity contract type */
  elContractType?: "dynamic" | "monthly" | "fixed";
  /** For dynamic contracts: pre-calculated hourly spot cost for this month (kr, EXKL moms).
   *  This is Σ(hourly_gridImport × hourly_spot / 100) from the hourly simulation.
   *  If provided and contract is dynamic, this replaces kWh × avg_spot. */
  hourlySpotCostKrExMoms?: number;
  /** For fixed contracts: the user's locked price (öre/kWh exkl moms).
   *  If not provided, we derive it from the bill. */
  fixedPriceOre?: number;
}

/**
 * Detailed cost breakdown for one month.
 * All values in kr, inkl moms unless noted.
 */
export interface MonthlyCostBreakdown {
  // --- Elhandel ---
  /** Spotpris × kWh (inkl moms) */
  spotCostKr: number;
  /** Elhandlarens påslag × kWh (inkl moms) */
  markupCostKr: number;
  /** Elhandlarens månadsavgift (inkl moms) */
  elhandelMonthlyFeeKr: number;
  /** Summa elhandel (inkl moms) */
  totalElhandelKr: number;

  // --- Elnät ---
  /** Fast nätavgift (inkl moms) */
  gridFixedFeeKr: number;
  /** Rörlig överföringsavgift (inkl moms) */
  gridTransferFeeKr: number;
  /** Effektavgift (inkl moms) — 0 om nätägaren inte har det */
  gridPowerChargeKr: number;
  /** Energiskatt (inkl moms) */
  energyTaxKr: number;
  /** Summa elnät (inkl moms) */
  totalElnatKr: number;

  // --- Produktion ---
  /** Intäkt från exporterad el (negativt = intäkt) */
  exportRevenueKr: number;

  // --- Totalt ---
  /** Total månadskostnad (inkl moms, efter exportintäkt) */
  totalKr: number;

  // --- Metadata ---
  /** Effective spot price used (öre/kWh exkl moms) */
  effectiveSpotOre: number;
  /** Total effective price per kWh inkl allt (öre/kWh inkl moms) */
  effectiveTotalOrePerKwh: number;
  /** Grid import this month */
  gridImportKwh: number;
  /** Peak kW this month */
  peakGridKw: number;
}

/**
 * Calculate the full monthly cost for a Swedish household.
 *
 * This function mirrors the actual Swedish invoice structure:
 * - Elhandel: spot + markup + monthly fee
 * - Elnät: fixed + transfer + power charge + energy tax
 * - Production: export revenue
 * - VAT: 25% on everything
 */
export function calculateMonthlyCost(input: MonthlyCostInput): MonthlyCostBreakdown {
  const {
    gridImportKwh,
    gridExportKwh,
    peakGridKw,
    month,
    seZone,
  } = input;

  // --- Resolve pricing ---
  const gridPricing = input.gridOperator
    ? getGridPricing(input.gridOperator)
    : DEFAULT_GRID_PRICING;

  const spotPriceOre = input.spotPriceOre
    ?? SE_ZONE_SPOT_PRICE[seZone]?.[month]
    ?? 80; // fallback

  const markupOre = input.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh;
  const elhandelFee = input.elhandelMonthlyFeeKr ?? ELHANDEL_DEFAULTS.avgMonthlyFeeKr;

  const gridFixedFee = input.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth;
  const transferFee = input.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh;
  const hasPowerCharge = input.gridHasPowerCharge ?? gridPricing.hasPowerCharge;
  const powerCharge = hasPowerCharge
    ? (input.gridPowerChargeKrPerKw ?? gridPricing.powerChargeKrPerKw)
    : 0;
  const energyTax = input.energyTaxOre ?? getEnergyTaxRate(seZone, false);

  // --- Elhandel: spot/energy cost depends on contract type ---
  const contractType = input.elContractType ?? "monthly";
  let spotCostKr: number;

  if (contractType === "dynamic" && input.hourlySpotCostKrExMoms !== undefined) {
    // Dynamic (timpris): use pre-calculated hourly cost from simulation
    spotCostKr = input.hourlySpotCostKrExMoms * VAT;
  } else if (contractType === "fixed") {
    // Fixed price: use locked price instead of spot
    const effectiveFixedPrice = input.fixedPriceOre ?? spotPriceOre;
    spotCostKr = (gridImportKwh * effectiveFixedPrice / 100) * VAT;
  } else {
    // Monthly average (rörligt) or fallback: kWh × monthly avg spot
    spotCostKr = (gridImportKwh * spotPriceOre / 100) * VAT;
  }
  const markupCostKr = (gridImportKwh * markupOre / 100) * VAT;
  const elhandelMonthlyFeeKr = elhandelFee * VAT;
  const totalElhandelKr = spotCostKr + markupCostKr + elhandelMonthlyFeeKr;

  // --- Elnät ---
  const gridFixedFeeKr = gridFixedFee * VAT;
  const gridTransferFeeKr = (gridImportKwh * transferFee / 100) * VAT;
  const gridPowerChargeKr = (peakGridKw * powerCharge) * VAT;
  const energyTaxKr = (gridImportKwh * energyTax / 100) * VAT;
  const totalElnatKr = gridFixedFeeKr + gridTransferFeeKr + gridPowerChargeKr + energyTaxKr;

  // --- Export revenue ---
  const exportRevenueKr = -(gridExportKwh * spotPriceOre * ELHANDEL_DEFAULTS.productionCompensationRate / 100) * VAT;

  // --- Total ---
  const totalKr = totalElhandelKr + totalElnatKr + exportRevenueKr;

  // --- Metadata ---
  const effectiveTotalOrePerKwh = gridImportKwh > 0
    ? (totalKr / gridImportKwh) * 100
    : 0;

  return {
    spotCostKr: Math.round(spotCostKr),
    markupCostKr: Math.round(markupCostKr),
    elhandelMonthlyFeeKr: Math.round(elhandelMonthlyFeeKr),
    totalElhandelKr: Math.round(totalElhandelKr),
    gridFixedFeeKr: Math.round(gridFixedFeeKr),
    gridTransferFeeKr: Math.round(gridTransferFeeKr),
    gridPowerChargeKr: Math.round(gridPowerChargeKr),
    energyTaxKr: Math.round(energyTaxKr),
    totalElnatKr: Math.round(totalElnatKr),
    exportRevenueKr: Math.round(exportRevenueKr),
    totalKr: Math.round(totalKr),
    effectiveSpotOre: contractType === "dynamic" && input.hourlySpotCostKrExMoms !== undefined
      ? (gridImportKwh > 0 ? (input.hourlySpotCostKrExMoms / gridImportKwh) * 100 : spotPriceOre)
      : (contractType === "fixed" ? (input.fixedPriceOre ?? spotPriceOre) : spotPriceOre),
    effectiveTotalOrePerKwh: Math.round(effectiveTotalOrePerKwh * 10) / 10,
    gridImportKwh,
    peakGridKw,
  };
}

/**
 * Calculate annual cost from 12 monthly breakdowns.
 */
export interface AnnualCostBreakdown {
  months: MonthlyCostBreakdown[];
  totalElhandelKr: number;
  totalElnatKr: number;
  totalExportRevenueKr: number;
  totalKr: number;
  avgMonthlyKr: number;
  effectiveOrePerKwh: number;
  /** Estimated annual export kWh — injected by scenarios.ts for solar export display */
  totalExportKwh?: number;
}

export function calculateAnnualCost(
  monthlyInputs: MonthlyCostInput[]
): AnnualCostBreakdown {
  const months = monthlyInputs.map(calculateMonthlyCost);

  const totalElhandelKr = months.reduce((s, m) => s + m.totalElhandelKr, 0);
  const totalElnatKr = months.reduce((s, m) => s + m.totalElnatKr, 0);
  const totalExportRevenueKr = months.reduce((s, m) => s + m.exportRevenueKr, 0);
  const totalKr = months.reduce((s, m) => s + m.totalKr, 0);
  const totalKwh = months.reduce((s, m) => s + m.gridImportKwh, 0);

  return {
    months,
    totalElhandelKr,
    totalElnatKr,
    totalExportRevenueKr,
    totalKr,
    avgMonthlyKr: Math.round(totalKr / 12),
    effectiveOrePerKwh: totalKwh > 0 ? Math.round((totalKr / totalKwh) * 100 * 10) / 10 : 0,
  };
}
