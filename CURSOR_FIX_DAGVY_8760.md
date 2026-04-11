# Fix: Dagvyn ska drivas av 8760-data (inte simulateDay)

## Problemet

Dagvyn i Dashboard.tsx (rad 94-97) använder fortfarande `simulateDay()` som ger en
identisk representativ dag för alla dagar i samma månad. Alla aprildagar ser
exakt likadana ut, alla januaridagar identiska, osv.

Men `simulate8760WithSolar()` i `simulate8760.ts` producerar redan 8760 unika
timvärden driven av verklig TMY-data (temperatur + solinstrålning). Varje dag
har unik förbrukning och solproduktion. En solig junidag kan ha massiv
överproduktion, medan en mulen junidag har nästan noll sol.

`tmyData` skickas redan in som prop till Dashboard (rad 47) men används BARA
av AnnualSummaryBar — inte av daggrafen.

## Lösning

### 1. Skapa en hjälpfunktion som hämtar timdata för en specifik dag ur 8760-arrayen

Lägg till i `simulate8760.ts`:

```typescript
/**
 * Extract 24 hourly values for a specific day-of-year from an 8760 array.
 * @param dayOfYear 0-indexed (0 = Jan 1, 364 = Dec 31)
 * @returns Array of 24 values
 */
export function getDay(hourlyArray: number[], dayOfYear: number): number[] {
  const startIndex = dayOfYear * 24;
  return hourlyArray.slice(startIndex, startIndex + 24);
}

/**
 * Convert a Date to day-of-year (0-indexed, non-leap).
 * Ignores the actual year — maps to TMY's 365-day structure.
 */
export function dateToDayOfYear(date: Date): number {
  const month = date.getMonth(); // 0-11
  const day = date.getDate(); // 1-31
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return Math.min(daysBeforeMonth[month] + day - 1, 364);
}
```

### 2. I Dashboard.tsx: beräkna full 8760-simulation ONCE, sedan slica per dag

Ersätt `daySimulation`-logiken (rad 94-97). Om `tmyData` finns tillgängligt,
kör `simulate8760WithSolar` en gång (memoized) och hämta rätt dag därifrån.
Faller annars tillbaka på `simulateDay()`.

```typescript
import { simulate8760WithSolar, getDay, dateToDayOfYear } from "../simulation/simulate8760";
import type { Simulate8760Result } from "../simulation/simulate8760";

// Full 8760-simulation (körs en gång, memoized)
const sim8760 = useMemo(() => {
  if (!tmyData || tmyData.length < 8760) return null;
  return simulate8760WithSolar(zeroEquipmentBill, refinement, tmyData, seZone);
}, [zeroEquipmentBill, refinement, tmyData, seZone]);

// Dagdata: antingen från 8760 eller fallback till simulateDay
const dayChartData = useMemo(() => {
  const date = new Date(selectedDate + "T12:00:00");
  const dayOfYear = dateToDayOfYear(date);

  if (sim8760) {
    // 8760-driven: varje dag är unik
    const consumption = getDay(sim8760.consumption, dayOfYear);
    const solar = getDay(sim8760.solarProduction, dayOfYear);
    const selfConsumption = getDay(sim8760.selfConsumption, dayOfYear);
    const gridImport = getDay(sim8760.gridImport, dayOfYear);
    const gridExport = getDay(sim8760.gridExport, dayOfYear);

    return Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      kwhAfterUpgrades: consumption[h],           // total förbrukning
      solarProductionKwh: solar[h],                // solproduktion
      selfConsumptionKwh: selfConsumption[h],      // egenförbrukning
      gridImportKwh: gridImport[h],                // nätimport
      gridExportKwh: gridExport[h],                // överskottsexport
      kwhBase: consumption[h],                      // TODO: base utan uppgraderingar
      // Kostnad: gridImport × spotpris (öre) + nätavgift
      costOre: gridImport[h] * 60,                 // förenklad — förbättra med riktiga spotpriser
    }));
  }

  // Fallback: gamla simulateDay
  return simulateDay(zeroEquipmentBill, refinement, date, activeUpgrades, seZone, assumptions);
}, [sim8760, selectedDate, zeroEquipmentBill, refinement, activeUpgrades, seZone, assumptions]);
```

### 3. Uppdatera chartData-logiken för `period === "dag"` (rad 119-136)

Byt ut `daySimulation` mot `dayChartData` i chartData useMemo:

```typescript
if (period === "dag") {
  if (chartUnit === "sek") {
    return dayChartData.map((d) => ({
      label: `${String(d.hour).padStart(2, "0")}`,
      value: Math.round((d.costOre / 100) * 100) / 100,
      baseline: undefined,
    }));
  }
  return dayChartData.map((d) => ({
    label: `${String(d.hour).padStart(2, "0")}`,
    value: Math.round(d.kwhAfterUpgrades * 100) / 100,
    overlay: d.solarProductionKwh > 0
      ? Math.round(d.solarProductionKwh * 100) / 100
      : undefined,
    baseline:
      hasUpgrades && d.kwhBase !== d.kwhAfterUpgrades
        ? d.kwhBase
        : undefined,
  }));
}
```

### 4. Ta bort den gamla daySimulation useMemo

Rad 94-97 (`const daySimulation = useMemo(() => { ... simulateDay ... })`) kan
tas bort helt om 8760-simuleringen funkar. Behåll som fallback om du vill, men
den nya `dayChartData` hanterar redan fallback internt.

### 5. DatePicker — lägg till min/max-begränsning

I `DatePicker.tsx`, sätt `min="2025-01-01"` på `<input type="date">` så att
användaren inte kan bläddra till datum före 2025. Inget max-datum behövs —
framtida datum visar TMY-baserad simulering (prognos).

```tsx
<input
  type="date"
  value={selectedDate}
  min="2025-01-01"
  onChange={(e) => onChange(e.target.value)}
  ...
/>
```

Uppdatera även snabbknapparna att peka på 2025:
```typescript
const midwinter = "2025-01-15";
const midsummer = "2025-06-21";
```

"Idag"-knappen: mappa dagens datum till 2025 (samma månad+dag) om vi är i 2026:
```typescript
const todayDate = new Date();
const todayMapped = `2025-${String(todayDate.getMonth()+1).padStart(2,"0")}-${String(todayDate.getDate()).padStart(2,"0")}`;
```

OBS: Framtida fas kommer ersätta TMY med verkliga historiska data för datum
som passerat. Men för nu visar alla datum TMY-baserade simuleringar, vilket
fortfarande ger **unik variation per dag** (soligt vs mulet, kallt vs varmt).

### 6. Visuell indikator: dagsammanfattning

Lägg till under grafen en liten sammanfattning för vald dag:

```tsx
{period === "dag" && sim8760 && (
  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
    <div>
      <p className="text-text-muted">Förbrukning</p>
      <p className="font-semibold text-text-primary">
        {dayChartData.reduce((s, d) => s + d.kwhAfterUpgrades, 0).toFixed(1)} kWh
      </p>
    </div>
    <div>
      <p className="text-text-muted">Solproduktion</p>
      <p className="font-semibold text-energy-yellow">
        {dayChartData.reduce((s, d) => s + d.solarProductionKwh, 0).toFixed(1)} kWh
      </p>
    </div>
    <div>
      <p className="text-text-muted">Nätexport</p>
      <p className="font-semibold text-energy-green">
        {dayChartData.reduce((s, d) => s + (d.gridExportKwh ?? 0), 0).toFixed(1)} kWh
      </p>
    </div>
  </div>
)}
```

## Resultat-sidan (ResultOverview.tsx)

ResultOverview.tsx visar idag INTE någon dagvy — bara årskostnad och
kostnadsuppdelning. Dagvyn behöver INTE läggas till här i fas 1. Den finns
redan i Dashboard (analys-sidan). Om Gustaf vill ha dagvy på resultat-sidan
också är det en separat uppgift.

## Filer att ändra

| Fil | Ändring |
|-----|---------|
| `app/simulator/simulation/simulate8760.ts` | Lägg till `getDay()` och `dateToDayOfYear()` |
| `app/simulator/components/Dashboard.tsx` | Ersätt simulateDay med 8760-slice, ny useMemo |
| `app/simulator/components/DatePicker.tsx` | Lägg till min="2025-01-01", uppdatera snabbknappar |

## Verifikation

1. Bläddra till **15 januari** → hög förbrukning (kallt), minimal sol
2. Bläddra till **21 juni** → låg förbrukning, massiv solproduktion (gul bar långt över grön)
3. Bläddra till **22 juni** → profilen ska vara ANNORLUNDA än 21 juni (olika TMY-data)
4. Bläddra till **10 oktober** → bör matcha oktober-mönstret (medel förbrukning, lite sol)
5. Datumväljaren ska inte tillåta datum före 2025-01-01
6. Varje dag ska ha unik profil — inga två dagar ska se exakt likadana ut
