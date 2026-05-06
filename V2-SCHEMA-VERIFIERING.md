# V2-schema verifiering

**Datum:** 2026-05-06
**Status:** Verifiering baserad på V1 (`supabase/schema.sql`). V2-schema-filen är inte uppladdad i repot vid skrivande stund — när den är på plats körs en andra pass där varje punkt nedan kan kryssas av mot faktiskt innehåll.
**Scope:** Funktioner, triggers, tabeller, RLS-policys, FK-beroenden, Storage. Bygger på V1 som finns i `supabase/schema.sql` (rad 1–795 efter senaste master).

---

## 1. Funktioner i V1 som behöver droppas

V1 har **7 funktioner** definierade i `supabase/schema.sql`. Tabellen nedan listar varje funktion med rad i V1-schemat och status i V2.

| # | Funktion (V1-signatur) | V1-rad | Status i V2 | Anmärkning |
|---|---|---|---|---|
| 1 | `public.handle_new_user()` returns trigger | 56–63 | **Behåll** oförändrad | Auth-trigger, oberoende av Mina sidor-modellen. |
| 2 | `public.transfer_ownership(p_anlaggnings_id text, p_new_owner_id uuid)` | 359–392 | **Drop + recreate** med ny signatur | V2: `transfer_ownership(p_home_id uuid, p_new_owner_id uuid)`. |
| 3 | `public.user_is_member(p_anlaggnings_id text)` returns boolean | 398–406 | **Drop + recreate** omdöpt | V2: `user_is_home_member(p_home_id uuid)`. |
| 4 | `public.user_is_owner(p_anlaggnings_id text)` returns boolean | 408–417 | **Drop + recreate** omdöpt | V2: `user_is_home_owner(p_home_id uuid)`. |
| 5 | `public.user_can_write(p_anlaggnings_id text)` returns boolean | 420–428 | **Drop + recreate** omdöpt | V2: `user_can_write_home(p_home_id uuid)`. |
| 6 | `public.user_email_matches(p_email text)` returns boolean | 431–440 (uppskattat) | **Behåll**, byt tabellreferens i policys (inte i funktionen själv) | Funktionens kropp slår mot `auth.users` — bytet sker när policys på `home_invitations` skapas och anropar samma funktion. Se sektion 5. |
| 7 | `public.set_updated_at()` returns trigger | 763–771 | **Behåll** oförändrad | Generisk trigger-funktion, används av V2:s nya updated_at-triggers. |

### 1.1 Förväntat drop-block för funktioner

Eftersom signaturer ändras (`text` → `uuid`) måste de gamla varianterna droppas explicit. Förväntat block:

```sql
drop function if exists public.transfer_ownership(text, uuid);
drop function if exists public.user_is_member(text);
drop function if exists public.user_is_owner(text);
drop function if exists public.user_can_write(text);
```

`handle_new_user()`, `user_email_matches(text)` och `set_updated_at()` ska **inte** droppas.

> **Att verifiera mot V2-utkastet:** Innehåller drop-blocket exakt dessa fyra `drop function`-rader? Saknas någon eller finns en extra som inte ska vara där?

---

## 2. Triggers i V1 som behöver droppas

V1 har **8 triggers** i `supabase/schema.sql`.

| # | Trigger | Tabell | V1-rad | Status i V2 |
|---|---|---|---|---|
| 1 | `on_auth_user_created` | `auth.users` | 66–68 | **Behåll** — auth-systemet, oberoende. |
| 2 | `trg_user_profiles_updated` | `public.user_profiles` | 772–774 | **Behåll** — `user_profiles` är oförändrad. |
| 3 | `trg_addresses_updated` | `public.addresses` | 777–779 | **Re-create** efter att `addresses` droppas och återskapas (se sektion 4). |
| 4 | `trg_consumption_mp_updated` | `public.consumption_metering_points` | 782–784 | **Drop implicit** när tabellen droppas. |
| 5 | `trg_production_mp_updated` | `public.production_metering_points` | 787–789 | **Drop implicit** när tabellen droppas. |
| 6 | `trg_documents_updated` | `public.documents` | 792–794 | **Re-create** efter att `documents` droppas och återskapas. |
| 7 | `trg_home_profile_updated` | `public.home_profile` | 797–799 | **Re-create** efter att `home_profile` droppas och återskapas. |
| 8 | `trg_home_equipment_updated` | `public.home_equipment` | 802–804 | **Re-create** efter att `home_equipment` droppas och återskapas. |

### 2.1 Triggers som behöver skapas i V2 (om de inte redan finns)

För varje ny tabell i V2 som har en `updated_at`-kolumn behövs en motsvarande `trg_*_updated`-trigger som anropar `public.set_updated_at()`:

- `trg_homes_updated` på `public.homes`
- `trg_home_members_updated` på `public.home_members`
- `trg_home_invitations_updated` på `public.home_invitations`
- `trg_home_properties_updated` på `public.home_properties`
- `trg_home_property_production_updated` på `public.home_property_production`
- `trg_home_property_documents_updated` på `public.home_property_documents` (om tabellen har `updated_at`)

### 2.2 Explicit drop av triggers — behövs det?

**Generellt nej** — när en tabell droppas via `DROP TABLE ... CASCADE` försvinner triggers automatiskt. Men:

- **`on_auth_user_created` på `auth.users`** är ett undantag. Den ligger på system-tabellen `auth.users` (Supabase-ägd) och skulle överleva en `DROP TABLE public.user_profiles`. Den är inte tänkt att droppas i V2 — `handle_new_user()` är fortfarande relevant — men om V2-utkastet vill köras "rent" måste triggern explicit droppas och återskapas eftersom `create or replace trigger` inte är giltig syntax i alla PostgreSQL-versioner. Mönstret från V1 är `drop trigger if exists on_auth_user_created on auth.users; create trigger ...`.

> **Att verifiera mot V2-utkastet:** Hanteras `on_auth_user_created` på samma idempotenta sätt som i V1? Finns explicita drops för triggers på system-tabeller?

---

## 3. Tabeller som ska behållas

### 3.1 `spot_prices` och `monthly_avg_prices` — **verifierad: utanför schema.sql, säkra**

Båda tabellerna är **inte definierade i `supabase/schema.sql`** och inte heller i någon av filerna under `supabase/migrations/`. De existerar i Supabase-databasen men är skapade utanför det versionerade schemat (troligen via Supabase Dashboard eller importjobb).

**Konsekvens för V2-migrationen:**
- De är osynliga för drop-blocket → påverkas inte alls.
- De har inga FK till V1-tabellerna (verifierat: ingen rad i `supabase/`-mappen som refererar till `consumption_metering_points`, `metering_point_members` etc. från `spot_prices` eller `monthly_avg_prices`).
- Koden i `lib/prices/sources/supabase.ts` läser `spot_prices` direkt utan att korsreferera Mina sidor-tabeller.

**Slutsats:** Mattias kan strunta i dessa två tabeller helt. De är safe.

### 3.2 `user_profiles` — kvar oförändrad

| Fråga | Svar |
|---|---|
| Finns i schema.sql? | Ja, rad 25–53. |
| FK till `auth.users`? | Ja: `id uuid primary key references auth.users(id) on delete cascade`. |
| Påverkas av drop-cascade på V1-tabeller? | **Nej.** `user_profiles` har inga FK *från* sig till V1-tabellerna och har inga FK *till* sig från Mina sidor-tabellerna. Den är isolerad från drop-blocket. |
| Behöver re-create i V2? | Nej, behåll oförändrad. |
| Status: | **SÄKER.** Ingen drop, ingen migration. |

### 3.3 Logiskt "behållna" tabeller som faktiskt droppas och återskapas

Per din bekräftelse droppas och återskapas följande tabeller i V2 — de är logiskt kvar men FK-strukturen ändras så grundligt att en drop-och-recreate är renast. Detta är ett **kritiskt fynd** som behöver verifieras mot V2-utkastet (se sektion 4 nedan):

- `addresses` — V1: FK `consumption_anlaggnings_id` mot `consumption_metering_points`. V2: FK vänds — `home_properties.address_id` pekar in mot `addresses`.
- `documents` — V1: FK `anlaggnings_id` mot `consumption_metering_points`. V2: ingen direkt FK; kopplas via `home_property_documents`.
- `analyses` — V1: FK `anlaggnings_id`. V2: ingen FK till mätarpunkt; kopplas via `documents → home_property_documents`.
- `consumption_data` — V1: FK `anlaggnings_id`. V2: FK `home_property_id` till `home_properties`.
- `home_profile` — V1: PK och FK `anlaggnings_id`. V2: PK/FK `home_property_id` till `home_properties`.
- `home_equipment` — V1: composite PK `(anlaggnings_id, equipment_key)`, FK `anlaggnings_id`. V2: composite PK `(home_property_id, equipment_key)`, FK `home_property_id`.

### 3.4 Tabeller som droppas och inte återskapas

- `consumption_metering_points` — ersätts konceptuellt av `home_properties` (nytt PK, nytt namn).
- `production_metering_points` — ersätts av `home_property_production`.
- `metering_point_members` — ersätts av `home_members`.
- `metering_point_invitations` — ersätts av `home_invitations`.

---

## 4. Risker

### 4.1 FK-cascade när V1-mätarpunkt-tabeller droppas — **HÖGSTA PRIORITET**

`consumption_metering_points` har **9 inkommande FK:s** från andra tabeller i V1:

| Från-tabell | FK-kolumn | V1-rad |
|---|---|---|
| `addresses` | `consumption_anlaggnings_id` (unique) | 125 |
| `production_metering_points` | `consumption_anlaggnings_id` (unique) | 124–125 |
| `metering_point_members` | `anlaggnings_id` | 145–146 |
| `metering_point_invitations` | `anlaggnings_id` | 177–178 |
| `documents` | `anlaggnings_id` | 208–209 |
| `analyses` | `anlaggnings_id` | 256–257 |
| `home_profile` | `anlaggnings_id` (är även PK) | 288–289 |
| `home_equipment` | `anlaggnings_id` | 314–315 |
| `consumption_data` | `anlaggnings_id` | 333–334 |

**Dessutom har `documents`** en inkommande FK från `analyses.document_id` (rad 255).

**Strategi-alternativ för V2:**

| Strategi | Effekt | Risk |
|---|---|---|
| `DROP TABLE consumption_metering_points CASCADE` (utan att droppa beroende tabeller separat) | Postgres droppar tabellen + alla FK-constraints från de beroende tabellerna. **Tabellerna själva försvinner inte** — bara constraints. Datan är kvar. | Högsta — kvarvarande tabeller har då ogiltiga `anlaggnings_id`-värden utan FK-skydd. Migration blir oklar. |
| Drop alla beroende tabeller + V1-mätarpunkt-tabeller med CASCADE, sedan `create table` på alla V2-tabeller från grunden | Renaste. Hela Mina sidor-modellen återskapas atomiskt. | Låg om körs i en transaktion. **All data försvinner** — accept för pre-launch tillstånd. |
| Drop FK:s manuellt först, alter columns, sedan drop V1-tabeller | Bevarar data men är mycket invecklat med rename av kolumner och re-population av nya FK-värden. | Hög — många små steg som kan gå fel. |

**Per din bekräftelse använder V2-utkastet strategi 2** (drop allt utom `user_profiles`, recreate allt). Det är pragmatiskt riktigt för pre-launch men förutsätter att inga riktiga användare hunnit registrera sig.

> **Att verifiera mot V2-utkastet:** Drop-blocket inkluderar **alla 10 tabeller**: `consumption_metering_points`, `production_metering_points`, `metering_point_members`, `metering_point_invitations`, `addresses`, `documents`, `analyses`, `consumption_data`, `home_profile`, `home_equipment`. Drops sker `with cascade`. **Om någon tabell saknas i drop-blocket är det ett kritiskt fynd.**

### 4.2 RLS-policys vid signaturändring av RLS-helpers

V1 har RLS-policys som anropar `user_is_member(anlaggnings_id)`, `user_is_owner(anlaggnings_id)` och `user_can_write(anlaggnings_id)` på följande tabeller:

- `consumption_metering_points` (rad 478–489) — försvinner med tabellen.
- `production_metering_points` (rad 521–539) — försvinner med tabellen.
- `metering_point_members` (rad 545–570) — försvinner.
- `metering_point_invitations` (rad 577–594) — försvinner.
- `addresses` (rad 500–515) — använder `user_is_member(consumption_anlaggnings_id)` via subquery-EXISTS mot `consumption_metering_points`. Försvinner när `addresses` droppas.
- `documents` (rad ~600) — använder `user_is_member(anlaggnings_id)`. Försvinner när tabellen droppas.
- `analyses`, `consumption_data`, `home_profile`, `home_equipment` — alla likadant.

**Risk:** RLS-policys binder till funktioner via *namn*, inte via signatur. Om en V1-policy försöker referera `user_is_member(text)` när vi senare har `user_is_home_member(uuid)` i V2 — då fallerar policyn vid skapande. Eftersom strategin är drop-och-recreate försvinner dock alla V1-policys med sina tabeller, och V2-policys skapas i nya tabellernas blocks. Risk: **låg** givet strategi 2.

> **Att verifiera mot V2-utkastet:** Inga V1-policys bevaras. Alla V2-policys använder de nya helper-namnen (`user_is_home_member`, `user_is_home_owner`, `user_can_write_home`).

### 4.3 Storage-policys

V1 har Storage-policys för `documents`-bucketen som troligen anropar `user_is_member(anlaggnings_id)` baserat på fil-pathen `documents/{anlaggnings_id}/{document_id}.pdf` (per CLAUDE.md). De finns kommenterade i slutet av V1:s `schema.sql` (rad ~735–755 enligt grep) som template — **icke-aktiva i schema.sql själv**, körs manuellt.

**I V2** ändras både path-konventionen (om beslutas) och helper-funktionen. Storage-policys behöver omformuleras. Om V2 fortfarande använder `documents/{anlaggnings_id}/{document_id}.pdf` (fastighet, inte hem) kan policyn använda `user_is_home_member` med en EXISTS-subquery genom `home_properties → home_property_documents → documents` för att verifiera åtkomst.

> **Att verifiera mot V2-utkastet:** Är Storage-policys uppdaterade eller flaggade som "att hantera manuellt"? Kommenteras de in eller lämnas utanför schemat?

### 4.4 Index — partial unique på aktiv ägare

V1 har:

```sql
create unique index idx_one_active_owner_per_metering_point
  on public.metering_point_members(anlaggnings_id)
  where role = 'owner' and left_at is null;
```

V2 behöver motsvarande:

```sql
create unique index idx_one_active_owner_per_home
  on public.home_members(home_id)
  where role = 'owner' and left_at is null;
```

> **Att verifiera mot V2-utkastet:** Finns motsvarande partial unique index på `home_members`?

### 4.5 GRANT-permissions på nya tabeller

V1 har explicita `grant select, insert, update, delete ... to authenticated` (rad 700–710) och `... to service_role` (rad 715–720) på Mina sidor-tabellerna. Detta upprepas i `supabase/migrations/20260504_grant_authenticated_permissions.sql`.

Anledningen är subtil: Postgres ger inte automatiskt access till tabeller bara för att RLS är aktiv — `authenticated`-rollen behöver explicit GRANT. Om V2 missar GRANT på de nya tabellerna får inloggade användare permission-fel på alla queries.

> **Att verifiera mot V2-utkastet:** Finns GRANT-statements för alla nya V2-tabeller (`homes`, `home_members`, `home_invitations`, `home_properties`, `home_property_production`, `home_property_documents`) till både `authenticated` och `service_role`?

---

## 5. Rekommendation om `user_email_matches`

V1-funktionen tar email som parameter och slår mot `auth.users`:

```sql
create or replace function public.user_email_matches(p_email text)
returns boolean as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = p_email
  );
$$ language sql security definer stable;
```

Den används troligen i V1:s policy `users see invitations to their email` på `metering_point_invitations`, ungefär:

```sql
create policy "users see invitations to their email"
  on public.metering_point_invitations for select
  using (public.user_email_matches(invited_email));
```

I V2 behövs samma logik på `home_invitations`. Du frågade vilken signatur som är renast.

### Variant 1 — behåll nuvarande signatur `(p_email text)`

**Pro:**
- Komponerbar — funktionen kan användas i andra kontexter (t.ex. om vi senare lägger till en `user_invitations`-vy som kombinerar olika typer av invitations).
- Samma mönster som `user_is_member` (tar id som arg, inte rad).
- `auth.users(id)` har PK-index så lookupen är O(1).

**Con:**
- En extra DB-lookup per RLS-evaluering. För invitations-listor med många rader summerar det.

### Variant 2 — invitation_id som parameter (`(p_invitation_id uuid)`)

**Pro:**
- Funktionen gör join internt — kallande policy blir kortare.

**Con:**
- Bundet till en specifik tabell. Om vi senare vill matcha email mot något annat måste vi skriva en ny variant.
- Inom funktionen behövs ändå en lookup mot `auth.users` plus en lookup mot `home_invitations`. **Mer arbete, inte mindre.**

### Variant 3 — läs email från JWT-claims (renaste, snabbast)

Supabase lägger användarens email i JWT-claimen. Den är åtkomlig via `current_setting('request.jwt.claims', true)::jsonb->>'email'`. Detta undviker DB-lookupen helt:

```sql
create or replace function public.user_email_matches(p_email text)
returns boolean as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb->>'email') = p_email,
    false
  );
$$ language sql stable;
```

**Pro:**
- Ingen DB-query alls.
- Kan markeras `stable` (inte `security definer`) — minskar attack-yta.
- `auth.email()` finns som standard-helper i Supabase och gör samma sak — kan användas direkt: `using (invited_email = auth.email())`.

**Con:**
- Beroende av att JWT-claimen finns och är aktuell. Om en användare ändrar email i `auth.users` syns det inte i JWT förrän nästa token-refresh.
- Subtila skillnader i hur Supabase handterar email-ändringar mellan auth.users och JWT — i praktiken inte ett problem för invitations-policys (en invitation till ny email skickas ändå via separat magic link).

### Slutsats

**Rekommenderad: Variant 3** (eller direkt `auth.email()`-call utan helper-funktion).

Men för att matcha V1-mönstret och minimera risken vid migration: **Variant 1** är acceptabelt och rensar inga icke-uppenbara förbättringar. Ingen prestanda-skuld om invitations-tabellen är liten (vilket den i praktiken är).

**Mitt förslag:** Behåll Variant 1 i V2 (oförändrad funktion) men anteckna i koden att `auth.email()` är ett alternativ vid framtida optimering. Det är rent och konservativt.

> **Att verifiera mot V2-utkastet:** Finns `user_email_matches(p_email text)` kvar oförändrad? Refereras den från policys på `home_invitations`?

---

## 6. Konkreta korrigeringar

Listan nedan beskriver vad som **ska finnas** i V2-utkastet. När V2-filen är uppladdad till repot är detta checklistan att stryka av mot.

### 6.1 Drop-block — funktioner

```sql
drop function if exists public.transfer_ownership(text, uuid);
drop function if exists public.user_is_member(text);
drop function if exists public.user_is_owner(text);
drop function if exists public.user_can_write(text);
```

`handle_new_user()`, `user_email_matches(text)` och `set_updated_at()` ska **inte** droppas.

### 6.2 Drop-block — tabeller

Per strategi 2 (drop-och-recreate på alla Mina sidor-tabeller utom `user_profiles`):

```sql
drop table if exists public.consumption_data cascade;
drop table if exists public.home_equipment cascade;
drop table if exists public.home_profile cascade;
drop table if exists public.analyses cascade;
drop table if exists public.documents cascade;
drop table if exists public.metering_point_invitations cascade;
drop table if exists public.metering_point_members cascade;
drop table if exists public.production_metering_points cascade;
drop table if exists public.consumption_metering_points cascade;
drop table if exists public.addresses cascade;
```

Ordning spelar mindre roll med `cascade`, men logiskt är det renare att droppa "barn först".

`user_profiles` ska **inte** droppas. Den behåller sin FK till `auth.users` och alla data.

`spot_prices` och `monthly_avg_prices` finns inte i schema.sql och ska **inte** läggas till i drop-blocket.

### 6.3 Re-create-block — funktioner (efter drop)

```sql
create or replace function public.user_is_home_member(p_home_id uuid) returns boolean as $$ ... $$;
create or replace function public.user_is_home_owner(p_home_id uuid) returns boolean as $$ ... $$;
create or replace function public.user_can_write_home(p_home_id uuid) returns boolean as $$ ... $$;
create or replace function public.transfer_ownership(p_home_id uuid, p_new_owner_id uuid) returns void as $$ ... $$;
```

### 6.4 Re-create-block — tabeller

Ordning (FK-beroenden):

1. `addresses`
2. `homes`
3. `home_properties` (FK till `homes`, `addresses`)
4. `home_members` (FK till `homes`, `auth.users`)
5. `home_invitations` (FK till `homes`)
6. `home_property_production` (FK till `home_properties`)
7. `documents` (ingen direkt FK till mätarpunkt i V2)
8. `analyses` (FK till `documents`)
9. `home_property_documents` (FK till `home_properties`, `documents`)
10. `home_profile` (FK till `home_properties`)
11. `home_equipment` (FK till `home_properties`)
12. `consumption_data` (FK till `home_properties`)

### 6.5 Index

- Partial unique på `home_members(home_id) where role='owner' and left_at is null` (motsvarar V1:s `idx_one_active_owner_per_metering_point`).
- Andra index efter behov — se V1:s rader 161, 166, 197, 241, 244, 275 för mönster.

### 6.6 RLS — `enable row level security` + policys

På varje ny V2-tabell:

```sql
alter table public.<table> enable row level security;
```

Policys på alla skrivande tabeller använder `user_can_write_home(home_id)` och på alla läsande använder `user_is_home_member(home_id)`. För tabeller där `home_id` inte är direkt tillgängligt (t.ex. `documents`, `analyses`, `consumption_data`, `home_profile`, `home_equipment`) krävs en EXISTS-subquery genom `home_properties` eller `home_property_documents`.

**Specifikt på `documents`:** Eftersom ett dokument kan vara kopplat till flera hem (M:N), måste policyn göra:

```sql
using (
  exists (
    select 1
    from public.home_property_documents hpd
    join public.home_properties hp on hp.id = hpd.home_property_id
    where hpd.document_id = documents.id
      and public.user_is_home_member(hp.home_id)
  )
)
```

Detta löser TODO-kommentaren i `MINA-SIDOR-ARKITEKTUR-V2-UTKAST.md` sektion 5.2.

### 6.7 GRANT-permissions

För varje ny V2-tabell:

```sql
grant select, insert, update, delete on public.<table> to authenticated;
grant select, insert, update, delete on public.<table> to service_role;
```

Tio nya/återskapade tabeller behöver detta. Missa inte någon — utan GRANT ger Postgres permission-fel även om RLS-policys är korrekta.

### 6.8 Triggers (re-create)

För varje ny V2-tabell med `updated_at`-kolumn:

```sql
drop trigger if exists trg_<name>_updated on public.<table>;
create trigger trg_<name>_updated
  before update on public.<table>
  for each row execute procedure public.set_updated_at();
```

`on_auth_user_created` och `trg_user_profiles_updated` rörs inte.

### 6.9 Storage-policys

V1:s template-policys (kommenterade i slutet av schema.sql) bör översättas till V2:s helper-funktioner och eventuellt nytt path-mönster. Om path-konventionen är `documents/{home_property_id}/{document_id}.pdf` (eller behåller `anlaggnings_id` enligt CLAUDE.md):

> **Beslut behövs:** Behåller V2 PDF-pathen som `documents/{anlaggnings_id}/{document_id}.pdf` eller byter till `documents/{home_property_id}/{document_id}.pdf`? CLAUDE.md anger `anlaggnings_id`, men i V2 är `home_property_id` mer naturligt eftersom det är den nya PK:n. Båda funkar tekniskt — Mattias avgör baserat på Storage-migrations-besvär.

---

## 7. Sammanfattning

| Område | Status |
|---|---|
| Funktioner att droppa | 4 explicita drops av `(text)`-signaturer. |
| Funktioner att behålla | 3 (`handle_new_user`, `user_email_matches`, `set_updated_at`). |
| Triggers att droppa explicit | 1 (`on_auth_user_created` om V2 vill köras idempotent). |
| Triggers att skapa nya | 6 (en per V2-tabell med `updated_at`). |
| Tabeller att droppa | 10 (alla Mina sidor-tabeller utom `user_profiles`). |
| Tabeller att skapa | 13 (alla V2 Mina sidor-tabeller). |
| Tabeller utanför scope | 2 (`spot_prices`, `monthly_avg_prices`) — oberoende, inga FK till V1, säkra. |
| Risker | FK-cascade lösbar via strategi 2; storage-policys kräver översättning; index och GRANT lätta att missa. |
| Rekommendation om `user_email_matches` | Behåll Variant 1 (text-signatur, oförändrad). Variant 3 (`auth.email()`) är optimering för senare. |

**Verifieringsstatus:** Klar mot V1. När V2-utkast-filen är uppladdad i repot körs en andra pass där varje "Att verifiera mot V2-utkastet"-not stryks av mot faktiskt innehåll.
