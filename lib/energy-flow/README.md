# lib/energy-flow

Energiflödes-simulering för svenska villa-hushåll. Simulerar ett dygn (24
timsteg) med varierande utrustning: värmepump, solpaneler, hembatteri,
elbil med V2H, smart styrning. Hanterar tre säsonger (vinter, vår·höst,
sommar) och två prismodeller (månadsmedel, dynamiskt).

Används primärt av visualiseringen i `app/kunskap/energiguiden/`.

## Översikt

| Fil | Vad |
|-----|-----|
| `types.ts` | Typer: `Settings`, `Scenario`, `HourSnapshot`, `Narrative`, `Allocation` mfl. |
| `constants.ts` | Spotpriser, sol-tider, batteri- och EV-konstanter, säsongsvikter. |
| `build-scenario.ts` | Huvudsimuleringen — 24 timsteg, två-pass warmup, peak shaving. |
| `allocate.ts` | Proportionell fördelning av varje källas bidrag till lasterna. |
| `narrative.ts` | Tid-baserad narrativtext (5 stabila slots/dygn). |
| `annual-saving.ts` | Säsongsviktad årsbesparing vs gårdagens hem. |
| `index.ts` | Barrel-export. |

## Användning

```ts
import { buildScenario, allocate, computeAnnualSaving } from "@/lib/energy-flow";

const settings = {
  season: "vinter",
  hasHP: true, hasEV: true, hasSol: true, hasBat: true, hasSmart: true,
  prismodell: "dynamiskt",
};

const scenario = buildScenario(settings);
console.log(`Dagskostnad: ${scenario.dayCost.toFixed(1)} kr`);
console.log(`Peak: ${scenario.peakKw.toFixed(1)} kW`);

// Energiflöden vid en specifik timme:
const flows = allocate(scenario.hours[12]);
console.log(`Sol → värme: ${flows["sol-heat"].toFixed(2)} kW`);

// Säsongsviktad jämförelse mot gårdagens hem:
const saving = computeAnnualSaving(settings);
console.log(`Total årsbesparing: ${Math.round(saving.total)} kr`);
console.log(`  Vinter: ${Math.round(saving.byseason.vinter)} kr`);
console.log(`  Vår·Höst: ${Math.round(saving.byseason.host)} kr`);
console.log(`  Sommar: ${Math.round(saving.byseason.sommar)} kr`);
```

## Modell-antaganden

Modellen är **pedagogisk**, inte exakt. Viktiga förenklingar:

- **Spotpris:** Statiska timpriser per säsong (typvärden för SE3).
- **Utomhustemp:** Cosinus-vågform med min vid 04:00, max vid 16:00.
- **Värmebehov:** Linjär funktion av (indoorTarget - outT) × heatRate.
- **Solproduktion:** Sin-kurva mellan sunrise och sunset.
- **Sommar-AC:** Aktiveras när outT > 22 °C, COP 3,0.
- **EV-cykel:** 30 ↔ 50 mil per dygn (driving + V2H = ~20 mil ut, natt-laddning = ~20 mil in).
- **Stödtjänster:** 3 fasta event/dygn, totalt 17 kr (FCR-D-typvärden för 10 kWh batteri).
- **Effektavgift:** 3 kr/kW/dag baserat på dygnets högsta nät-effekt.

För realistiska vinterdagar i SE3 modelleras tempspann -5 till 1 °C
(genomsnitt ca -2 °C) — inte kallaste januari-veckan.

## Två-pass warmup

`buildScenario` kör simuleringen två gånger. Första passet är "warmup"
som låter batteri-SOC och elbil-räckvidd konvergera till steady state.
Andra passet är det visualiserade dygnet — startar från slutet av första
passet, så användaren ser en realistisk daglig cykel istället för
"första dagen från nollläge".

## Peak shaving

I smart-läge håller systemet nät-effekten under ett säsongs-tak (vinter
8 kW, vår·höst 5 kW, sommar 2 kW). Reducerar i ordning:

1. **EV-laddning** först (lång laddningsperiod, kan spridas)
2. **Batteri-laddning** sedan (kort fönster, behövs för kvällspeak)

Värme och varmvatten är **alltid** skyddade — peak-cap minskar inte komfort.
