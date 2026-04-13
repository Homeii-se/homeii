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
        <p className="mb-6 max-w-md text-base leading-relaxed text-slate-300 italic">
          &ldquo;{STRINGS.heroTagline}&rdquo;
        </p>

        {/* Floating icon */}
        <div className="animate-float mb-10 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/25">
          <svg className="h-12 w-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="6.5" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h1 className="mb-5 max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl leading-[1.1]">
          {STRINGS.heroTitle}
        </h1>

        <p className="mb-10 max-w-md text-lg leading-relaxed text-slate-300">
          {STRINGS.heroSubtitle}
        </p>

        <button
          onClick={onStart}
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-brand-500 px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          style={{ boxShadow: "0 4px 24px rgba(13, 148, 136, 0.3)" }}
        >
          {STRINGS.heroCta}
        </button>

        {/* Trust signals — removed: "100% gratis", "Helt oberoende", "Ingen data sparas online" */}
      </div>

      {/* Social proof bar */}
      <section className="border-t border-sky-300/20 bg-white/5 py-5 backdrop-blur-sm mt-4">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-sm text-slate-400">
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
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Tre steg till lägre energikostnad</h2>
          <p className="mt-2 text-slate-300">Ingen registrering krävs. Helt gratis.</p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { n: 1, title: "Ladda upp elräkningen", desc: "Ta en bild eller fyll i dina uppgifter manuellt. Vi analyserar din förbrukning." },
            { n: 2, title: "Bekräfta din profil", desc: "Vi gissar din boendetyp och uppvärmning — korrigera om det inte stämmer." },
            { n: 3, title: "Få personliga råd", desc: "Se vilka åtgärder som sparar mest — med investeringskostnad och återbetalningstid." },
          ].map(({ n, title, desc }) => (
            <li key={n} className="relative rounded-2xl border border-white/15 bg-white/8 backdrop-blur-sm p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-brand-500 text-sm font-bold text-white shadow">{n}</span>
              <h3 className="mt-4 font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-400">{desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA block */}
      <section className="mx-auto max-w-2xl px-4 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500/20 to-brand-600/20 border border-brand-400/30 p-8 text-center backdrop-blur-sm sm:p-12">
          <h2 className="text-xl font-bold text-white sm:text-2xl">Redo att se vad du kan spara?</h2>
          <p className="mt-3 text-emerald-200/70">Det tar bara 2–3 minuter och kräver ingen registrering.</p>
          <button
            onClick={onStart}
            className="mt-6 inline-block rounded-full bg-gradient-to-r from-emerald-500 to-brand-500 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Analysera min elräkning
          </button>
        </div>
      </section>

      {/* Trust section */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-sm p-8">
          <h2 className="text-lg font-semibold text-white">Byggt för förtroende — inte försäljning</h2>
          <p className="mt-3 text-slate-400">
            HOMEii säljer inga produkter eller tjänster. Vi hjälper dig fatta ett klokt beslut med tydliga siffror och ärliga beräkningar. All data stannar i din webbläsare — inget sparas på våra servrar.
          </p>
        </div>
      </section>
    </div>
  );
}