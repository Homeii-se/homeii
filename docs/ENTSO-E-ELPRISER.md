# Elpriser för flera europeiska länder via ENTSO-E

Denna guide beskriver steg för steg hur du får elpriser (day-ahead, Nord Pool/Europeiska marknaden) för flera länder genom **ENTSO-E Transparency Platform API**.

---

## Steg 1: Registrera konto

1. Gå till **https://transparency.entsoe.eu/**
2. Klicka på **Sign in** / **Register** (länken går till Keycloak).
3. Skapa ett konto med e-post och lösenord.

---

## Steg 2: Begär API-åtkomst (security token)

API:et kräver en **security token**. Så här får du den:

1. Skicka ett e-postmeddelande till **transparency@entsoe.eu**
2. Ämne: **Restful API access**
3. I meddelandet: skriv den **e-postadress** du registrerade med på plattformen.
4. Vänta på svar (ofta inom några arbetsdagar). De aktiverar API-åtkomst för ditt konto.
5. Logga in på **https://transparency.entsoe.eu/** → gå till **Account/Settings** (eller motsvarande) → där hittar du din **API token** (en lång sträng).

**Mer hjälp:** [ENTSO-E Knowledge Base – How to get security token](https://transparencyplatform.zendesk.com/hc/en-us/articles/12845911031188-How-to-get-security-token)

---

## Steg 3: Spara token säkert (miljövariabel)

Använd **aldrig** token i koden som du committar. Spara den i en **miljövariabel**:

1. I projektets rot, skapa (eller redigera) filen **`.env.local`**.
2. Lägg till raden (ersätt med din egen token):

```env
ENTSO_E_API_TOKEN=din-token-här
```

3. Lägg **`.env.local`** i **`.gitignore`** om den inte redan finns där (Next.js ignorerar ofta `.env.local` som standard).

Nu kan din Next.js-app läsa token med `process.env.ENTSO_E_API_TOKEN` på servern.

---

## Steg 4: Hur API-anropet ser ut

**Bas-URL:** `https://web-api.tp.entsoe.eu/api`

**Day-ahead-priser** hämtas med följande parametrar (GET):

| Parameter       | Beskrivning |
|----------------|-------------|
| `securityToken` | Din API-token |
| `documentType`  | `A44` (day-ahead prices) |
| `in_Domain`    | EIC-kod för elområdet (se tabell nedan) |
| `out_Domain`   | Samma som `in_Domain` för priser |
| `periodStart`  | Starttid UTC, format `yyyyMMddHHmm` (t.ex. `202502090000`) |
| `periodEnd`    | Sluttid UTC, format `yyyyMMddHHmm` (t.ex. `202502100000`) |

**Exempel-URL** (en dag, Sverige SE3):

```
https://web-api.tp.entsoe.eu/api?securityToken=DIN_TOKEN&documentType=A44&in_Domain=10Y1001A1001A46L&out_Domain=10Y1001A1001A46L&periodStart=202502090000&periodEnd=202502100000
```

API:et returnerar **XML**. Priserna finns i element som `<price.amount>` (ofta i EUR/MWh) med tidsintervall per timme (eller 15 min beroende på zon).

---

## Steg 5: EIC-koder (bidding zones) för länder/regioner

Varje elzon har en **EIC-kod**. Här är några vanliga (fler finns på [ENTSO-E EIC codes](https://www.entsoe.eu/data/energy-identification-codes-eic/eic-approved-codes/)):

| Land/region | EIC-kod | Kommentar |
|-------------|---------|-----------|
| **Sverige SE1** | `10Y1001A1001A44P` | Luleå |
| **Sverige SE2** | `10Y1001A1001A45N` | Sundsvall |
| **Sverige SE3** | `10Y1001A1001A46L` | Stockholm |
| **Sverige SE4** | `10Y1001A1001A47J` | Malmö |
| **Norge NO1** | `10YNO-0--------C` | Oslo |
| **Norge NO2** | `10YNO-1--------2` | Kristiansand |
| **Norge NO3** | `10YNO-2--------T` | Trondheim |
| **Norge NO4** | `10YNO-3--------J` | Tromsø |
| **Danmark DK1** | `10Y1001A1001A65H` | Väst |
| **Danmark DK2** | `10Y1001A1001A66F` | Öst |
| **Finland** | `10YFI-1--------U` | Hela Finland |
| **Tyskland** | `10Y1001A1001A83F` | Deutschland (tidigare DE-LU) |
| **Frankrike** | `10YFR-RTE------C` | Frankrike |
| **Nederländerna** | `10YNL----------L` | Nederländerna |
| **Polen** | `10YPL-AREA-----S` | Polen |
| **Spanien** | `10YES-REE------0` | Spanien |
| **Italien Nord** | `10YIT-GRTN-----B` | Nord |
| **Storbritannien** | `10YGB----------A` | GB |

För fler zoner: [ENTSO-E Area codes](https://www.entsoe.eu/data/energy-identification-codes-eic/eic-area-codes-map).

---

## Steg 6: Använda i din hemsida (Next.js)

För att **inte** exponera din token i webbläsaren:

1. **Anrop från servern:** Använd en **API Route** i Next.js (t.ex. `app/api/elpriser/route.ts`) som läser `process.env.ENTSO_E_API_TOKEN`, anropar ENTSO-E och returnerar JSON till frontend.
2. **Frontend:** Din sida (t.ex. `/elpriser`) anropar **din egen** route: `fetch('/api/elpriser?zone=10Y1001A1001A46L&date=2025-02-09')` och visar priserna i tabell/graf.

I detta projekt finns:

- **`app/api/elpriser/route.ts`** – hämtar priser från ENTSO-E för vald zon och datum, parsar XML till JSON. Anrop: `GET /api/elpriser?zone=EIC_KOD&date=YYYY-MM-DD`.
- **`app/elpriser/page.tsx`** – sidan **Elpriser** (länk i headern): välj datum och flera länder/zoner, klicka "Hämta priser" – tabeller med timpriser (EUR/MWh) visas.
- **`app/elpriser/lib/zones.ts`** – lista över EIC-koder för Sverige, Norge, Danmark, Finland, Tyskland, Frankrike, Nederländerna, Polen, Spanien, Storbritannien.

---

## Viktigt att veta

- **Priser i EUR/MWh:** API:et returnerar oftast pris i **EUR per MWh**. För öre/kWh: dela med 10 och multiplicera med växelkurs om du vill visa SEK.
- **Morgondagens priser:** Day-ahead publiceras typiskt **dagen innan** (ca 12–13). Anropa alltså med `periodStart`/`periodEnd` för morgondagen när de finns ute.
- **Tidszon:** `periodStart` och `periodEnd` ska vara i **UTC**.
- **Begränsningar:** Läs ENTSO-Es användarvillkor; överdriven frekvens av anrop kan begränsas.

---

## Kort checklista

- [ ] Konto på transparency.entsoe.eu
- [ ] E-post till transparency@entsoe.eu för "Restful API access"
- [ ] Token från Account/Settings
- [ ] Token i `.env.local` som `ENTSO_E_API_TOKEN`
- [ ] API Route som anropar ENTSO-E med token och önskad zon/datum
- [ ] Sida som anropar din route och visar priser för flera länder (flera zoner)
