# Kodbasen – trädvy (endast källkod)

Detta är hur **din egen kod** ser ut. `.next/` och `node_modules/` är utelämnade (de genereras av Next.js och npm).

---

## Var hittar jag alla körbara kommandon?

**Alla kommandon du kan köra för projektet** finns i **`package.json`** under nyckeln **`"scripts"`**.

| Kommando (i terminalen) | Vad som står i package.json | Vad det gör |
|-------------------------|-----------------------------|-------------|
| `npm run dev`           | `"dev": "next dev"`         | Startar utvecklingsservern. Sidan öppnas (ofta http://localhost:3000). Ändringar i koden laddas om direkt. |
| `npm run build`         | `"build": "next build"`      | Bygger projektet för produktion (skapar `.next/` med optimerad kod). |
| `npm run start`         | `"start": "next start"`      | Startar den färdigbyggda appen (kör efter `npm run build`). |
| `npm run lint`          | `"lint": "eslint"`           | Kör ESLint – kontrollerar koden efter regler (fel/ varningar). |

**Var filen ligger:** Projektets rot – `energy-buddy/package.json`. Öppna filen och leta efter `"scripts": { ... }`.

**Den kod som faktiskt körs** när du kör dessa kommandon är allt under `app/` (sidor, layout, komponenter, `lib/tco.ts`, `globals.css`) plus konfigurationsfilerna (`next.config.ts`, `postcss.config.mjs`, `tsconfig.json`). Next.js läser dessa när du kör `next dev` eller `next build`.

```
energy-buddy/
│
├── app/                          ← Next.js App Router – alla sidor och layout
│   ├── layout.tsx                 Root layout (header, footer, bakgrund, typsnitt)
│   ├── page.tsx                   Startsida → /
│   ├── globals.css                Globala stilar + Tailwind
│   │
│   ├── calculator/
│   │   └── ev/
│   │       ├── layout.tsx         (valfri layout för /calculator/ev/*)
│   │       ├── page.tsx           Hub: välj variant → /calculator/ev
│   │       ├── lib/
│   │       │   └── tco.ts         TCO-logik (DEFAULTS, getDefaultFormData, calculateTCO)
│   │       ├── components/
│   │       │   └── SaHarViRaknat.tsx   Återanvänd sektion "Så har vi räknat"
│   │       ├── light/
│   │       │   └── page.tsx      → /calculator/ev/light
│   │       ├── full/
│   │       │   └── page.tsx      → /calculator/ev/full
│   │       ├── sliders/
│   │       │   └── page.tsx      → /calculator/ev/sliders
│   │       ├── scenarios/
│   │       │   └── page.tsx      → /calculator/ev/scenarios
│   │       └── steg/
│   │           └── page.tsx       → /calculator/ev/steg
│   │
│   └── energyhunt/
│       ├── layout.tsx             (valfri layout för Energyhunt)
│       └── page.tsx               → /energyhunt
│
├── docs/
│   ├── GENOMGANG-KODBASEN.md      Genomgång och zoom på delar
│   └── KODBAS-TRAD.md            Denna fil
│
├── package.json                   Scripts (dev, build, start) + dependencies
├── package-lock.json
├── next.config.ts                 Next.js-konfiguration
├── postcss.config.mjs             PostCSS (Tailwind)
├── eslint.config.mjs              ESLint
├── tsconfig.json                  TypeScript
└── next-env.d.ts                  Next.js TypeScript-referens (genererad)
```

## Antal källfiler (som du skriver/ändrar)

| Område | Filer |
|--------|--------|
| **Layout & startsida** | `app/layout.tsx`, `app/page.tsx`, `app/globals.css` |
| **TCO-kalkylator** | `app/calculator/ev/page.tsx`, `app/calculator/ev/lib/tco.ts`, `app/calculator/ev/components/SaHarViRaknat.tsx` |
| **TCO-varianter** | `light/page.tsx`, `full/page.tsx`, `sliders/page.tsx`, `scenarios/page.tsx`, `steg/page.tsx` |
| **Energyhunt** | `app/energyhunt/page.tsx` (+ ev. `app/energyhunt/layout.tsx`) |
| **Konfiguration** | `package.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json` |

**Totalt:** cirka 15–20 filer du faktiskt arbetar i (exkl. konfig). Resten är Next/React/node_modules.

## URL → fil (snabbreferens)

| URL | Fil |
|-----|-----|
| `/` | `app/page.tsx` |
| `/calculator/ev` | `app/calculator/ev/page.tsx` |
| `/calculator/ev/light` | `app/calculator/ev/light/page.tsx` |
| `/calculator/ev/full` | `app/calculator/ev/full/page.tsx` |
| `/calculator/ev/sliders` | `app/calculator/ev/sliders/page.tsx` |
| `/calculator/ev/scenarios` | `app/calculator/ev/scenarios/page.tsx` |
| `/calculator/ev/steg` | `app/calculator/ev/steg/page.tsx` |
| `/energyhunt` | `app/energyhunt/page.tsx` |

Varje sida wrappas av `app/layout.tsx` (och eventuellt en lokal `layout.tsx` i samma mapp).
