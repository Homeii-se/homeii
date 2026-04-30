# `lib/comparison`

Comparison module — beräknar hur en användares årliga elkostnad förhåller sig till
andra villor i deras geografiska område.

## Vad modulen gör

Givet en användares totala årskostnad (kr) och geokodade position (lat/lon)
returneras:
- En distribution över villor i deras område: `p10` / `p50` / `p90` (kr/år inkl moms)
- Användarens percentil på den distributionen (0–100)
- Skillnad mot medianen, både i kr och som andel

UI:et i `ResultScrollFlow` använder detta för att rendera "Mot dina grannar"-kortet
(bell-kurva, Lägst/Snitt/Högst-rad och insight-mening).

## Datakällor

Distributionen är härledd från **riktig svensk officiell statistik** (2024):

| Källa | Vad vi använder | Länk |
|-------|-----------------|------|
| **Energimyndigheten** *Energistatistik för småhus 2024* T3.12 | El GWh per län (inkl. hushållsel) — primär källa för **per-län** snittförbrukning | [energimyndigheten.se](https://www.energimyndigheten.se/statistik/officiell-energistatistik/tillforsel-och-anvandning/energistatistik-for-smahus/) |
| **Energimyndigheten** *Energistatistik för småhus 2024* T3.2 | Antal villor per län — sample size + nämnare i kWh-snitt-räkningen | Samma rapport |
| SCB *Uttagspunkter efter användningsområde, elområde och år* (2024) | Per-zon spridning (andel <10 000 kWh) → används för σ i lognormal | [statistikdatabasen.scb.se](https://www.statistikdatabasen.scb.se/) |
| SCB *Elanvändning i Sverige efter användningsområde, elområde och år* (2024) | Validering av Energimyndigheten-data | Samma databas |
| Spotpris-data 2024 (SE1–SE4) | Validera kr/kWh-koefficienter | `app/simulator/data/historical-spot.ts` |

Råunderlaget och alla beräkningar finns i [`data/scb-2024.md`](./data/scb-2024.md).

## Modellen — så räknas det

1. **Lognormal fit per zon.** För varje SE-zon (SE1–SE4) fittas en lognormal
   distribution mot två kända SCB-punkter: vägt snitt kWh + andel <10 000 kWh.
   P10/P50/P90 i kWh extraheras.

2. **kWh → kr per zon.** Modell: `kr = fast_avgifter + rörlig_kr_per_kWh × kWh`.
   Koefficienterna är kalibrerade mot 2024 års spotpriser, energiskatt (45 öre),
   moms 25 % och representativa nät-/elhandelsavgifter per zon.

3. **Län → zon-mappning.** 21 län mappas till sin huvudsakliga SE-zon. För län
   som spänner flera zoner (t.ex. Västerbotten) väljs zonen majoriteten av
   befolkningen bor i.

### Sanity-check

Modellen valideras mot Mattias faktiska faktura:
- 11 000 kWh i SE3 → modellen säger 8 000 + 1.50 × 11 000 = **24 500 kr**
- Faktisk faktura: **24 326 kr**
- **Avvikelse 0.7 %** ✅

### Resulterande distribution per län (kr/år inkl moms, urval)

| Län (kod) | P10     | P50     | P90     | Antal villor |
|-----------|--------:|--------:|--------:|-------------:|
| Stockholm (AB) |  21 300 |  28 300 |  39 000 |   279 635 |
| Skåne (M)      |  18 600 |  24 300 |  33 000 |   278 800 |
| Västra G. (O)  |  18 400 |  23 900 |  32 300 |   336 950 |
| Halland (N)    |  19 000 |  24 800 |  33 900 |    94 059 |
| Värmland (S)   |  18 400 |  23 900 |  32 300 |    63 885 |
| Norrbotten (BD)|  13 200 |  19 500 |  33 000 |    54 930 |

Notera: **Stockholm sticker ut med högt P50** eftersom länet har många stora
villor i Bromma/Lidingö/Saltsjöbaden som drar upp snittet. Alla 21 län finns
i `data/distributions.ts`.

## Vad modulen inte gör (än)

- **Nätbolags-specifik prissättning.** Jämförelsen gäller en zon-genomsnittlig
  nätbolagsmix, inte exakt det användaren har. En villa med dyrt nätbolag kan
  visas som "över snittet" delvis pga nätbolaget. Framtida steg: använd
  `app/simulator/data/grid-operators.ts` för nätbolags-justerad referensdistribution.
- **Storleks- eller uppvärmningsbucketing.** Alla villor jämförs mot varandra,
  oavsett storlek/uppvärmning. Detta är ett medvetet design-val (skillnader signalerar
  potential för förbättring), men för stora hus kan den absoluta kr-skillnaden vara
  missvisande. En framtida storleks-justerad jämförelse via kr/kWh diskuterades.
- **Län-finkornighet.** 21 län → 4 zoner förlorar nyans (en villa i Småland och en
  i Stockholm faller båda i SE3 trots olika klimat).
- **Empirisk data.** Allt är modellerat. När Homeii har ≥10 riktiga uppladdade
  räkningar för ett finare område byter vi distributionen för det området.

## Empirisk migration

När `sampleSize ≥ 10` riktiga uppladdade räkningar finns för ett tightare scope
(kommun eller postnummer-zon) ska modellen byta från modellerad till empirisk:

1. Aggregera uppladdade räkningar per `kommun_id` eller `postnummer_prefix`.
2. Beräkna empiriska percentiler (P10/P50/P90) över aggregatet.
3. `scope.mode = "empirical"`, `scope.kind` smalnar till `"kommun"` eller `"postnummer"`.
4. UI:et fortsätter visa "ditt område" som label men kan i metodologi-panelen
   förklara att jämförelsen nu baseras på faktiska räkningar.

## Begränsningar att kommunicera till användaren

- "Modellerad" / "Beta"-tag ska visas i UI:et tills empiriska data finns.
- Texten "ditt område" är medvetet generisk för att inte ge intrycket att
  jämförelsen är hyperlokal när den i själva verket är zon-bred.

## API

```ts
import { computeComparison } from "@/lib/comparison";

const result = computeComparison({
  yearlyKr: 24_326,
  latitude: 59.33,
  longitude: 18.07,
});

// → {
//   scope: { kind: "lan", id: "AB", label: "ditt område",
//            sampleSize: 1337577, mode: "modeled" },
//   distribution: { p10: 19000, p50: 25000, p90: 34000 },
//   user: {
//     kr: 24326,
//     percentile: 45.5,         // strax under medianen
//     diffFromMedian: -674,
//     diffFraction: -0.027      // 2.7 % under snittet
//   }
// }
```

## Senast uppdaterad

- **2026-04-30** — initial SCB-baserad kalibrering för 2024 års data. Ska
  uppdateras när SCB publicerar 2025-statistiken (sker typiskt Q4 påföljande år).
