# CURSOR-PROMPT-14: Replace spot price defaults with real 2026 forecast data

## Background
The cost model uses `SE_ZONE_SPOT_PRICE` for monthly spot prices per SE zone. The current values are 2023-2025 averages (~40 öre/kWh for SE3) which are far too low — actual 2025 SE3 average was ~51 öre, and Q1 2026 averaged ~92 öre.

We're replacing these with a **2026 forecast**: actual data for Jan-Mar (already happened) + quarterly forward prices from Nasdaq OMX for Apr-Dec (distributed to months using 2025's seasonal pattern).

## Data sources
- **Jan-Mar 2026**: Energimarknadsbyrån (energimarknadsbyran.se), actual monthly averages
- **Q2-Q4 2026**: Elpriser24.se terminal prices (Nasdaq OMX Commodities forward contracts)
- **Monthly distribution within quarters**: Based on 2025 actual monthly pattern from Elbruk.se/Nord Pool
- All prices are öre/kWh **exkl moms** (the cost model adds 25% moms in its calculations)

## Changes — 3 files

### 1. `app/simulator/data/energy-prices.ts` — Replace spot price data

Replace `SE_ZONE_SPOT_PRICE` with the new 2026 forecast. **Keep all other exports unchanged** (SE_ZONE_TOTAL_CONSUMER_PRICE, HOURLY_PRICE_PROFILES, etc).

Replace this block (lines 105-118):

```typescript
/**
 * Average spot price per SE-zone and month (öre/kWh, EXKL moms, skatt och nätavgifter).
 * Detta är BARA spotpriset — inte konsumentpriset.
 *
 * @source Nord Pool / Elpriskollen — genomsnitt 2023-2025
 * @updated 2026-04-04
 */
export const SE_ZONE_SPOT_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [   28,   25,   20,   15,   12,   10,   10,   12,   15,   18,   22,   28],
  SE2: [   32,   28,   22,   17,   14,   12,   12,   14,   18,   22,   26,   32],
  SE3: [   75,   68,   50,   30,   22,   18,   16,   18,   28,   38,   52,   70],
  SE4: [   95,   85,   62,   35,   25,   20,   18,   22,   32,   48,   68,   90],
};
```

With this:

```typescript
/**
 * Spot price forecast per SE-zone and month (öre/kWh, EXKL moms, skatt och nätavgifter).
 * Detta är BARA spotpriset — inte konsumentpriset.
 *
 * Jan-Mar 2026: Faktiskt utfall (Energimarknadsbyrån / Nord Pool)
 * Apr-Dec 2026: Terminspriser (Nasdaq OMX Commodities via Elpriser24.se),
 *               fördelade till månader med 2025 års säsongsmönster.
 *
 * @source Energimarknadsbyrån, Elbruk.se, Elpriser24.se (terminspriser)
 * @updated 2026-04-07
 */
export const SE_ZONE_SPOT_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [   94,   99,   23,   57,   55,   12,   24,   42,   31,   20,   52,   44],
  SE2: [   94,   99,   21,   50,   53,   18,   27,   39,   27,   19,   48,   45],
  SE3: [  108,  110,   59,   61,   69,   37,   29,   39,   42,   55,   60,   45],
  SE4: [  113,  113,   85,   69,   71,   48,   40,   62,   60,   68,   77,   62],
};
```

Also update `SE_ZONE_TOTAL_CONSUMER_PRICE` to match (this adds energiskatt ~42 öre + nätavgift ~25 öre + moms 25% on top of spot). Replace lines 15-20:

```typescript
export const SE_ZONE_TOTAL_CONSUMER_PRICE: Record<SEZone, number[]> = {
  //       Jan   Feb   Mar   Apr   Maj   Jun   Jul   Aug   Sep   Okt   Nov   Dec
  SE1: [  201,  208,  113,  155,  153,   99,  114,  136,  123,  109,  149,  139],
  SE2: [  201,  208,  110,  146,  150,  106,  118,  133,  118,  108,  144,  140],
  SE3: [  219,  221,  158,  160,  170,  130,  120,  132,  136,  152,  159,  140],
  SE4: [  225,  224,  190,  170,  172,  144,  134,  161,  159,  169,  180,  161],
};
```

### 2. `app/simulator/types.ts` — Add fields to Assumptions

Add these fields to the `Assumptions` interface, after the `elhandelMarkupOre` line (~line 133):

```typescript
  elhandelMarkupOre?: number;       // öre/kWh exkl moms
  elhandelMonthlyFeeKr?: number;    // kr/mån exkl moms
```

Just add `elhandelMonthlyFeeKr` — the other field is already there.

### 3. `app/page.tsx` — Pass invoice monthly fee to Assumptions

In `handleVerificationComplete`, after the existing `if (billData.invoiceMarkupOre)` block (~line 82-84), add:

```typescript
      if (billData.invoiceMonthlyFeeKr !== undefined) {
        updatedAssumptions.elhandelMonthlyFeeKr = billData.invoiceMonthlyFeeKr;
      }
```

And in `monthly.ts`, inside the `sharedCostInputs` object (~line 124-134), add elhandelMonthlyFeeKr:

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
      elhandelMonthlyFeeKr: assumptions?.elhandelMonthlyFeeKr,     // ← ADD THIS LINE
      fixedPriceOre,
    };
```

## What this achieves

**Before:** SE3 spot prices averaged ~40 öre/kWh (2023-2025 historical). A household with 23,265 kWh/year showed ~33,600 kr/year total cost.

**After:** SE3 spot prices average ~60 öre/kWh (2026 forecast). Same household should show ~52,000-55,000 kr/year — much closer to reality.

The cost model already handles the spot price correctly via `SE_ZONE_SPOT_PRICE[seZone][month]` on line 139-141 of cost-model.ts. No changes needed there — we're just feeding it better data.

## Verification

Run `npx tsc --noEmit --skipLibCheck` after changes. No errors expected — this is purely data updates plus one optional field addition.

## DO NOT
- Do NOT change `cost-model.ts` — it's correct as-is
- Do NOT change `HOURLY_PRICE_PROFILES` — the intraday shape is still valid
- Do NOT change any other files
- Do NOT truncate any file
