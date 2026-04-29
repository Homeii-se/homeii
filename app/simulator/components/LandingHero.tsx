"use client";

import { useState } from "react";
import { STRINGS } from "../data/strings";
import UploadModal from "./UploadModal";
import type { BillData } from "../types";

interface LandingHeroProps {
  /** Anropas med bill-data när modalen lyckats parsa en faktura.
   *  Föräldern (page.tsx) ska då navigera direkt till steg 2 (Bekräfta). */
  onUploadComplete: (data: BillData) => void;
}

export default function LandingHero({ onUploadComplete }: LandingHeroProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleClose = () => setModalOpen(false);
  const handleComplete = (data: BillData) => {
    setModalOpen(false);
    onUploadComplete(data);
  };

  const onStart = () => setModalOpen(true);

  return (
    <div className="animate-fade-in">
      <UploadModal open={modalOpen} onClose={handleClose} onComplete={handleComplete} />
      {/* Hero section */}
      <div className="flex min-h-[75vh] flex-col items-center justify-center px-4 text-center">
        {/* Eyebrow badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-green-light" />
          <span className="text-sm font-medium text-brand-700">Oberoende rådgivning</span>
        </div>

        <h1 className="mb-5 max-w-xl text-4xl font-light tracking-tight text-brand-900 sm:text-5xl leading-[1.1] font-[family-name:var(--font-fraunces)]">
          Förstå din{" "}
          <em className="text-brand-500">energiekonomi</em>
        </h1>

        <p className="mb-10 max-w-md text-lg leading-relaxed text-text-secondary font-light">
          {STRINGS.heroSubtitle}
        </p>

        <button
          onClick={onStart}
          className="rounded-xl bg-cta-orange px-10 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-orange focus-visible:ring-offset-2 focus-visible:ring-offset-bg-warm inline-flex items-center gap-2"
          style={{ boxShadow: "0 4px 24px rgba(232, 130, 74, 0.3)" }}
        >
          {STRINGS.heroCta}
          <span aria-hidden="true">&rarr;</span>
        </button>

        {/* Trust row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
          {["Helt gratis", "Personlig analys", "2-3 minuter"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 text-green-light" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-light text-brand-900 sm:text-3xl font-[family-name:var(--font-fraunces)]">Så går det till</h2>
          <p className="mt-2 text-text-secondary">Kom igång på ett par minuter. Helt gratis.</p>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              n: 1,
              title: "Ladda upp elräkningen",
              desc: "Ta en bild eller fyll i dina uppgifter manuellt. Vi analyserar din förbrukning.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="12" y2="12" />
                  <line x1="15" y1="15" x2="12" y2="12" />
                </svg>
              ),
            },
            {
              n: 2,
              title: "Bekräfta din profil",
              desc: "Vi gissar din boendetyp och uppvärmning — korrigera om det inte stämmer.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ),
            },
            {
              n: 3,
              title: "Få personliga råd",
              desc: "Se vilka åtgärder som sparar mest — med investeringskostnad och återbetalningstid.",
              icon: (
                <svg className="h-6 w-6 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="9" y1="18" x2="15" y2="18" />
                  <line x1="10" y1="22" x2="14" y2="22" />
                  <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14" />
                </svg>
              ),
            },
          ].map(({ n, title, desc, icon }) => (
            <li key={n} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
              {/* Watermark number */}
              <span className="absolute top-3 right-4 text-3xl font-light text-brand-100 font-[family-name:var(--font-fraunces)] select-none pointer-events-none">
                {n}
              </span>
              {/* Icon container */}
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                {icon}
              </span>
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
          <p className="mt-3 text-text-secondary">Det tar bara 2-3 minuter att komma igång.</p>
          <button
            onClick={onStart}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cta-orange px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta-orange focus-visible:ring-offset-2"
          >
            Analysera min elräkning
            <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      {/* Trust section */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-8">
          <h2 className="text-lg font-semibold text-brand-900">Byggt för förtroende — inte försäljning</h2>
          <p className="mt-3 text-text-secondary">
            HOMEii säljer inga produkter eller tjänster. Vi hjälper dig fatta ett klokt beslut med tydliga siffror och ärliga beräkningar.
          </p>
        </div>
      </section>
    </div>
  );
}
