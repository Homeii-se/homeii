# CURSOR-PROMPT-9: REPARATION — 12 trunkerade filer

## ⚠️ ANTI-TRUNKERINGSPROTOKOLL — LÄS FÖRST

Dessa filer har blivit avklippta mitt i koden. För att undvika att det händer igen:

1. **EN FIL I TAGET.** Fixa en fil, verifiera, sedan nästa.
2. **APPEND ONLY.** Skriv aldrig om hela filen. Hitta klippunkten → lägg till kod efter den.
3. **RADRÄKNARE.** Varje fil har ett förväntat radantal efter fix. Kontrollera med `wc -l`.
4. **CHECKPOINT.** Efter varje fil: `npx tsc --noEmit 2>&1 | grep FILNAMN` — ska ge 0 fel.
5. **OM NÅGOT KLIPPS:** Stanna. Fixa den filen igen innan du går vidare.

Ordning (enklast först):

---

## STEG 1: `app/simulator/recommendations/index.ts` (9 → 10 rader)

**KLIPPS VID rad 10:** `export type { ReasoningChain, ReasoningFactor } from ".`

**RADERA rad 10. ERSÄTT MED:**

```typescript
export type { ReasoningChain, ReasoningFactor } from "./reasoning";
```

**VERIFIERING:** `wc -l` = 10 rader. `npx tsc --noEmit 2>&1 | grep "recommendations/index"` = 0 fel.

---

## STEG 2: `app/simulator/recommendations/reasoning.ts` (27 → ~65 rader)

**KLIPPS VID rad 28:** `fac` (mitt i interface ReasoningChain)

**RADERA rad 28. ERSÄTT MED:**

```typescript
  factors: ReasoningFactor[];
  conclusion: string;
  annualSavingsKr: number;
  investmentKr: number;
  paybackYears: number;
}

/**
 * Build a reasoning chain explaining why an upgrade was recommended.
 */
export function buildReasoningChain(
  rec: Recommendation,
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions,
  existingUpgrades: ActiveUpgrades,
  annualSummaryBefore: AnnualSummary
): ReasoningChain {
  const factors: ReasoningFactor[] = [];

  // Factor: current consumption
  const yearlyKwh = billData.annualKwh ?? billData.kwhPerMonth * 12;
  factors.push({
    label: "Årsförbrukning",
    impact: yearlyKwh > 15000 ? "positive" : "neutral",
    description: `${yearlyKwh.toLocaleString("sv-SE")} kWh/år — ${yearlyKwh > 15000 ? "hög förbrukning ger stor besparingspotential" : "normal förbrukningsnivå"}`,
    value: yearlyKwh,
    unit: "kWh/år",
  });

  // Factor: kWh reduction
  if (rec.kwhReductionPercent > 0) {
    factors.push({
      label: "Förbrukningsminskning",
      impact: "positive",
      description: `Beräknad minskning: ${rec.kwhReductionPercent}% av nuvarande förbrukning`,
      value: rec.kwhReductionPercent,
      unit: "%",
    });
  }

  // Factor: peak reduction
  if (rec.peakReductionPercent > 0) {
    factors.push({
      label: "Effektminskning",
      impact: "positive",
      description: `Beräknad toppeffektminskning: ${rec.peakReductionPercent}%, kan sänka effektavgiften`,
      value: rec.peakReductionPercent,
      unit: "%",
    });
  }

  const conclusion = `${rec.upgradeId} beräknas spara ${rec.yearlySavingsKr.toLocaleString("sv-SE")} kr/år med en investering på ${rec.investmentKr.toLocaleString("sv-SE")} kr (återbetalningstid: ${rec.paybackYears} år).`;

  return {
    upgradeId: rec.upgradeId,
    factors,
    conclusion,
    annualSavingsKr: rec.yearlySavingsKr,
    investmentKr: rec.investmentKr,
    paybackYears: rec.paybackYears,
  };
}
```

**VERIFIERING:** `wc -l` ≈ 65. `npx tsc --noEmit 2>&1 | grep "reasoning"` = 0 fel.

---

## STEG 3: `app/simulator/recommendations/lifestyle-tips.ts` (15 → ~100 rader)

**KLIPPS VID rad 16:** `estimatedSavingsKrPerYear: numbe`

**RADERA rad 16. ERSÄTT MED:**

```typescript
  estimatedSavingsKrPerYear: number;
  category: TipCategory;
  applicableIf?: (r: RefinementAnswers, b: BillData) => boolean;
}

/**
 * Generate personalized lifestyle tips based on household profile.
 */
export function generateLifestyleTips(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  _assumptions?: Assumptions
): LifestyleTip[] {
  const yearlyKwh = billData.annualKwh ?? billData.kwhPerMonth * 12;
  const avgPriceOre = SE_ZONE_TOTAL_CONSUMER_PRICE[seZone]?.reduce((a, b) => a + b, 0) / 12 || 100;

  const allTips: LifestyleTip[] = [
    {
      id: "lower-indoor-temp",
      title: "Sänk inomhustemperaturen 1°C",
      description: "Varje grad lägre sparar ca 5% av uppvärmningskostnaden. Prova 20°C istället för 21°C.",
      estimatedSavingsKwhPerYear: Math.round(yearlyKwh * 0.03),
      estimatedSavingsKrPerYear: Math.round(yearlyKwh * 0.03 * avgPriceOre / 100),
      category: "heating",
    },
    {
      id: "wash-lower-temp",
      title: "Tvätta på 30°C istället för 40°C",
      description: "Modern tvättmedel fungerar lika bra på lägre temperatur och sparar energi.",
      estimatedSavingsKwhPerYear: 200,
      estimatedSavingsKrPerYear: Math.round(200 * avgPriceOre / 100),
      category: "appliances",
    },
    {
      id: "standby-off",
      title: "Stäng av standby-läge",
      description: "Elektronik i standby drar 5-10% av hushållets elförbrukning. Använd grenuttag med strömbrytare.",
      estimatedSavingsKwhPerYear: Math.round(yearlyKwh * 0.05),
      estimatedSavingsKrPerYear: Math.round(yearlyKwh * 0.05 * avgPriceOre / 100),
      category: "appliances",
    },
    {
      id: "smart-charging",
      title: "Ladda elbilen nattetid",
      description: "Spotpriset är lägst mellan 02-06. Schemalägg laddningen för att spara på timprisavtalet.",
      estimatedSavingsKwhPerYear: 500,
      estimatedSavingsKrPerYear: Math.round(500 * avgPriceOre / 100 * 0.4),
      category: "transport",
      applicableIf: (r) => r.elCar === "ja" || (r.bigConsumers ?? []).includes("elbil"),
    },
    {
      id: "review-contract",
      title: "Se över elavtalet",
      description: "Jämför elhandlare på Elpriskollen.se. Byt till timprisavtal om du kan vara flexibel.",
      estimatedSavingsKwhPerYear: 0,
      estimatedSavingsKrPerYear: Math.round(yearlyKwh * 0.05 * avgPriceOre / 100),
      category: "contract",
    },
    {
      id: "rot-deduction",
      title: "Utnyttja ROT- och grönt teknikavdrag",
      description: "30% skattereduktion på arbetskostnad för solceller, batteri och laddbox (max 50 000 kr/år).",
      estimatedSavingsKwhPerYear: 0,
      estimatedSavingsKrPerYear: 0,
      category: "finance",
    },
  ];

  return allTips.filter((tip) => {
    if (tip.applicableIf) return tip.applicableIf(refinement, billData);
    return true;
  });
}
```

**VERIFIERING:** `wc -l` ≈ 100. `npx tsc --noEmit 2>&1 | grep "lifestyle-tips"` = 0 fel.

---

## STEG 4: `app/simulator/simulation/adapters.ts` (71 → ~95 rader)

**KLIPPS VID rad 72:** `export function profileToR`

**RADERA rad 72. ERSÄTT MED:**

```typescript
export function profileToRefinement(profile: HouseholdProfile): RefinementAnswers {
  return {
    housingType: profile.housingType,
    area: profile.areaM2,
    heatingTypes: profile.heatingTypes,
    residents: profile.residents,
    elCar: profile.hasEv ? "ja" : "nej",
    bigConsumers: profile.bigConsumers,
    hasSolar: profile.hasSolar,
    solarSizeKw: profile.solarSizeKw,
    hasBattery: profile.hasBattery,
    batterySizeKwh: profile.batterySizeKwh,
    elContractType: profile.elContractType,
  };
}

/**
 * Build Assumptions from a HouseholdProfile.
 */
export function profileToAssumptions(profile: HouseholdProfile): Assumptions {
  return {
    solarSizeKw: profile.solarSizeKw,
    batterySizeKwh: profile.batterySizeKwh,
    gridFeeKrPerMonth: profile.gridFeeMonthlyKr ?? 320,
    powerFeeKrPerKw: profile.powerFeePerKw ?? 44,
  };
}
```

**VERIFIERING:** `wc -l` ≈ 95. `npx tsc --noEmit 2>&1 | grep "adapters"` = 0 fel.

---

## STEG 5: `app/simulator/climate.ts` (369 → ~385 rader)

**KLIPPS VID rad 370:** `label: "G` (mitt i CLIMATE_DATA_SOURCES.heatingDegreeDays)

**RADERA rad 370. ERSÄTT MED:**

```typescript
    label: "Graddagar per zon",
    source: "SMHI / Boverket",
    url: "https://www.smhi.se/data/meteorologi/temperatur",
    note: "Graddagar (bas 17°C) per SE-zon. Normalvärden 1991-2020.",
  },
  electricityPrices: {
    label: "Elpriser per zon",
    source: "Elpriskollen (Energimarknadsinspektionen) / Nord Pool",
    url: "https://www.ei.se/konsumentstod/elpriskollen",
    note: "Genomsnittliga konsumentpriser 2023-2025 per SE-zon, inklusive nätavgifter och skatter.",
  },
};
```

**VERIFIERING:** `wc -l` ≈ 382. `npx tsc --noEmit 2>&1 | grep "climate"` = 0 fel.

---

## STEG 6: `app/simulator/components/RecommendationCard.tsx` (124 → ~135 rader)

**KLIPPS VID rad 125:** `</div>` efter expanded-sektionen, men saknar stängning av yttre divs.

**Rad 124 är:** `</div>` (sista synliga). **EFTER rad 124, LÄGG TILL:**

```tsx
        </div>
      )}

      {/* Reasoning preview */}
      <p className="mt-2 px-5 pb-4 text-xs text-text-muted leading-relaxed">
        {recommendation.reasoning}
      </p>
    </div>
  );
}
```

**VERIFIERING:** `wc -l` ≈ 135. `npx tsc --noEmit 2>&1 | grep "RecommendationCard"` = 0 fel.

---

## STEG 7: `app/simulator/components/UpgradePanel.tsx` (113 → ~120 rader)

**KLIPPS VID rad 113:** `)}` — saknar stängning av yttre `</div>` och funktionen.

**EFTER rad 113, LÄGG TILL:**

```tsx
        </div>
      )}

      {/* Footer */}
      {!expanded && anyActive && (
        <p className="mt-2 text-center text-xs text-text-muted">
          Tryck för att se detaljer
        </p>
      )}
    </div>
  );
}
```

**VERIFIERING:** `wc -l` ≈ 126. `npx tsc --noEmit 2>&1 | grep "UpgradePanel"` = 0 fel.

---

## STEG 8: `app/simulator/components/AnnualSummaryBar.tsx` (211 → ~240 rader)

**KLIPPS VID rad 212:** `<div classNa` (mitt i JSX)

**RADERA rad 212. ERSÄTT MED:**

```tsx
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Ytterligare besparingspotential:</span>
                  <span className="font-semibold text-brand-300">
                    {threeScenarios.potentialSavingsKr.toLocaleString("sv-SE")} kr/år
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cost breakdown card */}
      {threeScenarios && (
        <div className="mt-4">
          <CostBreakdownCard
            title="Kostnadsuppdelning — nuläge"
            components={threeScenarios.currentSituation.costComponents}
            yearlyKwh={threeScenarios.currentSituation.yearlyKwh}
          />
        </div>
      )}
    </div>
  );
}
```

**VERIFIERING:** `wc -l` ≈ 237. `npx tsc --noEmit 2>&1 | grep "AnnualSummaryBar"` = 0 fel.

---

## STEG 9: `app/simulator/components/VerificationScreen.tsx` (422 → ~430 rader)

**KLIPPS VID rad 423:** `{STRINGS.confirmA` (mitt i button-text)

**RADERA rad 423. ERSÄTT MED:**

```tsx
        {STRINGS.confirmAndContinue ?? "Bekräfta och fortsätt"}
      </button>
    </div>
  );
}
```

**VERIFIERING:** `wc -l` ≈ 428. `npx tsc --noEmit 2>&1 | grep "VerificationScreen"` = 0 fel.

> **OBS:** Om `STRINGS.confirmAndContinue` inte finns, använd det exakta strängnamnet som finns i `data/strings.ts`. Sök: `grep "confirm" app/simulator/data/strings.ts`

---

## STEG 10: `app/simulator/components/Dashboard.tsx` (322 → ~340 rader)

**KLIPPS VID rad 323:** `{/*` (början av en kommentar)

**RADERA rad 323. ERSÄTT MED:**

```tsx
      {/* Methodology & Sources */}
      <div className="mt-6">
        <MethodologyPanel />
      </div>

      {/* Back to recommendations */}
      <div className="mt-6 text-center">
        <button
          onClick={onBackToRecommendations}
          className="rounded-xl px-6 py-2.5 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary hover:bg-surface-bright"
        >
          ← Tillbaka till rekommendationer
        </button>
      </div>
    </div>
  );
}
```

**VERIFIERING:** `wc -l` ≈ 340. `npx tsc --noEmit 2>&1 | grep "Dashboard"` = 0 fel.

---

## STEG 11: `app/page.tsx` (249 → ~260 rader)

**KLIPPS VID rad 250:** `recommendedUpgradeIds={state.recommendations?.recommendations.map((r) => r.up`

**RADERA rad 250. ERSÄTT MED:**

```tsx
            recommendedUpgradeIds={state.recommendations?.recommendations.map((r) => r.upgradeId)}
          />
        )}
      </div>
    </div>
  );
}
```

**VERIFIERING:** `wc -l` ≈ 257. `npx tsc --noEmit 2>&1 | grep "page.tsx"` = 0 fel.

---

## SLUTVERIFIERING

Efter alla 11 steg:

```bash
npx tsc --noEmit
```

Ska ge **0 fel**. Om det finns kvarvarande problem:

1. **Saknade STRINGS-nycklar** — kolla `data/strings.ts` och lägg till de som saknas
2. **Saknade typer (HouseholdProfile)** — kontrollera att `types.ts` exporterar `HouseholdProfile`
3. **Import-konflikter** — dubbelkolla att inga cirkulära imports uppstått

### Checklista att bocka av:

- [ ] Steg 1: recommendations/index.ts
- [ ] Steg 2: recommendations/reasoning.ts
- [ ] Steg 3: recommendations/lifestyle-tips.ts
- [ ] Steg 4: simulation/adapters.ts
- [ ] Steg 5: climate.ts
- [ ] Steg 6: RecommendationCard.tsx
- [ ] Steg 7: UpgradePanel.tsx
- [ ] Steg 8: AnnualSummaryBar.tsx
- [ ] Steg 9: VerificationScreen.tsx
- [ ] Steg 10: Dashboard.tsx
- [ ] Steg 11: page.tsx
- [ ] `npx tsc --noEmit` = 0 errors
