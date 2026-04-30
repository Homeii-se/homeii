import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kunskap — HOMEii",
  description:
    "Guider, räkneexempel, nyheter och en ordlista — allt om svensk elmarknad och energiåtgärder.",
};

const SECTIONS = [
  {
    href: "/kunskap/guider",
    title: "Guider",
    description: "Steg-för-steg-guider för solceller, värmepumpar, batterier och andra energiåtgärder.",
  },
  {
    href: "/kunskap/exempel",
    title: "Räkneexempel",
    description: "Verkliga exempel: vad sparar en typisk villa? Vad blev återbetalningen för en luft-vatten-värmepump?",
  },
  {
    href: "/kunskap/nyheter",
    title: "Nyheter & trender",
    description: "Aktuellt om elpriser, regelverk, ROT-avdrag och teknikutveckling.",
  },
  {
    href: "/kunskap/ordlista",
    title: "Ordlista",
    description: "Vad är effekttariff? Vad betyder COP? En jordnära ordlista med svenska elmarknads-termer.",
  },
];

export default function KunskapHubPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          Kunskap
        </p>
        <h1 className="mb-4 text-3xl font-light leading-tight text-brand-900 sm:text-4xl font-[family-name:var(--font-fraunces)]">
          Förstå <em className="text-brand-500">svenska elmarknaden</em> — utan svårbegripliga termer.
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          Vi samlar det viktigaste på ett ställe: hur olika åtgärder fungerar, vad de kostar,
          hur du räknar — och vad som faktiskt händer på elmarknaden just nu.
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
              Utforska <span aria-hidden>&rarr;</span>
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs italic text-text-muted">
        Innehållet byggs ut löpande. Saknar du något? Hör av dig på{" "}
        <a href="mailto:hej@homeii.se" className="text-brand-500 underline hover:text-brand-700">
          hej@homeii.se
        </a>
        .
      </p>
    </div>
  );
}
