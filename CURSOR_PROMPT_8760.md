# Implementera 8760-timmars simulering med PVGIS TMY

## Bakgrund

Homeii är en Next.js-app (app router, TypeScript) som hjälper svenska hushåll förstå sina elkostnader. Nuvarande simuleringsmodell kör **en representativ dag per månad** (den 15:e) och skalar till månadstotaler — 12 × 24 = 288 unika timmar. Det ger systematiskt fel vid beräkning av solcells-egenförbrukning vs export, eftersom dag-till-dag-variation i solinstålning och temperatur helt ignoreras.

Vi ska ersätta detta med **8 760 unika timmar** baserade på PVGIS TMY (Typical Meteorological Year) — verklig timvis solinstrålning och temperatur för hela året.

## Designprincip

**Inga snittdata.** Varje timme ska ha en unik kombination av förbrukning (driven av verklig temperatur) och solproduktion (driven av verklig instrålning). Genomsnitt ger falska beslutsunderlag.

## Befintlig arkitektur (rör INTE dessa om det inte krävs)

- `app/simulator/simulation/hourly.ts` — `simulateDay()` ger 24 timmar för en representativ dag. Behålls för snabba månadsöversikter i UI.
- `app/simulator/simulation/monthly.ts` — `simulateMonthsWithUpgrades()` kör simulateDay() 12 gånger (en per månad). Behålls.
- `app/simulator/simulation/cost-model.ts` — `calculateMonthlyCost()` beräknar kostnad per månad. Behålls.
- `app/simulator/climate.ts` — temperaturmodell med graddagar, `getTemperature()`, `getSolarProduction()`. Har referensdata per SE-zon (SE1-SE4).
- `app/simulator/data/solar-profiles.ts` — PVGIS-baserad månadsproduktion för 10 kW, timprofiler sommar/vinter.
- `app/simulator/simulation/scenarios.ts` — tre-scenariojämförelse. Här ska 8760-resultatet integreras för nuläge-exportkredit.
- `app/simulator/types.ts` — alla typer. BillData, RefinementAnswers, etc.

## Vad som ska byggas — 5 faser

### Fas 1: PVGIS TMY-integration

**Ny fil: `app/simulator/data/pvgis-tmy.ts`**

```typescript
export interface TmyHourlyData {
  time: string;        // "20070101:0010" format
  ghi: number;         // Global Horizontal Irradiance, W/m²
  dni: number;         // Direct Normal Irradiance, W/m²
  dhi: number;         // Diffuse Horizontal Irradiance, W/m²
  tempC: number;       // Outdoor temperature, °C
  windMs: number;      // Wind speed m/s
}

export async function fetchTmyData(lat: number, lon: number): Promise<TmyHourlyData[]>
export function parseTmyJson(json: any): TmyHourlyData[]
```

**API-endpoint:** `GET https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat={lat}&lon={lon}&outputformat=json`

JSON-svaret har strukturen:
```json
{
  "outputs": {
    "tmy_hourly": [
      { "time(UTC)": "20070101:0010", "G(h)": 0, "Gb(n)": 0, "Gd(h)": 0, "T2m": -5.2, "WS10m": 3.1 },
      ...
    ]
  }
}
```

Mappa: `G(h)` → ghi, `Gb(n)` → dni, `Gd(h)` → dhi, `T2m` → tempC, `WS10m` → windMs.

**Ny fil: `app/api/pvgis-tmy/route.ts`** — Server-side proxy (undviker CORS). Avrunda koordinater till 0.1° för cache-effektivitet.

**Caching:** TMY-data ändras aldrig — cacha permanent. Enkel in-memory Map i API-routen + localStorage på klienten.

**Acceptanskriterier:**
- fetchTmyData(59.37, 18.07) returnerar exakt 8 760 poster
- Varje post har ghi ≥ 0 och tempC i rimligt intervall

### Fas 2: Geocoding från faktura-adress

**Ny fil: `app/simulator/data/geocoding.ts`**

```typescript
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null>
```

Använd OpenStreetMap Nominatim: `https://nominatim.openstreetmap.org/search?q={address}&format=json&countrycodes=se&limit=1`

**Ändra: `app/api/parse-invoice/route.ts`** — efter LLM-extraktion, om adressen finns, kör geocoding.

**Ändra: `app/simulator/types.ts`** — lägg till `latitude?: number` och `longitude?: number` på BillData.

**Fallback:** Om geocoding misslyckas, använd SE-zon-centroid:
- SE1: 65.58, 22.15 (Luleå)
- SE2: 62.39, 17.31 (Sundsvall)
- SE3: 59.33, 18.07 (Stockholm)
- SE4: 55.60, 13.00 (Malmö)

### Fas 3: Temperaturdriven förbrukningsmodell (8760 timmar)

**Ny funktion i `app/simulator/simulation/simulate8760.ts`:**

```typescript
export function simulate8760Consumption(
  bill: BillData,
  refinement: RefinementAnswers,
  tmyData: TmyHourlyData[],
  seZone: SEZone
): number[]  // 8760 values, kWh per timme
```

**Logik per timme:**
1. **Baslast:** Använd befintlig HOURLY_PROFILE (24 timmar) som tidsmönster. Samma profil varje dag i månaden (viktigaste variationen är temperatur, inte tidsmönster).
2. **Uppvärmning:** `heatingKwh = max(0, 17 - tmyData[h].tempC) × heatingFactor`. Använd `getBlendedHeatingShare()` från refinement för att bestämma heatingFactor.
3. **Skalning:** Normalisera så att summan per månad matchar den kalibrerade säsongsfaktorn × kwhPerMonth. Den totala årssumman ska bli exakt annualKwh (t.ex. 23 265).

**Nyckelpoäng:** Pin-and-redistribute-kalibreringen från monthly.ts ska respekteras. Fakturamånadens (t.ex. februari) totala kWh ska matcha fakturavärdet (3 410,67 kWh). Övriga månader fördelas proportionellt.

### Fas 4: Solproduktion från verklig instrålning

**Ny funktion i samma fil (`simulate8760.ts`):**

```typescript
export function simulate8760Solar(
  systemSizeKw: number,
  tmyData: TmyHourlyData[],
  tiltDeg?: number,    // default 30
  azimuthDeg?: number  // default 180 (söder)
): number[]  // 8760 values, kWh per timme
```

**Förenklad formel:**
```
P_timme = G(h) × systemSizeKw / 1000 × performanceRatio
```
där performanceRatio ≈ 0.85 (täcker invertor, kablar, temperatur, nedsmutsning).

**Tilt-korrektion:** Kan börja med en enkel månatlig korrektionsfaktor (30° söder ger ~10-15% mer än horisontell i Sverige). Framtida förbättring: beräkna infallsvinkel från solposition.

**Acceptanskriterier:**
- 10 kW-system i Stockholm → ca 8 000–9 000 kWh/år (ska matcha PVGIS referensvärde ~8 470)
- Decemberdagar: många timmar med 0 kWh, några med 0.1–0.5 kWh
- Julidagar: variation 20–70 kWh/dag (INTE 50 kWh varje dag)

### Fas 5: Self-consumption, export och kalibrering

**Ny funktion:**

```typescript
export interface Simulate8760Result {
  consumption: number[];      // 8760 timmar
  solarProduction: number[];  // 8760 timmar
  selfConsumption: number[];  // 8760 timmar, min(production, consumption)
  gridImport: number[];       // 8760, consumption - selfConsumption
  gridExport: number[];       // 8760, production - selfConsumption
  annualExportKwh: number;
  annualSelfConsumptionKwh: number;
  annualGridImportKwh: number;
  calibratedSystemSizeKw: number;
}

export function simulate8760WithSolar(
  bill: BillData,
  refinement: RefinementAnswers,
  tmyData: TmyHourlyData[],
  seZone: SEZone
): Simulate8760Result
```

**Kalibrering av systemstorlek:**
1. Fakturan innehåller `solarExportKwh` för en viss månad (t.ex. 14,59 kWh i februari).
2. Kör binärsökning på systemstorlek S (1–20 kW):
   - simulate8760Consumption() ger förbrukning per timme
   - simulate8760Solar(S, tmyData) ger produktion per timme
   - Summera export för fakturamånaden: `sum(max(0, production[h] - consumption[h]))` för alla timmar i den månaden
   - Hitta S som ger matchande export (±5%)
3. Kör hela året med kalibrerad S.

**Integration med scenarios.ts:**
I `calculateThreeScenarios()`, efter nuläge-beräkningen, om TMY-data och solarExportKwh finns:
- Kör `simulate8760WithSolar()`
- Använd `annualExportKwh` och månatliga exportvärden för att beräkna korrekt exportintäkt
- Ersätt den nuvarande grova exportuppskattningen (som baseras på att skala en månads data med solprofil-fraktioner)

## Vad som INTE ska ändras

- `simulateDay()` — behövs för snabba UI-vyer
- `simulateMonthsWithUpgrades()` — behövs för månadsgrafer
- `calculateMonthlyCost()` — kostnadsmodellen är korrekt, den får bara bättre input
- Inga nya frågor till användaren i refinement-flödet
- Inga ändringar i LLM-prompten (parse-invoice)

## Test med riktig data

Testa med denna faktiska fakturadata:
- Adress: Dalvägen 10, 187 31 Täby (lat ≈ 59.44, lon ≈ 18.07)
- Årsförbrukning: 23 265 kWh (netto grid, redan reducerat för solar self-consumption)
- Februari förbrukning: 3 410,67 kWh
- Februari solexport: 14,59 kWh
- Nätägare: Ellevio AB, SE3
- Faktisk årsexport (referens): ~4 200 kWh — modellen ska komma nära detta
