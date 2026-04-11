# Homeii — Steg 2: Fixa buggar, implementera stubbar, komplettera typer

Du fortsätter refaktoreringen av Homeii-simulatorn. Steg 1 (mappstruktur) är klart — `data/`, `simulation/`, `recommendations/` och `inference/` finns på plats. Nu behöver vi fixa det som inte blev klart.

## 1. KRITISKT: Fixa kompileringsfel

### calculations.ts — skräpdata efter rad 50
Filen `app/simulator/calculations.ts` har tusentals osynliga tecken (null bytes) efter rad 49. Rensa bort allt efter rad 49 så filen bara innehåller re-exports. Filen ska se ut exakt så här:

```typescript
/**
 * Barrel re-export — all calculation/simulation logic.
 * Maintained for backwards compatibility.
 * Prefer importing directly from simulation/ or recommendations/ modules.
 */

// Re-export everything from simulation layer
export {
  getBlendedHeatingShare,
  getHeatPumpCOP,
  getAdjustedSeasonFactors,
  getSeasonFactorForDate,
  applyUpgradesToHour,
  buildExistingEquipmentUpgrades,
  NO_UPGRADES,
  simulateBattery,
  getAdjustedHourlyProfile,
  getTemperatureForDateHour,
  getSolarProductionForHour,
  getHourlyData,
  simulateDay,
  getMonthlyData,
  simulateMonthsWithUpgrades,
  calculatePricePerKwh,
  calculateDailyKwh,
  calculateYearlyKwh,
  estimateZeroEquipmentBill,
  getYearlyData,
  getPrecision,
  calculateAnnualSummary,
  calculateEnergyScore,
  calculateThreeScenarios,
  PRICE_SCENARIOS,
  projectCostsOverTime,
  calculateNPV,
} from "./simulation/index";

export type { PriceScenario } from "./climate";

export { generateRecommendations } from "./recommendations/engine";
```

### page.tsx — JSX-kompileringsfel
`app/page.tsx` har obalanserade JSX-taggar (div som inte stängs korrekt runt rad 180-250). Öppna filen, identifiera var taggarna inte matchar, och fixa.

## 2. Komplettera HouseholdProfile i types.ts

`HouseholdProfile` slutar abrupt på rad 207. Den behöver kompletteras med resterande fält. Här är den fullständiga definitionen:

```typescript
/** Unified simulation input — represents a household's energy profile */
export interface HouseholdProfile {
  // Consumption data
  monthlyKwh: number;
  monthlyCostKr: number;
  annualKwh: number;
  monthlyKwhBreakdown?: number[];     // 12 månaders fördelning om tillgänglig

  // Housing
  housingType: HousingType;
  heatingTypes: HeatingType[];
  areaM2: number;
  residents: number;
  seZone: SEZone;

  // Grid & contract
  elContractType: ElContractType;
  gridOperator?: string;
  gridFeeMonthlyKr?: number;          // från elnätsfaktura
  powerFeePerKw?: number;             // från elnätsfaktura
  peakKw?: number;                    // effekttopp från elnätsfaktura
  gridSubscriptionAmp?: number;       // säkringsstorlek

  // Equipment
  hasSolar: boolean;
  solarSizeKw: number;
  hasBattery: boolean;
  batterySizeKwh: number;
  bigConsumers: BigConsumer[];

  // EV
  hasEv: boolean;
  evChargingHome: boolean;

  // Metadata
  dataSources: DataSource[];
  inferredFields: string[];           // vilka fält som är infererade vs bekräftade av användaren
  lastUpdated: string;                // ISO date
}

export interface DataSource {
  type: "elrakning" | "natfaktura" | "manual" | "inferred";
  date?: string;
  provider?: string;
}
```

## 3. Implementera lifestyle-tips.ts

Filen `app/simulator/recommendations/lifestyle-tips.ts` returnerar idag `[]`. Implementera tre tips-typer:

```typescript
import type { RefinementAnswers, SEZone, HousingType } from "../types";

export interface LifestyleTip {
  id: "elbil" | "timpris" | "gront_bolan";
  label: string;
  description: string;
  estimatedYearlySavingsKr: number;
  reasoning: string;
  actionUrl?: string;
  icon: string;
  applicableWhen: string;  // förklaring av varför tipset visas/inte visas
}

/**
 * Generera livsstilstips baserat på hushållets profil.
 * Dessa kräver INTE timsimulering — enklare beräkningsmodeller.
 *
 * @source Diverse — se individuella beräkningar nedan
 */
export function generateLifestyleTips(
  refinement: RefinementAnswers,
  seZone: SEZone,
  annualKwh: number,
  annualCostKr: number
): LifestyleTip[] {
  const tips: LifestyleTip[] = [];

  // --- ELBIL ---
  // Visa om användaren INTE redan har elbil och inte kör via företaget
  if (refinement.elCar !== "ja" && !refinement.bigConsumers?.includes("elbil")) {
    /**
     * Beräkning:
     * Genomsnittlig körsträcka: 1200 mil/år (Transportstyrelsen 2024)
     * Bensinbil: ~0.7 L/mil * 20 kr/L = 14 kr/mil
     * Elbil: ~2 kWh/mil * zonpris/100 = varierar per zon
     * Besparing = (bensinkostnad - elkostnad) per år
     *
     * @source Transportstyrelsen — genomsnittlig körsträcka
     * @source Energimyndigheten — drivmedelspriser
     * @updated 2026-04-04
     */
    const annualMiles = 1200; // mil/år
    const petrolCostPerMile = 14; // kr/mil (0.7L * 20kr)
    const SE_ZONE_AVG_PRICE_KR: Record<SEZone, number> = {
      SE1: 0.72, SE2: 0.76, SE3: 0.92, SE4: 1.05,
    };
    const evCostPerMile = 2 * SE_ZONE_AVG_PRICE_KR[seZone]; // 2 kWh/mil * elpris
    const evSavings = Math.round((petrolCostPerMile - evCostPerMile) * annualMiles);

    tips.push({
      id: "elbil",
      label: "Byt till elbil",
      description: `Spara uppskattningsvis ${evSavings.toLocaleString("sv-SE")} kr/år på drivmedel genom att byta från bensinbil till elbil.`,
      estimatedYearlySavingsKr: evSavings,
      reasoning: `Baserat på ${annualMiles} mil/år (svenskt genomsnitt), bensinpris ~20 kr/L och ditt elpris i ${seZone}.`,
      actionUrl: "https://elbilskompassen.se",
      icon: "🚗",
      applicableWhen: "Användaren har inte elbil idag",
    });
  }

  // --- TIMPRIS ---
  // Visa om användaren INTE redan har dynamiskt avtal
  if (refinement.elContractType !== "dynamic") {
    /**
     * Beräkning:
     * Hushåll som aktivt kan flytta förbrukning sparar typiskt 5-15% på energikostnaden.
     * Vi antar konservativt 8% besparing för ett genomsnittshushåll med viss flexibilitet.
     * Hushåll med värmepump, elbil eller batteri har högre besparingspotential (12%).
     *
     * @source Energimarknadsinspektionen — rapport om timprisavtal 2024
     * @updated 2026-04-04
     */
    const hasFlexibleLoad = refinement.hasSolar || refinement.hasBattery ||
      refinement.bigConsumers?.includes("elbil") ||
      refinement.heatingTypes?.some(ht => ht === "luftluft" || ht === "luftvatten" || ht === "bergvarme");

    const savingsPercent = hasFlexibleLoad ? 0.12 : 0.08;
    const timeSavings = Math.round(annualCostKr * savingsPercent);

    tips.push({
      id: "timpris",
      label: "Byt till timpris",
      description: `Genom att byta till timprisavtal och styra förbrukning till billiga timmar kan du spara uppskattningsvis ${timeSavings.toLocaleString("sv-SE")} kr/år.`,
      estimatedYearlySavingsKr: timeSavings,
      reasoning: hasFlexibleLoad
        ? `Du har flexibel last (värmepump/elbil/batteri) som kan styras automatiskt — det ger ~12% besparing.`
        : `Genom att flytta disk/tvätt/laddning till billiga timmar kan ett genomsnittshushåll spara ~8%.`,
      icon: "⚡",
      applicableWhen: "Användaren har inte timprisavtal idag",
    });
  }

  // --- GRÖNT BOLÅN ---
  // Visa för villaägare och radhusägare (inte lägenheter — de har oftast bostadsrätt utan eget bolån av denna typ)
  const housingType = refinement.housingType;
  if (housingType === "villa" || housingType === "radhus") {
    /**
     * Beräkning:
     * Genomsnittligt bolån villa: ~2 500 000 kr (SCB/Finansinspektionen 2024)
     * Genomsnittligt bolån radhus: ~2 000 000 kr
     * Grönt bolån-rabatt: typiskt 0.10% lägre ränta (SBAB, Swedbank, Nordea)
     * Besparing = bolån * 0.001
     *
     * @source Finansinspektionen — bolånestatistik
     * @source SBAB, Swedbank — gröna bolånevillkor 2025
     * @updated 2026-04-04
     */
    const avgMortgage = housingType === "villa" ? 2500000 : 2000000;
    const greenDiscount = 0.001; // 0.10%
    const mortgageSavings = Math.round(avgMortgage * greenDiscount);

    tips.push({
      id: "gront_bolan",
      label: "Ansök om grönt bolån",
      description: `Kontakta din bank om grönt bolån — du kan spara ca ${mortgageSavings.toLocaleString("sv-SE")} kr/år med 0,1% lägre ränta.`,
      estimatedYearlySavingsKr: mortgageSavings,
      reasoning: `Baserat på genomsnittligt bolån för ${housingType === "villa" ? "villa" : "radhus"} (${(avgMortgage / 1000000).toFixed(1)} Mkr) och 0,1% rabatt som flera storbanker erbjuder.`,
      icon: "🏦",
      applicableWhen: "Användaren bor i villa eller radhus (har sannolikt eget bolån)",
    });
  }

  return tips;
}
```

## 4. Implementera reasoning.ts

Filen `app/simulator/recommendations/reasoning.ts` returnerar idag `null`. Implementera:

```typescript
import type { Recommendation, RefinementAnswers, SEZone, Assumptions } from "../types";

export interface ReasoningFactor {
  fact: string;       // "Du har direktel som huvuduppvärmning"
  impact: string;     // "70% av din förbrukning går till uppvärmning"
  source?: string;    // "Baserat på din elräkning"
}

export interface ReasoningChain {
  summary: string;
  factors: ReasoningFactor[];
  assumptions: string[];
}

/**
 * Bygg en förklaringskedja för en investerings­rekommendation.
 * Kedjan ska svara på "varför just detta?" med fakta → slutsats → motivering.
 */
export function buildReasoningChain(
  rec: Recommendation,
  refinement: RefinementAnswers,
  seZone: SEZone,
  annualKwh: number,
  assumptions: Assumptions
): ReasoningChain {
  const factors: ReasoningFactor[] = [];
  const assumptionsList: string[] = [];

  // Steg 1: Fakta om hushållet
  const heatingTypes = refinement.heatingTypes ?? (refinement.heatingType ? [refinement.heatingType] : []);
  const heatingLabel = heatingTypes.length > 0
    ? heatingTypes.join(" + ")
    : "okänd uppvärmning";

  factors.push({
    fact: `Du bor i ${refinement.housingType ?? "okänd bostad"}, ${refinement.area ?? "okänd"} kvm i ${seZone}`,
    impact: `Din årsförbrukning är ca ${Math.round(annualKwh).toLocaleString("sv-SE")} kWh`,
    source: "Baserat på din elräkning",
  });

  factors.push({
    fact: `Din uppvärmning: ${heatingLabel}`,
    impact: getHeatingImpact(heatingTypes, annualKwh),
    source: refinement.heatingTypes ? "Bekräftat av dig" : "Uppskattat baserat på förbrukning",
  });

  // Steg 2: Varför denna åtgärd
  const upgradeReasoning = getUpgradeSpecificFactors(rec.upgradeId, refinement, seZone, annualKwh);
  factors.push(...upgradeReasoning.factors);
  assumptionsList.push(...upgradeReasoning.assumptions);

  // Steg 3: Ekonomisk slutsats
  factors.push({
    fact: `Investering: ${rec.investmentKr.toLocaleString("sv-SE")} kr`,
    impact: `Besparing: ~${rec.yearlySavingsKr.toLocaleString("sv-SE")} kr/år → återbetalningstid ${rec.paybackYears} år`,
  });

  // Gemensamma antaganden
  assumptionsList.push(`Elpris: genomsnitt för ${seZone} baserat på Elpriskollen/Nord Pool 2023-2025`);
  assumptionsList.push(`Nätavgift: ${assumptions.gridFeeKrPerMonth} kr/mån fast + ${assumptions.powerFeeKrPerKw} kr/kW effektavgift`);

  return {
    summary: rec.reasoning,
    factors,
    assumptions: assumptionsList,
  };
}

function getHeatingImpact(heatingTypes: string[], annualKwh: number): string {
  if (heatingTypes.includes("direktel")) {
    const heatingKwh = Math.round(annualKwh * 0.7);
    return `Uppskattningsvis ${heatingKwh.toLocaleString("sv-SE")} kWh/år går till uppvärmning (direktel = ineffektivt)`;
  }
  if (heatingTypes.includes("bergvarme")) {
    return "Bergvärme ger redan låg elförbrukning för uppvärmning — fokusera på andra åtgärder";
  }
  if (heatingTypes.includes("luftluft")) {
    return "Luft/luft-värmepump hjälper men har begränsad effekt vid riktigt kallt väder";
  }
  return "Uppvärmningen står sannolikt för en betydande del av din elförbrukning";
}

function getUpgradeSpecificFactors(
  upgradeId: string,
  refinement: RefinementAnswers,
  seZone: SEZone,
  annualKwh: number
): { factors: ReasoningFactor[]; assumptions: string[] } {
  const factors: ReasoningFactor[] = [];
  const assumptions: string[] = [];

  switch (upgradeId) {
    case "bergvarme":
      factors.push({
        fact: "Bergvärme har stabil COP 3.2-4.2 oavsett utomhustemperatur",
        impact: `Kan minska din uppvärmningsel med ~70% jämfört med direktel`,
        source: "COP-data: Energimyndighetens värmepumpslista 2024",
      });
      assumptions.push("COP baserat på NIBE F1245/F1155 typvärden");
      assumptions.push("Investering inkl borrning: ~260 000 kr (landsgenomsnitt)");
      break;

    case "luftvatten":
      factors.push({
        fact: "Luft/vatten-värmepump ger COP 1.5-4.3 beroende på utetemperatur",
        impact: "Ersätter hela uppvärmningssystemet — bäst om du har vattenburet system",
        source: "COP-data: Energimyndighetens värmepumpslista 2024",
      });
      assumptions.push("COP varierar med säsong — lägre vintertid i norra Sverige");
      break;

    case "luftluft":
      factors.push({
        fact: "Luft/luft-värmepump ger COP 1.3-4.0 beroende på utetemperatur",
        impact: "Mest kostnadseffektiv per investerad krona — snabb återbetalningstid",
        source: "COP-data: Energimyndighetens värmepumpslista 2024",
      });
      assumptions.push("Täcker inte hela bostaden — kompletterande uppvärmning kan behövas");
      break;

    case "solceller":
      factors.push({
        fact: `Solproduktion i ${seZone} ger bra avkastning med nuvarande elpris`,
        impact: `Producera din egen el och sälj överskottet — minskar nettokostnaden`,
        source: "Produktionsdata: PVGIS 5.2 (EU Joint Research Centre)",
      });
      assumptions.push(`Systemstorlek ${refinement.solarSizeKw ?? 10} kW, optimal lutning söder`);
      assumptions.push("Inkluderar hembatteri för ökad egenanvändning");
      break;

    case "smartstyrning":
      factors.push({
        fact: "Smart styrning optimerar uppvärmning och förbrukning automatiskt",
        impact: "Typiskt ~8% besparing genom att undvika onödig förbrukning",
      });
      assumptions.push("Besparing baserad på branschgenomsnitt för smart home-system");
      break;

    case "varmvattenpump":
      factors.push({
        fact: "En varmvattenpump (brinevärmepump) minskar varmvattenkostnaden med ~65%",
        impact: `Varmvatten utgör ca 15% av din förbrukning — besparingen är stabil året runt`,
      });
      assumptions.push("Reduktionsfaktor 65% baserad på COP ~3 för dedikerade varmvattenpumpar");
      break;

    default:
      factors.push({
        fact: `${upgradeId} minskar din energiförbrukning`,
        impact: `Se detaljerad beräkning i simulatorn`,
      });
  }

  return { factors, assumptions };
}
```

## 5. Lägg till EU-harmoniseringsscenario

I `app/simulator/climate.ts`, lägg till ett fjärde prisscenario i `PRICE_SCENARIOS`:

```typescript
export const PRICE_SCENARIOS: Record<string, PriceScenario> = {
  base: {
    label: "Basscenario (följer inflation)",
    annualPriceChange: 0.02,
    annualGridFeeChange: 0.03,
    volatilityMultiplier: 1.0,
  },
  below_inflation: {
    label: "Under inflation (mer förnybart)",
    annualPriceChange: 0.005,
    annualGridFeeChange: 0.02,
    volatilityMultiplier: 0.8,
  },
  above_inflation: {
    label: "Över inflation (kapacitetsbrist)",
    annualPriceChange: 0.04,
    annualGridFeeChange: 0.05,
    volatilityMultiplier: 1.3,
  },
  eu_harmonization: {
    label: "EU-harmonisering",
    annualPriceChange: 0.06,
    annualGridFeeChange: 0.05,
    volatilityMultiplier: 1.5,
  },
};
```

OBS: Uppdatera alla ställen som refererar till de gamla scenario-namnen ("optimistic", "pessimistic") till de nya namnen.

## 6. Skapa data/README.md

Skapa filen `app/simulator/data/README.md`:

```markdown
# Datakällor — Homeii Simulator

Alla antaganden och konstanter som simulatorn bygger på. Varje fil har `@source`, `@updated` och `@notes` i JSDoc-kommentarer.

## Filer

| Fil | Innehåll | Huvudkälla | Senast verifierad |
|-----|----------|------------|-------------------|
| `climate.ts` (parent) | Temperatur, sol, gradtimmar per SE-zon | SMHI, PVGIS | 2026-04-04 |
| `cop-curves.ts` | COP per värmepumpstyp vid olika temperaturer | Energimyndighetens värmepumpslista | 2026-04-04 |
| `energy-prices.ts` | Spotpris, nätavgift, effektavgift per SE-zon | Elpriskollen / Nord Pool 2023-2025 | 2026-04-04 |
| `energy-profiles.ts` | Förbrukningsprofiler (tim, säsong, storförbrukare) | Energimyndigheten / branschdata | 2026-04-04 |
| `solar-profiles.ts` | Solproduktion timvis (sommar/vinter blend) | PVGIS 5.2 | 2026-04-04 |
| `upgrade-catalog.ts` | Investeringskostnad, livslängd, reduktionsfaktorer | Huskomponenter.se, branschsnitt | 2026-04-04 |
| `co2-factors.ts` | CO2/kWh per energikälla | Naturvårdsverket, Energimyndigheten | 2026-04-04 |
| `inference-rules.ts` | Trösklar och regler för profilinferens | Intern kalibrering | 2026-04-04 |
| `defaults.ts` | Standardvärden (nätavgift, effektavgift, batteri) | Ellevio, Vattenfall, E.ON | 2026-04-04 |
| `strings.ts` | UI-texter | — | 2026-04-04 |

## Uppdateringsrutin

Varje antagande ska verifieras minst en gång per halvår. Vid uppdatering:
1. Ändra värdet i respektive fil
2. Uppdatera `@updated`-datumet
3. Notera ändringen i CHANGELOG
```

## 7. Verifiering

När allt ovan är klart:
1. Kör `npx tsc --noEmit` — ska ge 0 fel
2. Kör `npm run dev` — sidan ska laddas utan fel
3. Testa flödet manuellt: ladda upp/mata in en elräkning → verifiera → se rekommendationer

**VIKTIGT**: Gör ett steg i taget. Committa efter varje steg. Verifiera att appen bygger innan du går vidare till nästa.
