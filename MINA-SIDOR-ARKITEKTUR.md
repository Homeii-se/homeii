# Mina sidor — arkitektur-brief

**Datum:** 2026-04-28 (uppdaterad senare samma dag)
**Författare:** Gustaf (med stöd från Cowork-resonemang)
**Mottagare:** Mattias P
**Status:** Alla öppna frågor besvarade — redo för implementation

---

## Bakgrund

Idag är fakturaflödet helt ephemeralt: PDF → `/api/parse-invoice` → Anthropic → resultat ritas → borta när fliken stängs. För att Homeii ska vara mer än en glorifierad fakturatolk behöver vi spara fakturor över tid. Det är där hela värdet ligger: longitudinell intelligens om hushållet, inte engångsanalys.

Mattias är på väg att koppla in Supabase (kvar att göra: `npm install @supabase/supabase-js`, env vars i Vercel, schema, RLS). När det är på plats bygger vi Mina sidor på den grunden.

---

## Beslutade arkitekturpunkter

### 1. Tre nivåer: Teaser → Bas → Premium

**Teaser (utan inlogg)** — det användaren får direkt vid faktura-uppladdning. Innehåller:
- Uppskattning av total betalning per år
- Tydlig synliggörning av vad användaren faktiskt betalar (mål: väcka känslan "du betalar mer än du tror")
- Jämförelse av nuläget mot referensgrupper (grannar / Sverige-snitt / villaägare etc)

**Bas (efter kontoskapande)** — grundläggande kontofunktionalitet, sparade fakturor, Mina sidor, historik över tid. Permanent gratis i grundutförande.

**Premium** — specifika rekommendationer, djupare analyser, framtida funktioner som läggs till över tid. Prismodell ej låst (kan vara $X/mån, B2B-paket för mäklare/banker, etc).

*Idé för konvertering Teaser→Bas:* visa blurrad teaser av Bas-funktionaliteten — "Skapa konto för att spara analysen och få fler insikter".

### 2. Spara både PDF och JSON

Inte bara den parsade datan. Storage är försumbart (~$1/mån för 1 000 hushåll × 24 fakturor i Supabase). Att behålla PDF:en ger oss option att re-parsa när modellerna blir bättre, och låter användarna ladda ner sina egna fakturor sen.

### 3. Adress som nav, inte användare

Flera användare kan vara medlemmar av samma adress. Hanterar sambo, flytt, sommarhus naturligt. Bättre privacy-story: "Homeii vet ditt hem", inte "Homeii vet dig".

### 4. Soft delete vid konto/data-radering

PDF raderas direkt. JSON behålls med PII strippad (bara konsumtionsmönster + region kvar) för aggregat-modell. Kräver tydlig text i integritetspolicyn.

### 5. Adressverifiering = explicit invite från ägaren (v1)

Bara för att Erik laddar upp en faktura som visar "Storgatan 5" får han inte automatiskt se Annas data. Existerande adress-ägare måste explicit invitera nya medlemmar via mejl. Säkerhet > bekvämlighet i v1.

### 6. Konsumtions-anläggningsID som primary key

INTE bara "anläggnings-ID" generellt. Distinktionen är viktig: solcellshushåll har två separata anläggnings-ID — ett för konsumtion (uttag) och ett för produktion (inmatning). Konsumtions-ID finns på *alla* svenska elhushåll, så det är den universella nyckeln.

### 7. Produktions-anläggningsID som valfri koppling

För solcellshushåll. Hänger på samma fysiska adress som konsumtions-anläggningen men är distinkt i elnätet. Förbereder för framtida solcellsanalys utan schema-ändring.

### 8. Produktprincip: bekräfta över ifyllnad

All data som går att extrahera från fakturan ska auto-fyllas och bara *bekräftas* av användaren — aldrig manuellt knappas in från noll. Detta gäller adress, anläggnings-ID, elhandelsbolag, period, förbrukning, kostnader. Skiljer Homeii från typiska kalkylatorer där användaren själv klickar in 50 fält. Inverkan på UI: kontoskapande-flödet är ett "bekräfta dina uppgifter"-steg, inte ett formulär.

### 9. Adress autodetekteras från fakturan, bekräftas av användaren

Adressen läses från fakturan automatiskt. När användaren skapar konto efter sin Teaser-analys är första steget en bekräftelse: "Vi tolkade adressen som *Storgatan 5, 113 33 Stockholm* — stämmer det?". Detta är direkt tillämpning av princip #8.

### 10. v1: 1 konsumtions-anläggningsID = 1 "hem" i Homeii

För edge-case villa med flera mätare (huvud + garage) ser användaren två separata "hem" i dashboarden, t.ex. "Storgatan 5 (huvud)" och "Storgatan 5 (garage)". Inga extra entiteter i schemat. När/om frågan blir akut kan v2 lägga till en optional `household_group_id`-kolumn för frivillig gruppering — additiv ändring, ingen migration. BRF-lägenheter är inte detta problem (varje lägenhet har eget anläggnings-ID = eget "hem").

### 11. Ägarskap kan överföras (flytt, avslut)

Vid flytt eller om ägaren lämnar tjänsten ska ägarskap kunna överföras till annan medlem av adressen. Tre situationer att stödja:

- **Flytt med kvarvarande medlemmar:** ägaren initierar överlåtelse till annan medlem, lämnar sedan adressen. Hens tidigare uppladdade fakturor stannar med adressen (data tillhör adressen, inte personen).
- **Flytt utan andra medlemmar (ensamhushåll):** användaren kan välja att (a) lämna adressen, varvid den blir föräldralös tills ny ägare registrerar samma konsumtions-ID, eller (b) arkivera och radera adressen helt.
- **Användare lämnar tjänsten helt:** soft delete enligt punkt 4. Om hen var ensam ägare blir adressen föräldralös.

---

## Datamodell

```
addresses (fysisk plats — gata, postnummer, stad, kommun)
  └─ consumption_metering_points (PK = konsumtions-anläggningsID)
       ├─ production_metering_point (valfri, FK — för solcellshushåll)
       ├─ members (users med roll: ägare / medlem)
       ├─ invoices (PDF-blob + parsed JSON, period, uppladdad_av)
       └─ consumption_data (timserie eller månadssnitt)

users (Supabase Auth — magic link, ingen lösen)
```

Nyckelpoänger:
- En `address` kan ha flera `consumption_metering_points` om det är ett flerbostadshus med separata mätare. Konsumtions-ID:t är det som unikt identifierar "ett hem" i Homeii-bemärkelse.
- En `user` kan vara medlem i flera adresser (sommarhus, flytt med övergångsperiod).
- En `invoice` tillhör ett konsumtions-metering-point, inte direkt en user. `uploaded_by` är bara metadata om vem som laddade upp.

---

## Implementations-sekvens

1. **`npm install @supabase/supabase-js`** + commita uppdaterad package.json/lock
2. **Skapa Supabase-projektet**, sätt `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` i Vercel
3. **Schema**: `addresses`, `consumption_metering_points`, `production_metering_points`, `address_members`, `invoices`, `consumption_data`
4. **RLS-policys**: en användare ser bara konsumtions-metering-points hen är medlem av. Storage-bucket samma princip.
5. **Auth-flöde**: Supabase magic link via mejl. Ingen lösen.
6. **UI v1**: efter lyckad faktura-uppladdning → "Spara den här analysen, skapa konto med din mejl" → magic link → fakturan kopplas till nyskapad konsumtions-anläggning ägd av användaren.
7. **Mina sidor v1**: lista över sparade fakturor per adress, klicka för att se historik. Invite-medlem via mejl-knapp.

---

## Kvarstående produktfrågor (inte arkitektur — kan besvaras under bygget)

- **Innehållet i Bas-nivån i detalj.** Vilka exakta funktioner är "grundläggande kontofunktionalitet"? Lämnar för senare definition under utveckling.
- **Premium-prismodell.** $X/mån, B2B, freemium-features, eller något annat? Beslut behövs först när Premium-funktionerna börjar byggas.
- **Föräldralösa adresser.** Hur länge stannar en föräldralös adress innan den auto-arkiveras? GDPR-fråga som behöver tänkas igenom när retention-policy skrivs.

---

## Sammanfattning för minnet

11 låsta beslut: tre-nivå-modell (Teaser/Bas/Premium); PDF + JSON; adress som nav; soft delete; explicit invite; konsumtions-anläggningsID som PK; produktions-anläggningsID som valfri koppling; *bekräfta över ifyllnad* som genomgående produktprincip; adress autodetekteras från faktura; 1 konsumtions-ID = 1 "hem" i v1; ägarskap kan överföras vid flytt/avslut. Datamodellen är klar, implementations-sekvensen är klar. Saknas: Supabase uppsatt + paketet i package.json. Det är där Mattias börjar imorgon.
