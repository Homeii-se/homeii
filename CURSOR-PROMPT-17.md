# CURSOR-PROMPT-17: Restructure Resultat & Analys → Rekommendation

## Goal
Restructure the UX flow so that:
- **Step 3 "Resultat"** = "This is your current situation" — confirmation + cost visualization
- **Step 4 "Rekommendation"** (renamed from "Analys") = Top 3 recommendations + impact visualization

## Current structure (to change)

| Step | Label | Component | What it shows |
|------|-------|-----------|---------------|
| 3 | Resultat | RecommendationResults | Summary card + recommendation cards + hidden donut |
| 4 | Analys | Dashboard | Full analysis dashboard |

## New structure

| Step | Label | Component | What it shows |
|------|-------|-----------|---------------|
| 3 | Resultat | **ResultOverview** (new) | Donut + cost breakdown + "with/without investments" comparison |
| 4 | Rekommendation | **RecommendationResults** (refactored) | Top 3 recommendations + impact visualization |

---

## Changes needed

### 1. `app/simulator/components/StepIndicator.tsx`

Change the step labels:
```typescript
// OLD:
const STEP_LABELS = ["Elräkning", "Bekräfta", "Resultat", "Analys"];

// NEW:
const STEP_LABELS = ["Elräkning", "Bekräfta", "Resultat", "Rekommendation"];
```

### 2. Create new component: `app/simulator/components/ResultOverview.tsx`

This is the NEW "Resultat" step. It should:

**A) Show the donut chart and cost breakdown PROMINENTLY (not hidden)**
- Move `CostBreakdownCard` content here as the main feature (not in a collapsible)
- Title: "Kostnadsuppdelning — nuläge"
- The donut chart + breakdown table should be immediately visible
- Show total annual cost prominently: "Din elkostnad: XX XXX kr/år"
- Show monthly cost in donut center

**B) Show "before/after existing investments" comparison**
- Two-column or stacked comparison:
  - "Utan dina investeringar: XX XXX kr/år" (without solar, heat pump, etc.)
  - "Med dina investeringar: XX XXX kr/år" (current situation = nuläge)
  - "Dina befintliga investeringar sparar dig: XX XXX kr/år"
- This requires the `ThreeScenarioSummary` data — specifically `withoutInvestments` vs `currentSituation`

**C) Confirmation action**
- Button: "Ser rimligt ut — visa rekommendationer" → advances to step 4
- Secondary link: "Justera antaganden" → could open a simple modal or link to dashboard

**Props needed:**
```typescript
interface ResultOverviewProps {
  threeScenarios: ThreeScenarioSummary;
  seZone: SEZone;
  onContinue: () => void;  // advance to Rekommendation step
}
```

**Design:** Follow the existing dark card style (bg-card-dark, rounded-2xl, etc.) used throughout the app.

### 3. Refactor `app/simulator/components/RecommendationResults.tsx`

Remove from this component:
- The summary hero card at the top (annual cost, "Vi rekommenderar X åtgärder...")
- The collapsible `CostBreakdownCard` (moved to ResultOverview)
- The collapsible `EnergyHealthScore` section

Keep and enhance:
- **Top 3 recommendation cards** — show only the top 3 (not all 5)
- Add a header: "Våra rekommendationer för dig"
- Each card should be more prominent with clear savings visualization
- Keep "Visa detaljer" expandable on each card
- Add a button/link: "Visa alla rekommendationer" if there are more than 3

Add at the bottom:
- "Visa detaljerad analys" button → navigates to Dashboard (step 5 if you want to keep it, or open as overlay)

### 4. `app/page.tsx` — Update step routing

The step rendering needs to change:

```tsx
// Step 3 = Resultat (new ResultOverview component)
{currentStep === 4 && (
  <ResultOverview
    threeScenarios={threeScenarios}
    seZone={state.seZone}
    onContinue={handleViewRecommendations}
  />
)}

// Step 4 = Rekommendation (existing RecommendationResults, refactored)
{currentStep === 5 && recommendations && (
  <RecommendationResults
    recommendations={recommendations}
    // ... other props
  />
)}
```

Note: You'll need to compute `threeScenarios` in page.tsx and pass it down. It's already imported/available via `calculateThreeScenarios` from `scenarios.ts`.

### 5. Wire up `ThreeScenarioSummary` data

In `app/page.tsx`, after `handleVerificationComplete`:
- Calculate three scenarios using `calculateThreeScenarios()`
- Store in state or compute on render
- Pass `threeScenarios.withoutInvestments` and `threeScenarios.currentSituation` to ResultOverview

---

## CRITICAL: Do not modify these files
- `app/simulator/simulation/monthly.ts` — cost model, do not touch
- `app/simulator/simulation/scenarios.ts` — scenario calculation, do not touch
- `app/simulator/simulation/cost-model.ts` — do not touch
- `app/simulator/inference/bill-parser.ts` — do not touch

## CRITICAL: Verify no truncation
After making changes, verify ALL modified files are complete:
- Run `npx tsc --noEmit --skipLibCheck 2>&1 | grep -v ".next/" | grep -v "route.ts"` — should be empty
- Check that each component file ends properly with its closing export/bracket
