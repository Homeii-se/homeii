# Mina sidor — arkitekturdokument

**Datum:** 2026-04-30
**Författare:** Gustaf (med stöd från Cowork-resonemang)
**Status:** Levande dokument — uppdateras i takt med bygget

> Detta dokument konsoliderar och ersätter den tidigare korta arkitektur-brieven samt `MINA-SIDOR-HANDOFF.md` (raderad i samma commit). Fullständig historik för båda finns i Git-loggen före denna commit.

> Det här dokumentet är *självständigt*. Du ska kunna läsa enbart denna fil och förstå vad som ska byggas, varför, och i vilken ordning. Faktiska SQL-statements finns i `supabase/schema.sql`. TypeScript-typer för `home_equipment` finns i `lib/types/home-equipment.ts`.
>
> **Regel:** Varje PR som ändrar ett arkitekturbeslut eller datamodellen ska uppdatera detta dokument i samma commit.

---

## 1. Sammanfattning

Mina sidor är där en kund **sparar fakturor över tid** och får löpande analys och optimering av sitt elbruk. Det är där Homeii går från en engångsanalys till en kontinuerlig energirådgivare.

Idag är fakturaflödet helt ephemeralt: PDF laddas upp → parsas via Anthropic → resultat visas → försvinner när fliken stängs. Hela värdet ligger i **longitudinell intelligens** — att över tid se hur ett hushåll konsumerar och lära sig optimera. Utan sparade fakturor är vi en glorifierad fakturatolk. Med sparade fakturor blir vi en energirådgivare som lär sig hushållet.

**Vi har låst:** Arkitektur, datamodell, RLS-policys, implementationssekvens, schemafil.

**Vi bygger nu:** Auth-flöde, spara-faktura-flöde, Mina sidor UI i prioritetsordning (se sektion 3 och 8).

---

## 2. Sajtstruktur

### 2.1 Publika routes (ingen inloggning krävs)

| Route | Beskrivning | Status |
|---|---|---|
| `/` | Landing — anonym uppladdning + Teaser-analys | Live |
| `/analys` | Komplett analysflöde (upload → verify → resultat → dashboard) | Live |
| `/kunskap` | Kunskapshub — guider, räkneexempel, nyheter, ordlista | Live (undersidor är placeholders) |
| `/om` | Om-hub — Så funkar det, Om oss, Oberoende roll, Integritet, Kontakt | Live |
| `/partners` | Partnersamarbeten | Live |

### 2.2 Auth-skyddade routes — Mina sidor

| Route | Sida | Prio |
|---|---|---|
| `/app/hem` | Hemöversikt / dashboard | 1 |
| `/app/min-plan` | Min plan — personliga rekommendationer | 1 |
| `/app/mitt-hem` | Mitt hem — husdata och utrustning | 2 |
| `/app/mina-offerter` | Offerter från installatörer | 2 |
| `/app/min-uppfoljning` | Uppföljning — historik och trender | 2 |
| `/app/min-kunskap` | Personaliserad kunskapshub | 2 |
| `/app/notiser` | Notiser | 3 |
| `/app/installningar` | Inställningar — konto, members, prenumeration | 2 |

`/kunskap` är en publik route som inte kräver inloggning. Inloggade användare får i stället `/app/min-kunskap` — en separat auth-skyddad route med filtrerat innehåll baserat på `home_profile` och `home_equipment`. Ingen villkorlig rendering på samma route.

### 2.3 API-routes (intern)

| Route | Funktion |
|---|---|
| `/api/parse-invoice` | Anthropic-parsning av PDF-faktura |
| `/api/chat` | Chat-flöde |
| `/api/spot-prices` | Spotpriser |
| `/api/historical-prices` | Historiska priser |
| `/api/monthly-spot-averages` | Månadssnitt spotpriser |
| `/api/pvgis-tmy` | PVGIS TMY-data för solcellsberäkning |

---

## 3. Mina sidor-sidor med prio

| Sida | Route | Prio | Beskrivning |
|---|---|---|---|
| Hem | `/app/hem` | **1** | Startvy vid inloggning. Senaste faktura, elbesparing YTD, genvägar till plan och uppföljning. |
| Min plan | `/app/min-plan` | **1** | Personliga rekommendationer baserade på fakturahistorik och hemdata. Länk till relevanta offerter. |
| Mitt hem | `/app/mitt-hem` | **2** | Hemdata: adress, boyta, byggår, byggnadstyp, befintlig utrustning (värmepump, solceller, batteri m.m.). Auto-fylls från faktura, bekräftas av användaren. |
| Mina offerter | `/app/mina-offerter` | **2** | Inkomna offerter från installatörer, kopplade till rekommenderade åtgärder. |
| Min uppföljning | `/app/min-uppfoljning` | **2** | Fakturahistorik, förbrukningsgrafer, jämförelse mot föregående period och liknande hushåll. |
| Min kunskap | `/app/min-kunskap` | **2** | Filtrerad version av publika `/kunskap` baserat på `home_profile` och `home_equipment`. |
| Inställningar | `/app/installningar` | **2** | Kontoinställningar, notifpreferenser, hantera members och roller, prenumerationsinfo. |
| Notiser | `/app/notiser` | **3** | Avisering om elpristoppar, nya analyser klara, åtgärdspåminnelser. |

**Prio 1** = byggs i nästa PR (auth-flöde + spara-faktura + grundläggande Hem/Min plan).
**Prio 2** = byggs stegvis i efterföljande PR:ar.
**Prio 3** = framtid, beroende av affärsbeslut och Stripe-integration.

---

## 4. Datamodell

### 4.1 Diagram

```
auth.users (Supabase Auth — magic link + Google OAuth, ingen lösenordshantering)
    │
    ├──► user_profiles (tier, namn, notif-preferenser, subscription_*)
    │
    └──► metering_point_members (join: user × mätarpunkt + roll)
              │
              ▼
    consumption_metering_points  ◄── PK = konsumtions-anläggningsID
         │  ("ETT HEM" i Homeii)
         │
         ├──► addresses (gata, postnr, stad, kommun, koordinater)
         ├──► production_metering_points (valfri, för solceller)
         ├──► documents (PDF i Storage + parsed_data — fakturor och offerter)
         │         └──► analyses (Anthropic-analysresultat, N per dokument)
         ├──► consumption_data (timme/dag/månad-kWh)
         ├──► home_profile (boyta, byggår, byggnadstyp, uppvärmning)
         ├──► home_equipment (ett rad per equipment_key, typat JSONB)
         └──► metering_point_invitations (pending invites)
```

### 4.2 Tabellöversikt (11 tabeller, definierade i `supabase/schema.sql`)

| Tabell | Roll |
|---|---|
| `user_profiles` | Homeii-specifik användardata, kopplad 1:1 till `auth.users`. Innehåller `subscription_*`-fält som förbereder Stripe (prio 3, aktiveras ej förrän Stripe byggs). |
| `addresses` | Fysisk plats — flera mätarpunkter kan dela adress |
| `consumption_metering_points` | Navet — "ett hem". PK = konsumtions-anläggningsID |
| `production_metering_points` | Solcellsproduktion, valfri koppling till consumption |
| `metering_point_members` | Vem har åtkomst till vilken mätarpunkt + roll (`owner` / `member` / `read_only`) |
| `metering_point_invitations` | Pending-invites, engångs-tokens |
| `documents` | Sparade dokument — fakturor **och** offerter. Ersätter `invoices`. PDF i Storage + parsed JSON + denormaliserade fält. Kolumn `document_type`: `'invoice'` \| `'offer'` |
| `analyses` | Anthropic-analysresultat kopplat till ett dokument (N:1). Sparar modell-version, råsvar och strukturerat resultat separat — möjliggör re-analys när modellerna förbättras. |
| `consumption_data` | Granular kWh-data (timme/dag/månad) |
| `home_profile` | Hemdata per mätarpunkt: boyta, byggår, byggnadstyp, uppvärmningssätt. Auto-fylls och bekräftas av användaren. |
| `home_equipment` | Utrustning per mätarpunkt — ett rad per `equipment_key` med typat JSONB-fält `equipment_data`. TypeScript-typer definieras i `lib/types/home-equipment.ts` (källa till sanning för equipment-schemat). |

### 4.3 Tre roller i metering_point_members

Utökat från tidigare två roller (owner, member) — nu tre.

| Action | `owner` | `member` | `read_only` |
|---|---|---|---|
| Läsa dokument, analyser, hemdata | ✓ | ✓ | ✓ |
| Ladda upp dokument | ✓ | ✓ | ✗ |
| Redigera och radera dokument | ✓ | ✓ | ✗ |
| Ändra mätarpunkt-inställningar | ✓ | ✓ | ✗ |
| Bjuda in ny `member` eller `read_only` | ✓ | ✓ | ✗ |
| Sparka ut member / ändra roller | ✓ | ✗ | ✗ |
| Överlåta ägarskap | ✓ | ✗ | ✗ |
| Stänga hela mätarpunkten | ✓ | ✗ | ✗ |
| Hantera prenumeration | ✓ | ✗ | ✗ |

`read_only` är avsedd för t.ex. en sambo som bara ska följa konsumtionen men inte ladda upp fakturor, eller för framtida tredjepartsgranskning. Bjuds in explicit av owner eller member.

### 4.4 subscription_*-fält på user_profiles

Läggs till i schemat nu men aktiveras inte förrän Stripe-integration byggs (prio 3):

```sql
subscription_status       text
  check (subscription_status in ('active', 'canceled', 'past_due')),
                                          -- null = gratis/ej prenumerant
subscription_external_id  text,          -- Stripe customer-ID när det blir aktuellt
subscription_active_until timestamptz    -- nuvarande periodslut
```

### 4.5 transfer_ownership

PL/pgSQL-funktion `public.transfer_ownership(p_anlaggnings_id text, p_new_owner_id uuid)` som atomiskt inom samma transaktion:

1. Verifierar att anroparen är nuvarande aktiva ägare
2. Verifierar att mottagaren är aktiv medlem av mätarpunkten
3. Sätter den nuvarande ägarens `role` till `'member'`
4. Sätter mottagarens `role` till `'owner'`

Båda förblir aktiva medlemmar — `left_at` rörs inte. Det partiella unika indexet på aktiv ägare säkrar att det aldrig finns två ägare samtidigt.

---

## 5. RLS-modell i sammandrag

### 5.1 Tre hjälpfunktioner

```sql
-- Är användaren aktiv i denna mätarpunkt (valfri roll)?
public.user_is_member(p_anlaggnings_id text) → boolean

-- Är användaren aktiv ägare?
public.user_is_owner(p_anlaggnings_id text) → boolean

-- Kan användaren skriva (owner eller member — inte read_only)?
public.user_can_write(p_anlaggnings_id text) → boolean
```

`read_only`-rollen ger enbart läsåtkomst. Alla `insert`-, `update`- och `delete`-policys kräver `user_can_write()`. Läs-policys (`select`) kräver `user_is_member()`.

### 5.2 Åtkomstöversikt

| Tabell | Vem läser | Vem skriver |
|---|---|---|
| `user_profiles` | Användaren själv | Användaren själv |
| `addresses` | `user_is_member` (via kopplad mätarpunkt) | — (skapas via flöden) |
| `consumption_metering_points` | `user_is_member` | `user_can_write` (uppdatera), `user_is_owner` (delete) |
| `production_metering_points` | `user_is_member` | `user_can_write` |
| `metering_point_members` | `user_is_member` | `user_can_write` (bjuda in), `user_is_owner` (ändra roll, ta bort) |
| `metering_point_invitations` | `user_is_member` + mottagare (på e-post) | `user_can_write` |
| `documents` | `user_is_member` | `user_can_write` |
| `analyses` | `user_is_member` | `user_can_write` (skapa/uppdatera), service role för bulk-jobb |
| `consumption_data` | `user_is_member` | Systemet (service role) |
| `home_profile` | `user_is_member` | `user_can_write` |
| `home_equipment` | `user_is_member` | `user_can_write` |
| Storage `documents`-bucket | `user_is_member` | `user_can_write` |

Service-role-nyckeln bypassar RLS — används bara server-side för admin-jobb (t.ex. cron-rensning), aldrig klient-side.

---

## 6. Arkitekturbeslut (12 låsta)

### 6.1 Tre prismässiga nivåer

| Nivå | Tröskel | Innehåll |
|---|---|---|
| **Teaser** | Anonym uppladdning | Uppskattning årlig betalning + synliggörande av vad användaren betalar + jämförelse mot grannar/Sverige/villaägare |
| **Bas** | Skapa konto | Sparade fakturor, Mina sidor, historik över tid (permanent gratis) |
| **Premium** | Framtid | Specifika rekommendationer + framtida funktioner. Prismodell ej låst. |

Konvertering Teaser→Bas sker vid wow-ögonblicket efter att användaren sett analysen, inte före.

### 6.2 Spara både PDF och JSON

Inte bara parsad data. Storage är försumbart i Supabase (~$1/mån för 1 000 hushåll × 24 fakturor). Att behålla PDF:en ger oss option att re-parsa när modellerna blir bättre, och låter användarna ladda ner sina egna fakturor.

### 6.3 Adress som nav, inte användare

Användare attacheras till adresser, inte tvärtom. Hanterar sambo, flytt, sommarhus naturligt. Bättre privacy-story: "Homeii vet ditt hem" istället för "Homeii vet dig".

### 6.4 Soft delete vid borttagning

PDF raderas direkt, JSON behålls med PII strippad (bara konsumtionsmönster + region kvar) för aggregat-modell. Kräver tydlig text i integritetspolicyn.

### 6.5 Adressverifiering = explicit invite

Existerande ägare måste explicit bjuda in nya medlemmar via mejl. Säkerhet > bekvämlighet i v1 — det räcker inte att Erik laddar upp en faktura med "Storgatan 5" för att automatiskt få se Annas data.

### 6.6 Konsumtions-anläggningsID som primary key

Inte bara "anläggnings-ID" generellt. Solcellshushåll har två separata anläggnings-ID — ett för konsumtion (uttag) och ett för produktion (inmatning). Konsumtions-ID finns på **alla** svenska elhushåll, så det är den universella nyckeln.

### 6.7 Produktions-anläggningsID som valfri koppling

För solcellshushåll. Hänger på samma fysiska adress som konsumtions-anläggningen men är distinkt i elnätet. Förbereder för framtida solcellsanalys utan schema-ändring.

### 6.8 Produktprincip: bekräfta över ifyllnad

All data som kan extraheras från fakturan ska auto-fyllas och bara **bekräftas** av användaren — aldrig manuellt knappas in från noll. Gäller adress, anläggnings-ID, elhandelsbolag, period, förbrukning, kostnader. Skiljer Homeii från typiska kalkylatorer där användaren själv klickar in 50 fält.

### 6.9 Adress autodetekteras från fakturan

När användaren skapar konto efter sin Teaser-analys är första steget en bekräftelse: *"Vi tolkade adressen som Storgatan 5, 113 33 Stockholm — stämmer det?"*. Direkt tillämpning av princip 6.8.

### 6.10 v1: 1 konsumtions-anläggningsID = 1 "hem"

Edge case: villa med separat mätare för garage/uthyrd källare → användaren ser två "hem" i dashboarden. Inget `household_group_id` i v1 — additiv ändring för v2 om det blir akut.

### 6.11 Roll-modell: Owner = admin/billing, Member = full operativ åtkomst, read_only = läsåtkomst

Se sektion 4.3 för fullständig behörighetstabell. Som Spotify Family — den inbjudna kan göra allt utom de oåterkalleliga och ekonomiska besluten. `read_only` lägger till ett tredje läge för läsande tredje part (sambo utan ansvar, hyresvärd, etc.).

Ägarskaps-överlåtelse sker via den atomiska `transfer_ownership`-funktionen (se 4.5).

### 6.12 documents ersätter invoices — generaliserat dokumentlager

`documents`-tabellen hanterar alla inkommande externa dokument: fakturor (`'invoice'`) och offerter (`'offer'`). Parsning och lagring är identisk — bara `document_type` skiljer. `analyses`-tabellen håller Anthropic-analysresultaten separat från dokumentlagringen, vilket möjliggör:
- Re-analys av ett befintligt dokument utan att duplicera PDF
- Flera analysversioner per dokument (A/B-test av promptar, modelluppgraderingar)
- Tydlig separation mellan "källdokument" och "tolkning"

---

## 7. Strukturella designval — varför schemat ser ut som det gör

### 7.1 `user_profiles` extends `auth.users` istället för en custom `users`-tabell

Supabase Auth hanterar registrering, magic links och sessioner i den interna tabellen `auth.users`. Vi äger inte den tabellen — Supabase kan ändra den vid uppdateringar. Därför skapar vi `public.user_profiles` med samma `id` (UUID) för Homeii-specifik data.

En trigger (`on_auth_user_created`) auto-skapar profil-raden vid registrering.

### 7.2 `anlaggnings_id` som `text`, inte `bigint`

Anläggnings-ID är 18 siffror men lagras som text:
- Inledande nollor bevaras
- Framtida formatändringar hanteras utan migration
- Vi gör aldrig matte på fältet — det är en identifierare, inte ett mätvärde

Samma logik som telefonnummer.

### 7.3 Denormaliserade snabb-läs-fält på `documents`

Hela parsade JSON-objektet sparas i `parsed_data jsonb`, men de mest använda fälten (`total_kr`, `consumption_kwh`, `spot_price_ore_kwh`, `electricity_supplier`) sparas **också** som egna kolumner för snabba dashboard-queries utan JSON-parsning.

### 7.4 Soft delete via `deleted_at`-kolumner

Tidsstämpel istället för direkt radering. Queries filtrerar `WHERE deleted_at IS NULL`. Möjliggör ångra-support, GDPR-grace-period och PII-stripping för aggregat-modell.

### 7.5 RLS via hjälpfunktioner

Centraliserad logik i `user_is_member()`, `user_is_owner()`, `user_can_write()` istället för duplicerad EXISTS-subquery i varje tabells policy. Minimerar risken för att missa en tabell vid framtida ändringar.

### 7.6 Partial unique index = max en aktiv ägare per mätarpunkt

```sql
create unique index idx_one_active_owner_per_metering_point
  on public.metering_point_members(anlaggnings_id)
  where role = 'owner' and left_at is null;
```

Garanterar på databasnivå att det aldrig finns två aktiva ägare. Skyddar mot race conditions och buggar i applikationskoden.

### 7.7 home_equipment — typat JSONB med TypeScript-spegling

Utrustningsdata varierar kraftigt per typ (en värmepump har andra fält än solceller). Lösningen är ett fält `equipment_data jsonb` per `equipment_key`-rad i databasen, med tillhörande TypeScript-typer i `lib/types/home-equipment.ts` som är källa till sanning för vilket JSON-schema varje `equipment_key` förväntar sig. Ger flexibilitet i databasen och typsäkerhet i applikationskoden.

---

## 8. Implementationssekvens

I strikt prioritetsordning. Bygg inte parallellt — varje steg bygger på föregående.

### Steg 1: Förberedelser i Supabase (~30 min)

1. SQL Editor → kör hela `supabase/schema.sql` (skapar **11 tabeller** + RLS-policys + triggers + `transfer_ownership`-funktion)
2. Storage → New bucket `documents`, private, 10 MB file limit
3. Lägg till Storage RLS-policys (template kommenterad i slutet av `schema.sql`)
4. Verifiera Vercel env vars — alla fyra för Production, Preview *och* Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Steg 2: Auth-flöde (~1–2 dagar)

- Magic link via `supabase.auth.signInWithOtp({ email })` och Google OAuth via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Global inloggad/utloggad state via Supabase Auth-listener
- Skydda `/app/*`-routes via Next.js middleware
- Logga ut + session refresh

### Steg 3: "Spara faktura"-flöde (~2–3 dagar)

- Efter lyckad anonym uppladdning → CTA "Skapa konto för att spara analysen"
- Magic link → bekräfta adress extraherad från fakturan
- Vid bekräftelse, atomisk transaktion:
  1. Skapa eller hitta `addresses`-rad
  2. Skapa `consumption_metering_points`
  3. Skapa `metering_point_members`-rad med `role='owner'`
  4. Ladda upp PDF till Storage-bucket `documents`
  5. Skapa `documents`-rad med `document_type='invoice'`, PDF-path och `parsed_data`
  6. Skapa `analyses`-rad med Anthropic-resultat kopplat till dokumentet
  7. Skapa `home_profile`-rad med data extraherad från fakturan (bekräftas i nästa steg)

### Steg 4: Mina sidor prio-1 UI (~2–3 dagar)

- `/app/hem` — senaste faktura, elbesparing YTD, genvägar
- `/app/min-plan` — rekommendationer baserade på fakturahistorik
- `/app/min-uppfoljning` — lista sparade fakturor per mätarpunkt, klick öppnar sparad analys

### Steg 5: Mitt hem (~1–2 dagar)

- `/app/mitt-hem` — visa och redigera `home_profile` och `home_equipment`
- Bekräfta/korrigera adress och husdata som auto-fylldes i steg 3

### Steg 6: Mina sidor prio-2 UI (~2–3 dagar)

- `/app/mina-offerter` — lista `documents` med `document_type='offer'`
- `/app/installningar` — kontoinställningar, notifpreferenser, members-hantering

### Steg 7: Invite-member-flöde (~1–2 dagar)

- Bjud-in-knapp → mejladress + roll (`member` eller `read_only`)
- Token i `metering_point_invitations`, 7 dagars expiry
- Accept-flow: validera token → skapa `metering_point_members`-rad → redirect till `/app/hem`

### Steg 8: Premium-gate UI (prio 3)

Byggs inte förrän affärsbeslut om innehåll och prismodell är tagna — dessa är öppna produktfrågor (se sektion 9). Stripe-integration är ett separat projekt (se CLAUDE.md) och är en förutsättning för att premium-gate ska bli funktionell.

- Blurrad teaser av detaljerade rekommendationer för Bas-användare
- "Uppgradera till Premium" CTA — UI-skiss tills prismodell och Stripe är på plats

---

## 9. Öppna produktfrågor

Inte arkitekturkritiska — kan besvaras under bygget.

- **Innehållet i Bas-nivån i detalj.** Vilka exakta funktioner är "grundläggande kontofunktionalitet"?
- **Premium-prismodell.** $X/mån, B2B, freemium-features? Beslut behövs först när Premium-funktioner börjar byggas.
- **Föräldralösa adresser.** När sista medlemmen lämnar — hur länge stannar adressen innan auto-arkivering? GDPR-fråga.
- **read_only-use cases.** Ska rollen exponeras i UI direkt i v1, eller bara finnas i schemat tills ett konkret behov uppstår?
- **home_equipment-evolution.** Vilka `equipment_key`-värden är must-have i v1? Se `lib/types/home-equipment.ts` för nuläget.

---

## 10. Internationaliseringsstatus

Schemat är primärt designat för svenska elhushåll. Inför internationell expansion (Europa) behöver följande adresseras:

**Förberedda men inte aktiva:**
- addresses.country defaultar till 'SE' men accepterar valfri landskod (text-fält utan check-constraint)
- consumption_metering_points har country-fältet som identifierar mätpunktens land
- Latitude och longitude är universella

**Låst till Sverige idag:**
- consumption_metering_points.zone har check-constraint för SE1-SE4. Andra länder har egna budområden (t.ex. Norge NO1-NO5, Tyskland en helt annan struktur). Constraintet behöver utvidgas eller refaktoreras vid expansion.
- Konceptet anlaggnings_id är svenskt (Svenska kraftnäts 18-siffriga ID). Andra länder har egna ID-system (Målepunkt-ID i Norge, MaLo/MeLo-ID i Tyskland, MPAN i UK). Vid expansion krävs antingen en kompromiss där "ett hem" identifieras annorlunda, eller en land-specifik ID-strategi.
- /api/parse-invoice använder en Anthropic-prompt som specifikt beskriver svenska elräkningar. Multilanguage-stöd kräver land-specifika prompts.
- Befintliga spot_prices och monthly_avg_prices-tabeller har market_id-fält som antyder förberedelse för fler marknader, men sammankopplingen med Mina sidor-tabellerna är inte etablerad.

**Vid första utländska lansering:** Detta blir en separat migration som adresserar punkterna ovan. Inte arkitekturkris, men inte heller en trivial ändring.

---

## 11. Referenser

- **`supabase/schema.sql`** — komplett databasschema (11 tabeller, RLS-policys, triggers, `transfer_ownership`). Kör i Supabase SQL Editor när du är redo.
- **`lib/types/home-equipment.ts`** — TypeScript-typer för `home_equipment.equipment_data` per `equipment_key`. Källa till sanning för equipment-schemat.
- **Supabase Auth-dokumentation:** https://supabase.com/docs/guides/auth
- **Supabase RLS-dokumentation:** https://supabase.com/docs/guides/auth/row-level-security
- **Anläggnings-ID-konceptet (Svenska kraftnät):** sökord "anläggningsidentifierare elnät"
