# Fix: Aktivera 8760-timmarsimulering (2 kritiska buggar)

Hela 8760-infrastrukturen (simulate8760.ts, pvgis-tmy.ts, geocoding.ts, API-proxy) är byggd och korrekt. Men den aktiveras ALDRIG pga två buggar:

---

## BUG 1: `scenarios.ts` avklippt på rad 229

Filen `app/simulator/simulation/scenarios.ts` slutar mitt i en variabeldeklaration:

```
const afterRecommendationsUpgrades
```

Funktionen `calculateThreeScenarios()` returnerar aldrig sitt `ThreeScenarioSummary`-objekt. Hela "efter rekommendationer"-scenariot saknas.

### Fix

Komplettera funktionen efter rad 229. Koden som saknas ska:

1. **Bygga afterRecommendationsUpgrades** — kombinera `existingEquipmentUpgrades` med rekommenderade uppgraderingar:
```typescript
const afterRecommendationsUpgrades: ActiveUpgrades = { ...existingEquipmentUpgrades };
if (recommendedUpgrades) {
  for (const upgradeId of recommendedUpgrades) {
    afterRecommendationsUpgrades[upgradeId] = true;
  }
}
```

2. **Beräkna afterRecommendationsSummary** med inflation (samma approach som withoutInvestments):
```typescript
const afterRefinement: RefinementAnswers = {
  elContractType: refinement.elContractType,
  hasSolar: refinement.hasSolar,
  solarSizeKw: refinement.solarSizeKw,
  hasBattery: refinement.hasBattery,
  batterySizeKwh: refinement.batterySizeKwh,
  heatingType: refinement.heatingType,
  heatingTypes: refinement.heatingTypes,
};
const afterRecommendationsSummary = calculateAnnualSummary(
  billData, afterRefinement, afterRecommendationsUpgrades, seZone, assumptions, false
);
console.log('[SCENARIOS] afterRecommendations: inflate + recommended upgrades, yearlyTotal:', afterRecommendationsSummary.yearlyTotalCostAfter);
```

3. **Returnera ThreeScenarioSummary:**
```typescript
const withoutInvestmentsDetail = buildScenarioDetail(withoutInvestmentsSummary, false);
const currentSituationDetail = buildScenarioDetail(currentSituationSummary, false);
const afterRecommendationsDetail = buildScenarioDetail(afterRecommendationsSummary, true);

return {
  withoutInvestments: withoutInvestmentsDetail,
  currentSituation: currentSituationDetail,
  afterRecommendations: afterRecommendationsDetail,
  existingSavingsKr: withoutInvestmentsDetail.yearlyTotalCostKr - currentSituationDetail.yearlyTotalCostKr,
  potentialSavingsKr: currentSituationDetail.yearlyTotalCostKr - afterRecommendationsDetail.yearlyTotalCostKr,
};
```

### Viktigt
- `buildScenarioDetail` och `extractCostComponents` finns redan (rad 31-71) — använd dem
- `withoutInvestmentsSummary` använder `false` (base-sidan) — den visar vad det HADE kostat utan utrustning
- `afterRecommendationsSummary` använder `true` (after-sidan) — den visar vad det kostar MED rekommenderade uppgraderingar
- Variabeln `existingEquipmentUpgrades` deklareras redan på rad 228 — ta inte bort den

---

## BUG 2: TMY-data hämtas aldrig → 8760-simuleringen körs aldrig

`fetchTmyData()` anropas ingenstans i UI-flödet. `calculateThreeScenarios()` tar `tmyData` som optional parameter, men den är alltid `undefined`, så scenarioberäkningen faller alltid tillbaka på den gamla profil-baserade skalnigen (Path B) istället för 8760-simuleringen (Path A).

**Koordinaterna finns redan!** `parse-invoice/route.ts` rad 255-263 anropar `geocodeAddress()` och sparar `latitude`/`longitude` i invoice-objektet. `BillData` har `latitude?: number` och `longitude?: number` (types.ts rad 100-102).

### Fix — 2 filer att ändra:

#### A) `app/page.tsx` — Hämta TMY-data och skicka in den

Ändra `useMemo` som beräknar `threeScenarios` (rad 48-52). TMY-hämtningen är async, så det behöver bli en `useEffect` + `useState` istället:

```typescript
import { fetchTmyData } from "./simulator/data/pvgis-tmy";
import type { TmyHourlyData } from "./simulator/data/pvgis-tmy";

// Lägg till state för TMY-data
const [tmyData, setTmyData] = useState<TmyHourlyData[] | null>(null);
const [tmyLoading, setTmyLoading] = useState(false);

// Hämta TMY-data när billData har koordinater
useEffect(() => {
  if (!state.billData?.latitude || !state.billData?.longitude) return;
  if (tmyData) return; // redan hämtat

  let cancelled = false;
  setTmyLoading(true);

  fetchTmyData(state.billData.latitude, state.billData.longitude)
    .then((data) => {
      if (!cancelled) {
        setTmyData(data);
        console.log(`[PAGE] TMY data loaded: ${data.length} hours`);
      }
    })
    .catch((err) => {
      console.warn("[PAGE] Failed to fetch TMY data, falling back to legacy:", err);
    })
    .finally(() => {
      if (!cancelled) setTmyLoading(false);
    });

  return () => { cancelled = true; };
}, [state.billData?.latitude, state.billData?.longitude, tmyData]);

// Beräkna scenarios (med TMY om tillgängligt)
const threeScenarios = useMemo(() => {
  if (!state.billData || !state.recommendations) return null;
  const recommendedIds = state.recommendations.recommendations.map((r) => r.upgradeId);
  return calculateThreeScenarios(
    state.billData, state.refinement, state.seZone, state.assumptions,
    recommendedIds, tmyData ?? undefined
  );
}, [state.billData, state.refinement, state.seZone, state.assumptions, state.recommendations, tmyData]);
```

OBS: Systemet ska fortfarande fungera utan TMY-data (fallback till Path B). TMY-hämtning kan misslyckas (nätverksfel, koordinater saknas) — det ska aldrig blockera kalkylen.

#### B) `app/simulator/components/AnnualSummaryBar.tsx` — Samma ändring

AnnualSummaryBar.tsx (rad 39) anropar `calculateThreeScenarios` utan tmyData. Den behöver ta emot `tmyData` som prop (eller hämta den själv). Enklast: lägg till `tmyData?: TmyHourlyData[]` som prop och skicka den från parent:

```typescript
// I AnnualSummaryBar props:
tmyData?: TmyHourlyData[];

// I useMemo (rad 39):
return calculateThreeScenarios(billData, refinement, seZone, assumptionsToUse, recommendedUpgradeIds, tmyData);
```

Och i parent-komponenten som renderar AnnualSummaryBar, skicka med `tmyData`.

---

## Sammanfattning av filer att ändra

| Fil | Ändring |
|-----|---------|
| `app/simulator/simulation/scenarios.ts` | Komplettera avklippt funktion (efter rad 229) — lägg till afterRecommendations-scenario + return |
| `app/page.tsx` | Lägg till TMY-hämtning (useEffect + useState) och skicka tmyData till calculateThreeScenarios |
| `app/simulator/components/AnnualSummaryBar.tsx` | Ta emot och vidarebefordra tmyData |

## Verifikation

Efter fix, kör appen och öppna browser console. Du ska se:
1. `[PVGIS] Fetching TMY data for ...` — TMY-data hämtas
2. `[SCENARIOS] Using 8760-hour TMY simulation for solar export estimation` — Path A aktiveras
3. `[8760-RESULT] System: X.X kW ...` — 8760-simuleringen körs
4. Exportkrediten ska vara MYCKET högre än -70 kr (sannolikt -2000 till -4000 kr/år för Green Hero-fakturan)
5. I daglig vy ska dagarna ha VARIERANDE profiler (inte identiska)
