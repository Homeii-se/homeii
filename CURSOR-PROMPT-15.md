# CURSOR-PROMPT-15: Calibrate seasonal consumption from invoice data

## Problem
The seasonal consumption model underestimates winter usage. For Gustaf's house:
- Model January: ~2,935 kWh (season factor 1.51, heatingShare ~0.5)
- Actual January: 3,748 kWh (season factor 1.93)

This 22% underestimate cascades into:
1. **Lower effektavgift**: Model peak ~6.5 kW vs actual ~9.5 kW → effektavgift off by ~3,500 kr/yr
2. **Lower winter spot costs**: Undercounting kWh in expensive months
3. **Lower energiskatt**: Less kWh = less tax

## Solution: Calibrate season factors from invoice kWh
Same approach as spot price calibration (PROMPT-14): use the one real data point (invoice month's actual kWh) to stretch the seasonal curve.

## Changes — 3 files

### 1. `app/simulator/types.ts` — Add field to BillData

After `invoiceMonth?: number;` (~line 72), add:

```typescript
  invoiceMonth?: number;
  /** Actual kWh consumed in the invoice period (for calibrating seasonal profile) */
  invoicePeriodKwh?: number;
```

### 2. `app/simulator/inference/bill-parser.ts` — Preserve actual month kWh

Currently (line 40-45), when `annualKwh` exists, `kwhForPeriod` is discarded. Change to preserve both:

Replace:
```typescript
  // Annual consumption → monthly average (preferred over single-month value)
  if (parsed.annualKwh && parsed.annualKwh > 0) {
    result.annualKwh = parsed.annualKwh;
    result.kwhPerMonth = Math.round(parsed.annualKwh / 12);
  } else if (parsed.kwhForPeriod && parsed.kwhForPeriod > 0) {
    result.kwhPerMonth = parsed.kwhForPeriod;
  }
```

With:
```typescript
  // Annual consumption → monthly average (preferred over single-month value)
  if (parsed.annualKwh && parsed.annualKwh > 0) {
    result.annualKwh = parsed.annualKwh;
    result.kwhPerMonth = Math.round(parsed.annualKwh / 12);
  } else if (parsed.kwhForPeriod && parsed.kwhForPeriod > 0) {
    result.kwhPerMonth = parsed.kwhForPeriod;
  }

  // Preserve actual period kWh for seasonal calibration (even when annualKwh is used)
  if (parsed.kwhForPeriod && parsed.kwhForPeriod > 0) {
    result.invoicePeriodKwh = parsed.kwhForPeriod;
  }
```

### 3. `app/simulator/simulation/monthly.ts` — Calibrate season factors

In `simulateMonthsWithUpgrades`, AFTER the `seasonFactors` are calculated (~line 50), add a calibration block:

```typescript
  const seasonFactors = getAdjustedSeasonFactors(refinement, seZone);

  // --- Seasonal consumption calibration ---
  // If we have actual kWh for a specific month from the invoice, use it to
  // calibrate the seasonal curve. This corrects for houses with steeper
  // winter/summer ratios than the generic model assumes.
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
      // Stretch the deviation from 1.0 by the calibration ratio
      // e.g., if model says Jan=1.51 but actual is 1.93:
      //   calibration = 1.93/1.51 = 1.28
      //   new deviation for each month = old deviation × 1.28
      const calibration = actualFactor / modelFactor;

      for (let i = 0; i < 12; i++) {
        seasonFactors[i] = 1 + (seasonFactors[i] - 1) * calibration;
      }

      // Renormalize so that annual total kWh is preserved
      // (12 factors should average to 1.0, i.e., sum to 12)
      const sum = seasonFactors.reduce((s, v) => s + v, 0);
      const scale = 12 / sum;
      for (let i = 0; i < 12; i++) {
        seasonFactors[i] = Math.max(0.15, seasonFactors[i] * scale);
      }
    }
  }
```

**IMPORTANT:** This block must go AFTER `getAdjustedSeasonFactors()` but BEFORE the `return seasonFactors.map(...)` call. The `seasonFactors` variable is already a `let`-bound array from the `const` call — change the declaration from `const` to `let` if needed:

```typescript
  let seasonFactors = getAdjustedSeasonFactors(refinement, seZone);
```

## How it works

Example with Gustaf's data:
- annualKwh: 23,265 → avgMonthly: 1,939
- invoicePeriodKwh: 3,411 (February from Green Hero), invoiceMonth: 1
- actualFactor: 3,411 / 1,939 = 1.76
- modelFactor for Feb: ~1.41 (at heatingShare 0.5)
- calibration: 1.76 / 1.41 = 1.25

After calibration:
- January: 1 + (1.51-1) × 1.25 = 1.64 → ~3,179 kWh (up from 2,935)
- July: 1 + (0.53-1) × 1.25 = 0.41 → ~800 kWh (down from 1,035)
- Peak kW scales proportionally → winter peaks rise to ~8-9 kW range
- Effektavgift increases by ~3,000-4,000 kr/yr

## What this achieves
- Annual total stays the same (23,265 kWh) — just redistributed
- Winter months get more kWh → higher peaks → higher effektavgift
- More kWh × expensive winter spot prices → higher elhandel cost
- Summer months get fewer kWh → lower summer costs
- Net effect: total annual cost increases by ~4,000-5,000 kr due to winter-loading

## Verification
After changes, run:
```bash
npx tsc --noEmit --skipLibCheck
```

## DO NOT
- Do NOT change climate.ts or upgrades.ts — the base seasonal model is fine
- Do NOT change cost-model.ts — it correctly uses whatever peaks it receives
- Do NOT change energy-prices.ts — already updated with correct 2026 spot data
- Do NOT truncate any file — each change is a small addition
