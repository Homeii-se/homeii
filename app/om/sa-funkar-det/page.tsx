import type { Metadata } from "next";
import OmPageLayout from "../OmPageLayout";

export const metadata: Metadata = {
  title: "Så funkar det — HOMEii",
  description: "Tre steg från elräkning till åtgärder.",
};

const STEPS = [
  {
    n: "01",
    title: "Du laddar upp din elräkning",
    body: "PDF eller bild — vi tolkar automatiskt fält som förbrukning, kostnad, elhandlare, nätbolag och avtalstyp. Tolkningen tar några sekunder och du behöver inte fylla i något manuellt.",
  },
  {
    n: "02",
    title: "Vi bekräftar och kompletterar",
    body: "Du ser direkt vad vi hittat på fakturan och fyller i några få uppgifter om ditt hem — boendetyp, uppvärmning, antal boende. Det räcker för att vi ska kunna skräddarsy analysen.",
  },
  {
    n: "03",
    title: "Du får en konkret analys + åtgärder",
    body: "Vi visar din elkostnad uppdelad i komponenter, jämför med historiska prisnivåer (2020-2026) och rangordnar de åtgärder som ger bäst återbetalning för just dig. Med eller utan investeringar — du väljer.",
  },
];

export default function SaFunkarDetPage() {
  return (
    <OmPageLayout
      eyebrow="Så funkar det"
      title={<>Tre steg från faktura <em className="text-brand-500">till åtgärder</em>.</>}
      subtitle="Hela analysen tar 2-3 minuter. Inga konton krävs för att se grundresultatet."
    >
      <ol className="grid gap-5">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-light text-brand-100 font-[family-name:var(--font-fraunces)]">
                {step.n}
              </span>
              <h2 className="text-lg font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
                {step.title}
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-2xl bg-card-green border border-brand-500/20 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
          Hur vi räknar
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Spotpriser hämtar vi i realtid från Nord Pool via elprisetjustnu.se (live data fr.o.m. 2022)
          eller ENTSO-E Transparency Platform (historiska data 2020-2025). Solcellsproduktion
          beräknas timme för timme via PVGIS Typical Meteorological Year-data. Energiskatt och
          nätavgifter använder årsspecifika nivåer för historiska år.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Vi är öppna med våra antaganden — varje siffra du ser i analysen kan klickas på för att
          se exakt hur den räknats fram.
        </p>
      </div>
    </OmPageLayout>
  );
}
