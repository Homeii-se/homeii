# Homeii — Arkitekturrefaktorering av simulatorn

Du är en senior TypeScript/Next.js-utvecklare som hjälper mig refaktorera beräkningsmotorn i Homeii — en personlig energirådgivare för svenska hushåll. Projektet är en Next.js 16 / React 19 / Tailwind 4-app.

## Bakgrund och syfte

Homeii analyserar en privatpersons elräkning (och elnätsfaktura) och ger personliga rekommendationer för att sänka energikostnader och klimatpåverkan. Trovärdigheten i hela tjänsten hänger på att simuleringsmodellen och dess antaganden är **korrekta, transparenta och underhållbara**.

All kärnlogik ligger idag i `app/simulator/`. Det som behöver ske är en **strukturerad refaktorering** som gör systemet redo att växa utan att tappa kontroll över korrekthet.

## Nuvarande struktur

```
app/simulator/
├── calculations.ts    ← 1053 rader, ALL beräkningslogik i en fil
├── climate.ts         ← Klimatdata per SE-zon (SMHI, PVGIS)
├── constants.ts       ← Alla antaganden, priser, COP-kurvor, upgrade-definitioner
├── inference.ts       ← Inferens av hushållsprofil från elräkningsdata
├── storage.ts         ← localStorage-persistens
├── types.ts           ← TypeScript-typer
└── components/        ← 24 UI-komponenter
```

## Målstruktur efter refaktorering

```
app/simulator/
├── types.ts                          ← Oförändrad (centrala typer)
├── storage.ts                        ← Oförändrad
│
├── data/                             ← ALLA antaganden och datakällor
│   ├── README.md                     ← Översikt: vad varje datakälla är, var den uppdateras
│   ├── assumptions.ts                ← Master-export: samlar alla antaganden
│   ├── climate.ts                    ← Klimat per SE-zon (från nuvarande climate.ts)
│   ├── energy-prices.ts              ← Spotpriser, nätavgifter, effektavgifter per zon
│   ├── cop-curves.ts                 ← COP-kurvor per värmepumpstyp
│   ├── upgrade-catalog.ts            ← UpgradeDefinition[] med investeringskostnad, livslängd, reduktionsfaktorer
│   ├── co2-factors.ts                ← CO2/kWh per energikälla (el-mix, fjärrvärme, fossilt)
│   └── inference-rules.ts            ← Trösklar och regler för inferenslogik
│
├── simulation/                       ← REN beräkningslogik (inga sidoeffekter, ingen UI)
│   ├── hourly.ts                     ← simulateDay() — timsimulering, grundläggande byggsten
│   ├── monthly.ts                    ← simulateMonth() — aggregerar timdata till månader
│   ├── annual.ts                     ← simulateYear() + framtidsscenarier (prisscenarier)
│   ├── upgrades.ts                   ← applyUpgradesToHour(), COP-interpolering
│   ├── battery.ts                    ← simulateBattery() — redan en tydlig enhet
│   ├── scoring.ts                    ← calculateEnergyScore(), CO2-beräkning
│   └── scenarios.ts                  ← Prisscenarier framåt: inflation, EU-harmonisering
│
├── recommendations/                  ← Rekommendationsmotor
│   ├── engine.ts                     ← generateRecommendations() — 2 investeringar + tips
│   ├── investment-recs.ts            ← Logik för fysiska investeringar (vp, sol, batteri, etc.)
│   ├── lifestyle-tips.ts             ← Mjuka råd: elbil, timpris, grönt bolån
│   └── reasoning.ts                  ← Genererar förklaringskedjor per rekommendation
│
├── inference/                        ← Profilanalys från elräkning
│   ├── profile.ts                    ← inferProfileFromBill() (från nuvarande inference.ts)
│   └── bill-parser.ts               ← Normalisering av OCR/manuell indata → BillData
│
└── components/                       ← UI (oförändrad initialt)
```

## Kritiska krav

### 1. Antaganden ska vara explicita och spårbara

VARJE antagande i `data/` ska ha följande struktur:

```typescript
/**
 * COP-kurvor för värmepumpar vid olika utomhustemperaturer.
 *
 * @source Energimyndighetens värmepumpslista 2024
 * @url https://www.energimyndigheten.se/tester/varmepumpslistan/
 * @updated 2026-03-25
 * @notes Typiska SCOP-värden för populära modeller. Luftluft baserat på
 *        Mitsubishi/Daikin toppmodeller. Bergvärme baserat på NIBE F1245/F1155.
 */
export const HEAT_PUMP_COP_CURVES: Record<string, CopDataPoint[]> = { ... };
```

Varje konstant, faktor och tröskel ska ha: `@source` (varifrån), `@updated` (senast verifierad), och `@notes` (vad det baseras på). Detta är icke-förhandlingsbart — det ÄR produktens trovärdighet.

`data/README.md` ska lista alla datakällor med senaste verifieringsdatum.

### 2. Beräkningsmodulerna ska vara rena funktioner

Alla funktioner i `simulation/` ska vara **rena** — deterministic output för samma input, inga sidoeffekter. De tar emot ett `HouseholdProfile`-objekt (se nedan) och returnerar resultat. De importerar INTE direkt från `data/` — antagandena passas in som argument eller via ett `SimulationConfig`-objekt. Detta gör det möjligt att:
- Testa med override-värden
- Köra scenarion med andra antaganden
- I framtiden låta användaren justera antaganden

### 3. HouseholdProfile — simulatorns gemensamma indataformat

Definiera ett samlat `HouseholdProfile`-interface som är **den enda ingången** till beräkningsmotorn. Oavsett om data kommer från OCR, manuell inmatning eller en sparad profil ska allt normaliseras till detta format:

```typescript
interface HouseholdProfile {
  // Identifierad data (med confidence)
  location: {
    seZone: SEZone;
    confidence: ConfidenceLevel;
  };
  housing: {
    type: HousingType;
    areaSqm: number;
    residents: number;
    confidence: ConfidenceLevel;
  };
  heating: {
    types: HeatingType[];
    confidence: ConfidenceLevel;
  };
  consumption: {
    annualKwh: number;
    monthlyKwh?: number[];        // om tillgängligt från faktura
    peakKw?: number;              // om elnätsfaktura finns
    gridSubscriptionAmp?: number; // om elnätsfaktura finns
    confidence: ConfidenceLevel;
  };
  equipment: {
    hasSolar: boolean;
    solarSizeKw?: number;
    hasBattery: boolean;
    batterySizeKwh?: number;
    hasEv: boolean;
    evChargingHome: boolean;
    bigConsumers: BigConsumer[];
  };
  contract: {
    type: ElContractType;
    gridOperator?: string;
    gridFeeMonthly?: number;      // om elnätsfaktura finns
    powerFeePerKw?: number;       // om elnätsfaktura finns
  };

  // Metadata
  dataSources: DataSource[];       // vilka dokument som bidragit
  inferredFields: string[];        // vilka fält som är infererade vs bekräftade
  lastUpdated: string;
}

type DataSource = {
  type: "elrakning" | "natfaktura" | "manual" | "inferred";
  date?: string;
  provider?: string;
};
```

### 4. Rekommendationer: 2 investeringar + separata tips

Rekommendationsmotorn ska ge:
- **Exakt 2 investeringsrekommendationer** (den viktigaste åtgärden + en kompletterande). Rangordnade efter payback-tid med hänsyn till hushållets profil. Varje rekommendation har en förklaringskedja (se punkt 5).
- **Separata "tips"** som presenteras visuellt åtskilt:
  - Byt till elbil (om relevant) — beräkna besparing baserat på genomsnittlig körsträcka
  - Byt till timpris (om de inte redan har det) — beräkna besparing baserat på deras förbrukningsprofil
  - Ansök om grönt bolån (0,1% lägre ränta) — beräkna besparing baserat på genomsnittligt bolån för boendetyp/ort
- Tips ska ha `estimatedYearlySavingsKr` men ska INTE kräva timsimulering — enklare beräkningsmodeller räcker.

```typescript
interface RecommendationResult {
  investments: InvestmentRecommendation[];  // exakt 2
  tips: LifestyleTip[];                     // 0-3 beroende på profil
  currentScore: ScoreBreakdown;
  projectedScore: ScoreBreakdown;           // efter alla recs + tips
  co2: {
    currentKgPerYear: number;
    projectedKgPerYear: number;
    reductionPercent: number;
    equivalentTrees: number;                // pedagogiskt verktyg
  };
  energyIndependence: {
    currentGridDependencyPercent: number;
    projectedGridDependencyPercent: number;
    message: string;                        // "Minskar Sveriges importberoende"
  };
}

interface InvestmentRecommendation {
  upgradeId: UpgradeId;
  rank: 1 | 2;
  investmentKr: number;
  yearlySavingsKr: number;
  paybackYears: number;
  co2ReductionKgPerYear: number;
  reasoning: ReasoningChain;
  isTopPick: boolean;
}

interface LifestyleTip {
  id: "elbil" | "timpris" | "gront_bolan" | string;
  label: string;
  description: string;
  estimatedYearlySavingsKr: number;
  reasoning: string;
  actionUrl?: string;                       // extern länk t.ex. till bankens gröna bolån-sida
  icon: string;
}

interface ReasoningChain {
  summary: string;                          // "Vi rekommenderar bergvärme"
  factors: ReasoningFactor[];               // kedjan av varför
  assumptions: string[];                    // vilka antaganden som påverkar mest
}

interface ReasoningFactor {
  fact: string;                             // "Du har direktel som huvuduppvärmning"
  impact: string;                           // "70% av din förbrukning går till uppvärmning"
  source?: string;                          // "Baserat på din elräkning"
}
```

### 5. Förklaringskedjor (reasoning)

Varje rekommendation ska kunna svara på "varför just detta?" med en kedja:
1. **Fakta om hushållet**: "Du har direktel, 150 kvm, SE3"
2. **Slutsats från fakta**: "~70% av din el går till uppvärmning, 18 000 kWh/år"
3. **Varför denna åtgärd**: "Bergvärme ger COP 3.6 vid 0°C → minskar uppvärmningselen med ~70%"
4. **Ekonomisk slutsats**: "Besparing ~15 000 kr/år, payback 17 år"
5. **Antaganden som påverkar**: "Baserat på COP-data från Energimyndighetens värmepumpslista, elpris 130 öre/kWh (SE3-snitt)"

Denna kedja lagras i `ReasoningChain` och exponeras till UI (och i framtiden chatbot).

### 6. CO2 och energioberoende

Alla investeringsrekommendationer ska visa:
- **CO2-besparing** i kg/år, baserat på el-mixens CO2-faktor per SE-zon
- **Minskat importberoende** — visa hur egenproducerad el (sol) och minskad förbrukning (VP) minskar behovet av importerad el
- Använd pedagogiska jämförelser: "motsvarar X träd planterade" eller "som att ta bort Y bilar från vägen"

CO2-faktorer ska ligga i `data/co2-factors.ts` med källhänvisning (Energimyndigheten / IVL / Naturvårdsverket).

### 7. Prisscenarier framåt

Simulatorn ska stödja fyra prisscenarier för framåtblickande beräkningar:

```typescript
type PriceScenario = "follows_inflation" | "below_inflation" | "above_inflation" | "eu_harmonization";

interface PriceScenarioConfig {
  id: PriceScenario;
  label: string;
  yearlyElPriceGrowth: number;         // relativt inflation
  yearlyGridFeeGrowth: number;
  description: string;
  source: string;
}
```

- **Följer inflation** (2%/år) — basscenario
- **Under inflation** (0.5%/år) — mer förnybart, lägre marginalkostnad
- **Över inflation** (4%/år) — kapacitetsbrist, högre nätavgifter
- **EU-harmonisering** (6%/år) — svenska priser konvergerar mot europeiska nivåer

Dessa scenarier används i `simulation/scenarios.ts` för att räkna NPV och payback under olika framtider.

## Refaktoreringsordning

Gör detta steg för steg, i denna ordning:

1. **Skapa `data/`-katalogen** — flytta alla antaganden från `constants.ts`, lägg till `@source`/`@updated`/`@notes` på varje konstant. Behåll `constants.ts` som re-export tills allt är migrerat.
2. **Skapa `HouseholdProfile`-typen** i `types.ts`.
3. **Bryt ut `simulation/`** — börja med `battery.ts` (redan en tydlig enhet), sedan `upgrades.ts`, `hourly.ts`, `monthly.ts`, `annual.ts`, `scoring.ts`, `scenarios.ts`.
4. **Bryt ut `recommendations/`** — `engine.ts`, `investment-recs.ts`, `lifestyle-tips.ts`, `reasoning.ts`.
5. **Bryt ut `inference/`** — flytta från `inference.ts` till `inference/profile.ts`, skapa `bill-parser.ts`.
6. **Uppdatera `page.tsx` och komponenter** att använda nya imports.
7. **Verifiera** — kör appen, kontrollera att allt fungerar som innan.

**VIKTIGT**: Varje steg ska resultera i en fungerande app. Gör INTE alla ändringar på en gång. Committa efter varje steg. Om något går sönder, backa till senaste fungerande state.

## Vad du INTE ska ändra (ännu)

- UI-komponenterna i `components/` — de uppdateras i ett separat steg
- Flödet i `page.tsx` — steg-logiken funkar och ska inte röras nu
- `storage.ts` — fungerar, låt vara
- Design/styling — inte i scope

## Kodstil

- TypeScript strict mode
- Alla funktioner i `simulation/` och `recommendations/` ska ha JSDoc med beskrivning av vad de gör, vilka antaganden de bygger på, och vad de returnerar
- Inga magiska tal — allt ska referera till namngivna konstanter i `data/`
- Exportera typer från `types.ts`, inte from implementation-filer
