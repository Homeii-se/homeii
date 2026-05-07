# V1-INVENTERING — referenser som måste hanteras inför V2-merge

**Datum:** 2026-05-07
**Branch:** `docs/arkitektur-v2-utkast`
**Syfte:** Kartlägga V1-kvarlevor i kodbasen. Underlag för en migrerings-checklista.

---

## Sammanfattning

| Kategori | Träffar | Blockerande? |
|---|---|---|
| 1. V1-tabellnamn | 60 | Nej — mestadels i dokumentation och korrekt SQL-drop-block |
| 2. V1-routes `/app/mina-matpunkter` | 0 | Nej — klart |
| 3. V1-RLS-helperfunktioner | 37 | Nej — mestadels dokumentation och korrekt SQL-drop-block |
| 4. `anlaggnings_id` i kod | 39 | Delvis — se kategori 4 |

**Blockerande fynd: 2**
1. `supabase/migrations/20260504_grant_authenticated_permissions.sql` — V1-migration i aktiv mapp
2. `app/simulator/components/UploadBill.tsx` — inaktuell kommentar med V1-antagande om PK

---

## Kategori 1 — V1-tabellnamn

Pattern: `metering_point|consumption_metering|production_metering`

### 1a. Dokumentationsfiler — ingen åtgärd

Alla träffar i `.md`-filer är historisk dokumentation eller V2-jämförelser:

| Fil | Vad det är |
|---|---|
| `MINA-SIDOR-ARKITEKTUR.md` | V1-arkitekturdokument — beskriver V1-modellen, ska inte ändras |
| `MINA-SIDOR-ARKITEKTUR-V2-UTKAST.md` | Jämför V1 vs V2 — referenserna är intentionella |
| `V2-SCHEMA-VERIFIERING.md` | Verifieringsrapport — nämner V1-tabeller för kontextuell jämförelse |
| `CLAUDE.md` | Roadmap-text (sektion "Steg 3") nämner V1-tabellnamn i äldre PR-beskrivning |

**Åtgärd:** Ingen. Dokumentation som beskriver V1 förblir historisk källkod.

**OBS på CLAUDE.md:** PR #9C-beskrivningen (rad 53) säger fortfarande  
`Address → consumption_metering_point → metering_point_member → ...`  
vilket är V1-flödet. Den ska uppdateras när PR #9C faktiskt implementeras med V2-flödet, som en del av den commit-regeln i CLAUDE.md.

### 1b. `supabase/schema.sql` rad 55–58 — korrekt

```sql
drop table if exists public.metering_point_invitations cascade;
drop table if exists public.metering_point_members cascade;
drop table if exists public.production_metering_points cascade;
drop table if exists public.consumption_metering_points cascade;
```

**Åtgärd:** Ingen. Dessa DROP-satser är V2-schemats migrationsstrategi — avsiktligt.

### 1c. `supabase/migrations/20260504_grant_authenticated_permissions.sql` — BLOCKERANDE

```sql
grant select, insert, update, delete on public.consumption_metering_points to authenticated;
grant select, insert, update, delete on public.production_metering_points to authenticated;
grant select, insert, update, delete on public.metering_point_members to authenticated;
grant select, insert, update, delete on public.metering_point_invitations to authenticated;
-- (+ 4 rader för service_role)
```

Migrations-mappen är avsedd för inkrementell historik. Denna fil är en V1-migration — om Supabase CLI eller ett CI-skript kör alla migrationer i ordning, kan `20260504_...`-filen köras mot en V2-databas (där V1-tabellerna inte finns) och orsaka fel.

**Åtgärd:** Flytta filen ur `supabase/migrations/` eller lägg till en kommentar-header:
```
-- V1-MIGRATION: Kör INTE mot V2-databas. Gäller enbart historisk V1-setup.
```
Hantera som en del av merge-förberedelserna.

### 1d. `app/simulator/components/UploadBill.tsx` rad 148 — inaktuell kommentar

```ts
// on consumption_metering_points, so two different IDs can't coexist in one save.
```

**Åtgärd:** Uppdatera kommentaren. Tabellen heter inte längre `consumption_metering_points`.  
Föreslagen text: `// on home_properties, so two different anlaggnings_id values can't coexist in one save.`

---

## Kategori 2 — V1-routes

Pattern: `/app/mina-matpunkter|/app/min-matpunkt`

**Resultat: Inga träffar.** Klart.

---

## Kategori 3 — V1-RLS-helperfunktioner

Pattern: `user_is_member|user_is_owner|user_can_write[^_]`

### 3a. Dokumentationsfiler — ingen åtgärd

Alla träffar i `.md`-filer är beskrivningar av V1-funktioner i historisk kontext.

### 3b. `supabase/schema.sql` rad 43–45 — korrekt

```sql
drop function if exists public.user_is_member(text);
drop function if exists public.user_is_owner(text);
drop function if exists public.user_can_write(text);
```

**Åtgärd:** Ingen. DROP-block för V1-funktioner är avsiktligt.

---

## Kategori 4 — `anlaggnings_id` i TypeScript-kod

`anlaggnings_id` existerar i V2-schemat som ett fält på `home_properties` — det är inte längre PK, men det är fortfarande ett centralt fält. De flesta träffar är alltså V2-korrekta.

### 4a. V2-korrekt användning — ingen åtgärd

| Fil | Vad det är | Bedömning |
|---|---|---|
| `lib/types/database.ts:84` | `DbHomeProperty.anlaggnings_id: string \| null` | ✅ Korrekt V2-typ |
| `lib/types/database.ts:101` | `DbHomePropertyProduction.production_anlaggnings_id` | ✅ Korrekt V2-typ |
| `lib/types/database.ts:212` | `SaveAnalysisPayload.property.anlaggnings_id` | ✅ Payload-typ |
| `lib/types/domain.ts:115` | Kommentar om `RealHomeProperty` | ✅ Korrekt |
| `lib/types/mappers.ts:161–169` | Mapper för `DbHomeProperty → HomeProperty` | ✅ Hanterar nullable korrekt |
| `lib/types/mappers.ts:202` | Mapper för `production_anlaggnings_id` | ✅ Korrekt |
| `lib/types/home-equipment.ts:12–13` | Kommentar som förklarar V2-skifte | ✅ Intentionellt |
| `lib/save-analysis/parse-form-data.ts:39,46,172` | Läser formulärfält `anlaggnings_id` | ✅ Formuläret heter fortfarande `anlaggnings_id` |
| `lib/save-analysis/call-rpc.ts:142` | Skickar `p_anlaggnings_id` till RPC | ✅ RPC-signaturen använder `anlaggnings_id` |
| `app/app/hem/[home_id]/page.tsx:39,204,225–227` | Hämtar och visar `anlaggnings_id` | ✅ Korrekt V2-query |
| `app/app/spara-analys/page.tsx:45,52,63–76,96–108` | Smart match på `anlaggnings_id` | ✅ Korrekt V2-logik |
| `app/app/spara-analys/address-form.tsx:31,35,69,232–237` | UI-formulär + smart match | ✅ Korrekt |

### 4b. `app/simulator/components/UploadBill.tsx` rad 146–148 — inaktuell kommentar

```ts
// Block if invoices come from different metering points (different anlaggnings_id).
// We can only save one home at a time — schema has anlaggnings_id as primary key
// on consumption_metering_points, so two different IDs can't coexist in one save.
```

V2-schemat har inte `anlaggnings_id` som PK — det är ett vanligt fält på `home_properties`.  
Logiken i sig (ett `anlaggnings_id` per spara-session) stämmer fortfarande, men motiveringen är V1.

**Åtgärd:** Uppdatera kommentaren:
```ts
// Block if invoices come from different metering points (different anlaggnings_id).
// We can only save one anlaggnings_id per save-session — the RPC creates or reuses
// one home_property per anlaggnings_id.
```

---

## Åtgärdslista inför V2-merge

| # | Fil | Åtgärd | Prioritet |
|---|---|---|---|
| 1 | `supabase/migrations/20260504_grant_authenticated_permissions.sql` | Lägg till V1-varningsheader eller flytta ur `migrations/` | **BLOCKERANDE** |
| 2 | `app/simulator/components/UploadBill.tsx` rad 147–148 | Uppdatera kommentar: ta bort PK-referens och `consumption_metering_points` | Låg |
| 3 | `CLAUDE.md` rad 53 | Uppdatera PR #9C-beskrivningen med V2-tabellnamn när PR implementeras | Naturligt med PR #9C |
| 4 | Alla `.md`-filer (MINA-SIDOR-ARKITEKTUR.md etc.) | Ingen åtgärd — historisk dokumentation | — |

**Slutsats:** Kodbasen är i bra form inför V2-merge. Inga TypeScript/React-filer refererar till  
V1-tabeller i aktiv kod. Det kritiska fyndet är migrationsfilen med V1-GRANTs.
