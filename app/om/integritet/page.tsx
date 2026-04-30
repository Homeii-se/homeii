import type { Metadata } from "next";
import OmPageLayout from "../OmPageLayout";

export const metadata: Metadata = {
  title: "Integritet & GDPR — HOMEii",
  description: "Hur vi hanterar din fakturadata och vilka rättigheter du har.",
};

export default function OmIntegritetPage() {
  return (
    <OmPageLayout
      eyebrow="Integritet & GDPR"
      title={<>Din data är <em className="text-brand-500">din data</em>.</>}
      subtitle="Vi samlar in det minimum som krävs för att ge dig en bra analys, sparar bara det du själv ber oss spara, och raderar resten."
    >
      <div className="space-y-8 text-base leading-relaxed text-text-secondary">
        <section>
          <h2 className="text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
            Vad vi samlar in
          </h2>
          <ul className="mt-3 space-y-2 pl-5 list-disc marker:text-brand-500">
            <li>
              <strong className="text-brand-700">Din elräkning</strong> — bilden eller PDF:en du
              laddar upp. Den skickas till vår tolkningstjänst och raderas direkt efter analysen
              är klar (om du inte sparar den i ett konto).
            </li>
            <li>
              <strong className="text-brand-700">Strukturerad fakturadata</strong> som vi tolkar
              fram (förbrukning, kostnad, zon, elhandlare). Lagras i din lokala browser
              (localStorage) tills du tömmer den.
            </li>
            <li>
              <strong className="text-brand-700">Hus-info</strong> du själv fyller i (boendetyp,
              uppvärmning, antal boende). Lagras lokalt.
            </li>
            <li>
              <strong className="text-brand-700">Anonym användningsstatistik</strong> (sidvisningar,
              feature-användning) via en integritetsvänlig analyslösning. Ingen personlig
              identifierare.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
            Vad vi inte samlar in
          </h2>
          <ul className="mt-3 space-y-2 pl-5 list-disc marker:text-brand-500">
            <li>Personnummer, kortnummer eller bankuppgifter</li>
            <li>Information från andra sajter eller sociala medier</li>
            <li>Plats utöver postnummer (för korrekt SE-zon och solinstrålning)</li>
            <li>Innehåll i mejl eller annan kommunikation utanför HOMEii</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
            Var datan lagras
          </h2>
          <p className="mt-3">
            Konton och historik (om du skapar ett) ligger hos Supabase i datacenter inom EU
            (eu-west-1). Fakturatolkningen sker via Anthropic Claude API. Alla datacenter följer
            GDPR och europeiska dataskyddsregler.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
            Dina rättigheter enligt GDPR
          </h2>
          <ul className="mt-3 space-y-2 pl-5 list-disc marker:text-brand-500">
            <li><strong className="text-brand-700">Rätt till tillgång</strong> — du kan begära ut all data vi har om dig</li>
            <li><strong className="text-brand-700">Rätt till radering</strong> — vi tar bort allt vid begäran (utom det vi måste spara enligt lag)</li>
            <li><strong className="text-brand-700">Rätt till rättelse</strong> — felaktig data ska kunna korrigeras</li>
            <li><strong className="text-brand-700">Rätt att invända</strong> — du kan när som helst stoppa behandling av din data</li>
          </ul>
          <p className="mt-3">
            Maila <a href="mailto:integritet@homeii.se" className="text-brand-500 underline hover:text-brand-700">integritet@homeii.se</a> så
            handlägger vi din begäran inom 30 dagar.
          </p>
        </section>

        <p className="text-xs text-text-muted">
          Senast uppdaterad: 2026-04-29.
        </p>
      </div>
    </OmPageLayout>
  );
}
