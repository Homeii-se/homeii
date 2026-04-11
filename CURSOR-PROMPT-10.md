# CURSOR-PROMPT-10: Omstrukturera rekommendationssidan + "Dela din analys"

## Bakgrund

Rekommendationssidan (`RecommendationResults.tsx`) ska omstruktureras. Nuvarande ordning kräver att användaren scrollar förbi kostnadsöversikt och energihälsa innan de ser åtgärdsförslagen. Ny princip: **visa vad du borde göra först, och erbjud förståelse som opt-in.**

## Ny layout — uppifrån och ner

### 1. Kompakt hero-sammanfattning (NYTT)

Ersätter nuvarande separata header + CostBreakdownCard + Score-block med en tät sammanfattning:

```
┌─────────────────────────────────────────────┐
│  Din elkostnad: 34 200 kr/år                │
│  Vi rekommenderar 3 åtgärder som kan        │
│  spara dig 11 800 kr/år                     │
└─────────────────────────────────────────────┘
```

Implementera som en `glass-card-strong` med:
- Rad 1: Årskostnad i stor text (`threeScenarios.currentSituation.yearlyTotalCostKr` eller fallback `billData.costPerMonth * 12`)
- Rad 2: Antal rekommendationer + total besparing i `text-brand-300`
- Om `hasExistingEquipment`: en liten rad under med "Dina befintliga investeringar sparar redan X kr/år" (befintlig logik, behåll)
- **Inga** donut charts, inga score-cirklar här

### 2. Rekommendationskort (FLYTTA UPP)

Direkt efter hero. Exakt som idag — `RecommendationCard` för varje rekommendation. Behåll tom-state ("Din energiprofil ser redan bra ut...").

### 3. CTA-block (OMARBETA)

Tre knappar i ny ordning:

1. **"Dela din analys"** (primär) — gradient-bakgrund, ny funktionalitet (se nedan)
2. **"Utforska detaljerad analys"** — befintlig `onViewDashboard`, sekundär stil (border)
3. **"Börja om"** — befintlig `onRestart`, tertiär stil (text only)

Ta bort "Min sida"-knappen och `AccountModal`-importen.

### 4. Expanderbar kostnadsöversikt (FLYTTA NER)

Befintlig `CostBreakdownCard` med `calculationDetails`, men nu **kollapsat som default** inuti en expanderbar sektion:

```tsx
<details className="group">
  <summary className="cursor-pointer flex items-center justify-between ...">
    <span>Förstå din elkostnad</span>
    <ChevronIcon />
  </summary>
  <div className="mt-3">
    <CostBreakdownCard ... />
  </div>
</details>
```

### 5. Expanderbar energihälsa (FLYTTA NER)

Befintlig score-jämförelsen (Idag → Potential → Med åtgärder), men nu **kollapsat som default** inuti en expanderbar sektion:

```tsx
<details className="group">
  <summary>Din energihälsa — {score.grade} ({score.total}/100)</summary>
  <div className="mt-3">
    {/* Befintlig renderScoreCircle-logik */}
  </div>
</details>
```

---

## "Dela din analys" — funktionalitet

### Delbar URL

Bygg en URL som kodar analysresultatet i query-parametrar. Ingen backend behövs.

```typescript
function buildShareUrl(): string {
  const params = new URLSearchParams();

  // Essentiella parametrar
  params.set("kwh", String(billData.kwhPerMonth));
  params.set("cost", String(billData.costPerMonth));
  params.set("zone", seZone || "SE3");

  // Profil (komprimerat)
  if (refinement?.housingType) params.set("ht", refinement.housingType);
  if (refinement?.area) params.set("a", String(refinement.area));
  if (refinement?.heatingTypes?.length) params.set("heat", refinement.heatingTypes.join(","));
  if (refinement?.residents) params.set("r", String(refinement.residents));
  if (refinement?.hasSolar) params.set("sol", "1");
  if (refinement?.solarSizeKw) params.set("solkw", String(refinement.solarSizeKw));

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
```

### Delningsbeteende

Knappen ska:
1. Kopiera URL:en till clipboard via `navigator.clipboard.writeText()`
2. Visa bekräftelse: knappens text ändras till "✓ Länk kopierad!" i 2 sekunder, sedan tillbaka
3. Fallback om clipboard API inte finns: visa URL:en i en text-input som användaren kan kopiera manuellt

### Notera

URL-parametrarna behöver **inte** parsas/användas ännu vid laddning (det kan vi bygga senare). Just nu handlar det bara om att *generera* en delbar länk.

---

## Filer att ändra

1. **`app/simulator/components/RecommendationResults.tsx`** — hela omstruktureringen
2. **`app/simulator/data/strings.ts`** — lägg till:
   ```typescript
   shareAnalysis: "Dela din analys",
   shareCopied: "Länk kopierad!",
   understandCosts: "Förstå din elkostnad",
   energyHealth: "Din energihälsa",
   recommendedActions: "Vi rekommenderar",
   actionsThatSave: "åtgärder som kan spara dig",
   ```

## Anti-trunkering

- Detta rör primärt **en** komponent (RecommendationResults.tsx)
- Komponenten är ~257 rader idag. Den nya versionen ska bli ungefär lika lång (±20 rader) — vi tar bort AccountModal-import och -logik, lägger till share-logik
- Ta bort `import AccountModal` och `useState(false)` för `showAccountModal`
- Behåll alla `useMemo`-hooks och `renderScoreCircle` oförändrade — flytta bara var de renderas i JSX

## Verifiering

```bash
npx tsc --noEmit
```

Visuellt: rekommendationerna ska vara synliga utan att scrolla på en typisk mobil (375px bred, 667px hög).
