"use client";

/**
 * Min plan v0.2 — djupdyk i åtgärder.
 *
 * Komplement till `/app/hem` som ger en överblick. Här ska Sofia
 * djupdyka i en åtgärd:
 *   - Variant-jämförelse (budget / standard / premium med riktiga produkter)
 *   - Varför just denna åtgärd (källor + antaganden från upgrade-evidence)
 *   - Så här går du tillväga (externa länkar — vi kopplar inte direkt till
 *     installatörer enligt project_premium_scope)
 *
 * Anropar `generateRecommendationsV2` direkt för att få `typeComparisons`
 * (legacy-shape från wrapper saknar varianterna).
 *
 * Datakälla v0.2: localStorage `homeii-state`. Migreras till Supabase
 * när Sparrs PR #9C landar.
 */

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { loadState } from "../../simulator/storage";
import { generateRecommendationsV2 } from "../../simulator/recommendations/engine-v2";
import { UPGRADE_EVIDENCE } from "../../simulator/data/upgrade-evidence";
import type {
  SimulatorState,
  Recommendation,
  UpgradeId,
} from "../../simulator/types";
import type { TypeComparison } from "../../simulator/recommendations/engine-v2";
import { STATIC_TIPS, type StaticTip } from "../../../lib/static-tips";

function formatKr(n: number): string {
  return Math.round(n).toLocaleString("sv-SE");
}

/* =========================================================================
   HOW-TO GUIDES per åtgärdstyp.
   "Så här går du tillväga" — externa länkar och 3-stegs-guide.
   Vi kopplar oss INTE direkt mot installatörer (per project_premium_scope).
   ========================================================================= */

type HowToGuide = {
  steps: string[];
  externalLinks: { label: string; url: string }[];
  /** Optional intro-text om åtgärden behöver kontext innan stegen */
  intro?: string;
};

const HOW_TO_GUIDES: Record<string, HowToGuide> = {
  bergvarme: {
    intro: "Bergvärme är en stor investering — räkna med 2–3 månaders ledtid från första kontakt till färdig installation.",
    steps: [
      "Beskriv ditt hus, byggår och nuvarande uppvärmning för 3-5 installatörer",
      "Få offert med komplett pris (borrning + pump + installation + driftsättning)",
      "Välj installatör baserat på pris, referenser, garantier och leveranstid",
    ],
    externalLinks: [
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
      { label: "Servicefinder", url: "https://www.servicefinder.se/" },
    ],
  },
  luftvatten: {
    steps: [
      "Beskriv ditt hus och nuvarande värmesystem (radiatorer / golvvärme)",
      "Få offert med pump + ev. ackumulatortank + installation",
      "Verifiera installatörens F-skattsedel och referenser innan beställning",
    ],
    externalLinks: [
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
      { label: "Energimyndighetens värmepumpslista", url: "https://www.energimyndigheten.se/tester/tester-a-o/varmepumpar/" },
    ],
  },
  luftluft: {
    intro: "Enklast värmepumpen att installera — många erbjuder fast pris inkl. installation.",
    steps: [
      "Identifiera vilka rum/våning som ska värmas (luft-luft täcker oftast inte hela huset)",
      "Begär offert från 2-3 leverantörer för märken som testats av Energimyndigheten",
      "Beställ installation — typiskt 1-2 dagars arbete",
    ],
    externalLinks: [
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
      { label: "Energimyndighetens tester", url: "https://www.energimyndigheten.se/tester/tester-a-o/varmepumpar/" },
    ],
  },
  solceller: {
    intro: "Solceller har långa ledtider just nu (3-9 månader). Börja tidigt.",
    steps: [
      "Mät takyta + utvärdera väderstreck (söder bäst, öst-väst också OK)",
      "Begär offert från 3-5 installatörer — jämför kr/kWp och produktgaranti",
      "Beställ — installatören sköter elnätsanmälan och certifiering",
    ],
    externalLinks: [
      { label: "Energimyndighetens solelportal", url: "https://www.energimyndigheten.se/fornybart/solelportalen/" },
      { label: "Solar360 — jämför pris", url: "https://www.solar360.se/" },
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
    ],
  },
  batteri: {
    intro: "Hembatteri köps oftast tillsammans med solceller för bästa nytta — men kan installeras separat för att jaga spotpriset eller ge stödtjänster.",
    steps: [
      "Bestäm syfte: solel-lagring, prisarbitrage eller stödtjänster (FCR-D/FFR)",
      "Välj kapacitet (10/20/40 kWh) baserat på din kvällsförbrukning",
      "Begär offert — de flesta solcellsinstallatörer säljer även batteri",
    ],
    externalLinks: [
      { label: "Svenska Kraftnät — stödtjänster", url: "https://www.svk.se/aktorsportalen/elmarknad/stodtjanster/" },
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
    ],
  },
  tillaggsisolering: {
    steps: [
      "Inspektera vinden — lösullsisolering är vanligast och billigast",
      "Begär offert från 2-3 lokala isolerare — be om typ av material och garanterat U-värde",
      "Verifiera F-skattsedel och allmänna villkor innan beställning",
    ],
    externalLinks: [
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
      { label: "Boverket — energieffektivisering", url: "https://www.boverket.se/sv/byggande/regler-for-byggande/om-boverkets-byggregler-bbr/" },
    ],
  },
  fonsterbyte: {
    intro: "Fönsterbyte är dyrt men håller 30+ år. Räkna noga — eller kombinera med tilläggsisolering för bättre helhetseffekt.",
    steps: [
      "Mät alla fönster + dokumentera nuvarande U-värde (står på glasrutans märkning)",
      "Begär offert med 3-glas / lågemissionsglas / Ar-fyllning specificerat",
      "Jämför totalpris inkl. montering — installation är ofta större kostnad än fönstren själva",
    ],
    externalLinks: [
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
      { label: "Verifiera.nu — kontrollera företaget", url: "https://www.verifiera.se/" },
    ],
  },
  eldstad: {
    intro: "Eldstad kräver besiktning och anmälan till kommunen innan du eldar. Räkna med extra tid för det.",
    steps: [
      "Kontakta kommunens skorstensfejarmästare för besiktning av befintlig skorsten (eller plan för ny)",
      "Begär offert från eldstad-leverantör — Contura, Keddy, Jydepejsen är vanliga märken",
      "Anmäl byggnationsarbete till kommunen innan installation",
    ],
    externalLinks: [
      { label: "Eldsbild.se — eldstad-info", url: "https://www.eldsbild.se/" },
      { label: "Naturvårdsverket — eldstäder", url: "https://www.naturvardsverket.se/amnesomraden/luft/utslapp-fran-uppvarmning/" },
    ],
  },
  smartstyrning: {
    intro: "Smartstyrning köper du själv online och installerar via app — ingen installatör behövs.",
    steps: [
      "Välj system: Tibber Pulse (mätare), Ngenic (värmestyrning), Sensibo (luftvärmepump-styrning)",
      "Beställ online — leverans inom 1-2 veckor",
      "Anslut via app + smartphone — typiskt 30 min installation",
    ],
    externalLinks: [
      { label: "Tibber", url: "https://tibber.com/se/" },
      { label: "Ngenic — värmestyrning", url: "https://www.ngenic.se/" },
      { label: "Sensibo — luftvärmepump", url: "https://sensibo.com/" },
    ],
  },
  varmvattenpump: {
    intro: "Fristående enhet som ersätter din nuvarande varmvattenberedare. Enklare installation än komplett värmesystem.",
    steps: [
      "Mät utrymmet kring nuvarande beredare (kräver luftvolym för värmeväxlare)",
      "Begär offert — Thermia, Ariston, Stiebel Eltron är vanliga märken",
      "Beställ installation — typiskt 1 dags arbete",
    ],
    externalLinks: [
      { label: "Offerta.se — begär offert", url: "https://www.offerta.se/" },
    ],
  },
  dynamiskt_elpris: {
    intro: "Att byta elhandelsavtal till timpris kostar inget och tar 5 minuter online. Inga installatörer behövs.",
    steps: [
      "Jämför timprisavtal på Elskling.se eller Elpriskollen",
      "Välj leverantör — Tibber, Greenely och flera traditionella har timpris",
      "Säg upp nuvarande avtal online — bytet sker automatiskt nästa månadsskifte",
    ],
    externalLinks: [
      { label: "Elskling — jämför avtal", url: "https://www.elskling.se/" },
      { label: "Elpriskollen (Energimarknadsinspektionen)", url: "https://www.elpriskollen.se/" },
    ],
  },
};

/* =========================================================================
   PAGE — hydration + routing
   ========================================================================= */

export default function MinPlanPage() {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  if (!hydrated) return <div className="min-h-screen bg-bg-warm" />;

  if (
    !state?.billData ||
    !state?.recommendations ||
    state.recommendations.recommendations.length === 0
  ) {
    return <EmptyState />;
  }

  return <MinPlanView state={state} />;
}

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
            För att räkna fram din personliga åtgärdsplan behöver vi din senaste
            elräkning. Ladda upp den så bygger vi upp en analys av just ditt hus.
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
   MIN-PLAN-VIEW — när Sofia har data
   ========================================================================= */

function MinPlanView({ state }: { state: SimulatorState }) {
  const { billData, refinement, recommendations, seZone, assumptions } = state;
  const billDataNonNull = billData!;
  const recommendationsNonNull = recommendations!;

  // Anropa engine v2 direkt för att få typeComparisons (variant-data).
  // Utan tmyData → legacy 12-day pipeline (~sub-sekund) eftersom 8760 är
  // för dyrt för client-side rendering. Cache (Punkt C4) lyfts senare.
  const v2Result = useMemo(() => {
    return generateRecommendationsV2(
      billDataNonNull,
      refinement,
      seZone,
      assumptions,
      undefined,
    );
  }, [billDataNonNull, refinement, seZone, assumptions]);

  const totalSavingsKr = recommendationsNonNull.totalYearlySavingsKr;
  const totalInvestmentKr = recommendationsNonNull.recommendations.reduce(
    (s, r) => s + r.investmentKr,
    0,
  );

  return (
    <div className="bg-bg-warm">
      {/* Section 1 — Hero */}
      <section className="px-4 py-12">
        <Section1Hero
          totalSavingsKr={totalSavingsKr}
          totalInvestmentKr={totalInvestmentKr}
          numActions={recommendationsNonNull.recommendations.length}
        />
      </section>

      {/* Section 2 — Per åtgärd: rikt expandable kort */}
      <section className="bg-surface-bright px-4 py-12">
        <Section2Actions
          recommendations={recommendationsNonNull.recommendations}
          typeComparisons={v2Result.typeComparisons}
        />
      </section>

      {/* Section 3 — Statiska tips */}
      <section className="px-4 py-12">
        <Section3Tips />
      </section>

      {/* Section 4 — Energy Buddy */}
      <section className="bg-surface-bright px-4 py-10">
        <Section4EnergyBuddy />
      </section>
    </div>
  );
}

/* =========================================================================
   SECTION 1 — Hero
   ========================================================================= */

function Section1Hero({
  totalSavingsKr,
  totalInvestmentKr,
  numActions,
}: {
  totalSavingsKr: number;
  totalInvestmentKr: number;
  numActions: number;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Min plan
        </div>
        <h1 className="mb-3 text-3xl font-bold leading-tight tracking-tight text-text-primary md:text-4xl">
          Din kompletta åtgärdsplan
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Här är de {numActions} åtgärder som lönar sig mest för just ditt hus.
          För varje åtgärd kan du jämföra varianter, läsa hur vi räknat och se
          hur du går vidare.
        </p>
      </header>

      <div className="rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-6 text-center text-white">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest opacity-85">
              Total sparpotential
            </div>
            <div className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {formatKr(totalSavingsKr)} kr
            </div>
            <div className="mt-1 text-xs opacity-80">per år</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-widest opacity-85">
              Om du gör allt
            </div>
            <div className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {formatKr(totalInvestmentKr)} kr
            </div>
            <div className="mt-1 text-xs opacity-80">total investering</div>
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed opacity-90">
          Du behöver inte göra allt på en gång. Börja med toppvalet — det
          betalar tillbaka sig snabbast.
        </p>
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 2 — Per åtgärd: rikt expandable åtgärdskort
   ========================================================================= */

function Section2Actions({
  recommendations,
  typeComparisons,
}: {
  recommendations: Recommendation[];
  typeComparisons: TypeComparison[];
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Åtgärder
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Klicka för att djupdyka i en åtgärd
        </h2>
      </header>

      <div className="flex flex-col gap-4">
        {recommendations.map((rec) => {
          const typeComparison = typeComparisons.find(
            (tc) => tc.type.id === rec.upgradeId,
          );
          return (
            <ActionCard
              key={rec.upgradeId}
              recommendation={rec}
              typeComparison={typeComparison}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActionCard({
  recommendation,
  typeComparison,
}: {
  recommendation: Recommendation;
  typeComparison: TypeComparison | undefined;
}) {
  const evidence = UPGRADE_EVIDENCE[recommendation.upgradeId as UpgradeId];
  const guide = HOW_TO_GUIDES[recommendation.upgradeId];
  const type = typeComparison?.type;
  const icon = type?.icon ?? "•";
  const label =
    recommendation.upgradeId === "solceller"
      ? "Solceller + hembatteri"
      : type?.label ?? recommendation.upgradeId;
  const description =
    recommendation.upgradeId === "solceller"
      ? "Producera egen el och lagra överskottet i ett hembatteri"
      : type?.explanation ?? "";

  return (
    <div
      className={`card-strong rounded-2xl overflow-hidden ${
        recommendation.isTopPick ? "ring-2 ring-brand-500/30" : ""
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
              recommendation.isTopPick ? "bg-brand-500 shadow-md" : "bg-card-green"
            }`}
          >
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-text-primary">{label}</h3>
              {recommendation.isTopPick && (
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  Toppval
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-text-muted mb-3">{description}</p>
            )}

            {/* Key metrics */}
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="text-xl font-bold text-energy-green">
                  {formatKr(recommendation.yearlySavingsKr)} kr
                </span>
                <span className="text-xs text-text-muted block">besparing/år</span>
              </div>
              {recommendation.investmentKr > 0 && (
                <div>
                  <span className="text-sm font-semibold text-text-primary">
                    {formatKr(recommendation.investmentKr)} kr
                  </span>
                  <span className="text-xs text-text-muted block">investering</span>
                </div>
              )}
              {recommendation.investmentKr > 0 ? (
                <div>
                  <span className="text-sm font-semibold text-text-primary">
                    {recommendation.paybackYears} år
                  </span>
                  <span className="text-xs text-text-muted block">återbetalningstid</span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-semibold text-energy-green">
                    Gratis
                  </span>
                  <span className="text-xs text-text-muted block">
                    ingen investering
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <p className="mt-3 text-sm text-text-secondary italic">
          {recommendation.reasoning}
        </p>
      </div>

      {/* Expandable sektioner — separata <details> så de kan öppnas oberoende */}
      <div className="border-t border-border bg-surface-dim/20">
        {typeComparison && typeComparison.variants.length > 1 && (
          <ExpandableSection title="Jämför varianter">
            <VariantComparison
              typeComparison={typeComparison}
              chosenVariantId={typeComparison.bestVariant.variant.id}
            />
          </ExpandableSection>
        )}

        {evidence && (
          <ExpandableSection title="Varför just denna åtgärd?">
            <WhyThisAction evidence={evidence} />
          </ExpandableSection>
        )}

        {guide && (
          <ExpandableSection title="Så här går du tillväga">
            <HowToBlock guide={guide} />
          </ExpandableSection>
        )}
      </div>
    </div>
  );
}

function ExpandableSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-brand-600 hover:text-brand-500 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}

/* =========================================================================
   VARIANT COMPARISON — head-to-head budget/standard/premium
   ========================================================================= */

function VariantComparison({
  typeComparison,
  chosenVariantId,
}: {
  typeComparison: TypeComparison;
  chosenVariantId: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {typeComparison.variants.map((evaluation) => {
        const isChosen = evaluation.variant.id === chosenVariantId;
        return (
          <div
            key={evaluation.variant.id}
            className={`rounded-xl border p-3 ${
              isChosen
                ? "border-brand-500 bg-brand-50/50"
                : "border-border bg-white"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {evaluation.variant.tier === "budget"
                  ? "Prisvärt"
                  : evaluation.variant.tier === "premium"
                  ? "Premium"
                  : "Standard"}
              </div>
              {isChosen && (
                <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[9px] font-bold text-white">
                  Vårt val
                </span>
              )}
            </div>
            <div className="mb-1 text-sm font-semibold text-text-primary">
              {evaluation.variant.label}
            </div>
            {evaluation.variant.supplier && (
              <div className="mb-2 text-[10px] text-text-muted">
                {evaluation.variant.supplier}
              </div>
            )}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Investering</span>
                <span className="font-semibold text-text-primary tabular-nums">
                  {formatKr(evaluation.totalInvestmentKr)} kr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Besparing/år</span>
                <span className="font-semibold text-energy-green tabular-nums">
                  {formatKr(evaluation.yearlySavingsKr)} kr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Payback</span>
                <span className="font-semibold text-text-primary">
                  {evaluation.paybackYears} år
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Livslängd</span>
                <span className="text-text-primary">
                  {evaluation.variant.lifespanYears} år
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   WHY THIS ACTION — UPGRADE_EVIDENCE.whatItDoes + sources
   ========================================================================= */

function WhyThisAction({
  evidence,
}: {
  evidence: (typeof UPGRADE_EVIDENCE)[UpgradeId];
}) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Vad åtgärden gör
        </div>
        <p>{evidence.whatItDoes}</p>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Hur besparingen räknas
        </div>
        <p>{evidence.savingsAssumption.description}</p>
        {evidence.savingsAssumption.rangeNote && (
          <p className="mt-1 text-xs italic text-text-muted">
            {evidence.savingsAssumption.rangeNote}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Kostnad
          </div>
          <p className="text-xs">{evidence.costAssumption}</p>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Livslängd
          </div>
          <p className="text-xs">{evidence.lifespanAssumption}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Källor
        </div>
        <ul className="space-y-1">
          {evidence.sources.map((source) => (
            <li key={source.url} className="text-xs">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-500 hover:text-brand-600 hover:underline"
              >
                {source.label} ↗
              </a>
              <span className="ml-2 text-text-muted">
                (hämtad {source.retrievedAt})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* =========================================================================
   HOW-TO BLOCK — 3-stegs guide + externa länkar
   ========================================================================= */

function HowToBlock({ guide }: { guide: HowToGuide }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-text-secondary">
      {guide.intro && (
        <p className="rounded-xl bg-brand-50/60 p-3 text-text-primary">
          <strong className="font-semibold">{guide.intro}</strong>
        </p>
      )}

      <ol className="space-y-2">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          Externa tjänster vi rekommenderar
        </div>
        <div className="flex flex-col gap-1.5">
          {guide.externalLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-bg-warm px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
        <p className="mt-2 text-[11px] italic text-text-muted">
          Vi tjänar inga pengar på dessa — vi delar vad vi vet.
        </p>
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 3 — Statiska tips (åtgärder utan engine-modellering)
   ========================================================================= */

function Section3Tips() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Andra tips
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Mindre saker du kan göra
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          Åtgärder vi inte kan räkna exakt på men som ändå ofta lönar sig.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {(["anvanda", "effekt", "fast"] as const).flatMap((cat) =>
          STATIC_TIPS[cat].map((tip) => <TipCard key={tip.id} tip={tip} />),
        )}
      </div>
    </div>
  );
}

function TipCard({ tip }: { tip: StaticTip }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-bg-warm text-xl">
          {tip.icon}
        </div>
        <div className="text-sm font-bold tracking-tight text-text-primary">
          {tip.title}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-text-muted mb-2">{tip.desc}</p>
      {tip.approxKr && (
        <div className="text-[11px] font-medium text-brand-600">
          {tip.approxKr}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   SECTION 4 — Energy Buddy
   ========================================================================= */

function Section4EnergyBuddy() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-start gap-4 rounded-2xl bg-brand-50/60 p-5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xl text-white">
          💬
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-text-primary">
            Vill du diskutera vad som passar just dig?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            Prata med <strong className="font-semibold text-brand-600">Energy Buddy</strong>{" "}
            — vår AI-rådgivare. Hon vet vad som finns i din plan och kan svara
            på allt från finansiering till hur du undviker dyra misstag. Hon
            ligger längst ner till höger på skärmen.
          </p>
        </div>
      </div>
    </div>
  );
}
