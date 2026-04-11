# CURSOR-PROMPT-11: Contract-Type-Aware Cost Calculation

## Goal
Make the cost model calculate electricity costs correctly based on the user's actual contract type (timpris/rörligt/fast). Currently `calculateMonthlyCost()` always uses monthly average spot price regardless of contract type. This must change.

## Background: Swedish Electricity Contracts

Swedish households have one of three elhandel contract types:

1. **dynamic** (timpris/kvartspris): Price varies hour-by-hour with Nord Pool spot. Smart consumers shift load to cheap hours. Cost = Σ(hourly_kWh × hourly_spot).
2. **monthly** (rörligt månadsmedel): Price is the monthly average spot price. No benefit from shifting load within the day. Cost = total_kWh × monthly_avg_spot.
3. **fixed** (fastpris): Locked price for 1-3 years. Cost = total_kWh × fixed_price. No exposure to spot market.

The contract type is visible on the user's elhandel invoice. The system already stores it in `refinement.elContractType` but does NOT use it in cost calculations.

## Anti-Truncation Rules
⚠️ CRITICAL — follow these rules EXACTLY:
- Edit ONE file at a time. Do NOT batch multiple file edits.
- After each file edit, run `npx tsc --noEmit` and verify 0 errors before proceeding.
- NEVER truncate code. If a function is 80 lines, write all 80 lines.
- Use APPEND strategy: read existing code, then add/modify only what's needed.
- If any `tsc` check fails, fix the error before moving to the next file.

---

## Step 1: Update `MonthlyCostInput` in cost-model.ts

**File:** `app/simulator/simulation/cost-model.ts`

Add three new optional fields to `MonthlyCostInput` (after the existing optional overrides):

```typescript
/** User's electricity contract type */
elContractType?: "dynamic" | "monthly" | "fixed";
/** For dynamic contracts: pre-calculated hourly spot cost for this month (kr, EXKL moms).
 *  This is Σ(hourly_gridImport × hourly_spot / 100) from the hourly simulation.
 *  If provided and contract is dynamic, this replaces kWh × avg_spot. */
hourlySpotCostKrExMoms?: number;
/** For fixed contracts: the user's locked price (öre/kWh exkl moms).
 *  If not provided, we derive it from the bill. */
fixedPriceOre?: number;
```

## Step 2: Modify `calculateMonthlyCost()` in cost-model.ts

In the function body, replace the current spot cost calculation:

**CURRENT** (lines ~144):
```typescript
const spotCostKr = (gridImportKwh * spotPriceOre / 100) * VAT;
```

**NEW** — the spot cost depends on contract type:
```typescript
// --- Spot/energy cost depends on contract type ---
const contractType = input.elContractType ?? "monthly";
let spotCostKr: number;

if (contractType === "dynamic" && input.hourlySpotCostKrExMoms !== undefined) {
  // Dynamic (timpris): use pre-calculated hourly cost from simulation
  // This captures the actual cost of consuming at specific hours
  spotCostKr = input.hourlySpotCostKrExMoms * VAT;
} else if (contractType === "fixed") {
  // Fixed price: use locked price instead of spot
  const effectiveFixedPrice = input.fixedPriceOre ?? input.spotPriceOre ?? 80;
  spotCostKr = (gridImportKwh * effectiveFixedPrice / 100) * VAT;
} else {
  // Monthly average (rörligt) or fallback: kWh × monthly avg spot
  spotCostKr = (gridImportKwh * spotPriceOre / 100) * VAT;
}
```

Also update the `effectiveSpotOre` in the return statement to reflect what was actually used:
```typescript
effectiveSpotOre: contractType === "dynamic" && input.hourlySpotCostKrExMoms !== undefined
  ? (gridImportKwh > 0 ? (input.hourlySpotCostKrExMoms / gridImportKwh) * 100 : spotPriceOre)
  : (contractType === "fixed" ? (input.fixedPriceOre ?? spotPriceOre) : spotPriceOre),
```

**IMPORTANT**: Do NOT change any other part of the function. The elnät calculation, export revenue, markup, monthly fee — all stay exactly as they are. Only the spot cost line and effectiveSpotOre change.

Run `npx tsc --noEmit` — expect 0 errors.

---

## Step 3: Update `simulateMonthsWithUpgrades()` in monthly.ts

**File:** `app/simulator/simulation/monthly.ts`

This function already calls `simulateDay()` which returns hourly data including `costOre` and `spotPriceOre` per hour. We need to:

1. Extract the hourly spot cost from the day simulation
2. Scale it to the full month
3. Pass it to `calculateMonthlyCost()`

### 3a: Determine effective contract type

After the existing `const dayDataBase = simulateDay(...)` line (around line 54), add:

```typescript
// Determine effective contract type for cost calculation
const effectiveContract = activeUpgrades.dynamiskt_elpris
  ? "dynamic" as const
  : (refinement.elContractType ?? "monthly") as "dynamic" | "monthly" | "fixed";
```

### 3b: Calculate hourly spot cost for dynamic contracts

After the scale ratio calculation (around line 65), add:

```typescript
// For dynamic contracts: sum up hourly spot cost from simulation and scale to month
let hourlySpotCostKrExMoms: number | undefined;
if (effectiveContract === "dynamic") {
  // dayData[h].spotPriceOre is the hourly spot price (öre/kWh exkl moms)
  // dayData[h].gridImportKwh is the hourly grid import after upgrades
  // We need: Σ(gridImport[h] × spotPrice[h]) / 100, scaled to month
  const dailySpotCostKrExMoms = dayData.reduce(
    (sum, d) => sum + (d.gridImportKwh * d.spotPriceOre / 100), 0
  );
  hourlySpotCostKrExMoms = dailySpotCostKrExMoms * scaleRatio;
}

// Same for base scenario (no upgrades)
let hourlySpotCostBaseKrExMoms: number | undefined;
if (effectiveContract === "dynamic" || refinement.elContractType === "dynamic") {
  const baseContract = refinement.elContractType ?? "monthly";
  if (baseContract === "dynamic") {
    const dailySpotCostBaseKrExMoms = dayDataBase.reduce(
      (sum, d) => sum + (d.gridImportKwh * d.spotPriceOre / 100), 0
    );
    // Base uses same scale but with base kWh
    const baseScaleRatio = dailyBase > 0 ? (monthlyBase / (dailyBase * daysInMonth)) * daysInMonth : daysInMonth;
    hourlySpotCostBaseKrExMoms = dailySpotCostBaseKrExMoms * baseScaleRatio;
  }
}
```

### 3c: Derive fixed price from bill (for fixed contract users)

Before the `sharedCostInputs` object, add:

```typescript
// For fixed contracts: derive implicit fixed price from bill
let fixedPriceOre: number | undefined;
if (effectiveContract === "fixed" || refinement.elContractType === "fixed") {
  // bill.costPerMonth includes EVERYTHING (elhandel + elnät + moms).
  // We need to isolate the energy price component.
  // Rough approach: total cost - estimated grid costs, then solve for öre/kWh exkl moms
  // Grid costs ≈ gridFixed + transfer + energyTax + markup (all per kWh or fixed)
  // For simplicity, use: fixedPrice ≈ (costPerMonth / 1.25 - gridFixed - kWh*(transfer+tax+markup)/100) / kWh * 100
  const gridPricing = assumptions?.gridOperator
    ? getGridPricing(assumptions.gridOperator)
    : (bill.natAgare ? getGridPricing(bill.natAgare) : DEFAULT_GRID_PRICING);
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
```

You'll need to add these imports at the top of monthly.ts:
```typescript
import { getGridPricing, DEFAULT_GRID_PRICING } from "../data/grid-operators";
import { getEnergyTaxRate } from "../data/energy-tax";
import { ELHANDEL_DEFAULTS } from "../data/elhandel-defaults";
```

### 3d: Pass new fields to calculateMonthlyCost()

Update the `sharedCostInputs` object to include the new fields:

```typescript
const sharedCostInputs = {
  month: monthIdx,
  seZone: seZone as SEZone,
  gridOperator: assumptions?.gridOperator ?? bill.natAgare,
  gridFixedFeeKr: assumptions?.gridFixedFeeKr,
  gridTransferFeeOre: assumptions?.gridTransferFeeOre,
  gridPowerChargeKrPerKw: assumptions?.gridPowerChargeKrPerKw,
  gridHasPowerCharge: assumptions?.gridHasPowerCharge,
  elhandelMarkupOre: assumptions?.elhandelMarkupOre,
  fixedPriceOre,
};
```

Update the "after upgrades" cost calculation call:

```typescript
const costBreakdown = calculateMonthlyCost({
  gridImportKwh: monthlyGridImport,
  gridExportKwh: monthlyGridExport,
  peakGridKw: peakKw,
  elContractType: effectiveContract,
  hourlySpotCostKrExMoms: hourlySpotCostKrExMoms,
  ...sharedCostInputs,
});
```

Update the "base (no upgrades)" cost calculation call:

```typescript
const costBreakdownBase = calculateMonthlyCost({
  gridImportKwh: monthlyBase,
  gridExportKwh: 0,
  peakGridKw: peakKwBase,
  elContractType: refinement.elContractType ?? "monthly",
  hourlySpotCostKrExMoms: hourlySpotCostBaseKrExMoms,
  ...sharedCostInputs,
});
```

Run `npx tsc --noEmit` — expect 0 errors.

---

## Step 4: Verify `dynamiskt_elpris` recommendation works

**File:** `app/simulator/recommendations/engine.ts`

This file already has correct logic (line 73-75): it excludes `dynamiskt_elpris` if the user already has `dynamic` contract. And the recommendation engine evaluates it by running `calculateAnnualSummary()` with `dynamiskt_elpris: true`.

With our changes, the flow now works correctly:
1. User has `monthly` contract → baseline cost uses kWh × monthly avg spot
2. Engine tests `dynamiskt_elpris` → `activeUpgrades.dynamiskt_elpris = true`
3. In `simulateDay()`, this switches price model to hourly (already implemented, line 122-124)
4. In `monthly.ts`, `effectiveContract` becomes `"dynamic"` (our new code)
5. `calculateMonthlyCost()` receives `hourlySpotCostKrExMoms` → calculates real hourly cost
6. Difference = savings from switching to dynamic pricing

**No changes needed in engine.ts.** But verify that `dynamiskt_elpris` produces non-zero savings for a test user with `monthly` contract type in SE3. The savings should come from the duck curve: consumption during cheap hours costs less than the flat monthly average. Expected savings: 2-8% of energy cost for a typical household without load shifting.

Run `npx tsc --noEmit` — expect 0 errors.

---

## Step 5: Verify hourly.ts base simulation uses correct prices

**File:** `app/simulator/simulation/hourly.ts`

The `simulateDay()` function already handles contract types correctly for hourly price calculation (lines 122-138). The base simulation (called with `NO_UPGRADES`) will use `refinement.elContractType` to set prices.

**One issue to verify:** When `simulateDay()` is called with `NO_UPGRADES` (for the base scenario), `activeUpgrades.dynamiskt_elpris` is `false`, so it correctly uses the user's actual contract type. Good — no changes needed.

**But verify** that `dayDataBase` in monthly.ts line 54 also correctly produces hourly prices for the base contract type. Currently:
```typescript
const dayDataBase = simulateDay(bill, refinement, repDate, NO_UPGRADES, seZone);
```
This is correct — `NO_UPGRADES` means `dynamiskt_elpris: false`, so `effectiveContract` in hourly.ts will be `refinement.elContractType ?? "monthly"`. ✅

No changes needed in hourly.ts.

---

## Verification

After all changes, run:
```bash
npx tsc --noEmit
```

Then create a simple test scenario mentally or in console:
- User in SE3, 2000 kWh/month, contract type `monthly`
- January spot average SE3 = 75 öre/kWh
- Hourly profile has peak at 1.48× and valley at 0.55×
- With `monthly` contract: spotCost = 2000 × 75/100 × 1.25 = 1875 kr
- With `dynamic` contract (no load shifting): spotCost ≈ same, because Σ(profile × avg) ≈ avg (profiles are normalized around 1.0). But with consumption weighted toward peak hours (typical), cost should be slightly HIGHER than monthly avg. The savings from dynamic comes when combined with battery/smartstyrning that shifts to cheap hours.
- This means `dynamiskt_elpris` alone (without smartstyrning) may show small or zero savings — which is CORRECT. The real value of dynamic pricing comes in combination with smart load management.

## Summary of Changes

| File | Change |
|------|--------|
| `cost-model.ts` | Add `elContractType`, `hourlySpotCostKrExMoms`, `fixedPriceOre` to input. Branch spot cost calculation by contract type. |
| `monthly.ts` | Extract hourly spot cost from `simulateDay()`. Derive fixed price from bill. Pass new fields to `calculateMonthlyCost()`. Add 3 imports. |
| `engine.ts` | No changes — verify it works. |
| `hourly.ts` | No changes — already handles contract types. |
