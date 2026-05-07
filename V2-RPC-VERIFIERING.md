# V2 RPC-funktioner — verifiering

**Datum:** 2026-05-06 (omskriven efter att RPC-koden flyttats in i schema.sql)
**Verifierad plats:** `supabase/schema.sql` Del 9, rad 819–1133 (1213 rader totalt)
**Funktioner:** `create_initial_home_from_invoice` (rad 851), `create_empty_home` (rad 1092)

> **Historik:** Verifieringen genomfördes ursprungligen mot den separata filen `supabase/migrations/20260506_rpc_create_home_functions.sql`. Den filen är nu raderad eftersom RPC-koden är konsoliderad till schema.sql (single source of truth-principen). Funktionerna är identiska — verifieringen av kolumnnamn, FK-ordning, exception-meddelanden, SECURITY DEFINER och GRANT är därför oförändrad.
>
> **Om radnummer i rapporten:** Tabellerna nedan listar fortfarande radnummer från **migration-filens originalpositioner** (1-baserad 1–351). För att hitta motsvarande rad i schema.sql Del 9, addera **+806** (Mattias bekräftade `create_initial_home_from_invoice` på schema-rad 851 = migration-rad 45; samma offset gäller för hela `create_empty_home`). Exempel: migration-rad 110 (addresses INSERT) ↔ schema-rad 916.
>
> Schema-radnumren för **tabelldefinitioner** (kolumnen "Schema-rad" i sektion 3) är ej påverkade — de pekar fortfarande på V2:s tabelldefinitioner i Del 2 (rad 69–322), som inte flyttats.
>
> **Sandbox-not:** Cowork-sandboxens fil-cache visade fortfarande gamla schema.sql (807 rader) vid omskrivningen, så Del 9 har inte verifierats direkt på rad-nivå. Mattias har bekräftat att RPC-koden är identisk med migration-filen.

> Bonus-fynd från läsning av schema.sql: `documents.uploaded_by` (rad 210) har **redan korrigerats** — `not null` borttaget per Pass 2-rekommendationen. Bra.

---

## 1. Sammanfattning

| Checkpoint | Status |
|---|---|
| 1. Tabellnamn matchar V2-schemat | ✅ Uppfylld |
| 2. Kolumnnamn finns i schemat | ✅ Uppfylld |
| 3. FK-relationer respekteras | ✅ Uppfylld |
| 4. Användarvänliga `raise exception`-meddelanden | ⚠️ Mestadels uppfyllt — 1 internt felmeddelande |
| 5. SECURITY DEFINER används korrekt | ✅ Uppfylld |
| 6. GRANT execute är korrekt | ✅ Uppfylld |

**Resultat:** 5 av 6 fullt uppfyllda. 1 mindre nyans på felmeddelande-formuleringar. Inga blockerande fel. Två observationer om robusthet (sektion 8) är värda att överväga men inte kritiska.

---

## 2. Checkpoint 1 — Tabellnamn matchar V2-schemat

RPC:erna gör `INSERT` mot 8 tabeller. Alla finns i V2-schemat:

| Tabell i RPC | Definierad i schema.sql | Anmärkning |
|---|---|---|
| `public.addresses` | rad 69–80 | ✓ |
| `public.homes` | rad 89–97 | ✓ |
| `public.home_members` | rad 106–113 | ✓ |
| `public.home_properties` | rad 145–171 | ✓ |
| `public.home_profile` | rad 298–307 | ✓ |
| `public.documents` | rad 207–231 | ✓ |
| `public.home_property_documents` | rad 243–248 | ✓ |
| `public.analyses` | rad 256–266 | ✓ |

✅ **Uppfylld** — exakt matchning.

---

## 3. Checkpoint 2 — Kolumnnamn finns i schemat

Genomgång av varje INSERT i RPC:n mot schema-definitionen. Alla refererade kolumner finns.

### `addresses` (RPC rad 110–128)

| RPC-kolumn | Schema-rad | Datatyp i schema | RPC-input |
|---|---|---|---|
| `street` | 71 | `text not null` | `p_address->>'street'` |
| `postal_code` | 72 | `text not null` | `p_address->>'postal_code'` |
| `city` | 73 | `text not null` | `p_address->>'city'` |
| `kommun` | 74 | `text` | `p_address->>'kommun'` |
| `country` | 75 | `text not null default 'SE'` | `coalesce(..., 'SE')` |
| `latitude` | 76 | `numeric` | `nullif(..., '')::numeric` |
| `longitude` | 77 | `numeric` | `nullif(..., '')::numeric` |

Bra: `country` har default-coalesce så även om input saknar `country` används 'SE'. `latitude`/`longitude` använder `nullif(..., '')` för att hantera tomma strängar från jsonb (annars hade `''::numeric` blivit fel).

### `homes` (RPC rad 133–139)

| RPC-kolumn | Schema-rad | Anmärkning |
|---|---|---|
| `id` | 90 | Sätts explicit till `p_home_id` (server action genererar UUID:en) |
| `name` | 91 | `not null` — RPC validerar i steg 2 (rad 79–81) |
| `description` | 92 | Nullable, kan vara `null` om saknas |
| `created_by` | 93 | Sätts till `v_user_id` (= `auth.uid()`) |

`deleted_at`, `created_at`, `updated_at` lämnas till defaults — OK.

### `home_members` (RPC rad 144–145)

| RPC-kolumn | Schema-rad |
|---|---|
| `home_id` | 107 |
| `user_id` | 108 |
| `role` | 109 (`check (role in ('owner', 'member', 'read_only'))`) — RPC sätter `'owner'`, OK |

`joined_at`, `left_at` lämnas till defaults. PK = `(home_id, user_id)` — säkerställd unikhet.

### `home_properties` (RPC rad 150–169)

| RPC-kolumn | Schema-rad | Anmärkning |
|---|---|---|
| `id` | 146 | Sätts explicit |
| `home_id` | 147 | FK |
| `property_type` | 148 | RPC sätter alltid `'real'` (CHECK matchar) |
| `anlaggnings_id` | 151 | RPC validerar regex `^\d{18}$` (rad 94) |
| `address_id` | 152 | FK |
| `zone` | 153 | CHECK `('SE1', 'SE2', 'SE3', 'SE4')` — se observation 8.4 |
| `network_operator` | 154 | Fritext |
| `country` | 155 | Default 'SE' |

`hypothetical_name` sätts inte (eftersom `property_type='real'` — composite check på rad 165–170 i schema kräver `anlaggnings_id` istället, vilket är satt). ✓

### `home_profile` (RPC rad 174–189)

| RPC-kolumn | Schema-rad |
|---|---|
| `home_property_id` | 299 (PK + FK) |
| `living_area_m2` | 300 |
| `building_year` | 301 |
| `building_type` | 302 |
| `heating_type` | 303 |
| `num_residents` | 304 |

Alla nullable utom `home_property_id`. RPC sätter null-värden via `nullif(..., '')`-mönstret för numeriska fält. ✓

### `documents` (RPC rad 197–224)

| RPC-kolumn | Schema-rad |
|---|---|
| `id` | 208 |
| `document_type` | 209 (CHECK `('invoice', 'offer')`) — RPC default `'invoice'` |
| `uploaded_by` | 210 (`uuid references auth.users(id) on delete set null` — **inte längre `not null`**) |
| `pdf_storage_path` | 213 |
| `parsed_data` | 216 |
| `total_kr` | 219 |
| `consumption_kwh` | 220 |
| `spot_price_ore_kwh` | 221 |
| `electricity_supplier` | 222 |
| `invoice_period_start` | 223 |
| `invoice_period_end` | 224 |
| `parser_confidence` | 227 |

✓ Alla finns. Default-värden för `created_at`, `updated_at`, `deleted_at` lämnas.

### `home_property_documents` (RPC rad 227–228)

| RPC-kolumn | Schema-rad |
|---|---|
| `home_property_id` | 244 (FK) |
| `document_id` | 245 (FK) |

PK = `(home_property_id, document_id)` — RPC garanterar unikhet eftersom samma kombination inte sker två gånger inom funktionen. ✓

### `analyses` (RPC rad 236–251)

| RPC-kolumn | Schema-rad |
|---|---|
| `document_id` | 258 (FK) |
| `analysis_type` | 259 (CHECK `('invoice_analysis', 'offer_analysis')`) — RPC default `'invoice_analysis'` |
| `model_version` | 261 (`not null`) — RPC förlitar på input |
| `result` | 262 (`jsonb not null`) |
| `raw_response` | 263 |
| `is_reference` | 264 (default `false`) |

`id` sätts inte explicit (default `gen_random_uuid()`). ✓

✅ **Checkpoint 2 uppfylld** — alla kolumnnamn matchar schemat.

---

## 4. Checkpoint 3 — FK-relationer respekteras

Spårning av INSERT-ordningen i `create_initial_home_from_invoice`:

| Steg | Tabell | FK-värden | Status |
|---|---|---|---|
| 1 | `addresses` | inga FK | ✓ |
| 2 | `homes` | `created_by → auth.users(id)` (= `auth.uid()`, garanterat existerar) | ✓ |
| 3 | `home_members` | `home_id` (just skapat), `user_id` (= `auth.uid()`) | ✓ |
| 4 | `home_properties` | `home_id` (steg 2), `address_id` (steg 1) | ✓ |
| 5 | `home_profile` | `home_property_id` (steg 4) | ✓ |
| 6 | `documents` (loop) | `uploaded_by → auth.users(id)` | ✓ |
| 7 | `home_property_documents` (loop) | `home_property_id` (steg 4), `document_id` (steg 6 — samma iteration) | ✓ |
| 8 | `analyses` (loop) | `document_id` (skapade i steg 6) | ✓ |

✅ **Checkpoint 3 uppfylld.** Beroenden hanteras i rätt ordning.

`create_empty_home`: bara `homes` + `home_members`. Båda hanterar FK korrekt. ✓

---

## 5. Checkpoint 4 — Användarvänliga raise exception-meddelanden

### `create_initial_home_from_invoice`

| Rad | Felmeddelande | Bedömning |
|---|---|---|
| 73 | "Användare är inte inloggad" | ✓ Vänligt |
| 80 | "Hem-namn krävs" | ✓ Vänligt |
| 87 | "Adress måste innehålla street, postal_code och city" | ✓ Vänligt + specifikt |
| 91 | "Fastighet måste ha anlaggnings_id" | ✓ Vänligt |
| 95 | "anlaggnings_id måste vara exakt 18 siffror" | ✓ Vänligt + specifikt |
| 99 | "Minst ett dokument krävs" | ✓ Vänligt |
| 104 | "p_documents-arrayen måste ha samma längd som p_document_ids" | ⚠️ **Ej användarvänligt** |

### `create_empty_home`

| Rad | Felmeddelande | Bedömning |
|---|---|---|
| 301 | "Användare är inte inloggad" | ✓ Vänligt |
| 307 | "Hem-namn krävs" | ✓ Vänligt |
| 311 | "Hem-namn får vara max 200 tecken" | ✓ Vänligt + specifikt |

### Avvikelse på rad 104

Felmeddelandet refererar till interna parameternamn (`p_documents`, `p_document_ids`). Detta felscenario ska aldrig nå slutanvändaren — det är en sanity-check mot programmeringsfel i server action. Två val:

**Alternativ A (minimal):** Behåll som det är. Server action ansvarar för att inte trigga felet.

**Alternativ B (bättre defense-in-depth):** Skriv om till mer neutralt språk:

```sql
raise exception 'Internt fel: dokumentlistorna har inte samma längd';
```

eller logga som warning istället för exception (men då måste validering göras på annat sätt).

⚠️ **Mindre avvikelse** — rekommenderad korrigering: Alternativ B. Inte blockerande.

---

## 6. Checkpoint 5 — SECURITY DEFINER används korrekt

| Funktion | Definer | Motivation |
|---|---|---|
| `create_initial_home_from_invoice` | rad 58 | Behövs för att kringgå RLS på `home_members` (insert-policy `writers can invite new members` har `with check (... and role in ('member', 'read_only'))` — `'owner'` blockeras explicit för authenticated). |
| `create_empty_home` | rad 291 | Samma motivation — INSERT på `home_members` med `role='owner'`. |

Både funktioner validerar input innan de skriver. Båda anropar `auth.uid()` för att säkerställa att de skriver för rätt användare (inte ett annat ID). ✓

**Säkerhetsanalys:** SECURITY DEFINER är farligt om input inte valideras. Båda funktionerna:

1. Verifierar att `auth.uid()` finns (rad 71 + 299).
2. Använder `v_user_id := auth.uid()` som `created_by`/`user_id` — kan inte skrivas över via parametrar.
3. Validerar inkommande strängar och regex.
4. Plockar specifika fält ur jsonb (extra fält ignoreras).

✅ **Checkpoint 5 uppfylld.** SECURITY DEFINER-användning är korrekt och säker.

---

## 7. Checkpoint 6 — GRANT execute är korrekt

### `create_initial_home_from_invoice` (RPC rad 268–270)

```sql
grant execute on function public.create_initial_home_from_invoice(
  uuid, uuid, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
```

Funktionssignatur (rad 45–55) har 9 parametrar:
- `p_home_id uuid`
- `p_home_property_id uuid`
- `p_document_ids uuid[]`
- `p_home jsonb`
- `p_address jsonb`
- `p_property jsonb`
- `p_documents jsonb`
- `p_analyses jsonb`
- `p_home_profile jsonb`

→ `(uuid, uuid, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)` — exakt matchning. ✓

### `create_empty_home` (RPC rad 327)

```sql
grant execute on function public.create_empty_home(text) to authenticated;
```

Funktionssignatur (rad 286–288): `p_name text`. → `(text)` matchar. ✓

✅ **Checkpoint 6 uppfylld.**

---

## 8. Nya buggrisker och observationer

Inget blockerande, men följande är värt att överväga.

### 8.1 Adress-deduplicering saknas (rad 109)

Kommentaren säger explicit "Skapa addressrad (alltid ny — ingen deduplicering)". Konsekvens: två användare som sparar fakturor från samma fysiska adress får två separata `addresses`-rader.

**Pragmatiskt:** Adresser är billiga, ingen FK-konflikt, ingen RLS-risk (varje home_property pekar på sin egen address-rad). Långsiktig issue om repository-vyer för "hus i samma område" byggs och vill aggregera per fysisk adress.

**Förslag:** Lämna som är. Lägg till TODO-kommentar i RPC:n om att framtida `find_or_create_address`-pattern är möjligt om aggregat-jämförelser kräver det.

### 8.2 Felaktigt `document_id` i `p_analyses` ger Postgres-formaterat FK-fel

Server action skickar in `p_analyses` med `document_id`-värden som ska finnas i `p_document_ids`. Men RPC:n verifierar inte detta innan den försöker INSERT:a — om server action har en bugg och skickar fel `document_id` får användaren ett `foreign key violation`-fel istället för ett tydligt valideringsmeddelande.

**Förslag (defensiv):** Lägg till validering före loopen i steg 9:

```sql
-- Verifiera att alla document_id i p_analyses finns i p_document_ids
for v_analysis in select * from jsonb_array_elements(p_analyses)
loop
  if not (v_analysis->>'document_id')::uuid = any(p_document_ids) then
    raise exception 'Analys hänvisar till ett dokument som inte finns i denna sparning';
  end if;
end loop;
```

Inte blockerande — server action ska verifiera detta i sin egen validering. Men defensiv kod skadar inte.

### 8.3 `is_reference`-ordning beror på jsonb-array-iteration

Rad 250: `v_first_analysis` används för att markera första analysen som `is_reference=true`. Detta beror på iterationsordningen från `jsonb_array_elements(p_analyses)`.

**Fakta:** Postgres bevarar inkommande ordning för jsonb-arrayer (modellerade som ordnade listor, till skillnad från jsonb-objekt där nyckelordning är icke-garanterad). Server action har därför kontroll genom att lista analyserna i önskad ordning.

✓ Inte en bugg, men en subtil beroende — om någon i framtiden byter `jsonb_array_elements` till `jsonb_object_keys` eller liknande blir resultatet odefinierat. Värt en kommentar i koden:

```sql
-- Postgres bevarar inkommande ordning för jsonb-arrays. Första 
-- elementet i p_analyses blir is_reference=true.
```

### 8.4 `zone`-validering saknas i RPC

`home_properties.zone` har CHECK `('SE1', 'SE2', 'SE3', 'SE4')` (schema rad 153). RPC validerar inte input — om server action skickar `'SE5'` eller `'sv1'` får användaren ett Postgres-formaterat constraint-fel.

**Förslag:** Lägg till validering i steg 2:

```sql
if p_property->>'zone' is not null 
   and p_property->>'zone' not in ('SE1', 'SE2', 'SE3', 'SE4') then
  raise exception 'Zon måste vara SE1, SE2, SE3 eller SE4';
end if;
```

Inte blockerande — server action validerar i UI-steget.

### 8.5 Storage-PDF kan bli föräldralös vid RPC-fel

Header rad 39–41 dokumenterar mönstret: PDF uppladdas till Storage **före** RPC-anrop. Vid RPC-fel rullas DB-transaktionen tillbaka, men PDF:en finns kvar på Storage. Server action ansvarar för cleanup.

✓ Detta är dokumenterat. Inte en bugg i RPC:n, men server action behöver en `try/catch`-pattern som raderar PDF vid fel. Kommentar i RPC:n är klar och tydlig.

### 8.6 Möjlig krock på `p_home_id` om server action har bugg

Om server action återanvänder en UUID från en tidigare lyckad sparning och kör om RPC:n får man `duplicate key value violates unique constraint "homes_pkey"`. Detta är ett edge-case (server action ska generera ny UUID per anrop) men ger ett otydligt fel.

**Inte rekommenderat att fixa i RPC:n** — det är server actions ansvar. Bara värt att flagga.

### 8.7 Inga längdvalideringar för fritextfält

`create_initial_home_from_invoice` saknar längdvalidering på `p_home->>'name'`, `p_home->>'description'`, `p_address->>'street'` etc. `create_empty_home` har 200-teckens-validering på `p_name`, så samma logik kunde appliceras.

**Förslag:** Lägg till motsvarande validering i `create_initial_home_from_invoice`:

```sql
if length(p_home->>'name') > 200 then
  raise exception 'Hem-namn får vara max 200 tecken';
end if;
```

Inte blockerande — TEXT-kolumner i Postgres har ingen max-längd. Men UI-konsistens är värdefull.

---

## 9. Slutsats

Båda RPC-funktionerna är **redo för användning**. Schema-matchningen är exakt, FK-ordningen korrekt, SECURITY DEFINER-användningen säker, GRANT-signaturen korrekt.

**Rekommenderade förbättringar (alla mindre, ingen blockerar):**

1. ⚠️ Skriv om felmeddelandet på RPC rad 104 ("p_documents-arrayen...") till mer neutralt språk (se sektion 5 — Alternativ B).
2. 🔧 Lägg till `zone`-validering i `create_initial_home_from_invoice` (se 8.4).
3. 🔧 Lägg till längdvalidering på `p_home->>'name'` så det matchar `create_empty_home` (se 8.7).
4. 💬 Lägg till kommentar om jsonb-array-ordning vid `is_reference`-logiken (se 8.3).
5. 🛡️ Överväg defensiv validering att alla `document_id` i `p_analyses` finns i `p_document_ids` (se 8.2).

Inga av dessa är blockerande för PR #9C eller spara-flödet. RPC:erna kan köras i Supabase SQL Editor som de är.

**Bonus-fynd:** `documents.uploaded_by` är redan korrigerad (Pass 2-buggfynd åtgärdat) — `not null` borttaget på schema rad 210. Bra jobbat.

---

## 10. Pass 2 — verifiering av `add_invoice_to_existing_homes` (Del 9.3)

**Datum:** 2026-05-06
**Funktion:** `public.add_invoice_to_existing_homes` (schema rad 991–1172)
**Parametrar:** `uuid[], text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb` (8 st)

### 10.1 Checkpoints — sammanfattning

| # | Checkpoint | Status | Anmärkning |
|---|---|---|---|
| 1 | Tabellnamn matchar V2-schemat (Del 2) | ✅ Uppfylld | Alla 6 tabeller finns: `addresses`, `home_properties`, `home_profile`, `documents`, `analyses`, `home_property_documents` |
| 2 | Kolumnnamn som funktionen refererar finns i schemat | ✅ Uppfylld | Se 10.2 för kolumn-för-kolumn-granskning |
| 3 | FK-relationer respekteras (FK-värden existerar innan referens) | ✅ Uppfylld | Se 10.3 för skriv-ordning |
| 4 | `raise exception`-meddelanden är användarvänliga och konsekventa | ✅ med en anmärkning | 7 av 8 meddelanden är tydliga. Ett exponerar parameternamn (se 10.4) |
| 5 | SECURITY DEFINER används korrekt | ✅ Uppfylld | Explicit permissionsvalidering körs före alla skrivningar |
| 6 | GRANT execute är korrekt | ✅ Uppfylld | Signatur matchar funktionens parameterlista exakt |
| 7 | Defense-in-depth `user_can_write_home`-loop är semantiskt korrekt | ✅ Uppfylld | Validerar alla hem i ett pass innan första INSERT |
| 8 | Documents/analyses skapas EN GÅNG utanför hem-loopen | ✅ Uppfylld | Korrekt M:N-semantik: documents och analyses skapas före hem-loopen |
| 9 | `on conflict`-hantering på `home_property_documents` är korrekt | ✅ Uppfylld | Conflict-target matchar PK, `do nothing` ger idempotent beteende |
| 10 | Storage-policys i Del 10 fungerar med ny path-konvention | ✅ Uppfylld | Policy matchar via `d.pdf_storage_path = storage.objects.name` — path-format-agnostisk |

**Resultat: alla 10 checkpoints uppfyllda.**

### 10.2 Kolumn-för-kolumn-granskning

| Tabell | Kolumner i funktionen | Status |
|---|---|---|
| `addresses` | street, postal_code, city, kommun, country, latitude, longitude | ✅ Alla i Del 2.1 |
| `home_properties` | home_id, property_type, anlaggnings_id, address_id, zone, network_operator, country, deleted_at | ✅ Alla i Del 2.5 |
| `home_profile` | home_property_id, living_area_m2, building_year, building_type, heating_type, num_residents | ✅ Alla i Del 2.11 |
| `documents` | id, document_type, uploaded_by, pdf_storage_path, parsed_data, total_kr, consumption_kwh, spot_price_ore_kwh, electricity_supplier, invoice_period_start, invoice_period_end, parser_confidence | ✅ Alla i Del 2.7 |
| `analyses` | document_id, analysis_type, model_version, result, raw_response, is_reference | ✅ Alla i Del 2.9 |
| `home_property_documents` | home_property_id, document_id | ✅ Alla i Del 2.8 |

### 10.3 FK-skriv-ordning

Funktionen skriver i denna ordning. Varje steg respekterar FK-beroenden:

1. Validering — `user_can_write_home` för alla hem (inga skrivningar än)
2. **documents** INSERT — `uploaded_by` → `auth.users(id)` (v_user_id satt av `auth.uid()` överst) ✅
3. **analyses** INSERT — `document_id` → `documents.id` (documents skapade i steg 2) ✅
4. *Per hem:* **addresses** INSERT → `id` sparas i `v_address_id`
5. *Per hem:* **home_properties** INSERT — `home_id` → `homes.id` (p_target_homes-hem måste finnas; `user_can_write_home`-valideringen i steg 1 garanterar detta) ✅, `address_id` → `addresses.id` (v_address_id från steg 4) ✅
6. *Per hem:* **home_profile** INSERT — `home_property_id` → `home_properties.id` (v_home_property_id från steg 5) ✅
7. *Per hem:* **home_property_documents** INSERT — båda FK:erna uppfyllda (documents från steg 2, home_properties från steg 5) ✅

### 10.4 Felmeddelanden

| Meddelande | Omdöme |
|---|---|
| `'Användare är inte inloggad'` | ✅ Tydligt |
| `'Minst ett hem måste väljas'` | ✅ Tydligt |
| `'anlaggnings_id krävs'` | ✅ Tydligt |
| `'anlaggnings_id måste vara exakt 18 siffror'` | ✅ Tydligt |
| `'Adress måste innehålla street, postal_code och city'` | ✅ Tydligt |
| `'Minst ett dokument krävs'` | ✅ Tydligt |
| `'p_documents-arrayen måste ha samma längd som p_document_ids'` | ⚠️ Exponerar interna parameternamn — samma klass av problem som flaggades i sektion 5 för `create_initial_home_from_invoice`. Förslag: `'Antal dokument stämmer inte med antal dokument-ID:n'` |
| `'Du har inte skrivrättigheter till alla valda hem (home_id: %)'` | ✅ Acceptabelt för v1 (UUID i felet hjälper debuggning) |

### 10.5 SECURITY DEFINER och `user_can_write_home`

`user_can_write_home` (schema rad ~430) är `security definer stable` och frågar `home_members` direkt med `auth.uid()`. Den är inte påverkad av funktionens SECURITY DEFINER-kontext — den returnerar alltid rätt svar för den inloggade användaren.

Valideringsloopen kör **före alla INSERTs**, vilket innebär:
- Antingen har användaren rätt till alla hem → alla skrivningar sker
- Eller misslyckas ett hem → `raise exception` → hela transaktionen rullas tillbaka, inga partiella skrivningar ✅

`stable`-märkningen är korrekt eftersom `home_members` inte modifieras av denna funktion (förutsätter att home_members-raden redan finns, vilket kräver att hemmet är skapat sedan tidigare). ✅

### 10.6 Storage-policys med ny path-konvention

Ny convention: `documents/{document_id}.pdf` (inom bucketen `documents`) → `storage.objects.name = '{document_id}.pdf'`

Policyn matchar via:
```sql
where d.pdf_storage_path = storage.objects.name
```

`pdf_storage_path` i `documents`-tabellen lagrar exakt det server action sätter. Policyn är path-format-agnostisk — den gör ingen hårdkodad strängmanipulation. Så länge server action är konsekvent (`pdf_storage_path` = `storage.objects.name`) fungerar policyn oavsett konvention. ✅

### 10.7 Nya observationer (utöver checkpoints)

**1. `is_reference`-flaggan beter sig annorlunda än i `create_initial_home_from_invoice`**

I `add_invoice_to_existing_homes` spåras `v_first_analysis` globalt över hela `p_analyses`-arrayen — bara allra första analysen (oavsett vilket dokument den tillhör) får `is_reference=true`. I `create_initial_home_from_invoice` är samma logik.

Konsekvens: om server action skickar flera dokument+analyser i ett anrop, får bara ett dokument sin analys markerad som referens. Inte fel för v1 (server action skickar troligen ett dokument i taget), men värt att dokumentera. Se sektion 8.3 för djupare analys.

**2. `idx_one_anlaggnings_id_per_home` hindrar inte funktionen**

Partial unique index (`home_id, anlaggnings_id where anlaggnings_id is not null and deleted_at is null`) är korrekt designad. Funktionen kollar `deleted_at is null` i sin `select`-fråga — hittar befintlig home_property → INSERT:ar inte → ingen index-krock. ✅

**3. Inga längdvalideringar (konsekvent med `create_initial_home_from_invoice`)**

Samma brist som flaggades i sektion 8.7. Inte blockerande.

### 10.8 Slutsats

`add_invoice_to_existing_homes` är **redo för körning**. Schema-matchning korrekt, FK-ordning korrekt, M:N-semantiken implementerad rätt, permissions-validering sker atomiskt innan skrivningar, `on conflict`-hantering idempotent.

**Enda rekommenderade åtgärd:** Skriv om felmeddelandet `'p_documents-arrayen...'` (se 10.4) — samma klass som sektion 5-rekommendation för `create_initial_home_from_invoice`.
