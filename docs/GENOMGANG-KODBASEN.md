# Genomgång: Hur hemsidan är byggd (och vad du behöver veta)

Syftet med denna genomgång är att du ska förstå **hur My Energy Buddy är uppbyggd** och **vad du hade behövt kunna** om du byggt den utan AI-hjälp. Vi går från helheten till utvalda delar och "zoomar in" där det är extra viktigt.

---

## 1. Översikt: Vad består hemsidan av?

- **Startsida** (`/`) – hero, sökfält, förklaring, verktygskort, förtroendetext  
- **TCO-kalkylator** – en “hub” (`/calculator/ev`) och fem varianter (light, full, sliders, scenarios, steg)  
- **Energyhunt** (`/energyhunt`) – ett enkelt spel  
- **Gemensamt:** layout (header, footer, bakgrund), typsnitt, färger, tillgänglighet (hoppa till innehåll)

**Teknisk stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4. Inget databas eller inloggning – allt körs i webbläsaren.

---

## 2. Vad du hade behövt veta från början

För att bygga denna hemsida från scratch (utan AI) behöver du grovt:

| Område | Vad du behöver |
|--------|-----------------|
| **Next.js** | Att sidor = filer under `app/`, att `layout.tsx` wrappar alla sidor, att `page.tsx` är själva sidinnehållet. Skillnad mellan Server och Client Components (`"use client"`). |
| **React** | Komponenter, `useState`, `useRef`, formulär (controlled inputs), `map()` för listor. |
| **TypeScript** | Grundtyper, `interface`, typade props och state. |
| **Tailwind** | Klass-baserad styling (`className`), responsivitet (`sm:`, `md:`), färger och spacing. |
| **Tillgänglighet** | Semantisk HTML (`<main>`, `<nav>`, `role="main"`), “Hoppa till innehåll”-länk, fokusringar. |

Resten av dokumentet zoomar in på **var** i kodbasen dessa saker används.

---

## 3. Projektstruktur (var finns vad?)

En full trädvy av kodbasen finns i **[KODBAS-TRAD.md](./KODBAS-TRAD.md)**. Kort version:

```
energy-buddy/
├── app/                    ← Alla sidor och layout
│   ├── layout.tsx          ← Gemensam layout (header, footer, bakgrund)
│   ├── page.tsx            ← Startsida (/)
│   ├── globals.css         ← Globala stilar + Tailwind
│   ├── calculator/
│   │   └── ev/
│   │       ├── page.tsx    ← Hub: välj variant (/calculator/ev)
│   │       ├── lib/
│   │       │   └── tco.ts  ← All TCO-logik (beräkning, standardvärden)
│   │       ├── components/
│   │       │   └── SaHarViRaknat.tsx  ← Återanvänd sektion "Så har vi räknat"
│   │       ├── light/page.tsx
│   │       ├── full/page.tsx
│   │       ├── sliders/page.tsx
│   │       ├── scenarios/page.tsx
│   │       └── steg/page.tsx
│   └── energyhunt/
│       └── page.tsx
├── package.json            ← Scripts och dependencies
├── next.config.ts          ← Next.js-konfiguration
├── postcss.config.mjs      ← Tailwind/PostCSS
└── tsconfig.json           ← TypeScript
```

**Viktigt:** I Next.js **App Router** bestämmer mappstrukturen URL:erna.  
`app/page.tsx` → `/`, `app/calculator/ev/page.tsx` → `/calculator/ev`, `app/calculator/ev/full/page.tsx` → `/calculator/ev/full`.

---

## 4. Zooma in: Projektets start (package.json, next, tailwind)

**Fil:** `package.json`

Du behöver veta:
- **npm / yarn:** `npm install` installerar paket, `npm run dev` startar utvecklingsservern.
- **Next.js:** ger dig routing (filbaserad), server/client-rendering, och byggverktyg.
- **Tailwind:** du skriver inte vanlig CSS för layout/färger, utan klasser i JSX (`className="mt-4 text-white"`).

Kör `npm run dev` → sidan körs lokalt. Det hade du behövt kunna sätta upp (eller använda `create-next-app`).

---

## 5. Zooma in: Gemensam layout (app/layout.tsx)

**Fil:** `app/layout.tsx`

- **Layout = omslag:** Alla sidor under `app/` får samma `<html>`, `<body>`, header och footer. `{children}` är den aktuella sidan.
- **Metadata:** `export const metadata` används av Next för titel och beskrivning (SEO).
- **Typsnitt:** `next/font/google` (Geist) – laddar typsnitt och exponerar CSS-variabler (`--font-geist-sans`).
- **Bakgrund:** En `div` med `position: fixed` och en gradient (inline `style`) ger den gemensamma “himmel”-känslan på alla sidor.
- **Header/Footer:** Sticky header med `Link` till startsida, TCO-kalkylator och Energyhunt. Footer med kort text.
- **Tillgänglighet:** `<a href="#main-content">Hoppa till innehåll</a>` med klassen som gör den synlig vid fokus (definierad i `globals.css`).

Vad du behöver kunna: hur en root layout wrappar hela appen, hur man använder Next `Link` och `next/font`, och varför “Hoppa till innehåll” sätts här.

---

## 6. Zooma in: Startsidan (app/page.tsx)

**Fil:** `app/page.tsx`

- **"use client":** Sidan använder `useState` och `useRef`, så den måste vara en Client Component. Without "use client" är komponenten en Server Component (inga hooks).
- **State:** `query` för sökfältet, `toolsRef` för att scrolla till verktygssektionen.
- **Formulär:** `onSubmit` på form, `e.preventDefault()`, styr input med `value={query}` och `onChange` (controlled input). Vid sökning: enkel logik som t.ex. skickar till `/calculator/ev` eller `/energyhunt`, eller scrollar till `#verktyg`.
- **Struktur:** Hero (rubrik, sök, förslagsknappar) → kort förklaring → “Så funkar det” (nummerlista) → verktygskort (länkar till kalkylator och Energyhunt + “kommer snart”-kort) → förtroendetext.
- **Tailwind:** Responsivitet (`sm:py-24`, `max-w-2xl`), färger (`text-slate-200`, `bg-white`), fokusringar (`focus-visible:ring-2`).

Vad du behöver kunna: Client vs Server Component, controlled inputs, enkel navigationslogik, och hur man bygger en landningssida med sektioner.

---

## 7. Zooma in: Routing och TCO-hubben (app/calculator/ev/page.tsx)

**Fil:** `app/calculator/ev/page.tsx`

- **Routing:** Filen ligger i `app/calculator/ev/page.tsx` → URL blir `/calculator/ev`. Ingen extra konfiguration.
- **Innehåll:** En lista med länkar (VARIANTS) till de fem varianterna: light, full, sliders, scenarios, steg. Varje variant har egen `page.tsx` i en undermapp (t.ex. `full/page.tsx` → `/calculator/ev/full`).
- **Återanvändning:** Komponenten `SaHarViRaknat` importeras från `./components/SaHarViRaknat` – samma sektion används på alla TCO-sidor.

Vad du behöver kunna: filbaserad routing i Next App Router, och att dela komponenter mellan sidor.

---

## 8. Zooma in: Delad logik – TCO (app/calculator/ev/lib/tco.ts)

**Fil:** `app/calculator/ev/lib/tco.ts`

Detta är **hjärtat** i kalkylatorn – ingen UI, bara data och beräkningar.

- **DEFAULTS:** Ett stort objekt med standardvärden (ägperiod, mil/år, elpris, bilklasser med inköp, försäkring, skatt, underhåll, restvärdesandel, förbrukning). Alla varianter (light, full, sliders, …) använder samma grund.
- **Typer (TypeScript):** `VehicleClass`, `TCOFormData`, `CalculationResults`, `VehicleTcoResult` osv. Formulärdata kommer in som strängar (från input), parsas i `calculateTCO`.
- **getDefaultFormData():** Returnerar ett objekt med alla fält som formulären förväntar sig, med standardvärden. Varje variant fyller i eller över skriver det.
- **calculateTCO(formData, scenarioOverride?, variantOverride?):**  
  - Läser in alla värden från `formData` (och överridesa vid behov).  
  - Räknar blandat elpris, energikostnad per år (el respektive fossilt).  
  - Räknar restvärde och värdeminskning per år: `(inköp - restvärde) / ägperiod`.  
  - Returnerar `CalculationResults` med ev/fossil-kostnader och sparande.

Vad du behöver kunna: att lägga affärslogik i en separat modul (lib) så att alla UI-varianter använder samma beräkning; TypeScript-interfaces för in/ut-data; hur formulärdata (strängar) normaliseras och används i beräkningar.

---

## 9. Zooma in: En enkel variant – Light (app/calculator/ev/light/page.tsx)

**Fil:** `app/calculator/ev/light/page.tsx`

- **State:** `miles`, `chargingAtHome`, `done`. När användaren svarat visas resultat.
- **Koppling till lib:** `formData` byggs från `getDefaultFormData()` + över skriv med `miles` och `chargingAtHome`. `calculateTCO(formData)` anropas – antingen varje render (som här) eller vid klick. Resultatet används för att visa sparande och “elbil vinner” / “fossil billigare”.
- **UI:** Knappar för mil (500–3000), radio för “ladda hemma ja/nej”, knapp “Se resultat” som sätter `done = true` och visar resultatrutan.
- **Länk tillbaka:** `Link` till `/calculator/ev` för att välja annan variant.

Vad du behöver kunna: hur en enkel sida hämtar standarddata från lib, bygger ett minimalt formulär, anropar samma `calculateTCO` som de andra varianterna och visar resultat.

---

## 10. Zooma in: Komplett variant med många fält (app/calculator/ev/full/page.tsx)

**Fil:** `app/calculator/ev/full/page.tsx`

- **State:** `step` (“input” | “results”), `results`, `formData`. Ett stort formulär med många fält; vid submit räknas TCO och `step` byts till “results”.
- **Formulär:** Alla fält styrs av ett enda `formData`-objekt. `handleChange` uppdaterar ett fält i taget via `name` och `value`/`type` (inkl. checkbox). Det är samma mönster som i TCOFormData: strängar i state, parsas i `calculateTCO`.
- **Två vyer:** Om `step === "results"` visas resultat (sparande, underlag head-to-head, tabell, Wayke-länkar, knappar “Ändra uppgifter” / “Tillbaka till varianter”). Annars visas formuläret (körprofil, energi, fossil vs elbil, avancerade antaganden).
- **Återanvändning:** `SaHarViRaknat` längst ner. Formatering med hjälpfunktioner (`formatCurrency`, `formatNumber`).

Vad du behöver kunna: stora formulär med ett state-objekt och en generisk `handleChange`, steg-baserad UI (input → resultat), och att presentera samma `CalculationResults` som på light-varianten men med mer detalj.

---

## 11. Zooma in: Återanvänd sektion (app/calculator/ev/components/SaHarViRaknat.tsx)

**Fil:** `app/calculator/ev/components/SaHarViRaknat.tsx`

- En **presentationskomponent:** ingen state, bara text och struktur. Förklarar TCO, ägperiodens effekt, restvärde, schabloner, elpris.
- **Tailwind:** Sektion med border, padding, textfärger (vit/slate) så det passar den mörka bakgrunden.
- **Var den används:** Hubben och alla fem kalkylatorvarianter importerar och renderar `<SaHarViRaknat />` längst ner.

Vad du behöver kunna: att bryta ut återkommande innehåll till en komponent för att undvika dubbelkod och hålla texterna på ett ställe.

---

## 12. Zooma in: Globala stilar och Tailwind (app/globals.css)

**Fil:** `app/globals.css`

- `@import "tailwindcss";` – aktiverar Tailwind (v4-stil).
- **CSS-variabler:** `:root` med t.ex. `--background`, `--foreground`; `@theme inline` kopplar Tailwind till dessa om du vill.
- **body:** Bakgrundsfärg och typsnitt från variablerna.
- **.sr-only-focusable:focus:** Gör “Hoppa till innehåll”-länken osynlig tills den får fokus (tangentbord), då den blir synlig och tydlig. Viktigt för tillgänglighet.

Vad du behöver kunna: hur Tailwind importeras, hur du sätter globala färger/typsnitt och hur du stylar fokus för dolda “skip”-länkar.

---

## 13. Sammanfattning: Flöde från användare till siffror

1. Användaren öppnar t.ex. `/calculator/ev/full`.  
2. Next.js renderar `app/calculator/ev/full/page.tsx` inuti `app/layout.tsx`.  
3. Sidan har state (`formData`, `step`). Användaren fyller i formuläret.  
4. Vid “Beräkna” anropas `calculateTCO(formData)` från `lib/tco.ts`.  
5. `calculateTCO` parsar strängar, använder DEFAULTS där något saknas, räknar värdeminskning, energi, försäkring, skatt, underhåll och returnerar `CalculationResults`.  
6. Sidan sätter `step = "results"` och visar resultat + “Så har vi räknat” (`SaHarViRaknat`).

Om du förstår detta flöde (routing → sida → state → lib → resultat → UI) har du en bra mental karta över hur hemsidan hänger ihop.

---

## 14. Vad du kan göra härnäst för att lära dig mer

- **Ändra ett standardvärde** i `tco.ts` (t.ex. elpris eller restvärdesandel) och se hur alla varianter påverkas.  
- **Lägg till ett fält** i full-formuläret: lägg det i `TCOFormData`, i `getDefaultFormData()`, i formuläret i `full/page.tsx` och i `calculateTCO` om det ska påverka beräkningen.  
- **Skapa en ny sida** under `app/`, t.ex. `app/om-oss/page.tsx`, och länka till den från headern eller footern i `layout.tsx`.  
- **Läs “Så har vi räknat”** i koden och jämför med det du ser på skärmen – då ser du exakt var texterna om ägperiod och restvärde kommer ifrån.

Om du vill kan vi i nästa steg zooma in på en **enda fil** rad för rad (t.ex. `tco.ts` eller `layout.tsx`) och gå igenom varje del som om du skulle skriva den själv.
