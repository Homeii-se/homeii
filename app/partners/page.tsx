import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners — HOMEii",
  description:
    "Vi söker partners som vill påskynda elektrifieringen av Sverige — banker, försäkringsbolag, intresseorganisationer, tillverkare och installatörer.",
};

const TARGET_GROUPS = [
  {
    title: "Banker & finans",
    desc: "Hjälp era kunder se ROI på energiinvesteringar — bättre lönelöfte för bolån, gröna lån och energilån.",
  },
  {
    title: "Försäkringsbolag",
    desc: "Mer informerade hushåll fattar bättre beslut om hemmet — mindre risk, fler nöjda kunder.",
  },
  {
    title: "Intresseorganisationer",
    desc: "Villaägarna, BRF-organisationer, energirörelser. Konkret medlemsnytta i form av oberoende analys.",
  },
  {
    title: "Tillverkare & leverantörer",
    desc: "Solceller, batterier, värmepumpar, smarta hem. Synas där kunder fattar konkreta beslut, baserat på riktiga siffror.",
  },
  {
    title: "Installatörer",
    desc: "Få kvalificerade leads — kunder som redan vet vad de söker och har sett konkret payback.",
  },
  {
    title: "Energihandlare & nätbolag",
    desc: "Vi hjälper kunder förstå sin elräkning. Mer transparens leder till färre supportärenden och högre nöjdhet.",
  },
];

export default function PartnersPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-12 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          Partners
        </p>
        <h1 className="mb-4 text-3xl font-light leading-tight text-brand-900 sm:text-4xl font-[family-name:var(--font-fraunces)]">
          Vi söker partners som vill <em className="text-brand-500">påskynda elektrifieringen</em> av Sverige.
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          HOMEii växer snabbt och möter tusentals svenska hushåll varje månad. Vi tror på ett
          öppet ekosystem där aktörer som delar målet om en smartare energianvändning kan
          jobba tillsammans — och nå hushållen där de fattar verkliga beslut.
        </p>
      </div>

      {/* Vilka söker vi */}
      <section className="mb-14">
        <h2 className="mb-6 text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
          Vilka söker vi?
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TARGET_GROUPS.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
                {g.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vad vi erbjuder */}
      <section className="mb-14">
        <h2 className="mb-6 text-xl font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
          Vad vi erbjuder
        </h2>
        <ul className="space-y-3 text-base leading-relaxed text-text-secondary">
          <li className="flex gap-3">
            <span className="text-brand-500" aria-hidden>✓</span>
            <span>
              <strong className="text-brand-900">Tillgång till en relevant publik</strong> — svenska
              hushåll som aktivt undersöker sin energisituation och är redo att fatta beslut.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-500" aria-hidden>✓</span>
            <span>
              <strong className="text-brand-900">Datadrivna rekommendationer</strong> — när vi
              föreslår en lösning gör vi det baserat på kundens faktiska faktura, inte generiska
              schabloner.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-500" aria-hidden>✓</span>
            <span>
              <strong className="text-brand-900">Trovärdighet</strong> — eftersom vi är oberoende
              och inte säljer egna produkter har våra rekommendationer hög integritet hos
              läsaren.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-brand-500" aria-hidden>✓</span>
            <span>
              <strong className="text-brand-900">Flexibla samarbetsformer</strong> — sponsorerat
              innehåll, integrationer, lead-generation, white-label, eller något helt annat. Vi
              utgår från ditt behov.
            </span>
          </li>
        </ul>
      </section>

      {/* CTA */}
      <section className="rounded-3xl bg-card-green border border-brand-500/20 p-8 sm:p-10">
        <h2 className="text-2xl font-light leading-tight text-brand-900 font-[family-name:var(--font-fraunces)]">
          Hör av dig — så ses vi över en kaffe.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-text-secondary">
          Vi tar gärna ett första samtal för att förstå er verksamhet och om ett samarbete kan
          gynna båda. Inga formaliteter, inget åtagande.
        </p>

        <a
          href="mailto:partners@homeii.se?subject=Partnersamarbete med HOMEii"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cta-orange px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:shadow-xl hover:-translate-y-0.5"
          style={{ boxShadow: "0 4px 24px rgba(232, 130, 74, 0.3)" }}
        >
          Mejla partners@homeii.se
          <span aria-hidden>&rarr;</span>
        </a>

        <p className="mt-4 text-xs text-text-muted">
          Eller ring oss direkt — kontaktinfo finns under{" "}
          <a href="/om/kontakt" className="text-brand-500 underline hover:text-brand-700">
            Om HOMEii / Kontakt
          </a>.
        </p>
      </section>
    </div>
  );
}
