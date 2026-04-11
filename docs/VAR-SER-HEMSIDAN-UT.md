# Var finns koden som bestämmer hur hemsidan ser ut?

Förklaring för dig som är helt oinsatt: **Hemsidan är byggd av textfiler med kod.** Den koden beskriver både **innehåll** (texter, rubriker, knappar) och **utseende** (färger, storlek, placering). Nedan står exakt **var** dessa rader kod finns och **vad som är vad**.

---

## Grundidé

- Det du ser i webbläsaren (t.ex. "Din personlige energirådgivare", menyn, bakgrunden) **kommer från kod**.
- Den koden ligger i **vanliga textfiler** i projektet, framför allt i mappen **`app/`**.
- När du kör `
` läser Next.js dessa filer och **gör om koden till den sida du ser**.

Så: **För att förstå hur hemsidan skapas, steg för steg, tittar du i dessa filer.**

---

## Steg 1: Var finns filerna?

Öppna projektet i Cursor (eller VS Code) och gå till mappen **`app`** i vänster filträdet. Där ligger nästan allt som styr hur sidan ser ut:

```
app/
├── layout.tsx    ← "Ramen" runt hela sidan (header, footer, bakgrund)
├── page.tsx      ← Startsidans innehåll (det du ser på "/")
├── globals.css   ← Gemensamma färger och några extra stilar
└── ... (fler mappar med sidor)
```

**Kort sagt:**  
- **`layout.tsx`** = det som är lika på alla sidor (logga, menyn, footern, bakgrunden).  
- **`page.tsx`** = innehållet på just den sidan (texter, sektioner, knappar).  
- **`globals.css`** = grundfärger och typsnitt som gäller överallt.

Om du vill följa steg för steg: börja med **`app/layout.tsx`**, sedan **`app/page.tsx`**.

---

## Steg 2: Vad är "koden som beskriver utseendet"?

I den här typen av projekt gör man två saker i samma fil:

1. **Struktur** – vad som finns på sidan (rubrik, text, knapp, formulär). Det skrivs med något som liknar HTML, fast i JavaScript/React (kallas JSX), t.ex. `<h1>`, `<p>`, `<button>`.
2. **Utseende** – färger, storlek, marginaler. Det styrs ofta med **klasser** i ett verktyg som heter Tailwind, t.ex. `text-white`, `bg-sky-600`, `rounded-2xl`.

Så **"raderna kod som beskriver hur hemsidan ska se ut"** är alltså:
- **Struktur:** de delar som ser ut som HTML (`<header>`, `<h1>`, `<section>`, etc.).
- **Utseende:** orden i `className="..."` (Tailwind-klasser) och ibland `style={...}`.

Allt det finns i **`.tsx`-filerna** (och delvis i **`.css`**).

---

## Steg 3: Var i koden blir vad du ser?

Här är **konkreta platser** i dina filer. Om du öppnar filen och går till radnumret ser du exakt den kod som styr det som beskrivs.

### A) Ramen runt hela sidan – **`app/layout.tsx`**

| Det du ser på skärmen        | Var i koden (fil + ungefär rad) | Vad det är i koden |
|-----------------------------|----------------------------------|---------------------|
| Blå gradient-bakgrund (himmel) | `app/layout.tsx`, rad 16–21     | `skyBackgroundStyle` – färger och gradient beskrivs här. |
| Samma bakgrund används       | `app/layout.tsx`, rad 47–50     | En `<div>` som får `style={skyBackgroundStyle}`. |
| Vit header med logga och menylänkar | `app/layout.tsx`, rad 51–78     | `<header>...</header>` med klasser som `bg-white/80`, `sticky top-0`. |
| "My Energy Buddy" i headern   | `app/layout.tsx`, rad 58–59     | Text inne i en `<Link>`. |
| Länkarna "TCO-kalkylator" och "Energyhunt" | `app/layout.tsx`, rad 62–74     | Två `<Link href="...">` med text. |
| Footer längst ner             | `app/layout.tsx`, rad 80–89     | `<footer>...</footer>` med text om "Personlig energirådgivning". |

Så: **Öppna `app/layout.tsx`** – då ser du koden som beskriver hur "ramen" (bakgrund, header, footer) ska se ut.

---

### B) Startsidans innehåll – **`app/page.tsx`**

| Det du ser på skärmen        | Var i koden (fil + ungefär rad) | Vad det är i koden |
|-----------------------------|----------------------------------|---------------------|
| Rubriken "Din personlige energirådgivare" | `app/page.tsx`, rad 39–45       | `<h1>` och `<span>` med klasser för storlek och gradient-text. |
| Brödtexten under rubriken    | `app/page.tsx`, rad 46–48       | `<p className="text-slate-200 ...">`. |
| Sökfältet (rutan där man skriver) | `app/page.tsx`, rad 50–72      | `<form>`, `<input>` och `<button>` med klasser för utseende. |
| Förslagsknapparna ("Är elbil billigare för mig?" etc.) | `app/page.tsx`, rad 75–96       | En lista (`SUGGESTIONS`) som ritas med `.map()` till `<button>`. |
| Korten "Så funkar det" och "Verktyg" | `app/page.tsx`, längre ner      | `<section>` och `<ol>` / `<div>` med rubriker och kort. |

Så: **Öppna `app/page.tsx`** – då ser du koden som beskriver hur **startsidan** ska se ut (texter, sektioner, knappar).

---

## Steg 4: Så kan du lära dig steg för steg

1. **Öppna `app/layout.tsx`**  
   - Titta på rad 16–21: där definieras bakgrundsfärgerna.  
   - Titta på rad 51–78: där byggs headern. Ändra t.ex. texten "My Energy Buddy" till något annat, spara, och se att hemsidan uppdateras.

2. **Öppna `app/page.tsx`**  
   - Titta på rad 39–45: rubriken "Din personlige energirådgivare".  
   - Ändra texten till "Min energisida", spara, och ladda om i webbläsaren – då ser du att det är just den raden som styr rubriken.

3. **Öppna `app/globals.css`**  
   - Där finns t.ex. `--background` och `--foreground` (färger) och stilar för "Hoppa till innehåll". Det påverkar utseendet på hela sidan.

4. **Andra sidor**  
   - Samma idé: under `app/` finns en mapp per "sida". Inuti varje mapp finns ofta en **`page.tsx`**.  
   - T.ex. `app/calculator/ev/page.tsx` = sidan när du går till "/calculator/ev".  
   - Där finns samma typ av kod: struktur (JSX) och utseende (klasser i `className`).

---

## Sammanfattning

| Du vill veta …                    | Då tittar du här |
|----------------------------------|-------------------|
| Var koden som styr utseendet finns | I **`app/`**, framför allt i **`.tsx`-filer** och **`globals.css`**. |
| "Ramen" (header, footer, bakgrund) | **`app/layout.tsx`** |
| Startsidans texter och sektioner  | **`app/page.tsx`** |
| Gemensamma färger och typsnitt    | **`app/globals.css`** (och ibland i `layout.tsx`) |
| En annan sida (t.ex. kalkylatorn) | **`app/calculator/ev/page.tsx`** (eller motsvarande mapp under `app/`) |

**Raden kod som beskriver hur hemsidan ska se ut** är alltså inte på ett enda ställe – den är **fördelad på dessa filer**. Börja med `app/layout.tsx` och `app/page.tsx`, och följ rad för rad så ser du exakt vilken kod som blir vilken del av sidan.
