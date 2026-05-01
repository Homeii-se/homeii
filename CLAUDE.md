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

## Affärsmodell &amp; spridning

**Spridning (hur Homeii når slutkund):**

Primärkanal är **partners** — banker, försäkringsbolag, intresseorganisationer (typ
Villaägarna), arbetsgivarförbund, energirörelser. De erbjuder Homeii som värdeadd till
sina medlemmar/kunder. Installatörer är medvetet INTE primär spridningskanal — vi vill
förbli oberoende från enskilda leverantörer.

**Intäktsmodell:**

Homeii är en **förmedlare**, inte en rådgivare som rekommenderar enskilda installatörer.
Konkret betyder det:

- ✅ Förmedla anonyma offertförfrågningar till flera installatörer/tillverkare samtidigt
  (kunden jämför själv och väljer)
- ✅ Affiliate-ersättning från elhandlare (Tibber, Greenely m.fl.) när kunden själv väljer
  att byta — alltid med alla rimliga alternativ synliga, sorterade efter kundens nytta
- ✅ Lead-ersättning från installatörer/tillverkare för förfrågningar (inte specifika
  rekommendationer)
- ❌ INTE: rekommendera enskild installatör/tillverkare som "den bästa för dig"
- ❌ INTE: rangordna leverantörer efter provisionsstorlek

Den oberoende positionen är produktens viktigaste tillgång. Allt vi bygger ska skydda
den även när det kortsiktigt minskar konvertering.

**Konsekvenser för UI &amp; copy:**

- Vid upgrade-rekommendationer ("solceller skulle spara X kr/år") → erbjud "vill du
  ha 3 offerter från lokala installatörer?" inte "vi rekommenderar firma Y"
- Vid byt-elhandlare-flöden → visa alla rimliga alternativ med tydliga faktiska
  besparingar, även när några ger oss provision och andra inte
- `/partners`-sidan riktar sig BREDARE än bara installatörer — banker, försäkring,
  intresseorganisationer, energihandlare, nätbolag, tillverkare

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
