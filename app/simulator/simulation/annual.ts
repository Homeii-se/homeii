/**
 * Annual-level calculations — price per kWh, yearly estimates,
 * zero-equipment reversal, and annual summary.
 */

import type {
  BillData,
  RefinementAnswers,
  YearlyDataPoint,
  AnnualSummary,
  ActiveUpgrades,
  Assumptions,
  SEZone,
} from "../types";
import { UPGRADE_DEFINITIONS } from "../data/upgrade-catalog";
import { getZoneClimate } from "../climate";
import { getBlendedHeatingShare, getHeatPumpCOP, getAdjustedSeasonFactors } from "./upgrades";
import { simulateMonthsWithUpgrades } from "./monthly";
import type { AnnualCostBreakdown } from "./cost-model";
import { getAnnualAvgSpotOre } from "../data/energy-prices";
import { getEnergyTaxRateForYear } from "../data/energy-tax";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";
import { DEFAULT_GRID_PRICING, getGridPricing } from "../data/grid-operators";

/** Första år vi har historisk data för (Supabase + ENTSO-E). */
const HISTORICAL_FROM_YEAR = 2020;
/** Antal år framåt vi prognostiserar bortom innevarande år. */
const FORECAST_YEARS_AHEAD = 1;
/** Årlig prisuppräkning för år bortom 2026 (innan vi har terminspriser). */
const ANNUAL_PRICE_ESCALATION = 1.03;

/**
 * Årsspecifika förbrukningsmultiplikatorer baserade på SMHI:s
 * Heating Degree Days-data (HDD) för Sverige. Värdet 1.00 = "typiskt år".
 *
 * Implementerar att kalla år ger högre elförbrukning (mer uppvärmning) och
 * milda år ger lägre. Variationen är dämpad till ~±5% eftersom hushållets
 * grunduppvärmning bara är ~50-70% av total förbrukning — resten
 * (varmvatten, hushållsel, EV-laddning) är temperaturoberoende.
 *
 * @source SMHI Klimatindikatorer / HDD-statistik per år, normaliserad
 *   mot 1991-2020 medelvärde och vägd med typisk svensk villas
 *   uppvärmningsandel.
 */
const ANNUAL_CONSUMPTION_MULTIPLIER: Record<number, number> = {
  2020: 0.96, // Rekordmild vinter, varm vår
  2021: 1.00, // Normalt år, kall februari kompenserad av mild höst
  2022: 0.98, // Slightly mild
  2023: 0.95, // Varmt år
  2024: 1.01, // Närmare normalt, något kallare slutet av året
  2025: 1.03, // Kall vinter / kall vår
  2026: 1.00, // Innevarande år — antas normalt
  2027: 1.00, // Prognos — antas normalt
};

export function calculatePricePerKwh(bill: BillData): number {
  if (bill.kwhPerMonth <= 0) return 0;
  return bill.costPerMonth / bill.kwhPerMonth;
}

export function calculateDailyKwh(bill: BillData): number {
  return bill.kwhPerMonth / 30;
}

export function calculateYearlyKwh(bill: BillData): number {
  return bill.kwhPerMonth * 12;
}

/**
 * Estimate what the user's consumption would be WITHOUT their existing equipment.
 *
 * The bill kwhPerMonth represents the user's ACTUAL consumption (with existing
 * heat pumps, solar, etc already active). To correctly model "without investments"
 * we need to reverse-engineer the zero-equipment baseline.
 *
 * Returns a synthetic BillData with inflated kwhPerMonth and costPerMonth.
 */
export function estimateZeroEquipmentBill(
  bill: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone
): BillData {
  let inflationFactor = 1.0;

  // 1. Reverse heat pump COP effect on the heating portion
  const heatingTypes = refinement.heatingTypes ?? (refinement.heatingType ? [refinement.heatingType] : []);
  const heatPumpTypes = heatingTypes.filter(
    (ht): ht is "luftluft" | "luftvatten" | "bergvarme" =>
      ht === "luftluft" || ht === "luftvatten" || ht === "bergvarme"
  );

  if (heatPumpTypes.length > 0) {
    const totalHeatingShare = getBlendedHeatingShare(heatingTypes) ?? 0.5;
    const nonPumpTypes = heatingTypes.filter(ht => ht !== "luftluft" && ht !== "luftvatten" && ht !== "bergvarme");
    let pumpFractionOfHeating = 1.0;
    if (nonPumpTypes.length > 0 && heatPumpTypes.length > 0) {
      pumpFractionOfHeating = heatPumpTypes.length === 1 && nonPumpTypes.length === 1 ? 0.65 : 0.5;
    }

    const zoneClimate = getZoneClimate(seZone);
    let totalCOP = 0;
    let heatingMonths = 0;
    for (let m = 0; m < 12; m++) {
      const temp = zoneClimate.monthlyTemp[m];
      if (temp < 17) {
        const primaryPump = heatPumpTypes[0];
        totalCOP += getHeatPumpCOP(primaryPump, temp);
        heatingMonths++;
      }
    }
    const avgCOP = heatingMonths > 0 ? totalCOP / heatingMonths : 2.5;

    const heatingByPumpShare = totalHeatingShare * pumpFractionOfHeating;
    inflationFactor = heatingByPumpShare * (avgCOP - 1) + 1;
  }

  // 2. Reverse solar self-consumption effect
  if (refinement.hasSolar) {
    const solarSizeKw = refinement.solarSizeKw ?? 10;
    const zoneClimate = getZoneClimate(seZone);
    const yearlyProduction = zoneClimate.solarMonthly10kw.reduce((s, v) => s + v, 0) * (solarSizeKw / 10);
    const selfConsumptionRate = refinement.hasBattery ? 0.60 : 0.30;
    const monthlySelfConsumed = (yearlyProduction * selfConsumptionRate) / 12;
    const inflatedKwh = bill.kwhPerMonth * inflationFactor;
    inflationFactor = (inflatedKwh + monthlySelfConsumed) / bill.kwhPerMonth;
  }

  return {
    ...bill,
    kwhPerMonth: Math.round(bill.kwhPerMonth * inflationFactor),
    costPerMonth: Math.round(bill.costPerMonth * inflationFactor),
    annualKwh: bill.annualKwh
      ? Math.round(bill.annualKwh * inflationFactor)
      : undefined,
  };
}

/**
 * Returnera ett 8-årigt fönster av årsförbrukning + årskostnad: 2020 →
 * (innevarande år + 1).
 *
 * För varje år beräknas kostnaden som:
 *   total_kr = årlig_kWh × (spot_öre + skatt_öre + transferFee_öre + markup_öre) / 100
 *            + grid_fixed_fee_kr × 12
 *            + elhandel_monthly_fee_kr × 12
 *
 * Där komponenterna kommer från:
 *  - **Spot**: ENTSO-E månadsmedel (verkligt utfall) för 2020-2025; nuvarande
 *    prognos (terminspriser) för 2026; 2026 × 1.03 för 2027.
 *  - **Energiskatt**: Årsspecifik från Skatteverkets historik (2020-2025 verkligt,
 *    2026 sänkt till 36, 2027 antar oförändrat).
 *  - **Transferfee, markup, fasta avgifter**: Användarens nuvarande nätbolag och
 *    elhandlare (samma alla år — historiska nätbolagsavgifter publiceras inte
 *    enhetligt). Detta ger ~1-5% felmarginal på totalkostnaden men fångar
 *    huvudvariansen som kommer från spot+skatt.
 *
 * Förbrukning är konstant över alla år (visualiserar priseffekten isolerat).
 *
 * `isEstimate=false` markerar innevarande år (matchar fakturan); alla andra
 * år är härledda och markeras `isEstimate=true`.
 */
export function getYearlyData(
  bill: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone = "SE3"
): YearlyDataPoint[] {
  const currentYear = new Date().getFullYear();

  // Användarens TMY-justerade årsförbrukning (kWh)
  const seasonFactors = getAdjustedSeasonFactors(refinement, seZone);
  const annualKwh = seasonFactors.reduce(
    (sum, f) => sum + bill.kwhPerMonth * f,
    0
  );

  // Hämta användarens NUVARANDE elhandel- och nätbolagsdata från fakturan.
  // Dessa antas oförändrade över alla år i jämförelsen.
  const transferFeeOre = bill.gridTransferFeeOre
    ?? (bill.natAgare ? getGridPricing(bill.natAgare).transferFeeOrePerKwh : DEFAULT_GRID_PRICING.transferFeeOrePerKwh);
  const markupOre = bill.invoiceMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh;
  const gridFixedFeeKr = bill.gridFixedFeeKr
    ?? (bill.natAgare ? getGridPricing(bill.natAgare).fixedFeeKrPerMonth : DEFAULT_GRID_PRICING.fixedFeeKrPerMonth);
  const elhandelMonthlyFeeKr = bill.invoiceMonthlyFeeKr ?? ELHANDEL_DEFAULTS.avgMonthlyFeeKr;

  const result: YearlyDataPoint[] = [];

  for (let year = HISTORICAL_FROM_YEAR; year <= currentYear + FORECAST_YEARS_AHEAD; year++) {
    // Spotpris-komponent
    let spotOre: number;
    let isEstimate = true;

    if (year >= HISTORICAL_FROM_YEAR && year <= 2026) {
      // Direkt från historisk/prognos-tabell
      const spot = getAnnualAvgSpotOre(year, seZone);
      // Fallback till 2026-prognos om något saknas
      spotOre = spot ?? (getAnnualAvgSpotOre(2026, seZone) ?? 60);
    } else {
      // För år bortom 2026: applicera årlig uppräkning från 2026-basen
      const base = getAnnualAvgSpotOre(2026, seZone) ?? 60;
      const yearsBeyond2026 = year - 2026;
      spotOre = base * Math.pow(ANNUAL_PRICE_ESCALATION, yearsBeyond2026);
    }

    if (year === currentYear) {
      isEstimate = false; // Innevarande år matchar fakturan
    }

    const taxOre = getEnergyTaxRateForYear(year, seZone);

    // Årsspecifik förbrukning baserat på temperatur (kalla år → mer uppvärmning)
    const consumptionMultiplier = ANNUAL_CONSUMPTION_MULTIPLIER[year] ?? 1.0;
    const yearKwh = annualKwh * consumptionMultiplier;

    // Kostnad per kWh för det här året (öre/kWh exkl moms)
    const variableOrePerKwh = spotOre + taxOre + transferFeeOre + markupOre;
    const variableCostKr = (yearKwh * variableOrePerKwh) / 100;
    const fixedCostKr = (gridFixedFeeKr + elhandelMonthlyFeeKr) * 12;
    const totalCostKr = variableCostKr + fixedCostKr;

    result.push({
      year,
      label: `${year}`,
      kwh: Math.round(yearKwh),
      cost: Math.round(totalCostKr),
      isEstimate,
    });
  }

  return result;
}

export function getPrecision(answeredQuestions: number): number {
  return Math.min(100, 40 + answeredQuestions * 12);
}

/** Calculate annual summary with investment costs and payback.
 *  @param skipInflation — if true, use the bill as-is (for nuläge scenario
 *  where the invoice kWh already reflects actual grid consumption). */
export function calculateAnnualSummary(
  bill: BillData,
  refinement: RefinementAnswers,
  activeUpgrades: ActiveUpgrades,
  seZone: SEZone,
  assumptions?: Assumptions,
  skipInflation?: boolean
): AnnualSummary {
  // When skipInflation is false (default), inflate the bill to a zero-equipment
  // baseline so the simulation can model "without investments" and "with upgrades".
  // When true (nuläge), use the actual invoice kWh directly.
  const effectiveBill = skipInflation
    ? bill
    : estimateZeroEquipmentBill(bill, refinement, seZone);
  const monthlyData = simulateMonthsWithUpgrades(effectiveBill, refinement, activeUpgrades, seZone, assumptions);

  // Aggregate from monthly cost breakdowns (new cost model)
  const yearlyKwhBase = monthlyData.reduce((s, m) => s + m.kwhBase, 0);
  const yearlyKwhAfter = monthlyData.reduce((s, m) => s + m.kwhAfterUpgrades, 0);
  const yearlyEnergyCostBase = monthlyData.reduce((s, m) => s + m.costBase, 0);
  const yearlyEnergyCostAfter = monthlyData.reduce((s, m) => s + m.costAfterUpgrades, 0);
  const yearlyGridFeeCost = monthlyData.reduce((s, m) => s + m.gridFeeCostKr, 0);
  const yearlyPowerFeeCostBase = monthlyData.reduce((s, m) => s + m.costBreakdownBase.gridPowerChargeKr, 0);
  const yearlyPowerFeeCostAfter = monthlyData.reduce((s, m) => s + m.powerFeeCostKr, 0);
  const yearlyTotalCostBase = monthlyData.reduce((s, m) => s + m.totalCostBaseKr, 0);
  const yearlyTotalCostAfter = monthlyData.reduce((s, m) => s + m.totalCostKr, 0);

  // Total investment
  const totalInvestmentCost = UPGRADE_DEFINITIONS.filter(
    (u) => activeUpgrades[u.id]
  ).reduce((s, u) => s + u.investmentCostSEK, 0);

  // Payback based on total savings (incl. grid + power fee)
  const yearlySavings = yearlyTotalCostBase - yearlyTotalCostAfter;
  const paybackYears =
    yearlySavings > 0 ? totalInvestmentCost / yearlySavings : 0;

  // Solar production (scaled by system size and zone)
  const solarScale = (assumptions?.solarSizeKw ?? 10) / 10;
  const zoneClimate = getZoneClimate(seZone);
  const solarProductionYearlyKwh = activeUpgrades.solceller
    ? Math.round(zoneClimate.solarMonthly10kw.reduce((s, v) => s + v, 0) * solarScale)
    : 0;

  // Build annual cost breakdown from monthly breakdowns
  const monthlyBreakdowns = monthlyData.map((m) => m.costBreakdown);

  const annualCostBreakdown: AnnualCostBreakdown = {
          months: monthlyBreakdowns,
          totalElhandelKr: monthlyBreakdowns.reduce((s, m) => s + m.totalElhandelKr, 0),
          totalElnatKr: monthlyBreakdowns.reduce((s, m) => s + m.totalElnatKr, 0),
          totalExportRevenueKr: monthlyBreakdowns.reduce((s, m) => s + m.exportRevenueKr, 0),
          totalKr: monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0),
          avgMonthlyKr: Math.round(monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0) / 12),
          effectiveOrePerKwh: yearlyKwhAfter > 0
            ? Math.round((monthlyBreakdowns.reduce((s, m) => s + m.totalKr, 0) / yearlyKwhAfter) * 100 * 10) / 10
            : 0,
  };

  return {
    yearlyKwhBase,
    yearlyKwhAfter,
    yearlyEnergyCostBase,
    yearlyEnergyCostAfter,
    yearlyGridFeeCost,
    yearlyPowerFeeCostBase,
    yearlyPowerFeeCostAfter,
    yearlyTotalCostBase,
    yearlyTotalCostAfter,
    totalInvestmentCost,
    paybackYears: Math.round(paybackYears * 10) / 10,
    solarProductionYearlyKwh,
    annualCostBreakdown,
  };
}