export type HousingType = "villa" | "radhus" | "lagenhet";
export type HeatingType = "direktel" | "luftluft" | "luftvatten" | "fjarrvarme" | "bergvarme";
export type ElCarStatus = "ja" | "nej" | "planerar";
export type Period = "dag" | "manad" | "ar";
export type ChartUnit = "kwh" | "kw" | "sek";
export type SEZone = "SE1" | "SE2" | "SE3" | "SE4";
export type BigConsumer = "elbil" | "pool" | "spabad" | "bastu";
export type ElContractType = "dynamic" | "monthly" | "fixed";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface InferredValue<T> {
  value: T;
  confidence: ConfidenceLevel;
  reasoning: string;
}

export interface InferredProfile {
  seZone: InferredValue<SEZone>;
  housingType: InferredValue<HousingType>;
  heatingTypes: InferredValue<HeatingType[]>;
  area: InferredValue<number>;
  residents: InferredValue<number>;
  hasSolar: InferredValue<boolean>;
}

export type UpgradeId =
  | "solceller"
  | "batteri"
  | "luftluft"
  | "luftvatten"
  | "bergvarme"
  | "tillaggsisolering"
  | "eldstad"
  | "smartstyrning"
  | "varmvattenpump"
  | "fonsterbyte"
  | "dynamiskt_elpris";

export type ActiveUpgrades = Record<UpgradeId, boolean>;

export interface UpgradeDefinition {
  id: UpgradeId;
  label: string;
  description: string;
  investmentCostSEK: number;
  lifespanYears: number;
  incompatibleWith?: UpgradeId[];
  requires?: UpgradeId;
  icon: string;
}

export interface BillData {
  // --- Core (required) ---
  kwhPerMonth: number;
  costPerMonth: number;

  // --- From invoice header (either elnät or elhandel) ---
  natAgare?: string;
  annualKwh?: number;
  seZone?: SEZone;
  elhandlare?: string;

  // --- From elhandel invoice ---
  elContractType?: ElContractType;
  /** Volume-weighted avg spot price for the invoiced month (öre/kWh exkl moms) */
  invoiceSpotPriceOre?: number;
  /** Elhandlarens påslag — total of rörliga + fasta (öre/kWh exkl moms) */
  invoiceMarkupOre?: number;
  /** Elhandlarens månadsavgift (kr exkl moms) */
  invoiceMonthlyFeeKr?: number;
  /** Invoice period month (0-11) — to calibrate season */
  invoiceMonth?: number;
  /** Invoice period year (e.g. 2025) — needed for historical spot price lookup */
  invoiceYear?: number;
  /** Actual kWh consumed in the invoice period (for calibrating seasonal profile) */
  invoicePeriodKwh?: number;
  /** Invoice total for elhandel only (kr inkl moms) */
  invoiceElhandelTotalKr?: number;

  // --- From elnät invoice ---
  /** Fast nätavgift (kr/mån exkl moms) */
  gridFixedFeeKr?: number;
  /** Överföringsavgift (öre/kWh exkl moms) */
  gridTransferFeeOre?: number;
  /** Effektavgift (kr/kW/mån exkl moms) */
  gridPowerChargeKrPerKw?: number;
  /** Does this grid operator charge effektavgift? */
  gridHasPowerCharge?: boolean;
  /** Energiskatt from invoice (öre/kWh exkl moms) */
  invoiceEnergyTaxOre?: number;
  /** Actual average peak kW from invoice (e.g. Ellevio "Snitt effekttoppar") */
  invoicePeakKw?: number;
  /** Top 3 peak kW values from invoice (e.g. Ellevio "Dina 3 högsta effekttoppar") */
  invoiceTop3PeakKw?: number[];
  /** Elnät invoice total (kr inkl moms) */
  invoiceElnatTotalKr?: number;

  // --- Location (from geocoding) ---
  /** Latitude from geocoded address */
  latitude?: number;
  /** Longitude from geocoded address */
  longitude?: number;

  // --- Solar indicators ---
  hasProductionRevenue?: boolean;
  hasDualMeteringIds?: boolean;
  /** Export kWh from production meter */
  solarExportKwh?: number;
  /** Export revenue (kr) */
  solarExportRevenueKr?: number;

  // --- Derived analytics ---
  /** Ratio of user's actual spot price vs zone average for the invoice month.
   *  < 1.0 = user pays less than average (smart consumption pattern)
   *  = 1.0 = average
   *  > 1.0 = user pays more than average
   *  Only meaningful for dynamic (timpris) contracts. */
  spotPriceRatio?: number;
  /** Historical zone-average spot price for the invoice month/year (öre/kWh exkl moms).
   *  Fetched from elprisetjustnu.se. Used as the denominator for spotPriceRatio. */
  historicalSpotPriceOre?: number;

  // --- Metadata ---
  /** Which invoice types have been uploaded */
  uploadedInvoiceTypes?: ("elhandel" | "elnat")[];
  /** Parser confidence 0-1 */
  parserConfidence?: number;
}

export interface RefinementAnswers {
  housingType?: HousingType;
  area?: number;
  heatingType?: HeatingType;
  heatingTypes?: HeatingType[];
  residents?: number;
  elCar?: ElCarStatus;
  bigConsumers?: BigConsumer[];
  hasSolar?: boolean;
  solarSizeKw?: number;
  hasBattery?: boolean;
  batterySizeKwh?: number;
  elContractType?: ElContractType;
}

export interface Assumptions {
  // Equipment sizing
  solarSizeKw: number;
  batterySizeKwh: number;

  // Elnät — populated from grid operator lookup or elnätsfaktura
  gridOperator?: string;
  gridFixedFeeKr?: number;          // kr/mån exkl moms
  gridTransferFeeOre?: number;      // öre/kWh exkl moms
  gridHasPowerCharge?: boolean;
  gridPowerChargeKrPerKw?: number;  // kr/kW exkl moms

  // Elhandel
  elhandelMarkupOre?: number;       // öre/kWh exkl moms
  elhandelMonthlyFeeKr?: number;    // kr/mån exkl moms

  // --- Variant overrides (from upgrade-variants.ts) ---
  /** Override COP curve for the active heat pump: [outdoorTemp°C, COP][] */
  copCurveOverride?: [number, number][];
  /** Override heating coverage for heat pump (0-1, e.g. 0.7 for luft-luft) */
  heatingCoverageOverride?: number;
  /** Override reduction factors per upgrade type */
  reductionOverrides?: Record<string, number>;

  // Legacy fields — kept for backwards compatibility with existing state
  /** @deprecated Use gridFixedFeeKr instead */
  gridFeeKrPerMonth: number;
  /** @deprecated Use gridPowerChargeKrPerKw instead */
  powerFeeKrPerKw: number;
}

export interface ScoreBreakdown {
  total: number;
  priceScore: number;
  consumptionScore: number;
  peakScore: number;
  optimizationScore: number;
  grade: string;
  color: string;
  message: string;
}

export interface Recommendation {
  upgradeId: UpgradeId;
  rank: number;
  yearlySavingsKr: number;
  investmentKr: number;
  paybackYears: number;
  reasoning: string;
  kwhReductionPercent: number;
  peakReductionPercent: number;
  isTopPick: boolean;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  score: ScoreBreakdown;
  scoreAfterAll: ScoreBreakdown;
  totalYearlySavingsKr: number; // Combined savings from all recommendations (not sum of individual)
}

export interface SimulatorState {
  completedStep: number; // 0=landing, 1=upload, 2=profile, 3=recommendations, 4=dashboard
  billData?: BillData;
  refinement: RefinementAnswers;
  answeredQuestions: number;
  seZone: SEZone;
  activeUpgrades: ActiveUpgrades;
  selectedDate: string; // ISO date string YYYY-MM-DD
  assumptions: Assumptions;
  recommendations?: RecommendationResult;
  inferredProfile?: InferredProfile;
}

export interface HourlyDataPoint {
  hour: number;
  kwh: number;
}

export interface HourlyDataPointExtended {
  hour: number;
  kwhBase: number;
  kwhAfterUpgrades: number;
  solarProductionKwh: number;
  batteryChargeKwh: number;
  batteryStateKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  costOre: number;
  spotPriceOre: number;
}

export interface MonthlyDataPoint {
  month: number;
  label: string;
  kwh: number;
  cost: number;
}

export interface MonthlyDataPointExtended {
  month: number;
  label: string;
  kwhBase: number;
  kwhAfterUpgrades: number;
  solarProductionKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  peakKw: number;
  peakKwBase: number;
  costBase: number;                 // kr inkl moms (total)
  costAfterUpgrades: number;        // kr inkl moms (total) — alias for backwards compat
  savingsKr: number;                // kr inkl moms
  /** @deprecated Use costBreakdown.gridFixedFeeKr */
  gridFeeCostKr: number;
  /** @deprecated Use costBreakdown.gridPowerChargeKr */
  powerFeeCostKr: number;
  /** @deprecated Use costBreakdown.totalKr */
  totalCostKr: number;
  /** @deprecated Use costBreakdownBase.totalKr */
  totalCostBaseKr: number;
  /** Detailed cost breakdown from new cost model */
  costBreakdown: MonthlyCostBreakdown;
  /** Detailed cost breakdown for base scenario (no upgrades) */
  costBreakdownBase: MonthlyCostBreakdown;
}

import type { MonthlyCostBreakdown, AnnualCostBreakdown } from "./simulation/cost-model";

export interface YearlyDataPoint {
  year: number;
  label: string;
  kwh: number;
  cost: number;
  isEstimate: boolean;
}

/** Aggregated annual cost breakdown for display — 7 components */
export interface AnnualCostComponents {
  spotCostKr: number;
  markupCostKr: number;
  elhandelMonthlyFeeKr: number;
  gridFixedFeeKr: number;
  gridTransferFeeKr: number;
  gridPowerChargeKr: number;
  energyTaxKr: number;
  exportRevenueKr: number;
  /** Estimated annual export kWh (for display — may not always be set) */
  exportKwh?: number;
  totalKr: number;
}

export interface ScenarioDetail {
  yearlyKwh: number;
  yearlyCostKr: number;
  yearlyTotalCostKr: number;
  costComponents: AnnualCostComponents;
  monthlyKwh?: number[];
  monthlyPeakKw?: number[];
}

export interface ThreeScenarioSummary {
  withoutInvestments: ScenarioDetail;
  currentSituation: ScenarioDetail;
  afterRecommendations: ScenarioDetail;
  existingSavingsKr: number;
  potentialSavingsKr: number;
}

export interface AnnualSummary {
  yearlyKwhBase: number;
  yearlyKwhAfter: number;
  yearlyEnergyCostBase: number;
  yearlyEnergyCostAfter: number;
  yearlyGridFeeCost: number;
  yearlyPowerFeeCostBase: number;
  yearlyPowerFeeCostAfter: number;
  yearlyTotalCostBase: number;
  yearlyTotalCostAfter: number;
  totalInvestmentCost: number;
  paybackYears: number;
  solarProductionYearlyKwh: number;
  annualCostBreakdown: AnnualCostBreakdown;
}

export interface DataSource {
  type: string;
  timestamp: string;
  confidence?: number;
}

export interface HouseholdProfile {
  monthlyKwh: number;
  monthlyCostKr: number;
  annualKwh: number;
  housingType: HousingType;
  heatingTypes: HeatingType[];
  areaM2: number;
  residents: number;
  seZone: SEZone;
  gridOperator?: string;
  gridFeeMonthlyKr: number;
  powerFeePerKw: number;
  elContractType: ElContractType;
  bigConsumers: BigConsumer[];
  hasElbil: boolean;
  hasSolar: boolean;
  solarSizeKw?: number;
  hasBattery: boolean;
  batterySizeKwh?: number;
}