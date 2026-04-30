import type { Metadata } from "next";
import OmPageLayout from "../OmPageLayout";

export const metadata: Metadata = {
  title: "Kontakt — HOMEii",
  description: "Frågor, synpunkter eller förslag? Hör av dig.",
};

const TOPICS = [
  {
    label: "Allmänna frågor",
    email: "hej@homeii.se",
    description: "Allt som inte passar i kategorierna nedan.",
  },
  {
    label: "Felrapport / bug",
    email: "bug@homeii.se",
    description: "Något som inte fungerar som det ska? Skicka gärna en skärmdump.",
  },
  {
    label: "Integritet & data",
    email: "integritet@homeii.se",
    description: "Begäran om utdrag, radering eller andra GDPR-frågor.",
  },
  {
    label: "Partners & samarbeten",
    email: "partners@homeii.se",
    description: "Vill du synas eller samarbeta? Banker, försäkringsbolag, intresseorganisationer.",
  },
  {
    label: "Press & media",
    email: "press@homeii.se",
    description: "Pressfrågor, intervjuförfrågningar och citat.",
  },
];

export default function OmKontaktPage() {
  return (
    <OmPageLayout
      eyebrow="Kontakt"
      title={<>Hör av <em className="text-brand-500">dig</em>.</>}
      subtitle="Vi läser allt och svarar oftast inom ett dygn på vardagar."
    >
      <div className="grid gap-3">
        {TOPICS.map((t) => (
          <a
            key={t.email}
            href={`mailto:${t.email}`}
            className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-500/40 hover:shadow-md"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
                {t.label}
              </h2>
              <span className="font-mono text-xs text-brand-500 group-hover:text-brand-700 transition-colors">
                {t.email}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-text-secondary">{t.description}</p>
          </a>
        ))}
      </div>

      <div className="mt-10 rounded-2xl bg-card-green border border-brand-500/20 p-6">
        <h2 className="text-base font-semibold text-brand-900 font-[family-name:var(--font-fraunces)]">
          Företagsuppgifter
        </h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Företag</dt>
            <dd className="text-text-primary">HOMEii AB</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Adress</dt>
            <dd className="text-text-primary">Stockholm, Sverige</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Org.nr</dt>
            <dd className="text-text-primary">— (uppdateras)</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-text-muted">Status</dt>
            <dd className="text-text-primary">F-skatt godkänd</dd>
          </div>
        </dl>
      </div>
    </OmPageLayout>
  );
}
