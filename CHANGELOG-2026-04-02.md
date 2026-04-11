# HOMEii — Ändringslogg 2 april 2026

## Del 1: Visuell uppgradering

Stort tema-byte och layoutförbättringar inspirerade av elbilskompassen.

### Nytt mörkt tema
- Mörk blå gradient-bakgrund (samma stil som elbilskompassen)
- Glasmorfism-kort anpassade för mörkt tema
- Alla textfärger, ytfärger, borders och interaktiva element uppdaterade
- Custom range sliders med teal-tema

### Header + Footer + Mobilmeny
- Sticky header med HOMEii-logga och desktop-navigation
- Hamburger-meny på mobil (ny MobileNav-komponent)
- Professionell footer med branding
- Skip-to-content för tangentbordsnavigation

### Förbättrad Landing Page
- Social proof-bar med nyckeltal
- "Tre steg till lägre energikostnad"-sektion
- CTA-block med gradient
- Förtroendesektion om oberoende

### Komponentuppdateringar (16 filer)
Samtliga UI-komponenter anpassade för mörkt tema.

---

## Del 2: Beräkningsmodell och funktionalitet

Omfattande förbättringar av beräkningsmodellen, buggfixar och nya funktioner.

### Buggfix: Batteri-kostnad ökade istället för att minska
**Problem:** När man aktiverade hembatteri i kalkylatorn ÖKADE årskostnaden.
**Orsak (tre delar):**
1. Batteriets "smarta nätladdning" var för aggressiv — laddade 50% av max kapacitet varje natt
2. Månadsskalningen använde brutto-gridimport (inkl. batteriladdning) istället för netto
3. Exportintäkter från solöverskott räknades inte in

**Fix:**
1. Smartare nätladdning: bara vid extremt låga priser (<0.65x snitt), max 30% av kapacitet, bara under 30% laddning
2. Netto gridimport: import minus export används för skalning
3. Exportintäkter: 80% av spotpris för överskottsel (typiskt för mikroproducenter i Sverige)

### Befintlig utrustning hanteras korrekt
**Problem:** Rekommendationer jämförde mot ett "naket hus" utan befintlig utrustning.
**Fix:** Baslinjen inkluderar nu:
- Befintliga solceller/batteri
- Befintlig värmepump (om ht är luftluft/luftvatten/bergvärme)
- Nya rekommendationer testas ovanpå befintlig utrustning

### Tre-scenariovisning (helt nytt!)
Nu visas tre scenarion i både rekommendationer och dashboard:
- **A) Utan dina investeringar** — Vad hade det kostat utan solceller/VP etc?
- **B) Nuvarande situation** — Vad du betalar idag med befintlig utrustning
- **C) Med rekommenderade åtgärder** — Vad du kan betala framöver

Visar tydligt både *vad befintlig utrustning redan sparar* och *hur mycket mer du kan spara*.

### Förbättrad beräkningsdata
Uppdaterat med realistiska svenska data och källhänvisningar:
- **Solproduktion:** Justerat mot PVGIS-data (~8470 kWh/år för 10 kWp i Stockholm)
- **Värmepumps-COP:** Uppdaterat mot Energimyndighetens värmepumpslista
- **Investeringskostnader:** Justerade till 2025-2026 prisnivåer
- **Nya datakällor:** PVGIS, Energimyndigheten, SMHI, Nord Pool, SCB, Elpriskollen

### "Så räknar vi" — Metodikpanel (ny komponent)
Ny expanderbar panel i dashboarden som visar:
- Metodikförklaring (energi, sol, värmepumpar, batterier, nätavgifter)
- Alla datakällor med länkar till officiella sidor
- Disclaimer om att beräkningarna är uppskattningar

### Encoding-fix
Fixat å/ä/ö-problem i UploadBill och layout.

---

**Totalt ändrade filer:** ~25 filer
**Nya filer:** MobileNav.tsx, MethodologyPanel.tsx
**Nya typer:** ThreeScenarioSummary
**Nya funktioner:** calculateThreeScenarios(), buildExistingEquipmentUpgrades()
