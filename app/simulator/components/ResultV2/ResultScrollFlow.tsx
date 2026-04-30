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
import type { SEZone } from "../../types";
import MotGrannar from "./MotGrannar";
import Energyscore from "./Energyscore";

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
  /** Geokodad latitud — drivar "Mot dina grannar"-jämförelsen via lib/comparison. */
  latitude?: number;
  /** Geokodad longitud — drivar "Mot dina grannar"-jämförelsen via lib/comparison. */
  longitude?: number;
  /** Husets uppvärmda area (m²) — aktiverar kr/m²-jämförelse i "Mot grannar". */
  area?: number;
  /** Användarens uppvärmningssätt — för fjärrvärme-disclaimer i "Mot grannar". */
  heatingTypes?: import("../../types").HeatingType[];
  /** Konkret besparing från rekommenderade åtgärder — drivar Energyscore-möjligheten. */
  potentialSavingsKr?: number;
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
  // monthlyKwh, monthlyTotalPriceOre — kvar i interface för API-stabilitet
  // men används inte längre sedan månads-charten flyttats från Section 1.
  seZone = "SE3",
  latitude,
  longitude,
  area,
  heatingTypes,
  potentialSavingsKr,
}: MinaSidorScrollFlowProps) {
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
        <Section1Chock
          totalKr={totalKr}
          operator={operator}
          seZone={seZone}
          latitude={latitude}
          longitude={longitude}
          area={area}
          heatingTypes={heatingTypes}
          potentialSavingsKr={potentialSavingsKr}
        />
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
          Alla sektioner alltid synliga — aktiv är mörk/bold, inaktiva är ljusare. */}
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
                className={`whitespace-nowrap text-xs transition-all ${
                  activeIdx === idx
                    ? "font-bold text-text-primary"
                    : "font-medium text-text-muted opacity-60 group-hover:opacity-100 group-hover:text-text-secondary"
                }`}
              >
                {sec.label}
              </span>
              <div
                className={`rounded-full transition-all ${
                  activeIdx === idx
                    ? "h-2.5 w-8 bg-brand-500"
                    : "h-2 w-2 bg-border opacity-60 group-hover:bg-brand-300 group-hover:opacity-100"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: horisontell rail top — alla labels alltid synliga, aktiv är mörk/bold. */}
      <div className="fixed left-0 right-0 top-0 z-40 flex items-center justify-center gap-1 bg-bg-warm/95 px-2 py-2 backdrop-blur-sm lg:hidden">
        {SECTIONS.map((sec, idx) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => onClick(idx)}
            className={`flex-1 rounded-full px-2 py-1 text-[10px] transition-all ${
              activeIdx === idx
                ? "bg-brand-500 font-bold text-white"
                : "font-medium text-text-muted opacity-60 hover:opacity-100"
            }`}
            aria-label={`Gå till ${sec.label}`}
          >
            <span className="block truncate">{sec.label}</span>
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}

/* =========================================================================
   SECTION 1 — DIN KOSTNAD
   Hero (totalsumma) + insight bubble + Mot dina grannar + Energyscore.
   Den gamla månads-fördelningschart:en är borttagen — den passar bättre
   som deep-dive i "Vart pengarna går"-sektionen senare.
   ========================================================================= */

function Section1Chock({
  totalKr,
  operator,
  seZone,
  latitude,
  longitude,
  area,
  heatingTypes,
  potentialSavingsKr,
}: {
  totalKr: number;
  operator: GridOperatorPricing | null;
  seZone: SEZone;
  latitude?: number;
  longitude?: number;
  area?: number;
  heatingTypes?: import("../../types").HeatingType[];
  potentialSavingsKr?: number;
}) {
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

      {/* Mot dina grannar — modellerad jämförelse via lib/comparison */}
      <MotGrannar
        yearlyKr={totalKr}
        latitude={latitude}
        longitude={longitude}
        seZone={seZone}
        area={area}
        heatingTypes={heatingTypes}
      />

      {/* Energyscore — gauge + möjlighet att förbättra (kr) */}
      <Energyscore
        yearlyKr={totalKr}
        latitude={latitude}
        longitude={longitude}
        seZone={seZone}
        potentialSavingsKr={potentialSavingsKr}
      />

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
