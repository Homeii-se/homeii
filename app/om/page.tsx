import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om HOMEii — Din oberoende energirådgivare",
  description:
    "Vi hjälper svenska hushåll förstå sin energiekonomi och hitta de åtgärder som faktiskt lönar sig. Helt oberoende, helt gratis.",
};

const SECTIONS = [
  {
    href: "/om/sa-funkar-det",
    title: "Så funkar det",
    description: "Tre steg från elräkning till åtgärder — vad som händer i varje steg och hur vi räknar.",
  },
  {
    href: "/om/oss",
    title: "Om oss",
    description: "Vilka vi är, varför vi byggde HOMEii och vad som driver oss.",
  },
  {
    href: "/om/dig",
    title: "Vår oberoende roll",
    description: "Vi säljer ingenting. Hur vi tjänar pengar — och varför det inte påverkar våra rekommendationer.",
  },
  {
    href: "/om/integritet",
    title: "Integritet & GDPR",
    description: "Hur vi hanterar din fakturadata, vad vi sparar och vad du har för rättigheter.",
  },
  {
    href: "/om/kontakt",
    title: "Kontakt",
    description: "Frågor, synpunkter eller förslag? Hör av dig.",
  },
];

export default function OmHubPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          Om HOMEii
        </p>
        <h1 className="mb-4 text-3xl font-light leading-tight text-brand-900 sm:text-4xl font-[family-name:var(--font-fraunces)]">
          Vi hjälper dig <em className="text-brand-500">förstå</em> din energiekonomi och hjälper dig på resan mot mer pengar i plånboken.
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          HOMEii är en oberoende tjänst som analyserar din elräkning och visar vad du faktiskt
          betalar för, vad du kan spara — och vilka åtgärder som lönar sig.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-brand-900 group-hover:text-brand-700 font-[family-name:var(--font-fraunces)]">
              {s.title}
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary">{s.description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-500 group-hover:gap-2 transition-all">
              Läs mer <span aria-hidden>&rarr;</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
