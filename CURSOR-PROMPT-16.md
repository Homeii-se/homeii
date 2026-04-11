# CURSOR-PROMPT-16: Fix effektavgift calculation (top-3 peak averaging)

## Problem
The effektavgift (power charge) is severely underestimated: 3,024 kr/yr vs actual ~7,000-8,000 kr/yr.

**Root cause:** The cost model calculates effektavgift per month using that month's own peak kW. But Swedish grid operators like Ellevio charge based on the **average of the 3 highest monthly peaks**, applied to ALL 12 months. This means winter peaks (~7-8 kW) determine the charge year-round, not summer peaks (~1-2 kW).

Current (wrong): `Σ(monthly_peak_i × 65 × 1.25)` ≈ 3,000 kr
Correct: `avg(top3_peaks) × 65 × 1.25 × 12` ≈ 7,000 kr

## Changes needed

### 1. `app/simulator/simulation/monthly.ts` — Two-pass peak calculation

The function `simulateMonthsWithUpgrades` needs to:
1. First pass: compute all 12 months' raw peaks (peakKw and peakKwBase)
2. Calculate effective peak = average of top 3 monthly peaks
3. Second pass: use this effective peak for ALL months' cost calculations

Replace the current single-pass approach with:

```typescript
export function simulateMonthsWithUpgrades(
  bill: BillData,
  refinement: RefinementAnswers,
  activeUpgrades: ActiveUpgrades,
  seZone: SEZone,
  assumptions?: Assumptions
): MonthlyDataPointExtended[] {
  const year = new Date().getFullYear();
  let seasonFactors = getAdjustedSeasonFactors(refinement, seZone);

  // --- Seasonal consumption calibration ---
  console.log('[CALIBRATION] inputs:', {
    invoicePeriodKwh: bill.invoicePeriodKwh,
    invoiceMonth: bill.invoiceMonth,
    annualKwh: bill.annualKwh,
    factorsBefore: [...seasonFactors],
  });
  if (
    bill.invoicePeriodKwh &&
    bill.invoiceMonth !== undefined &&
    bill.annualKwh &&
    bill.annualKwh > 0
  ) {
    const avgMonthly = bill.annualKwh / 12;
    const actualFactor = bill.invoicePeriodKwh / avgMonthly;
    const modelFactor = seasonFactors[bill.invoiceMonth];

    if (modelFactor > 0 && Math.abs(actualFactor - modelFactor) > 0.1) {
      const calibration = actualFactor / modelFactor;

      for (let i = 0; i < 12; i++) {
        seasonFactors[i] = 1 + (seasonFactors[i] - 1) * calibration;
      }

      const sum = seasonFactors.reduce((s, v) => s + v, 0);
      const scale = 12 / sum;
      for (let i = 0; i < 12; i++) {
        seasonFactors[i] = Math.max(0.15, seasonFactors[i] * scale);
      }
      console.log('[CALIBRATION] applied!', {
        actualFactor,
        modelFactor,
        calibration,
        factorsAfter: [...seasonFactors],
      });
    }
  }

  // Determine contract types
  const baseContract = (refinement.elContractType ?? "monthly") as "dynamic" | "monthly" | "fixed";
  const effectiveContract = activeUpgrades.dynamiskt_elpris
    ? "dynamic" as const
    : baseContract;

  // Check if grid operator uses power charges
  const gridPricing = assumptions?.gridOperator
    ? getGridPricing(assumptions.gridOperator)
    : (bill.natAgare ? getGridPricing(bill.natAgare) : DEFAULT_GRID_PRICING);
  const hasPowerCharge = assumptions?.gridHasPowerCharge ?? gridPricing.hasPowerCharge;

  // ========== PASS 1: Compute raw monthly data (peaks, kWh, etc.) ==========
  const rawMonths = seasonFactors.map((factor, monthIdx) => {
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const repDate = new Date(year, monthIdx, 15);
    const dayData = simulateDay(bill, refinement, repDate, activeUpgrades, seZone, assumptions);
    const dayDataBase = simulateDay(bill, refinement, repDate, NO_UPGRADES, seZone);

    const dailyBase = dayData.reduce((s, d) => s + d.kwhBase, 0);
    const monthlyBase = Math.round(bill.kwhPerMonth * factor);

    // After-upgrades daily totals
    const dailyGridImport = dayData.reduce((s, d) => s + d.gridImportKwh, 0);
    const dailyGridExport = dayData.reduce((s, d) => s + d.gridExportKwh, 0);
    const dailySolar = dayData.reduce((s, d) => s + d.solarProductionKwh, 0);

    // Scale daily values to full month
    const scaleRatio = dailyBase > 0 ? (monthlyBase / (dailyBase * daysInMonth)) * daysInMonth : daysInMonth;
    const monthlyGridImport = Math.round(dailyGridImport * scaleRatio);
    const monthlyGridExport = Math.round(dailyGridExport * scaleRatio);
    const monthlySolar = Math.round(dailySolar * scaleRatio / daysInMonth);
    const monthlyAfter = Math.max(0, Math.round((dailyGridImport - dailyGridExport) * scaleRatio));

    // Peak kW from representative day
    const peakKw = Math.max(...dayData.map((d) => d.gridImportKwh));
    const peakKwBase = Math.max(...dayDataBase.map((d) => d.gridImportKwh));

    // Base scenario scaling
    const dailyBaseKwh = dayDataBase.reduce((s, d) => s + d.kwhBase, 0);
    const dailyBaseGridImport = dayDataBase.reduce((s, d) => s + d.gridImportKwh, 0);
    const dailyBaseGridExport = dayDataBase.reduce((s, d) => s + d.gridExportKwh, 0);
    const baseScaleRatio = dailyBaseKwh > 0
      ? (monthlyBase / (dailyBaseKwh * daysInMonth)) * daysInMonth
      : daysInMonth;
    const monthlyBaseGridImport = Math.round(dailyBaseGridImport * baseScaleRatio);
    const monthlyBaseGridExport = Math.round(dailyBaseGridExport * baseScaleRatio);

    // Hourly spot cost for dynamic contracts
    let hourlySpotCostKrExMoms: number | undefined;
    if (effectiveContract === "dynamic") {
      const dailySpotCostKrExMoms = dayData.reduce(
        (sum, d) => sum + (d.gridImportKwh * d.spotPriceOre / 100), 0
      );
      hourlySpotCostKrExMoms = dailySpotCostKrExMoms * scaleRatio;
    }

    let hourlySpotCostBaseKrExMoms: number | undefined;
    if (baseContract === "dynamic") {
      const dailySpotCostBaseKrExMoms = dayDataBase.reduce(
        (sum, d) => sum + (d.gridImportKwh * d.spotPriceOre / 100), 0
      );
      hourlySpotCostBaseKrExMoms = dailySpotCostBaseKrExMoms * baseScaleRatio;
    }

    // Fixed price derivation
    let fixedPriceOre: number | undefined;
    if (effectiveContract === "fixed" || baseContract === "fixed") {
      const estGridFixed = assumptions?.gridFixedFeeKr ?? gridPricing.fixedFeeKrPerMonth;
      const estTransfer = assumptions?.gridTransferFeeOre ?? gridPricing.transferFeeOrePerKwh;
      const estTax = getEnergyTaxRate(seZone, false);
      const estMarkup = assumptions?.elhandelMarkupOre ?? ELHANDEL_DEFAULTS.avgMarkupOrePerKwh;
      const kwhMonth = bill.kwhPerMonth;
      if (kwhMonth > 0) {
        const costExMoms = bill.costPerMonth / 1.25;
        const gridCostsExMoms = estGridFixed + (kwhMonth * (estTransfer + estTax + estMarkup) / 100);
        const impliedSpotCostExMoms = costExMoms - gridCostsExMoms;
        fixedPriceOre = Math.max(0, (impliedSpotCostExMoms / kwhMonth) * 100);
      }
    }

    return {
      monthIdx,
      factor,
      daysInMonth,
      monthlyBase,
      monthlyAfter,
      monthlySolar,
      monthlyGridImport,
      monthlyGridExport,
      monthlyBaseGridImport,
      monthlyBaseGridExport,
      peakKw,
      peakKwBase,
      hourlySpotCostKrExMoms,
      hourlySpotCostBaseKrExMoms,
      fixedPriceOre,
    };
  });

  // ========== Compute effective peak for effektavgift ==========
  // Swedish grid operators (Ellevio, Vattenfall Eldistribution, E.ON) typically
  // charge effektavgift based on the average of the 3 highest monthly peaks,
  // applied to every month.
  let effectivePeakKw: number;
  let effectivePeakKwBase: number;

  if (hasPowerCharge) {
    const sortedPeaks = rawMonths.map(m => m.peakKw).sort((a, b) => b - a);
    const sortedPeaksBase = rawMonths.map(m => m.peakKwBase).sort((a, b) => b - a);
    const top3 = sortedPeaks.slice(0, 3);
    const top3Base = sortedPeaksBase.slice(0, 3);
    effectivePeakKw = top3.reduce((s, v) => s + v, 0) / 3;
    effectivePeakKwBase = top3Base.reduce((s, v) => s + v, 0) / 3;

    console.log('[EFFEKTAVGIFT] top-3 peaks (after upgrades):', top3, '→ effective:', effectivePeakKw.toFixed(1), 'kW');
    console.log('[EFFEKTAVGIFT] top-3 peaks (base):', top3Base, '→ effective:', effectivePeakKwBase.toFixed(1), 'kW');
  } else {
    effectivePeakKw = 0;
    effectivePeakKwBase = 0;
  }

  // ========== PASS 2: Calculate costs using effective peak ==========
  return rawMonths.map((raw) => {
    const sharedCostInputs = {
      month: raw.monthIdx,
      seZone: seZone as SEZone,
      gridOperator: assumptions?.gridOperator ?? bill.natAgare,
      gridFixedFeeKr: assumptions?.gridFixedFeeKr,
      gridTransferFeeOre: assumptions?.gridTransferFeeOre,
      gridPowerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw,
      gridHasPowerCharge: assumptions?.gridHasPowerCharge,
      elhandelMarkupOre: assumptions?.elhandelMarkupOre,
      elhandelMonthlyFeeKr: assumptions?.elhandelMonthlyFeeKr,
      fixedPriceOre: raw.fixedPriceOre,
    };

    // After-upgrades cost — use effective (top-3 average) peak for effektavgift
    const costBreakdown = calculateMonthlyCost({
      gridImportKwh: raw.monthlyGridImport,
      gridExportKwh: raw.monthlyGridExport,
      peakGridKw: effectivePeakKw,
      elContractType: effectiveContract,
      hourlySpotCostKrExMoms: raw.hourlySpotCostKrExMoms,
      ...sharedCostInputs,
    });

    // Base cost — same effective peak approach
    const costBreakdownBase = calculateMonthlyCost({
      gridImportKwh: raw.monthlyBaseGridImport,
      gridExportKwh: raw.monthlyBaseGridExport,
      peakGridKw: effectivePeakKwBase,
      elContractType: baseContract,
      hourlySpotCostKrExMoms: raw.hourlySpotCostBaseKrExMoms,
      ...sharedCostInputs,
    });

    const costAfter = costBreakdown.totalKr;
    const costBase = costBreakdownBase.totalKr;

    return {
      month: raw.monthIdx,
      label: MONTH_LABELS[raw.monthIdx],
      kwhBase: raw.monthlyBase,
      kwhAfterUpgrades: raw.monthlyAfter,
      solarProductionKwh: raw.monthlySolar,
      gridImportKwh: raw.monthlyGridImport,
      gridExportKwh: raw.monthlyGridExport,
      peakKw: raw.peakKw,
      peakKwBase: raw.peakKwBase,
      costBase,
      costAfterUpgrades: costAfter,
      savingsKr: costBase - costAfter,
      gridFeeCostKr: costBreakdown.gridFixedFeeKr,
      powerFeeCostKr: costBreakdown.gridPowerChargeKr,
      totalCostKr: costAfter,
      totalCostBaseKr: costBase,
      costBreakdown,
      costBreakdownBase,
    };
  });
}
```

### 2. Add missing import in `monthly.ts`

Add `getGridPricing`, `DEFAULT_GRID_PRICING` are already imported. Also need:
```typescript
import { getEnergyTaxRate } from "../data/energy-tax";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";
```
These are already imported — just verify they're present after your changes.

## CRITICAL: Verify no truncation

After making changes, verify these files are complete:
1. `monthly.ts` — must end with `});` then `}` (closing the map and function)
2. Run `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v ".next/" | grep -v "route.ts"` — should be empty

## Expected result
- Effektavgift should go from ~3,000 kr/yr to ~6,000-8,000 kr/yr
- Total annual cost should increase by ~3,000-5,000 kr, landing closer to 38,000-42,000 kr
- Console should show `[EFFEKTAVGIFT] top-3 peaks` with values like 5-8 kW

## DO NOT modify these files:
- `cost-model.ts` — no changes needed
- `types.ts` — no changes needed
- `hourly.ts` — no changes needed
- `bill-parser.ts` — no changes needed
