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
