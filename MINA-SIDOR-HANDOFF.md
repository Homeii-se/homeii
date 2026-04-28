# Mina sidor — fullständigt handoff-dokument

**Datum:** 2026-04-28
**Författare:** Gustaf (med stöd från Cowork-resonemang)
**Status:** Arkitektur klar — implementation pausad, redo att återupptas

> Det här dokumentet är *självständigt*. Du ska kunna läsa enbart denna fil och förstå vad som ska byggas, varför, och i vilken ordning. Faktiska SQL-statements finns i `supabase/schema.sql`.

---

## 1. Sammanfattning

Mina sidor är där en kund **sparar fakturor över tid** och får löpande analys/optimering av sitt elbruk. Det är där Homeii går från en engångsanalys till en kontinuerlig energirådgivare.

**Vi har låst:** Arkitektur, datamodell, RLS-policys, implementationssekvens, schemafil.

**Vi har inte byggt än:** Kod (Auth, UI, save-flöden) — pausat tills simuleringskorrektheten är på plats.

**När arbetet återupptas:** Följ implementationssekvensen i avsnitt 7 nedan. Allt nödvändigt är dokumenterat.

---

## 2. Varför Mina sidor

Idag är fakturaflödet **helt ephemeralt**: PDF laddas upp → parsas via Anthropic → resultat visas → försvinner när fliken stängs. Ingen persistens.

För Homeii som produkt är detta otillräckligt. Hela värdet ligger i **longitudinell intelligens** — att över tid se hur ett hushåll konsumerar och lära sig optimera. Utan att spara fakturor är vi en glorifierad fakturatolk. Med sparade fakturor blir vi en energirådgivare som lär sig hushållet.

---

## 3. Arkitekturbeslut (11 låsta)

### 3.1 Tre prismässiga nivåer

| Nivå | Tröskel | Innehåll |
|---|---|---|
| **Teaser** | Anonym uppladdning | Uppskattning årlig betalning + synliggörande av vad användaren betalar + jämförelse mot grannar/Sverige/villaägare |
| **Bas** | Skapa konto | Sparade fakturor, Mina sidor, historik över tid (permanent gratis) |
| **Premium** | Framtid | Specifika rekommendationer + framtida funktioner. Prismodell ej låst (kan vara $X/mån, B2B, etc) |

Konvertering Teaser→Bas sker vid wow-ögonblicket efter att användaren sett analysen, inte före.

### 3.2 Spara både PDF och JSON

Inte bara parsad data. Storage är försumbart i Supabase (~$1/mån för 1 000 hushåll × 24 fakturor). Att behålla PDF:en ger oss option att re-parsa när modellerna blir bättre, och låter användarna ladda ner sina egna fakturor.

### 3.3 Adress som nav, inte användare

Användare attacheras till adresser, inte tvärtom. Hanterar sambo, flytt, sommarhus naturligt. Bättre privacy-story: "Homeii vet ditt hem" istället för "Homeii vet dig".

### 3.4 Soft delete vid borttagning

PDF raderas direkt, JSON behålls med PII strippad (bara konsumtionsmönster + region kvar) för aggregat-modell. Kräver tydlig text i integritetspolicyn.

### 3.5 Adressverifiering = explicit invite

Existerande ägare måste explicit bjuda in nya medlemmar via mejl. Säkerhet > bekvämlighet i v1 — det räcker inte att Erik laddar upp en faktura med "Storgatan 5" för att få se Annas data automatiskt.

### 3.6 Konsumtions-anläggningsID som primary key

Inte bara "anläggnings-ID" generellt. Solcellshushåll har två separata anläggnings-ID — ett för konsumtion (uttag) och ett för produktion (inmatning). Konsumtions-ID finns på **alla** svenska elhushåll (även icke-solcellshushåll), så det är den universella nyckeln.

### 3.7 Produktions-anläggningsID som valfri koppling

För solcellshushåll. Hänger på samma fysiska adress som konsumtions-anläggningen men är distinkt i elnätet. Förbereder för framtida solcellsanalys utan schema-ändring.

### 3.8 Produktprincip: bekräfta över ifyllnad

All data som kan extraheras från fakturan ska auto-fyllas och bara **bekräftas** av användaren — aldrig manuellt knappas in från noll. Gäller adress, anläggnings-ID, elhandelsbolag, period, förbrukning, kostnader. Skiljer Homeii från typiska kalkylatorer där användaren själv klickar in 50 fält.

### 3.9 Adress autodetekteras från fakturan

När användaren skapar konto efter sin Teaser-analys är första steget en bekräftelse: *"Vi tolkade adressen som Storgatan 5, 113 33 Stockholm — stämmer det?"*. Direkt tillämpning av princip 3.8.

### 3.10 v1: 1 konsumtions-anläggningsID = 1 "hem"

Edge case: villa med separat mätare för garage/uthyrd källare → användaren ser två "hem" i dashboarden, t.ex. "Storgatan 5 (huvud)" och "Storgatan 5 (garage)". Inget `household_group_id` i v1 — additiv ändring för v2 om det blir akut. BRF-lägenheter är **inte** detta problem (varje lägenhet har eget anläggnings-ID = eget "hem" naturligt).

### 3.11 Roll-modell: Owner = admin/billing, Member = full operativ åtkomst

| Action | Owner | Member |
|---|---|---|
| Läsa, ladda upp, redigera, radera fakturor | ✓ | ✓ |
| Ändra mätarpunkt-inställningar | ✓ | ✓ |
| Bjuda in ny medlem | ✓ | ✓ |
| Sparka ut medlem | ✓ | ✗ |
| Överlåta ägarskap | ✓ | ✗ |
| Stänga hela kontot | ✓ | ✗ |
| Hantera Premium-prenumeration | ✓ | ✗ |

Som Spotify Family — den inbjudna kan göra allt utom de oåterkalleliga och ekonomiska besluten. Modell stödjer flytt och övergång (ägaren kan överlåta ägarskap till annan medlem).

---

## 4. Datamodell

```
auth.users (Supabase Auth — magic link, ingen lösen)
    │
    ├──► user_profiles (tier, namn, notif-preferenser)
    │
    └──► metering_point_members (join: user × mätarpunkt + roll)
              │
              ▼
    consumption_metering_points  ◄── PK = konsumtions-anläggningsID
         │  ("ETT HEM" i Homeii)
         │
         ├──► addresses (gata, postnr, stad, kommun, koordinater)
         ├──► production_metering_points (valfri, för solceller)
         ├──► invoices (PDF i Storage + JSON parsed_data)
         ├──► consumption_data (timme/dag/månad-kWh)
         └──► metering_point_invitations (pending invites)
```

**Tabellöversikt (8 tabeller, definierade i `supabase/schema.sql`):**

| Tabell | Roll |
|---|---|
| `user_profiles` | Hemii-specifik användardata, kopplad 1:1 till `auth.users` |
| `addresses` | Fysisk plats — flera mätarpunkter kan dela adress |
| `consumption_metering_points` | Navet — "ett hem". PK = konsumtions-anläggningsID |
| `production_metering_points` | Solcellsproduktion, valfri koppling till consumption |
| `metering_point_members` | Vem har åtkomst till vilken mätarpunkt + roll |
| `metering_point_invitations` | Pending-invites, engångs-tokens |
| `invoices` | Sparad faktura (storage path + parsed JSON + denormaliserade fält) |
| `consumption_data` | Granular kWh-data (timme/dag/månad) |

---

## 5. Strukturella designval — varför schemat ser ut som det gör

Det här är de viktigaste *icke-uppenbara* valen i schemat. När du läser `schema.sql` och undrar "varför så här?", här finns motiveringen.

### 5.1 `user_profiles` extends `auth.users` istället för en custom `users`-tabell

Supabase Auth hanterar registrering, magic links, sessioner i den interna tabellen `auth.users`. Vi äger inte den tabellen — Supabase kan ändra den vid uppdateringar. Därför skapar vi en parallell tabell `public.user_profiles` med samma `id` (UUID) för Homeii-specifik data: tier, mejlnotiser, namn.

En trigger (`on_auth_user_created`) auto-skapar profil-raden vid registrering. Standard Supabase-mönster — minskar mängden auth-kod vi behöver underhålla.

### 5.2 `anlaggnings_id` som `text`, inte `bigint`

Anläggnings-ID är 18 siffror men vi lagrar som text:

- **Inledande nollor** bevaras (talsystem skulle tappa dem)
- **Framtida formatändringar** (bindestreck, prefix) hanteras utan migration
- Vi gör aldrig matte på fältet — det är en identifierare, inte ett mätvärde
- Prestandaskillnaden är osynlig vid hushållsvolymer

Samma logik som telefonnummer.

### 5.3 Denormaliserade snabb-läs-fält på `invoices`

Hela parsade JSON-objektet sparas i `parsed_data jsonb`, men de fyra mest använda fälten (`total_kr`, `consumption_kwh`, `spot_price_ore_kwh`, `electricity_supplier`) sparas **också** som egna kolumner.

Skälet: dashboards och grafer som gör `SELECT total_kr FROM invoices WHERE ...` ska inte behöva JSON-parsa varje rad. För 1000 användares dashboard-rendering är skillnaden 50–100×.

Vid uppladdning skrivs båda samtidigt — ingen synkproblematik.

### 5.4 Soft delete via `deleted_at`-kolumner

När en användare raderar en faktura sätts en tidsstämpel istället för att radera raden direkt. Queries filtrerar `WHERE deleted_at IS NULL`.

Skäl:
- Misstag kan ångras (support kan återställa direkt)
- GDPR-grace-period (typiskt 30 dagar innan permanent radering)
- Forensik vid disputer
- Stripa PII och behålla anonymiserade konsumtionsmönster för aggregat-modell

En framtida cron-job hard-deletar rader vars `deleted_at` är äldre än X dagar.

### 5.5 RLS via hjälpfunktioner `user_is_member()` / `user_is_owner()`

Row-Level Security policys ligger på databasen själv — säkerheten är inte beroende av att applikationskoden gör rätt. Istället för att duplicera samma EXISTS-subquery i varje tabells policy är logiken centraliserad i två funktioner som varje policy bara anropar.

Skäl: en typisk RLS-bug är att uppdatera logik på 7 av 8 tabeller och glömma den åttonde — tyst säkerhetshål. Med centraliserade funktioner finns det bara ett ställe att uppdatera.

### 5.6 Partial unique index = max en aktiv ägare per mätarpunkt

```sql
create unique index idx_one_active_owner_per_metering_point
  on public.metering_point_members(anlaggnings_id)
  where role = 'owner' and left_at is null;
```

Index-villkoret garanterar **på databasnivå** att det finns högst en aktiv ägare per mätarpunkt. Försöker applikationskoden av misstag skapa två ägare (race condition, bugg, manuell admin-fix) så vägrar databasen.

Vid ägarskaps-överlåtelse: i en transaktion, demota gamla ägaren (sätt `left_at`), promota nya. Glömmer du första steget → databasen kastar fel, transaktionen rullas tillbaka.

"Partial" betyder att begränsningen bara gäller aktiva ägare. Du kan ha flera *före detta* ägare per mätarpunkt — bara inte två aktuella.

---

## 6. RLS-modell i sammandrag

| Tabell | Vem läser | Vem skriver |
|---|---|---|
| `user_profiles` | Användaren själv | Användaren själv |
| `addresses` | Medlemmar i kopplad mätarpunkt | (inget direkt — skapas via flöden) |
| `consumption_metering_points` | Medlemmar | Medlemmar (uppdatera), Owner (delete) |
| `production_metering_points` | Medlemmar i kopplad konsumtion | (kopplas vid solcells-flöde) |
| `metering_point_members` | Medlemmar i samma mätarpunkt | Medlemmar (lägga till `member`), Owner (ändra roller, ta bort) |
| `metering_point_invitations` | Medlemmar (sina), mottagare (sina egna) | Medlemmar (skapa invite) |
| `invoices` | Medlemmar | Medlemmar (full CRUD) |
| `consumption_data` | Medlemmar | (skrivs av systemet) |
| Storage `invoices`-bucket | Medlemmar i kopplad mätarpunkt | Medlemmar |

Service-role-nyckeln bypassar RLS — använd bara server-side för admin-jobb (t.ex. cron-rensning), aldrig klient-side.

---

## 7. Implementationssekvens

I strikt prioritetsordning. Bygg inte parallellt — varje steg bygger på föregående.

### Steg 1: Förberedelser i Supabase (~30 min)

1. Skapa Homeii-organisationen i Supabase och flytta projektet dit (om inte gjort) — fakturering ska ligga på orgen, inte privatkontot
2. SQL Editor → kör hela `supabase/schema.sql` (skapar 8 tabeller + alla RLS-policys + triggers)
3. Storage → New bucket `invoices`, private, 10 MB file limit
4. Lägg till Storage RLS-policys (template kommenterad i slutet av `schema.sql`)
5. Verifiera Vercel env vars — alla fyra för Production, Preview *och* Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Steg 2: Auth-flöde (~1-2 dagar)

- Magic link via `supabase.auth.signInWithOtp({ email })` — ingen lösenordshantering
- Global inloggad/utloggad state via Supabase Auth-listener
- Skydda `/mina-sidor`-routes via Next.js middleware
- Logga ut + session refresh

### Steg 3: "Spara faktura"-flöde (~2-3 dagar)

- Efter lyckad anonym uppladdning → CTA "Skapa konto för att spara analysen"
- Magic link → användaren bekräftar adressen som extraherats från fakturan ("Vi tolkade som *Storgatan 5* — stämmer?")
- Vid bekräftelse, atomisk transaktion:
  1. Skapa eller hitta `addresses`-rad
  2. Skapa `consumption_metering_points` med konsumtions-ID från fakturan
  3. Skapa `metering_point_members`-rad med `role='owner'`
  4. Ladda upp PDF till Storage-bucket
  5. Skapa `invoices`-rad med `pdf_storage_path` + `parsed_data` JSON + denormaliserade fält

### Steg 4: Mina sidor v1 UI (~2-3 dagar)

- `/mina-sidor`-vy: lista över sparade fakturor grupperade per mätarpunkt
- Klick på faktura → öppna sparad analys (samma vy som anonym uppladdning visade)
- Mätarpunkt-inställningar: ändra display-namn, lämna mätarpunkt
- Användarprofil: tier, mejlnotiser, kontoinställningar

### Steg 5: Invite-medlem-flöde (~1-2 dagar)

- Bjud-in-knapp i Mina sidor → mejladress
- Skapa rad i `metering_point_invitations` med engångs-token + 7 dagars expiry
- Skicka mejl med länk: `/invitation/accept?token=<uuid>`
- Acceptera-flow:
  - Validera token (status='pending', inte expirerad, mejl matchar)
  - Skapa `metering_point_members`-rad med `role='member'`
  - Sätt invitation status='accepted'
  - Redirect till Mina sidor

### Steg 6: Premium-gate UI (senare, ~1-2 dagar)

- Visa **blurrad** teaser av detaljerade rekommendationer för Bas-användare
- "Uppgradera till Premium" CTA
- Prismodell ej låst — UI-skiss tills affärsmodell är fastställd
- Stripe/Klarna-integration kommer separat

---

## 8. Vad som inte ska göras under pausen

- ❌ INTE köra `schema.sql` i Supabase än — databasen ska vara tom tills aktivt arbete startar
- ❌ INTE ta bort eller ändra env vars i Vercel (de gör ingen skada och slipper att sätta om)
- ❌ INTE radera Supabase-projektet
- ❌ INTE börja koda Auth, Mina sidor UI eller andra Steg-2+-uppgifter

---

## 9. Öppna produktfrågor

Inte arkitekturkritiska — kan besvaras under bygget.

- **Innehållet i Bas-nivån i detalj.** Vilka exakta funktioner är "grundläggande kontofunktionalitet"?
- **Premium-prismodell.** $X/mån, B2B, freemium-features, eller något annat? Beslut behövs först när Premium-funktioner börjar byggas.
- **Föräldralösa adresser.** När sista medlemmen lämnar — hur länge stannar adressen innan auto-arkivering? GDPR-fråga som behöver tänkas igenom när retention-policy skrivs.

---

## 10. Referenser

- **`supabase/schema.sql`** — komplett databasschema (CREATE TABLE, RLS-policys, triggers). Kör i Supabase SQL Editor när du är redo.
- **Supabase Auth-dokumentation:** https://supabase.com/docs/guides/auth
- **Supabase RLS-dokumentation:** https://supabase.com/docs/guides/auth/row-level-security
- **Anläggnings-ID-konceptet (Svenska kraftnät):** sökord "anläggningsidentifierare elnät"

---

## Frågor?

Skicka tillbaka konkreta frågor så fort något i detta dokument är otydligt eller verkar fel — innan kod skrivs ovanpå antaganden. Allt som skrevs här bygger på resonemang i ett videomöte 2026-04-28 och kan justeras om något inte håller mot verkligheten.
