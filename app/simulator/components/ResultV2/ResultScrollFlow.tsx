"use client";

/**
 * MinaSidorScrollFlow — alternativt analysflöde post-faktura.
 *
 * Single-page scroll med 4 sektioner som var och en tar nästan full
 * viewporthöjd (hero-pauser). Bakgrundsfärg alternerar för visuell
 * separation. Sticky progress-rail på sidan visar var i scrollen man är
 * och tillåter klicka-för-att-hoppa.
 *
 * Lever parallellt med klassiska Dashboard-vyn — inget gammalt flöde
 * påverkas. Switch-tabs (Klassisk vy / Ny vy) sätts in i Dashboard
 * själv när den filen återställts från git.
 *
 * Gating på sektion 3 + 4 finns visuellt men är inaktiv (account-systemet
 * är inte byggt än). Knapparna leder till # tills vidare.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AnnualCostComponents } from "../../types";
import {
  findGridOperator,
  describePowerChargeModel,
  // withVat removed — costComponents är redan inkl moms
  type GridOperatorPricing,
} from "../../data/grid-operators";
import { SE_ZONE_SPOT_PRICE } from "../../data/energy-prices";
import type { SEZone } from "../../types";

interface MinaSidorScrollFlowProps {
  /** Aggregerade kostnader (samma struktur som CostBreakdownCard använder). */
  costComponents: AnnualCostComponents;
  /** Bolagsnamn från fakturadata — driver effekttariff-modellen. */
  gridOperatorName?: string;
  /** Månatliga kWh, från simulering — används för real månadsfördelning. Apr-Mar ordning. */
  monthlyKwh?: number[];
  /** Effektivt pris öre/kWh per månad (om finns) för att räkna real månadskost. */
  monthlyTotalPriceOre?: number[];
  /** SE-zon — driver vilken spotpris-array som används i månadsdiagrammet. */
  seZone?: SEZone;
}

const SECTIONS = [
  { id: "chock", label: "Din kostnad" },
  { id: "vartpengarna", label: "Var pengarna går" },
  { id: "framtiden", label: "Framtiden" },
  { id: "vadgora", label: "Vad du kan göra" },
];

function formatKr(n: number): string {
  return Math.round(n).toLocaleString("sv-SE");
}

export default function MinaSidorScrollFlow({
  costComponents,
  gridOperatorName,
  monthlyKwh,
  monthlyTotalPriceOre,
  seZone = "SE3",
}: MinaSidorScrollFlowProps) {
  // Räkna ut månadskost från real kWh+pris om tillgängligt, annars schablon
  const monthlyKr = monthlyKwh && monthlyTotalPriceOre && monthlyKwh.length === 12
    ? monthlyKwh.map((kwh, i) => kwh * (monthlyTotalPriceOre[i] ?? 0) / 100)
    : undefined;
  const [activeIdx, setActiveIdx] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  // IntersectionObserver för att highlighta aktuell sektion i progress-rail
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.findIndex((el) => el === entry.target);
            if (idx >= 0) setActiveIdx(idx);
          }
        });
      },
      { threshold: 0.4 }
    );

    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (idx: number) => {
    sectionRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Bucket categorize (samma som Step2A)
  const anvandaKr =
    costComponents.spotCostKr +
    costComponents.markupCostKr +
    costComponents.energyTaxKr +
    costComponents.gridTransferFeeKr;
  const effektKr = costComponents.gridPowerChargeKr;
  const fastaKr = costComponents.gridFixedFeeKr + costComponents.elhandelMonthlyFeeKr;
  // Använd costComponents.totalKr som canonical så vi matchar Klassisk vy exakt.
  // (Bucket-summan kan avvika nagra kr pga rundningsackumulering.)
  const totalKr = Math.round(costComponents.totalKr);

  const operator: GridOperatorPricing | null = gridOperatorName
    ? findGridOperator(gridOperatorName)
    : null;
  const hasEffekt = (operator?.hasPowerCharge ?? false) && effektKr > 0;

  return (
    <div className="relative">
      {/* Sticky progress-rail — desktop: vänster sida, mobile: top */}
      <ProgressRail activeIdx={activeIdx} onClick={scrollToSection} />

      {/* Section 1: Chock */}
      <section
        ref={(el) => { sectionRefs.current[0] = el; }}
        id="chock"
        className="flex min-h-[90vh] items-center justify-center bg-bg-warm px-4 py-16"
      >
        <Section1Chock totalKr={totalKr} monthlyKr={monthlyKr} operator={operator} seZone={seZone} />
      </section>

      {/* Section 2: Vart pengarna går */}
      <section
        ref={(el) => { sectionRefs.current[1] = el; }}
        id="vartpengarna"
        className="flex min-h-[90vh] items-center justify-center bg-surface-bright px-4 py-16"
      >
        <Section2VartPengarnaGar
          costComponents={costComponents}
          anvandaKr={anvandaKr}
          effektKr={effektKr}
          fastaKr={fastaKr}
          totalKr={totalKr}
          operator={operator}
          hasEffekt={hasEffekt}
        />
      </section>

      {/* Section 3: Framtiden — kommer FÖRE Vad du kan göra för att skapa motivation */}
      <section
        ref={(el) => { sectionRefs.current[2] = el; }}
        id="framtiden"
        className="flex min-h-[90vh] items-center justify-center bg-bg-warm px-4 py-16"
      >
        <Section4Framtiden totalKr={totalKr} spotCostKr={costComponents.spotCostKr} />
      </section>

      {/* Section 4: Vad du kan göra — efter framtiden för att svara på "vad gör jag åt det?" */}
      <section
        ref={(el) => { sectionRefs.current[3] = el; }}
        id="vadgora"
        className="flex min-h-[90vh] items-center justify-center bg-surface-bright px-4 py-16"
      >
        <Section3VadGora hasEffekt={hasEffekt} anvandaKr={anvandaKr} effektKr={effektKr} fastaKr={fastaKr} totalKr={totalKr} />
      </section>
    </div>
  );
}

/* =========================================================================
   PROGRESS RAIL
   ========================================================================= */

function ProgressRail({ activeIdx, onClick }: { activeIdx: number; onClick: (idx: number) => void }) {
  // Portal till document.body sa fixed-positionen blir relativ till viewport,
  // inte till nagon transformed parent (animate-fade-in pa ResultOverview-wrappern
  // bryter annars containing block och rail:n hamnar mitt i ResultScrollFlow).
  const [mounted, setMounted] = useState(false);
  // Portal-hydration-guard: SSR renderar null, klienten sätter mounted=true efter mount
  // så portalen renderas till document.body (undviker SSR-krasch + fixing-bug med transformed parent).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Desktop: vertikal rail right-aligned strax till vänster om content.
          right-edge sitter ~24px utanför content-edgen, labels expanderar åt vänster
          så de aldrig krockar med content. (content max-w-2xl = 21rem half) */}
      <div className="fixed top-1/2 z-40 hidden -translate-y-1/2 lg:block right-[calc(50%+22.5rem)]">
        <div className="flex flex-col items-end gap-4">
          {SECTIONS.map((sec, idx) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => onClick(idx)}
              className="group flex items-center gap-3"
              aria-label={`Gå till ${sec.label}`}
            >
              <span
                className={`whitespace-nowrap text-xs font-medium transition-all ${
                  activeIdx === idx
                    ? "text-text-primary opacity-100"
                    : "text-text-muted opacity-0 group-hover:opacity-100"
                }`}
              >
                {sec.label}
              </span>
              <div
                className={`rounded-full transition-all ${
                  activeIdx === idx
                    ? "h-2 w-8 bg-brand-500"
                    : "h-2 w-2 bg-border group-hover:bg-brand-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: horisontell rail top — fixed istallet for sticky for samma anledning */}
      <div className="fixed left-0 right-0 top-0 z-40 flex items-center justify-center gap-2 bg-bg-warm/90 px-4 py-2 backdrop-blur-sm lg:hidden">
        {SECTIONS.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => onClick(idx)}
            className={`rounded-full transition-all ${
              activeIdx === idx ? "h-2 w-8 bg-brand-500" : "h-2 w-2 bg-border"
            }`}
            aria-label={`Gå till ${sec.label}`}
          />
        ))}
      </div>
    </>,
    document.body
  );
}

/* =========================================================================
   SECTION 1 — CHOCK
   ========================================================================= */

type ChartVariant = "rolling" | "forward" | "calendar";

const VARIANT_LABELS: Record<ChartVariant, string> = {
  rolling: "Senaste året",
  forward: "Kommande år",
  calendar: "Senaste helåret 2025",
};

const VARIANT_CAPTIONS: Record<ChartVariant, string> = {
  rolling: "Faktiska priser från senaste 12 månaderna · Energimarknadsbyrån / Nord Pool",
  forward: "Uppskattade priser för kommande 12 månader · terminspriser via elpriser24.se",
  calendar: "Genomsnitt från senaste helåret · 2025 spotpriser per månad",
};

const MONTH_NAMES_SV = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const WINTER_MONTH_INDICES = new Set([10, 11, 0, 1, 2]);

function distributeCost(weights: number[], totalKr: number): number[] {
  // Blanda fast (40%) + spotpris-driven (60%) — ger realistisk månadsvariation
  const fixedShare = 0.4;
  const variableShare = 0.6;
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => (totalKr * fixedShare) / 12 + (totalKr * variableShare * w) / totalWeight);
}

function buildChartData(
  variant: ChartVariant,
  totalKr: number,
  seZone: SEZone,
  historic2025: number[] | null
): { bars: number[]; labels: string[]; isWinter: boolean[]; usingRealData: boolean } {
  // Olika spotpris-källor per variant:
  //  - rolling: 12 senaste månaderna = senaste delen av 2025 + början av 2026
  //  - forward: SE_ZONE_SPOT_PRICE 2026 (jan-mar actual + apr-dec terminspriser)
  //  - calendar: hela 2025 (fetched från Supabase)
  const futurePrices = SE_ZONE_SPOT_PRICE[seZone];

  let priceByCalendarIdx: number[];
  let usingRealData = false;

  if (variant === "calendar" && historic2025) {
    priceByCalendarIdx = historic2025;
    usingRealData = true;
  } else if (variant === "rolling") {
    if (historic2025) {
      // Bygg rolling 12 månader: senaste delen av 2025 + början av 2026
      const now = new Date();
      const currentMonthIdx = now.getMonth();
      // Indices: maj förra året (curr - 11) ... apr i år (curr)
      const rollingPrices = new Array(12);
      for (let i = 0; i < 12; i++) {
        const monthIdx = (currentMonthIdx - 11 + i + 12) % 12;
        // Om denna månad redan passerats i ÅR, använd 2026-priser; annars 2025
        const isThisYear = i + (currentMonthIdx - 11) >= 0 && i >= (12 - currentMonthIdx - 1);
        rollingPrices[monthIdx] = isThisYear ? futurePrices[monthIdx] : historic2025[monthIdx];
      }
      priceByCalendarIdx = rollingPrices;
      usingRealData = true;
    } else {
      priceByCalendarIdx = futurePrices;
    }
  } else {
    // forward = SE_ZONE_SPOT_PRICE (terminspriser apr-dec 2026)
    priceByCalendarIdx = futurePrices;
  }

  const costByCalendarIdx = distributeCost(priceByCalendarIdx, totalKr);

  const now = new Date();
  const currentMonthIdx = now.getMonth();

  let monthIndices: number[];
  if (variant === "rolling") {
    monthIndices = Array.from({ length: 12 }, (_, i) => (currentMonthIdx - 11 + i + 12) % 12);
  } else if (variant === "forward") {
    monthIndices = Array.from({ length: 12 }, (_, i) => (currentMonthIdx + i) % 12);
  } else {
    monthIndices = Array.from({ length: 12 }, (_, i) => i);
  }

  const bars = monthIndices.map((idx) => costByCalendarIdx[idx] ?? 0);
  const labels = monthIndices.map((idx) => MONTH_NAMES_SV[idx]);
  const isWinter = monthIndices.map((idx) => WINTER_MONTH_INDICES.has(idx));

  return { bars, labels, isWinter, usingRealData };
}

function Section1Chock({
  totalKr,
  operator,
  seZone,
}: {
  totalKr: number;
  monthlyKr?: number[];
  operator: GridOperatorPricing | null;
  seZone: SEZone;
}) {
  const [variant, setVariant] = useState<ChartVariant>("rolling");

  // Fetch riktiga manadsmedel fran Supabase nar zoner/variant andras
  const [historic2025, setHistoric2025] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Sätter loading synkront i effect-kroppen för att visa spinner direkt när seZone ändras. Medvetet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/monthly-spot-averages?zone=${seZone}&year=2025`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && Array.isArray(data.monthlyAvgsOreExklMoms)) {
          setHistoric2025(data.monthlyAvgsOreExklMoms as number[]);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [seZone]);

  const { bars: monthly, labels: monthLabels, isWinter } = buildChartData(variant, totalKr, seZone, historic2025);
  const maxMonthly = Math.max(...monthly);
  const winterShareKr = monthly.reduce((sum, val, idx) => sum + (isWinter[idx] ? val : 0), 0);
  const winterPct = totalKr > 0 ? Math.round((winterShareKr / totalKr) * 100) : 0;
  const monthlyAvg = totalKr / 12;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Din elräkning
        </div>
        <div className="mb-3 text-5xl font-extrabold leading-none tracking-tight text-text-primary md:text-6xl">
          {formatKr(totalKr)} kr
        </div>
        <div className="mb-6 text-base text-text-muted md:text-lg">
          för el senaste året · apr 2025 – mar 2026
        </div>
        <h2 className="mb-3 text-xl font-bold leading-tight text-text-primary md:text-2xl">
          Det är drygt {formatKr(monthlyAvg)} kr i månaden
        </h2>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-text-secondary md:text-base">
          Vi har räknat fram din uppskattade årliga elkostnad — både elhandel
          och elnät tillsammans — utifrån fakturan du laddade upp.
        </p>
      </header>

      <div className="mb-7 flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-sm text-text-primary">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl text-brand-500">📊</div>
        <p className="leading-relaxed">
          {operator ? (
            <>
              <strong className="font-semibold">Lite över snittet</strong> för en
              villa med {operator.name}. Den största delen av skillnaden ligger i
              hur du använder el — inte vilket bolag du har.
            </>
          ) : (
            <>
              Skillnaden mellan ett genomsnittshus och ditt ligger främst i hur
              ni använder el — inte vilket bolag ni har.
            </>
          )}
        </p>
      </div>

      <div className="border-t border-border pt-6">
        <div className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-text-muted">
          Hur kostnaden fördelar sig över året
        </div>
        <div className="mx-auto grid max-w-lg grid-cols-12 items-end gap-1.5" style={{ height: 140 }}>
          {monthly.map((m, idx) => {
            const heightPct = (m / maxMonthly) * 100;
            return (
              <div
                key={idx}
                className={`rounded-t ${isWinter[idx] ? "bg-brand-900" : "bg-brand-500"}`}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={`${formatKr(m)} kr · ${monthLabels[idx]}`}
              />
            );
          })}
        </div>
        <div className="mx-auto grid max-w-lg grid-cols-12 gap-1.5 pt-2 text-center text-[9px] font-semibold uppercase tracking-wide text-text-muted">
          {monthLabels.map((m, idx) => <span key={`${m}-${idx}`}>{m}</span>)}
        </div>
        {/* kr-labels under varje stapel */}
        <div className="mx-auto grid max-w-lg grid-cols-12 gap-1.5 pt-1 text-center text-[9px] font-semibold tabular-nums text-text-secondary">
          {monthly.map((m, idx) => (
            <span key={`kr-${idx}`} className="leading-tight">{Math.round(m / 100) * 100 >= 1000 ? `${(m / 1000).toFixed(1)}k` : Math.round(m).toString()}</span>
          ))}
        </div>

        {/* Variant-toggle: tre chips */}
        <div className="mx-auto mt-5 flex max-w-lg flex-wrap justify-center gap-2">
          {(["rolling", "forward", "calendar"] as ChartVariant[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={
                variant === v
                  ? "rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
                  : "rounded-full border border-border bg-white px-4 py-1.5 text-xs font-semibold text-text-secondary hover:bg-bg-warm"
              }
            >
              {VARIANT_LABELS[v]}
            </button>
          ))}
        </div>
        {/* Datakälla-caption */}
        <div className="mx-auto mt-2 max-w-lg text-center text-[11px] italic text-text-muted">
          {loading && variant !== "forward" ? "Laddar historiska priser…" : VARIANT_CAPTIONS[variant]}
        </div>
        <div className="mt-3 text-center text-sm text-text-muted">
          <strong className="font-semibold text-text-primary">Vintern står för {winterPct} %</strong>
          {" "}av din årskostnad — drygt {formatKr(winterShareKr)} kr av {formatKr(totalKr)}.
        </div>
      </div>

      <div className="mt-9 text-center text-xs text-text-muted">
        Scrolla för att se vart pengarna tar vägen ↓
      </div>
    </div>
  );
}

/* =========================================================================
   SECTION 2 — VART PENGARNA GÅR
   ========================================================================= */

function Section2VartPengarnaGar({
  costComponents,
  anvandaKr,
  effektKr,
  fastaKr,
  totalKr,
  operator,
  hasEffekt,
}: {
  costComponents: AnnualCostComponents;
  anvandaKr: number;
  effektKr: number;
  fastaKr: number;
  totalKr: number;
  operator: GridOperatorPricing | null;
  hasEffekt: boolean;
}) {
  const [openModal, setOpenModal] = useState<"anvanda" | "effekt" | "fasta" | null>(null);

  const anvandaPct = totalKr > 0 ? (anvandaKr / totalKr) * 100 : 0;
  const effektPct = totalKr > 0 ? (effektKr / totalKr) * 100 : 0;
  const fastaPct = totalKr > 0 ? (fastaKr / totalKr) * 100 : 0;
  const paverkbarPct = Math.round(anvandaPct + effektPct);

  const operatorDesc = operator?.powerChargeModel
    ? describePowerChargeModel(operator.powerChargeModel)
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Vart pengarna går
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Tre sorters kostnader — och olika sätt att påverka dem
        </h2>
        <p className="text-sm text-text-muted">
          Av <strong className="font-semibold text-text-primary">{formatKr(totalKr)} kr</strong> senaste året
        </p>
      </header>

      <div className="mb-1 flex h-14 overflow-hidden rounded-xl shadow-sm">
        <div className="flex items-center justify-center bg-brand-500 text-base font-bold text-white" style={{ flex: anvandaPct }}>
          {Math.round(anvandaPct)} %
        </div>
        {hasEffekt && (
          <div className="flex items-center justify-center bg-cta-orange text-base font-bold text-white" style={{ flex: effektPct }}>
            {Math.round(effektPct)} %
          </div>
        )}
        <div className="flex items-center justify-center text-base font-bold text-white" style={{ flex: fastaPct, background: "#97A39B" }}>
          {Math.round(fastaPct)} %
        </div>
      </div>
      <div className="mb-6 flex text-[10px] font-bold uppercase tracking-wider text-text-muted">
        <span style={{ flex: anvandaPct }} className="pl-1">Det du använder</span>
        {hasEffekt && <span style={{ flex: effektPct }} className="text-center">Effekttopp</span>}
        <span style={{ flex: fastaPct }} className="pr-1 text-right">Fast</span>
      </div>

      <div className="flex flex-col gap-3.5">
        <CostCard
          variant="anvanda"
          title="Det du använder"
          amountKr={anvandaKr}
          desc="Allt det som rör sig med varje kWh — själva elen, skatt, påslag och överföring."
          insightStrong="Använder du mindre, sjunker hela summan."
          actionPills={["Värmepump", "Solceller", "Tilläggsisolering", "Smartare vanor"]}
          onMore={() => setOpenModal("anvanda")}
        />

        {hasEffekt && (
          <CostCard
            variant="effekt"
            title="Effekttoppen"
            amountKr={effektKr}
            desc={
              operator?.powerChargeModel?.numberOfPeaks === 1
                ? "Den enda högsta timmen varje månad räknas — undvik samtidiga laster i höglasttid."
                : `Snittet av dina ${operator?.powerChargeModel?.numberOfPeaks ?? 3} högsta timmar varje månad räknas.`
            }
            insightStrong="Sprider du ut förbrukningen, sjunker den."
            actionPills={["Smart laddning", "Hembatteri", "Tidsstyrning"]}
            onMore={() => setOpenModal("effekt")}
          />
        )}

        <CostCard
          variant="fast"
          title="Fasta avgifter"
          amountKr={fastaKr}
          desc="Abonnemang till nätet och eventuell fast avgift på elavtalet."
          insightStrong="Ligger kvar varje månad oavsett."
          actionPills={["Byt elhandlare", "Mindre säkring"]}
          onMore={() => setOpenModal("fasta")}
        />
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-surface p-4">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-500">!</div>
        <p className="text-sm leading-relaxed text-text-primary">
          <strong className="font-bold text-text-primary">Slutsats:</strong> {paverkbarPct} % av din räkning kan du påverka — antingen genom att använda mindre el{hasEffekt ? ", eller genom att flytta din användning till bättre tider" : ""}. Bara {Math.round(fastaPct)} % är fast.
        </p>
      </div>

      {/* Modaler */}
      {openModal === "anvanda" && (
        <Modal onClose={() => setOpenModal(null)} eyebrow={`Det du använder · ${formatKr(anvandaKr)} kr / år`} title="Vart pengarna går">
          <ComponentRow name="Spotpriset på börsen" amountKr={costComponents.spotCostKr} recipient="elhandlaren" />
          <ComponentRow name="Påslag" amountKr={costComponents.markupCostKr} recipient="elhandlaren" />
          <ComponentRow name="Energiskatt + moms" amountKr={costComponents.energyTaxKr} recipient="staten" />
          <ComponentRow name="Överföring per kWh" amountKr={costComponents.gridTransferFeeKr} recipient="elnatet" />
        </Modal>
      )}

      {openModal === "effekt" && hasEffekt && (
        <Modal onClose={() => setOpenModal(null)} eyebrow="Effekttoppen" title="Så räknas effekttoppen hos dig">
          {operator && operatorDesc && (
            <div className="mb-4 rounded-xl bg-orange-50 p-4 text-sm leading-relaxed">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-cta-orange">
                Ditt nätbolag · {operator.name}
              </div>
              <div className="mb-2 text-xs text-text-muted">
                Identifierat från din faktura · uppdaterat {operator.lastVerified}
              </div>
              <ul className="space-y-1">
                {operatorDesc.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="font-bold text-cta-orange">→</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mb-1 border-b border-border pb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Senaste året (inkl moms) — fördelat på
          </div>
          <ComponentRow
            name={operator?.powerChargeModel ? `Effektavgift (snitt ${operator.powerChargeModel.numberOfPeaks} toppar)` : "Effektavgift"}
            amountKr={effektKr}
            recipient="elnatet"
          />
        </Modal>
      )}

      {openModal === "fasta" && (
        <Modal onClose={() => setOpenModal(null)} eyebrow={`Fasta avgifter · ${formatKr(fastaKr)} kr / år`} title="Vart pengarna går">
          <ComponentRow name="Nätabonnemang" amountKr={costComponents.gridFixedFeeKr} recipient="elnatet" />
          {costComponents.elhandelMonthlyFeeKr > 0 && (
            <ComponentRow name="Fast avgift på elavtalet" amountKr={costComponents.elhandelMonthlyFeeKr} recipient="elhandlaren" />
          )}
        </Modal>
      )}
    </div>
  );
}

/* =========================================================================
   SECTION 3 — VAD DU KAN GÖRA
   ========================================================================= */

function Section3VadGora({
  hasEffekt, anvandaKr, effektKr, fastaKr, totalKr,
}: {
  hasEffekt: boolean;
  anvandaKr: number;
  effektKr: number;
  fastaKr: number;
  totalKr: number;
}) {
  // Realistiska procent baserat på branschdata
  const anvandaSavings = Math.round(anvandaKr * 0.55);    // Värmepump+solceller+isolering ~55% av kWh-kostnaden
  const effektSavings = hasEffekt ? Math.round(effektKr * 0.30) : 0;  // Smart laddning + tidstyrning ~30%
  const fastSavings = Math.round(fastaKr * 0.15 + anvandaKr * 0.05);  // Mindre säkring + byt elhandlare
  const totalSavings = anvandaSavings + effektSavings + fastSavings;
  const savingsPct = totalKr > 0 ? Math.round((totalSavings / totalKr) * 100) : 0;

  // Visible actions (gratis, lågt-tröskel) räknas som mindre andel
  const smartaVanorKr = Math.round(anvandaKr * 0.04);       // 3-5% av kWh-kostnad
  const flyttaLastKr = hasEffekt ? Math.round(effektKr * 0.12) : 0; // ~12% av effektkostnad
  const bytElhandlareKr = Math.round(anvandaKr * 0.04);     // ~4% av kWh-kostnad

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Vad du kan göra
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Tre spakar du kan dra i
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          Här är ett enkelt tips från varje kategori — sånt du kan göra direkt, gratis. När du skapar ett konto räknar vi också på <strong className="font-semibold text-text-primary">de större åtgärderna</strong> som passar just ditt hus.
        </p>
      </header>

      <div className="mb-6 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-5 text-center text-white">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest opacity-85">Total sparpotential</div>
        <div className="mb-1 text-3xl font-bold tracking-tight">upp till {formatKr(totalSavings)} kr</div>
        <div className="text-sm opacity-80">per år · {savingsPct} % av din nuvarande räkning</div>
      </div>

      <div className="flex flex-col gap-3.5">
        <ActionCard
          variant="anvanda"
          title="Använd mindre"
          savings={`spara upp till ${formatKr(anvandaSavings)} kr/år`}
          desc="Allt som rör sig med din kWh-förbrukning. Den största kategorin — även där du kan investera mest."
          visibleAction={{ emoji: "💡", name: "Smartare vanor", effort: "Gratis · börja idag", saving: `~ ${formatKr(smartaVanorKr)} kr` }}
          moreTitle="Vill du veta vad du sparar med värmepump, solceller och bättre isolering?"
          moreDesc="Skapa konto så räknar vi sparpotential och återbetalningstid för just ditt hus."
        />

        {hasEffekt && (
          <ActionCard
            variant="effekt"
            title="Kapa effekttoppen"
            savings={`spara upp till ${formatKr(effektSavings)} kr/år`}
            desc="Ditt nätbolag räknar dina högsta timmar varje månad — flytta laster för att halvera deras vikt."
            visibleAction={{ emoji: "🌙", name: "Flytta tvätt och disk till kvällen", effort: "Gratis · ändra rutiner", saving: `~ ${formatKr(flyttaLastKr)} kr` }}
            moreTitle="Vill du veta om smart laddning eller hembatteri lönar sig?"
            moreDesc="Vi räknar ROI baserat på just ditt elnät och din konsumtion."
          />
        )}

        <ActionCard
          variant="fast"
          title="Se över abonnemang"
          savings={`spara upp till ${formatKr(fastSavings)} kr/år`}
          desc="Snabbaste vinsterna — kräver bara ett samtal eller några klick. Inga förändringar i dina vanor."
          visibleAction={{ emoji: "📞", name: "Byt elhandlare", effort: "15 min · direkt effekt", saving: `~ ${formatKr(bytElhandlareKr)} kr` }}
          moreTitle="Funderar du på att gå ner en huvudsäkring?"
          moreDesc="Vi kollar din toppförbrukning och säger om det är säkert — och hur mycket du sparar."
        />
      </div>

      <SignupCta
        eyebrow="★ Ditt nästa steg"
        title="Få en personlig sparplan för ditt hus"
        desc="Med ett gratis konto räknar vi exakt sparpotential för varje åtgärd, i vilken ordning du bör göra dem, och sparar din historik så du kan följa utvecklingen månad för månad."
      />
    </div>
  );
}

/* =========================================================================
   SECTION 4 — FRAMTIDEN
   ========================================================================= */

function Section4Framtiden({
  totalKr, spotCostKr,
}: {
  totalKr: number;
  spotCostKr: number;
}) {
  // Scenarie-deltas baseras på spotpris-känslighet (det enda som varierar)
  // Energikrisen 2022: spotpris 2.4× → spotCost ökar med 1.4× (140%)
  const krisDelta = Math.round(spotCostKr * 1.4);
  const krisTotal = totalKr + krisDelta;
  // Grön omställning: spotpris -25% → spotCost minskar med 0.25×
  const gronDelta = Math.round(spotCostKr * 0.25);
  const gronTotal = totalKr - gronDelta;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Framtidens elpriser
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Vad händer om priserna ändras?
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-primary md:text-base">
          Du betalar <strong className="font-semibold">{formatKr(totalKr)} kr/år</strong> idag. Här är två ytterscenarier — det värsta och det bästa fallet. När du skapar konto räknar vi även på de mer sannolika alternativen däremellan.
        </p>
      </header>

      <div className="flex flex-col gap-3.5">
        <ScenarioCard
          variant="bad"
          tagline="Worst case · Sett innan"
          title="Energikrisen 2022 återvänder"
          deltaText={`+${formatKr(krisDelta)} kr`}
          todayKr={totalKr}
          scenarioKr={krisTotal}
          isHigher={true}
          explanation="Spotpriset i SE3 låg vintern 2022 i snitt på 120 öre/kWh — mer än dubbelt så högt som nu. Krig, gasbrist eller en kall vinter kan trigga det igen. Sannolikhet: medel — det har hänt en gång det senaste decenniet."
        />

        <MoreScenariosBlock />

        <ScenarioCard
          variant="good"
          tagline="Best case · 5–10 år bort"
          title="Massiv utbyggnad av sol och vind"
          deltaText={`−${formatKr(gronDelta)} kr`}
          todayKr={totalKr}
          scenarioKr={gronTotal}
          isHigher={false}
          explanation="Om Sverige bygger ut sol, vind och batterier snabbare än beräknat kan elpriset pressas ned. Sannolikhet: låg — kräver politisk vilja och snabbt utbyggd infrastruktur."
        />
      </div>

      <div className="mt-7 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-7 text-center text-white">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest opacity-85">Sammanfattning</div>
        <div className="mx-auto mb-3 max-w-md text-2xl font-bold leading-tight tracking-tight md:text-3xl">
          I tre av fyra scenarier blir det dyrare.
        </div>
        <p className="mx-auto max-w-md text-sm leading-relaxed opacity-90">
          Du kan inte påverka spotpriset, EU-marknaden eller stålindustrin. <strong className="font-bold text-white">Men i alla fyra scenarierna har du nytta av att använda mindre el</strong> — varje sparad kWh skyddar dig oavsett vad som händer.
        </p>
      </div>

      <SignupCta
        eyebrow="★ Ditt nästa steg"
        title="Få en personlig sparplan + alla scenarier"
        desc="Vi räknar de två sannolika scenarierna, sparpotential för alla åtgärder, sparar historik och meddelar när priserna ändras."
      />
    </div>
  );
}

/* =========================================================================
   SUB-COMPONENTS
   ========================================================================= */

function CostCard({
  variant, title, amountKr, desc, insightStrong, actionPills, onMore,
}: {
  variant: "anvanda" | "effekt" | "fast";
  title: string;
  amountKr: number;
  desc: string;
  insightStrong: string;
  actionPills: string[];
  onMore: () => void;
}) {
  const colors = {
    anvanda: { border: "border-l-brand-500", text: "text-brand-500", pillBg: "bg-brand-50", pillText: "text-brand-600" },
    effekt: { border: "border-l-cta-orange", text: "text-cta-orange", pillBg: "bg-orange-50", pillText: "text-orange-700" },
    fast: { border: "border-l-[#97A39B]", text: "text-[#5E6961]", pillBg: "bg-gray-100", pillText: "text-gray-700" },
  }[variant];

  return (
    <div className={`rounded-2xl border border-border ${colors.border} border-l-[5px] bg-white p-5`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div className="text-lg font-bold tracking-tight text-text-primary">{title}</div>
        <div className={`text-xl font-bold tracking-tight ${colors.text}`}>{formatKr(amountKr)} kr</div>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-text-secondary">
        {desc} <strong className="font-semibold text-text-primary">{insightStrong}</strong>
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {actionPills.map((pill) => (
          <button key={pill} type="button" className={`rounded-full ${colors.pillBg} ${colors.pillText} px-3 py-1 text-xs font-medium hover:brightness-95`}>
            → {pill}
          </button>
        ))}
      </div>
      <button type="button" onClick={onMore} className="text-xs font-medium text-text-muted hover:text-text-primary">
        Vart går pengarna? →
      </button>
    </div>
  );
}

function ActionCard({
  variant, title, savings, desc, visibleAction, moreTitle, moreDesc,
}: {
  variant: "anvanda" | "effekt" | "fast";
  title: string;
  savings: string;
  desc: string;
  visibleAction: { emoji: string; name: string; effort: string; saving: string };
  moreTitle: string;
  moreDesc: string;
}) {
  const colors = {
    anvanda: "border-l-brand-500 [&_.savings]:text-brand-500",
    effekt: "border-l-cta-orange [&_.savings]:text-cta-orange",
    fast: "border-l-[#97A39B] [&_.savings]:text-[#5E6961]",
  }[variant];

  return (
    <div className={`rounded-2xl border border-border ${colors} border-l-[5px] bg-white p-5`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div className="text-lg font-bold tracking-tight text-text-primary">{title}</div>
        <div className="savings text-sm font-semibold">{savings}</div>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-text-muted">{desc}</p>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-bg-warm p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-lg">{visibleAction.emoji}</div>
          <div>
            <div className="text-sm font-semibold text-text-primary">{visibleAction.name}</div>
            <div className="text-xs text-text-muted">{visibleAction.effort}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-text-primary tabular-nums">{visibleAction.saving}</div>
          <div className="text-[10px] text-text-muted">per år</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand-200/40 bg-bg-warm p-3.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg">✨</div>
        <div className="flex-1">
          <div className="text-sm font-bold leading-tight text-text-primary">{moreTitle}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{moreDesc}</div>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({
  variant, tagline, title, deltaText, todayKr, scenarioKr, explanation,
}: {
  variant: "bad" | "good";
  tagline: string;
  title: string;
  deltaText: string;
  todayKr: number;
  scenarioKr: number;
  isHigher: boolean;
  explanation: string;
}) {
  const colors = variant === "bad"
    ? { border: "border-l-[#E05C5C]", barFill: "bg-[#E05C5C]", deltaText: "text-[#C0392B]" }
    : { border: "border-l-brand-500", barFill: "bg-brand-500", deltaText: "text-brand-500" };

  const max = Math.max(todayKr, scenarioKr);

  return (
    <div className={`rounded-2xl border border-border ${colors.border} border-l-[5px] bg-white p-5`}>
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">{tagline}</div>
          <div className="text-lg font-bold leading-tight tracking-tight text-text-primary">{title}</div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-extrabold leading-none tracking-tight tabular-nums ${colors.deltaText}`}>
            {deltaText}
          </div>
          <div className="mt-1 text-xs text-text-muted">per år</div>
        </div>
      </div>
      <div className="my-3 grid grid-cols-[60px_1fr] items-center gap-3 text-xs">
        <span className="text-text-muted">Idag</span>
        <div className="h-4 rounded bg-bg-warm">
          <div className="flex h-full items-center justify-end rounded bg-brand-900 px-2 text-[10px] font-bold text-white" style={{ width: `${(todayKr / max) * 100}%` }}>
            {formatKr(todayKr)}
          </div>
        </div>
        <span className="text-text-muted">Scenariot</span>
        <div className="h-4 rounded bg-bg-warm">
          <div className={`flex h-full items-center justify-end rounded ${colors.barFill} px-2 text-[10px] font-bold text-white`} style={{ width: `${(scenarioKr / max) * 100}%` }}>
            {formatKr(scenarioKr)} kr/år
          </div>
        </div>
      </div>
      <p className="border-t border-border pt-3 text-sm leading-relaxed text-text-primary">
        {explanation}
      </p>
    </div>
  );
}

function MoreScenariosBlock() {
  return (
    <div className="rounded-2xl border border-brand-200/40 bg-bg-warm p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">✨</div>
        <div>
          <div className="mb-1 text-base font-bold tracking-tight text-text-primary">Två scenarier till — räknade för dig</div>
          <div className="text-xs leading-relaxed text-text-muted">
            Mellan ytterligheterna finns de mer sannolika framtiderna. Skapa konto så visar vi exakta belopp för just din kostnad.
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl bg-white p-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">Stålboom i norr</div>
            <div className="mt-0.5 text-[11px] text-text-muted">H2 Green Steel + LKAB drar enorm el · sannolikhet hög</div>
          </div>
          <span className="text-xs font-semibold text-brand-500">se beloppet →</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white p-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">EU-priserna sammankopplas</div>
            <div className="mt-0.5 text-[11px] text-text-muted">Sverige följer Europas prisnivå · sannolikhet mycket hög</div>
          </div>
          <span className="text-xs font-semibold text-brand-500">se beloppet →</span>
        </div>
      </div>
    </div>
  );
}

function SignupCta({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mt-7 rounded-2xl border border-border bg-white p-7 text-center">
      <div className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-500">{eyebrow}</div>
      <div className="mb-3 text-xl font-bold leading-tight tracking-tight text-text-primary md:text-2xl">{title}</div>
      <p className="mx-auto mb-5 max-w-md text-sm leading-relaxed text-text-muted">{desc}</p>
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-2xl bg-brand-500/60 px-7 py-4 text-base font-bold text-white shadow-lg disabled:opacity-70"
      >
        Skapa konto — gratis (kommer snart)
      </button>
      <div className="mt-3 text-xs text-text-muted">
        <strong className="font-semibold text-text-primary">Inga kortuppgifter</strong> · Magic link via mejl · Tar 30 sek
      </div>
    </div>
  );
}

/* Modal — bottom sheet på mobile, centered på desktop */

function Modal({ onClose, eyebrow, title, children }: { onClose: () => void; eyebrow: string; title: string; children: React.ReactNode }) {
  // Render via portal till document.body så positionen är relativ till viewport,
  // inte till någon transformed parent (sticky progress-rail har transform).
  const [mounted, setMounted] = useState(false);
  // Portal-hydration-guard + overflow-lock: SSR renderar null, klienten aktiverar modal
  // via portal till document.body (undviker SSR-krasch + fixing-bug med transformed parent).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg-warm p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-brand-500">{eyebrow}</div>
        <div className="mb-4 text-lg font-bold tracking-tight text-text-primary">{title}</div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border bg-transparent py-3 text-sm font-medium text-text-primary hover:bg-white"
        >
          Stäng
        </button>
      </div>
    </div>,
    document.body
  );
}

function ComponentRow({ name, amountKr, recipient }: { name: string; amountKr: number; recipient: "elhandlaren" | "elnatet" | "staten" }) {
  const recipientStyle = {
    elhandlaren: "bg-brand-50 text-brand-600",
    elnatet: "bg-orange-50 text-orange-700",
    staten: "bg-gray-100 text-gray-600",
  }[recipient];
  const recipientLabel = { elhandlaren: "elhandlaren", elnatet: "elnätet", staten: "staten" }[recipient];

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-text-primary">{name}</span>
      <span className="text-sm font-semibold tabular-nums text-text-primary">{formatKr(amountKr)} kr</span>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${recipientStyle}`}>{recipientLabel}</span>
    </div>
  );
}
