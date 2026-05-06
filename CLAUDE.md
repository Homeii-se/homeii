# Homeii

Homeii är en Next.js-app som analyserar svenska elräkningar och hjälper hushåll förstå och
optimera sin elkonsumtion. En anonym besökare laddar upp sin PDF, får direkt analys, och kan
skapa konto för att spara fakturor och bygga en historik över tid ("Mina sidor").

## Tech stack

- **Next.js 16** App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (region: eu-west-1) — databas, Auth och Storage

## Auth-strategi

Magic link + Google OAuth. Ingen lösenordshantering — Supabase Auth sköter allt.

## Arbetsflöde

Korta PR:ar mot `master`. En branch per implementationssteg — namnmönster:
`feat/<område>-<steg>-<kort-beskrivning>`.

## Mina sidor

Arkitekturdokumentet **`MINA-SIDOR-ARKITEKTUR.md`** är den enda källan till sanning för
detta arbete. Läs det vid varje sessionsstart innan du föreslår ändringar.

**Regel:** Varje PR som ändrar ett arkitekturbeslut eller datamodellen ska uppdatera
`MINA-SIDOR-ARKITEKTUR.md` i samma commit.

## Status

**Klart i master för "Mina Sidor":**
- PR #1-3: Dokumentation, schema (11 tabeller, RLS, GRANT-permissions)
- PR #5: Supabase-klienter, login `/logga-in`, callback `/auth/callback`
- PR #6: Proxy.ts skyddar `/app/*`, stub-sida `/app/hem`, logga ut-knapp
- PR #7: Schema-utökning `user_profiles` (first_name, last_name, telefon, samtycken)
- PR #8A: Profilformulär `/app/skapa-profil` med server action
- PR #8B: Profil-skydd i proxy redirectar ofullständiga profiler
- PR #9A: SignupCta aktiverad i simulator-flödet, stub-sida `/app/spara-analys`, next-param bevaras genom hela registreringsflödet
- PR #SCAFFOLD: Scaffold av alla Mina sidor-rutter med stub-sidor och gemensam sidomeny (`app/app/layout.tsx`)

**Verifierat end-to-end:** Anonym besökare laddar upp faktura → analys → klickar "Skapa konto" → magic link → profilformulär → landar på `/app/spara-analys` med inloggad session.

**Nästa:** PR #9C-prep – PDF som base64 i `homeii-state` (förberedelse för databas-skrivning). PR #9C – atomisk databas-skrivning.

## Roadmap

Grov plan för Mina sidor v1. Ordningen kan justeras baserat på vad som blir relevant först.

### Steg 3 – Spara-flöde (pågående)
- **PR #9C:** Atomisk databas-skrivning. Ersätter console.log i `actions.ts` med faktisk persistering. Address → consumption_metering_point → metering_point_member → document → analysis → home_profile. PDF lagras i Storage. Hantering av duplicat-faktura.

### Steg 4 – Mina sidor-vyer (sidorna är scaffoldade, fyll med innehåll)
- **PR #10:** Bygg ut `/app/hem` till riktig dashboard. Visa sparade fakturor, total kostnad, översikt över anslutna fastigheter.
- **PR #11:** `/app/min-uppfoljning` – jämförelser av användarens nuvarande läge kontra tidigare.
- **PR #12:** `/app/min-plan` – rekommendationer baserat på alla sparade analyser, prioriterad sparpotential.
- **PR #13:** `/app/mitt-hem` – redigera home_profile, hantera flera fastigheter, byta mellan dem.
- **PR #14:** `/app/mina-offerter` – offerter för åtgärder från rekommendationerna (vänster på prio-listan).
- **PR #14B:** `/app/mina-dokument` – dokumentrepository med filter per fastighet (alla typer av uppladdade dokument).
- **PR #14C:** `/app/mina-erbjudanden` – partnersamarbeten (placeholder tills partners är på plats).

### Steg 5 – Inbjudningar och delning
- **PR #15:** Bjuda in andra medlemmar till en fastighet med roller (member/read_only). Använder befintlig `metering_point_invitations`-tabell.
- **PR #16:** Acceptera inbjudningar, hantera invitations-flödet.

### Steg 6 – Bra-att-ha
- **PR #17:** Notiser och inställningar (mejl, push i framtiden).
- **PR #18:** Adminkonsol – kommer när första riktiga användare finns och GDPR-förfrågningar börjar dyka upp. Se Tekniska skulder.
- **PR #19:** Användarradering med korrekt hantering av ägarskap. Soft-delete-kolumner finns redan i schemat. Se Beslut-arkiv för regler.

### Steg 7 – Stripe (efter Mina sidor v1)
Premiumprenumerationer. Förberedelser i schemat finns redan. Se Tekniska skulder för plan.

## Beslut-arkiv

Beslut som tagits utanför arkitekturdokumentet och inte hör till en specifik PR.

### PDF-sökväg i Storage
PDF:er lagras under `documents/{document_id}.pdf` — inte under `{user_id}/...` eller `{home_property_id}/...`. Skälet: pathen identifierar dokumentet självt, inte vilket hem eller fastighet det tillhör. M:N-modellen (Beslut 6.15) innebär att samma dokument kan tillhöra flera hem — fel att hardcoda ett av dem i pathen.

**Notering vid V2-omskrivning (2026-05):** Path-konventionen har ändrats två gånger:
- V1 använde `{anlaggnings_id}/{document_id}.pdf`
- V2 första utkast använde `{home_property_id}/{document_id}.pdf`  
- V2 slutgiltigt använder `{document_id}.pdf` (efter att M:N-relationen mellan dokument och hem etablerades, Beslut 6.15)

### Användarradering
Vid radering (självvald, admin eller dödsfall):
- Hindra radering av owner med andra medlemmar — måste först överföra ägarskap via `transfer_ownership`-funktionen
- Om ensam användare på fastighet: radera både användare och fastighet
- Princip: undvik föräldralösa fastigheter
- Vid dödsfall: hantera manuellt när familj kontaktar Homeii

Implementeras inte nu — soft-delete-kolumner finns redan i schemat. Reglerna kodifieras när användarradering byggs.

### Datatransfer mellan anonym analys och spara-flow
Använder `localStorage`-nyckeln `homeii-state` (befintlig konvention från simulator). Sidan `/app/spara-analys` läser den direkt — ingen separat sessionStorage-överföring. Trade-off: per browser-domän, men accepterad för v1.

### Hantering av duplicat-faktura
Om användaren försöker spara en faktura med ett `anlaggnings_id` som redan är kopplat till samma användare: avvisa med "Du har redan denna faktura sparad". Ingen auto-uppdatering eller duplicat tillåts i v1.

## Konventioner

- UI-strängar bör skrivas så de är förberedda för översättning. Konkret val av i18n-lager
  (next-intl, next-i18next eller liknande) är inte låst — beslutet tas separat innan andra
  marknader lanseras. Tills dess: undvik att hårdkoda svenska strängar djupt nere i
  komponenter där de är svåra att hitta senare. Samla helst UI-text i en enkel central plats
  per komponent eller i konstanter, så att ett senare i18n-byte blir mekaniskt snarare än
  arkeologi.
- **Dokumentation** (inklusive denna fil och `MINA-SIDOR-ARKITEKTUR.md`) skrivs på svenska
- **Kod** — variabelnamn, funktionsnamn, kommentarer i kodfiler — skrivs på engelska
- Supabase-tabellnamn och kolumnnamn på engelska (schema redan låst)

## Regler för Claude Code

- Lägg aldrig till `Co-Authored-By`-trailers i commit-meddelanden. Användaren bestämmer commit-format själv.
- Använd inte `git push --force` utan explicit instruktion från användaren.
- Lägg inga skadliga eller obegripliga kommandon i `~/.claude/settings.local.json`-Allow-listan utan att fråga.
- När en filändring ger märklig duplicering (block dyker upp två gånger): stoppa direkt, beskriv exakt vad du ser för användaren, vänta på bekräftelse innan filen sparas. Bättre att vara övertydlig än att skriva trasig kod till disk.

## Innan du pushar

```bash
npm run lint
npm run build
```

Båda ska vara gröna innan en branch pushas.

---

## Tekniska skulder och prio 3-arbete

### Stripe-integration (prio 3)

Premiumprenumerationer hanteras via en framtida Stripe-integration. Schemat har förberett
tre fält på `user_profiles` (`subscription_status`, `subscription_external_id`,
`subscription_active_until`) som väntar på att aktiveras när Stripe byggs. Beslut om
prismodell, faktureringsfrekvens och feature-gating tas separat innan Stripe-arbetet startar.

### home_equipment-typsystem

`home_equipment`-tabellen i Supabase är ett key-value-lager där `equipment_data` är jsonb.
Strukturen för `equipment_data` per `equipment_key` definieras i
`lib/types/home-equipment.ts` — det är källa till sanning för equipment-schemat.
När du lägger till ny utrustningstyp:

1. Lägg till värdet i `EquipmentKey`-unionen
2. Skapa interface för datafält
3. Lägg till mappingen i `EquipmentDataMap`
4. Lägg till värdet i `isEquipmentKey`-funktionens lista

Mattias' analyskod och frontend-formulär ska importera typer härifrån.

### Single-country-antaganden

Schemat förutsätter Sverige som primär marknad. Specifika antaganden listas i MINA-SIDOR-ARKITEKTUR.md sektion 11. Vid internationell expansion kommer schemajustering krävas — främst zone-constraint och anlaggnings_id-konceptet. Inte arkitekturkris, men kräver medveten migration när det blir aktuellt.

### Adminkonsol

Skjuts upp till efter Mina sidor v1 är levererad. Behövs när:
- Riktiga användare börjar registrera sig
- GDPR-förfrågningar kommer in (radera, exportera, rätta)
- Kollegor utan SQL-kunskaper behöver hjälpa till med supportärenden
- Volymen blir för stor för att läsa user_profiles-tabellen direkt

Fram tills dess: ändringar görs manuellt via Supabase-dashboarden eller SQL Editor. Adminkonsol kräver autentiseringsmodell, behörighetslager (vem är admin?) och audit-logg — uppskattat 1-2 veckors arbete och inte värt att bygga förrän behovet är konkret.