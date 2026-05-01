# Referenspriser — Qvantum värmepumpar

Källa: [qvantum.com](https://qvantum.com) — riktpriser hämtade från tillverkarens
egna kampanjsidor.

Insamlat: 2026-04-30

> **Användning:** Dessa priser är riktpriser inkl. moms och ROT-avdrag, hämtade
> direkt från Qvantums marknadsföring. De ska ses som indikativa toppnivåer för
> jämförelse i `app/simulator/data/upgrade-variants.ts`. Slutpris hos
> installatör kan variera.

---

## QG-serien — bergvärmepump

Standardinstallation med QG, utbyte av äldre bergvärmepump. Slutgiltigt pris
avgörs i samråd med installatör.

| Modell | Riktpris efter 30% ROT (inkl. moms) |
| ------ | ----------------------------------- |
| QG7    | ca 109 000 kr                       |
| QG14   | ca 119 000 kr                       |

**Egenskaper som lyfts fram:**

- Integrerat expansionskärl och säkerhetsutrustning
- Ingen säkerhetskanal eller extra håltagning behövs
- Färre komponenter och moment ger snabbare installation och lägre kostnad
- Smart från start

*Lanseringserbjudandet gällde under en begränsad period vid köp och
installation före 10 augusti.*

---

## QA-serien — luft/vattenvärmepump

Riktpris installerat och klart, inkl. moms.

| Period                                    | Riktpris        |
| ----------------------------------------- | --------------- |
| Resten av 2025 (inkl. 50% ROT, kampanj)   | 119 750 kr      |
| Från och med 2026-01-01 (ordinarie pris)  | ca 133 300 kr   |

**Två fördelar som drev kampanjen:**

1. **Tillfälligt höjt ROT-avdrag:** 50 % på arbetskostnaden under 2025, innan
   ROT-avdraget sänktes till 30 % efter årsskiftet.
2. **Kampanjpris året ut:** Prissänkningen på QA9 och QA15 gällde endast till
   31 december 2025.

Total besparing om man köpte före årsskiftet: upp till 13 500 kr.

---

## Att tänka på vid jämförelse

- Qvantums riktpriser inkluderar standardinstallation. Avvikelser (extra
  borrning, längre dragningar, befintlig installation som behöver bytas) kan
  påverka slutpris.
- ROT-procenten har ändrats över tid. Sedan 2026-01-01 är den 30 % igen.
  Använd alltid aktuell ROT-procent i kalkyler.
- Riktpriser visas inkl. moms — kontrollera att övriga datapunkter i
  `upgrade-variants.ts` använder samma konvention.
