# Simulator Data — Källor och dokumentation

Alla datakonstanter som driver HOMEii:s simuleringsmotor finns i denna katalog. Varje fil har JSDoc-kommentarer med `@source`, `@updated` och `@notes` för spårbarhet.

## Filöversikt

| Fil | Innehåll | Primär källa |
|-----|----------|-------------|
| `energy-profiles.ts` | Säsongsfaktorer, timprofiler, bostadsamplitud, uppvärmningsandelar, referensytor, varmvattenandel, elbilsladdprofil, storkonsumenter, månadsetiketter | SCB Energistatistik, Energimyndigheten |
| `energy-prices.ts` | Zonpriser per SE-zon (konsumentpris ink. skatt), timprisvariation, nätavgift, effektavgift | Nord Pool 2023–2024, Ei nätavgiftsrapport |
| `cop-curves.ts` | COP-kurvor per värmepumptyp, medeltemperaturer Stockholm, timtemperaturvariation | Nibe/Thermia datablad, SMHI öppen data |
| `solar-profiles.ts` | Månatlig solproduktion (10 kW), timprofil sommar/vinter, säsongsblend | PVGIS (EU JRC), Mälardalens Energikontor |
| `upgrade-catalog.ts` | Uppgraderingsdefinitioner, reduktionsfaktorer, batteriparametrar, rekommendationskonfiguration | Branschgenomsnitt 2024, Energimyndigheten |
| `co2-factors.ts` | CO2-utsläppsfaktorer per energikälla (g CO2e/kWh) | Naturvårdsverket, IVL |
| `inference-rules.ts` | Nätägare → SE-zon mappning | Ei elområdesregister |
| `strings.ts` | UI-texter, frågeformuleringar, datakällereferenser | Intern |
| `defaults.ts` | Standardvärden för antaganden och simuleringsstate | Intern |

## Principer

1. **Alla siffror ska ha källa.** Varje konstant ska dokumenteras med `@source`.
2. **Uppdateringsdatum.** `@updated` anger senaste verifiering mot källan.
3. **Transparens.** Alla antaganden ska vara synliga och justerbara av användaren (via AssumptionsPanel).
4. **Konservatism.** Vid osäkerhet — välj det konservativa antagandet som underskattar besparingar.

## Uppdateringsrutin

- Energipriser: Uppdateras kvartalsvis mot Nord Pool/Ei
- COP-kurvor: Uppdateras vid nya produktversioner från tillverkare
- Solprofiler: Stabila (baserade på PVGIS långtidsmedelvärden)
- CO2-faktorer: Uppdateras årligen mot Naturvårdsverkets rapporter
