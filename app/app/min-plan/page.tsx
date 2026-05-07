"use client";

/**
 * Min plan — Premium-vy för inloggade användare.
 *
 * Visar personaliserade rekommendationer baserat på senaste fakturan
 * Sofia laddade upp. v0.1: läser från `homeii-state`-localStorage tills
 * Sparrs PR #9C ger oss Supabase-persistens. När den är ute byts bara
 * datakällan ut — UI:t är oförändrat.
 *
 * Designspråk: ärver färger, typografi och kort-mönster från
 * ResultScrollFlow (publika simulator-flödet) men ingen konverterings-CTA
 * — Sofia är redan inloggad. Sektioner går från lugn hälsning →
 * konkreta toppval → samlad potential → konkret nästa steg.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadState } from "../../simulator/storage";
import RecommendationCard from "../../simulator/components/RecommendationCard";
import { UPGRADE_DEFINITIONS } from "../../simulator/data/upgrade-catalog";
import type {
  SimulatorState,
  Recommendation,
  BillData,
} from "../../simulator/types";

function formatKr(n: number): string {
  return Math.round(n).toLocaleString("sv-SE");
}

export default function MinPlanPage() {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  // Pre-hydration — render skelett-tomt så server/client-HTML matchar.
  if (!hydrated) return <div className="min-h-screen" />;

  // Saknar fakturadata — visa onboarding-CTA till analys-flödet.
  if (!state?.billData || !state?.recommendations || state.recommendations.recommendations.length === 0) {
    return <EmptyState />;
  }

  return <PremiumPlan state={state} />;
}

/* =========================================================================
   EMPTY STATE — när Sofia inte har laddat upp en faktura ännu
   ========================================================================= */

function EmptyState() {
  return (
    <main className="min-h-screen bg-bg-warm">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="card-strong rounded-2xl p-8 text-center">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-500">
            Min plan
          </div>
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">
            Vi behöver din faktura först
          </h1>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
            För att vi ska kunna räkna fram din personliga plan behöver vi
            din senaste elräkning. Ladda upp den så bygger vi upp en
            analys av just ditt hus.
          </p>
          <Link
            href="/analys"
            className="inline-block rounded-2xl bg-brand-500 px-7 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
          >
            Ladda upp faktura →
          </Link>
        </div>
      </div>
    </main>
  );
}

/* =========================================================================
   PREMIUM PLAN — huvudvyn när Sofia har data
   ========================================================================= */

function PremiumPlan({ state }: { state: SimulatorState }) {
  const { billData, recommendations } = state;
  const billDataNonNull = billData!;
  const recommendationsNonNull = recommendations!;

  const yearlyKr = (billDataNonNull.costPerMonth ?? 0) * 12;
  const totalSavingsKr = recommendationsNonNull.totalYearlySavingsKr;
  const topPicks = recommendationsNonNull.recommendations.filter((r) => r.isTopPick);
  const morePicks = recommendationsNonNull.recommendations.filter((r) => !r.isTopPick);

  return (
    <div className="relative bg-bg-warm">
      {/* Section 1 — Hej + nuläge */}
      <section className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <Section1Hero
          yearlyKr={yearlyKr}
          totalSavingsKr={totalSavingsKr}
          billData={billDataNonNull}
        />
      </section>

      {/* Section 2 — Toppvalen */}
      <section className="bg-surface-bright px-4 py-16">
        <Section2TopPicks topPicks={topPicks} />
      </section>

      {/* Section 3 — Samlad potential */}
      <section className="px-4 py-16">
        <Section3Potential
          totalSavingsKr={totalSavingsKr}
          yearlyKr={yearlyKr}
          morePicks={morePicks}
        />
      </section>

      {/* Section 4 — Nästa steg */}
      <section className="bg-surface-bright px-4 py-16">
        <Section4NextSteps />
      </section>
    </div>
  );
}

/* =========================================================================
   SECTION 1 — Hej + nuläge
   ========================================================================= */

function Section1Hero({
  yearlyKr,
  totalSavingsKr,
  billData,
}: {
  yearlyKr: number;
  totalSavingsKr: number;
  billData: BillData;
}) {
  const monthLabel = billData.invoiceMonth !== undefined
    ? ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"][billData.invoiceMonth]
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-9 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Min plan
        </div>
        <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-text-primary md:text-4xl">
          Hej, här är din plan
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Baserat på {monthLabel ? `din ${monthLabel}-faktura` : "din senaste faktura"}{" "}
          och dina husuppgifter har vi räknat fram vad som ger störst
          effekt för just ditt hem.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* KPI 1 — Din nuvarande kostnad */}
        <div className="card-strong rounded-2xl p-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Din elkostnad i år
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-text-primary md:text-4xl">
            {formatKr(yearlyKr)} kr
          </div>
          <div className="mt-1 text-xs text-text-muted">
            ~ {formatKr(yearlyKr / 12)} kr per månad
          </div>
        </div>

        {/* KPI 2 — Möjlig besparing */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-6 text-white shadow-md">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider opacity-85">
            Möjlig besparing
          </div>
          <div className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {formatKr(totalSavingsKr)} kr
          </div>
          <div className="mt-1 text-xs opacity-80">
            per år, om du följer planen nedan
          </div>
        </div>
      </div>

      <div className="mt-9 text-center text-xs text-text-muted">
        Scrolla för att se vad som ger störst effekt ↓
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 2 — Toppvalen
   ========================================================================= */

function Section2TopPicks({ topPicks }: { topPicks: Recommendation[] }) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Tre toppval
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Det här ger störst effekt för dig
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          Sorterat på återbetalningstid — det som lönar sig snabbast först.
          Du behöver inte göra allt på en gång.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {topPicks.map((rec) => (
          <RecommendationCard key={rec.upgradeId} recommendation={rec} />
        ))}
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 3 — Samlad potential + fler möjligheter
   ========================================================================= */

function Section3Potential({
  totalSavingsKr,
  yearlyKr,
  morePicks,
}: {
  totalSavingsKr: number;
  yearlyKr: number;
  morePicks: Recommendation[];
}) {
  const savingsPercent = yearlyKr > 0 ? Math.round((totalSavingsKr / yearlyKr) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Om du gör allt
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Samlad potential
        </h2>
      </header>

      {/* Mörkt gradient-kort med totala potentialen */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-8 text-center text-white shadow-lg">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest opacity-85">
          Total sparpotential
        </div>
        <div className="mb-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          {formatKr(totalSavingsKr)} kr / år
        </div>
        <div className="text-sm opacity-85">
          {savingsPercent} % av din nuvarande räkning
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed opacity-90">
          Fördelat över flera åtgärder. Vi rekommenderar att börja med
          toppvalet — det betalar tillbaka sig snabbast.
        </p>
      </div>

      {/* Fler möjligheter, kompakt */}
      {morePicks.length > 0 && (
        <>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-muted">
            Fler möjligheter
          </h3>
          <div className="flex flex-col gap-3">
            {morePicks.map((rec) => (
              <CompactPickRow key={rec.upgradeId} rec={rec} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CompactPickRow({ rec }: { rec: Recommendation }) {
  const upgrade = UPGRADE_DEFINITIONS.find((u) => u.id === rec.upgradeId);
  const label = upgrade?.label ?? rec.upgradeId;
  const icon = upgrade?.icon ?? "•";

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-text-primary">
          <span className="mr-2">{icon}</span>
          {label}
        </div>
        <div className="text-sm font-bold text-energy-green tabular-nums">
          +{formatKr(rec.yearlySavingsKr)} kr/år
        </div>
      </div>
      <div className="mt-1 text-xs text-text-muted">
        {rec.investmentKr > 0
          ? `Investering: ${formatKr(rec.investmentKr)} kr · Återbetalningstid: ${rec.paybackYears} år`
          : "Ingen investering — gratis att byta"}
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 4 — Nästa steg
   ========================================================================= */

function Section4NextSteps() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Vad gör du nu?
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Tre vägar framåt
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          Du behöver inte agera direkt. Men när du är redo finns det
          några sätt att gå vidare med din plan.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <NextStepCard
          icon="📋"
          title="Få offerter på toppvalen"
          description="Vi kan hjälpa dig att begära offerter från seriösa installatörer för åtgärderna i din plan."
          href="/app/mina-offerter"
          ctaLabel="Gå till mina offerter"
        />
        <NextStepCard
          icon="📞"
          title="Boka samtal med energirådgivare"
          description="Få en personlig genomgång av din plan med en oberoende rådgivare. (Kommer snart)"
          href={null}
          ctaLabel="Kommer snart"
        />
        <NextStepCard
          icon="📊"
          title="Följ upp månad för månad"
          description="Spara fler fakturor över tid så bygger vi upp en mer precis bild av ditt hem och anpassar planen."
          href="/app/min-uppfoljning"
          ctaLabel="Gå till uppföljning"
        />
      </div>
    </div>
  );
}

function NextStepCard({
  icon,
  title,
  description,
  href,
  ctaLabel,
}: {
  icon: string;
  title: string;
  description: string;
  href: string | null;
  ctaLabel: string;
}) {
  // Innehåll är samma oavsett om kortet är klickbart eller inaktivt —
  // bygg det en gång och låt det villkorligt wrappas i Link.
  const content = (
    <div
      className={`rounded-2xl border border-border bg-white p-5 transition-all ${
        href ? "hover:border-brand-300 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 text-base font-bold tracking-tight text-text-primary">
            {title}
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
          <div className="mt-2 text-xs font-medium text-brand-500">
            {ctaLabel} {href && "→"}
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return <div className="block opacity-70">{content}</div>;
}
