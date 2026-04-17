"use client";

import { STRINGS } from "../data/strings";

interface LandingHeroProps {
  onStart: () => void;
}

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="animate-fade-in">
      {/* Hero section */}
      <div className="flex min-h-[75vh] flex-col items-center justify-center px-4 text-center">
        {/* Tagline */}
        <p className="mb-6 max-w-md text-base leading-relaxed text-text-secondary italic">
          &ldquo;{STRINGS.heroTagline}&rdquo;
        </p>

        {/* Floating icon */}
        <div className="animate-float mb-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-500 shadow-lg">
          <svg className="h-12 w-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h1 className="mb-5 max-w-xl text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl leading-[1.1]">
          {STRINGS.heroTitle}
        </h1>

        <p className="mb-10 max-w-md text-lg leading-relaxed text-text-secondary">
          {STRINGS.heroSubtitle}
        </p>

        <button
          onClick={onStart}
          className="rounded-2xl bg-cta-orange px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-orange focus-visible:ring-offset-2 focus-visible:ring-offset-bg-warm"
          style={{ boxShadow: "0 4px 24px rgba(244, 162, 97, 0.3)" }}
        >
          {STRINGS.heroCta}
        </button>
      </div>

      {/* Social proof bar */}
      <section className="border-t border-gray-200 bg-white py-5 mt-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-sm text-text-secondary">
          <span>Genomsnittlig besparing: 8 000–25 000 kr/år</span>
          <span className="hidden sm:inline">·</span>
          <span>Analysen tar under 3 minuter</span>
          <span className="hidden sm:inline">·</span>
          <span>Personliga rekommendationer</span>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-brand-900 sm:text-3xl">Så går det till</h2>
          <p className="mt-2 text-text-secondary">Ingen registrering krävs. Helt gratis.</p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { n: 1, title: "Ladda upp elräkningen", desc: "Ta en bild eller fyll i dina uppgifter manuellt. Vi analyserar din förbrukning." },
            { n: 2, title: "Bekräfta din profil", desc: "Vi gissar din boendetyp och uppvärmning — korrigera om det inte stämmer." },
            { n: 3, title: "Få personliga råd", desc: "Se vilka åtgärder som sparar mest — med investeringskostnad och återbetalningstid." },
          ].map(({ n, title, desc }) => (
            <li key={n} className="relative rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white shadow">{n}</span>
              <h3 className="mt-4 font-semibold text-brand-900">{title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA block */}
      <section className="mx-auto max-w-2xl px-4 pb-16">
        <div className="rounded-3xl bg-card-green border border-brand-500/20 p-8 text-center sm:p-12">
          <h2 className="text-xl font-bold text-brand-900 sm:text-2xl">Redo att se vad du kan spara?</h2>
          <p className="mt-3 text-text-secondary">Det tar bara 2–3 minuter och kräver ingen registrering.</p>
          <button
            onClick={onStart}
            className="mt-6 inline-block rounded-full bg-cta-orange px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-orange focus-visible:ring-offset-2"
          >
            Analysera min elräkning
          </button>
        </div>
      </section>

      {/* Trust section */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-8">
          <h2 className="text-lg font-semibold text-brand-900">Byggt för förtroende — inte försäljning</h2>
          <p className="mt-3 text-text-secondary">
            HOMEii säljer inga produkter eller tjänster. Vi hjälper dig fatta ett klokt beslut med tydliga siffror och ärliga beräkningar. All data stannar i din webbläsare — inget sparas på våra servrar.
          </p>
        </div>
      </section>
    </div>
  );
}
