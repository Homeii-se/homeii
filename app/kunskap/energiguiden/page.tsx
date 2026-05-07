import type { Metadata } from "next";
import Link from "next/link";
import EnergyFlowApp from "./energifloden-dygn/EnergyFlowApp";

export const metadata: Metadata = {
  title: "Energiguiden — HOMEii",
  description:
    "Interaktiva visualiseringar för att förstå energiflödena i hemmet — jämför gårdagens hem (passiv konsument) mot morgondagens hem (aktiv prosument med solpaneler, batteri, elbil och smart styrning).",
};

export default function EnergiguidenPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/kunskap"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
      >
        <span aria-hidden>&larr;</span> Tillbaka till Kunskap
      </Link>

      <div className="mb-8 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-muted">
          Kunskap › Energiguiden
        </p>
        <h1 className="mb-4 text-3xl font-light leading-tight text-brand-900 sm:text-4xl font-[family-name:var(--font-fraunces)]">
          Hur flödar <em className="text-brand-500">energin</em> i morgondagens hem?
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          I morgondagens hem rör sig el åt flera håll samtidigt — solen producerar,
          batteriet lagrar, elbilen laddar, och överskott säljs ibland tillbaka till nätet.
          Klicka mellan gårdagens och morgondagens hem nedan för att se hur de nya flödena
          skiljer sig från en värld där elen bara gick ett håll: från nätet in i huset.
        </p>
      </div>

      <EnergyFlowApp />

      <p className="mt-8 max-w-2xl text-xs text-text-muted">
        Värdena är förenklade illustrationer för att visa <em>logiken</em> i ett
        energihem — inte exakta mätningar. Solproduktion, värmeförluster, prisprofiler
        och förbrukningsmönster baseras på typiska svenska villavärden för zon SE3.
      </p>
    </div>
  );
}