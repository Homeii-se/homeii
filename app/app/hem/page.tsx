"use client";

/**
 * Hem — huvudvyn när Sofia loggat in.
 *
 * Speglar teaser-flödet (publika ResultScrollFlow) i fyra sektioner —
 * "Din kostnad", "Vart pengarna går", "Framtiden", "Vad du kan göra" —
 * men med "låsen borttagna":
 *   - Inga "Skapa konto"-CTA (Sofia är inloggad)
 *   - Sektion 4 visar specifika åtgärder från engine v2, inte
 *     teaser-tipsen ("smartare vanor 4%")
 *   - Klick på en åtgärd leder till `/app/min-plan` för djupdyk
 *
 * Datakälla v0.1: `homeii-state` localStorage. Migreras till Supabase
 * när Sparrs PR #9C landar — UI-koden är oförändrad.
 *
 * Återanvänder direkt: MotGrannar, Energyscore, RecommendationCard.
 */

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { loadState } from "../../simulator/storage";
import { calculateThreeScenarios } from "../../simulator/simulation/scenarios";
import MotGrannar from "../../simulator/components/ResultV2/MotGrannar";
import Energyscore from "../../simulator/components/ResultV2/Energyscore";
import { UPGRADE_DEFINITIONS } from "../../simulator/data/upgrade-catalog";
import { findGridOperator, describePowerChargeModel } from "../../simulator/data/grid-operators";
import type {
  SimulatorState,
  Recommendation,
  BillData,
  RefinementAnswers,
  SEZone,
  AnnualCostComponents,
} from "../../simulator/types";
import type { BillContext } from "../../../lib/comparison";

function formatKr(n: number): string {
  return Math.round(n).toLocaleString("sv-SE");
}

export default function HemPage() {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  // Pre-hydration: render skelett-tomt så server/client-HTML matchar.
  if (!hydrated) return <div className="min-h-screen bg-bg-warm" />;

  if (
    !state?.billData ||
    !state?.recommendations ||
    state.recommendations.recommendations.length === 0
  ) {
    return <EmptyState />;
  }

  return <HemView state={state} />;
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
            Hem
          </div>
          <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">
            Vi behöver din faktura först
          </h1>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
            För att vi ska kunna räkna fram din analys och dina personliga
            rekommendationer behöver vi din senaste elräkning. Ladda upp
            den så bygger vi upp en bild av just ditt hus.
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
   HEM-VIEW — huvudvyn när Sofia har data
   ========================================================================= */

function HemView({ state }: { state: SimulatorState }) {
  const { billData, refinement, recommendations, seZone, assumptions } = state;
  const billDataNonNull = billData!;
  const recommendationsNonNull = recommendations!;
  const recommendedIds = useMemo(
    () => recommendationsNonNull.recommendations.map((r) => r.upgradeId),
    [recommendationsNonNull],
  );

  // Beräkna scenario-data för MotGrannar + Energyscore + Section 2.
  // Vi skickar inte tmyData — kör legacy 12-day pipeline här (sub-sekund)
  // istället för 8760 (~10s). Cache-strategi (Punkt C4) lyfts senare.
  const threeScenarios = useMemo(() => {
    return calculateThreeScenarios(
      billDataNonNull,
      refinement,
      seZone,
      assumptions,
      recommendedIds,
      undefined,
    );
  }, [billDataNonNull, refinement, seZone, assumptions, recommendedIds]);

  const costComponents = threeScenarios.currentSituation.costComponents;
  const potentialSavingsKr = threeScenarios.potentialSavingsKr;
  // Använd canonical totalKr från modellen (samma värde som visas i Sektion 2).
  // Tidigare räknade vi billData.costPerMonth × 12 vilket inte alltid matchar
  // modellens summa eftersom modellen kan rekonstruera kostnaden från grunden.
  const yearlyKr = Math.round(costComponents.totalKr);

  return (
    <div className="bg-bg-warm">
      {/* Section 1 — Din kostnad */}
      <section className="px-4 py-12 md:py-16">
        <Section1Cost
          yearlyKr={yearlyKr}
          billData={billDataNonNull}
          refinement={refinement}
          seZone={seZone}
          potentialSavingsKr={potentialSavingsKr}
        />
      </section>

      {/* Section 2 — Vart pengarna går */}
      <section className="bg-surface-bright px-4 py-12 md:py-16">
        <Section2WhereMoneyGoes
          costComponents={costComponents}
          gridOperatorName={assumptions?.gridOperator ?? billDataNonNull.natAgare}
        />
      </section>

      {/* Section 3 — Framtiden (kort version, länk till uppföljning för djup) */}
      <section className="px-4 py-12 md:py-16">
        <Section3Future
          yearlyKr={yearlyKr}
          spotCostKr={costComponents.spotCostKr}
        />
      </section>

      {/* Section 4 — Vad du kan göra (specifika åtgärder från engine v2) */}
      <section className="bg-surface-bright px-4 py-12 md:py-16">
        <Section4Actions
          recommendations={recommendationsNonNull.recommendations}
          totalSavingsKr={recommendationsNonNull.totalYearlySavingsKr}
          yearlyKr={yearlyKr}
        />
      </section>
    </div>
  );
}

/* =========================================================================
   SECTION 1 — Din kostnad (med MotGrannar + Energyscore)
   ========================================================================= */

function Section1Cost({
  yearlyKr,
  billData,
  refinement,
  seZone,
  potentialSavingsKr,
}: {
  yearlyKr: number;
  billData: BillData;
  refinement: RefinementAnswers;
  seZone: SEZone;
  potentialSavingsKr: number;
}) {
  const monthlyAvg = yearlyKr / 12;
  const operator = billData.natAgare ? findGridOperator(billData.natAgare) : null;

  // Bygg BillContext för MotGrannar (drivar kr-konvertering via cost-model)
  const billContext: BillContext = useMemo(
    () => ({
      seZone,
      gridOperator: operator?.name,
      gridFixedFeeKr: operator?.fixedFeeKrPerMonth,
      gridTransferFeeOre: operator?.transferFeeOrePerKwh,
      gridPowerChargeKrPerKw: operator?.powerChargeKrPerKw,
      gridHasPowerCharge: operator?.hasPowerCharge,
    }),
    [operator, seZone],
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Din elräkning
        </div>
        <div className="mb-3 text-5xl font-extrabold leading-none tracking-tight text-text-primary md:text-6xl">
          {formatKr(yearlyKr)} kr
        </div>
        <div className="mb-6 text-base text-text-muted md:text-lg">
          för el senaste året
        </div>
        <h2 className="mb-3 text-xl font-bold leading-tight text-text-primary md:text-2xl">
          Det är drygt {formatKr(monthlyAvg)} kr i månaden
        </h2>
      </header>

      {/* Mot dina grannar */}
      <MotGrannar
        yearlyKr={yearlyKr}
        latitude={billData.latitude}
        longitude={billData.longitude}
        seZone={seZone}
        area={refinement.area}
        heatingTypes={
          refinement.heatingTypes ??
          (refinement.heatingType ? [refinement.heatingType] : undefined)
        }
        billData={billContext}
      />

      {/* Energy score */}
      <Energyscore
        yearlyKr={yearlyKr}
        latitude={billData.latitude}
        longitude={billData.longitude}
        seZone={seZone}
        potentialSavingsKr={potentialSavingsKr}
      />
    </div>
  );
}

/* =========================================================================
   SECTION 2 — Vart pengarna går (kompakt: 3 buckets, ingen modal)
   ========================================================================= */

function Section2WhereMoneyGoes({
  costComponents,
  gridOperatorName,
}: {
  costComponents: AnnualCostComponents;
  gridOperatorName: string | undefined;
}) {
  const operator = gridOperatorName ? findGridOperator(gridOperatorName) : null;
  const hasEffekt =
    (operator?.hasPowerCharge ?? false) && costComponents.gridPowerChargeKr > 0;

  const anvandaKr =
    costComponents.spotCostKr +
    costComponents.markupCostKr +
    costComponents.energyTaxKr +
    costComponents.gridTransferFeeKr;
  const effektKr = costComponents.gridPowerChargeKr;
  const fastaKr =
    costComponents.gridFixedFeeKr + costComponents.elhandelMonthlyFeeKr;
  const totalKr = Math.round(costComponents.totalKr);

  const anvandaPct = totalKr > 0 ? (anvandaKr / totalKr) * 100 : 0;
  const effektPct = totalKr > 0 ? (effektKr / totalKr) * 100 : 0;
  const fastaPct = totalKr > 0 ? (fastaKr / totalKr) * 100 : 0;
  const paverkbarPct = Math.round(anvandaPct + effektPct);

  // Modal-state. null = ingen öppen. Pattern speglar ResultScrollFlow.
  const [openModal, setOpenModal] = useState<"anvanda" | "effekt" | "fasta" | null>(null);

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

      {/* Bucket-bar */}
      <div className="mb-1 flex h-14 overflow-hidden rounded-xl shadow-sm">
        <div
          className="flex items-center justify-center bg-brand-500 text-base font-bold text-white"
          style={{ flex: anvandaPct }}
        >
          {Math.round(anvandaPct)} %
        </div>
        {hasEffekt && (
          <div
            className="flex items-center justify-center bg-cta-orange text-base font-bold text-white"
            style={{ flex: effektPct }}
          >
            {Math.round(effektPct)} %
          </div>
        )}
        <div
          className="flex items-center justify-center text-base font-bold text-white"
          style={{ flex: fastaPct, background: "#97A39B" }}
        >
          {Math.round(fastaPct)} %
        </div>
      </div>
      <div className="mb-6 flex text-[10px] font-bold uppercase tracking-wider text-text-muted">
        <span style={{ flex: anvandaPct }} className="pl-1">
          Det du använder
        </span>
        {hasEffekt && (
          <span style={{ flex: effektPct }} className="text-center">
            Effekttopp
          </span>
        )}
        <span style={{ flex: fastaPct }} className="pr-1 text-right">
          Fast
        </span>
      </div>

      {/* Bucket-kort med action pills + "Vart går pengarna?"-knapp */}
      <div className="flex flex-col gap-3.5">
        <BucketCard
          variant="anvanda"
          title="Det du använder"
          amountKr={anvandaKr}
          desc="Allt det som rör sig med varje kWh — själva elen, skatt, påslag och överföring."
          insightStrong="Använder du mindre, sjunker hela summan."
          actionPills={["Värmepump", "Solceller", "Tilläggsisolering", "Smartare vanor"]}
          onMore={() => setOpenModal("anvanda")}
        />

        <BucketCard
          variant="effekt"
          title="Effekttoppen"
          amountKr={effektKr}
          desc={
            hasEffekt
              ? operator?.powerChargeModel?.numberOfPeaks === 1
                ? "Den enda högsta timmen varje månad räknas — undvik samtidiga laster i höglasttid."
                : `Snittet av dina ${operator?.powerChargeModel?.numberOfPeaks ?? 3} högsta timmar varje månad räknas.`
              : `${operator?.name ?? "Ditt nätbolag"} har just nu ingen effektavgift — du betalar inget extra för dina topptimmar.`
          }
          insightStrong={
            hasEffekt
              ? "Sprider du ut förbrukningen, sjunker den."
              : "Men det är en växande modell — fler nätbolag inför detta."
          }
          actionPills={hasEffekt ? ["Smart laddning", "Hembatteri", "Tidsstyrning"] : []}
          onMore={() => setOpenModal("effekt")}
        />

        <BucketCard
          variant="fast"
          title="Fasta avgifter"
          amountKr={fastaKr}
          desc="Abonnemang till nätet och eventuell fast avgift på elavtalet."
          insightStrong="Ligger kvar varje månad oavsett."
          actionPills={["Byt elhandlare", "Mindre säkring"]}
          onMore={() => setOpenModal("fasta")}
        />
      </div>

      {/* Slutsats */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-surface p-4">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-500">
          !
        </div>
        <p className="text-sm leading-relaxed text-text-primary">
          <strong className="font-bold text-text-primary">Slutsats:</strong>{" "}
          {paverkbarPct} % av din räkning kan du påverka — antingen genom att använda
          mindre el{hasEffekt ? ", eller genom att flytta din användning till bättre tider" : ""}.
          Bara {Math.round(fastaPct)} % är fast.
        </p>
      </div>

      {/* Energy Buddy-callout — uppmuntra dialog istället för att gissa */}
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-brand-50/60 p-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg text-white">
          💬
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-primary">
            Frågor om vad varje del betyder?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Prata med <strong className="font-semibold text-brand-600">Energy Buddy</strong>{" "}
            — vår AI-rådgivare som kan din analys och svarar på vad du undrar över. Hon ligger längst ner till höger.
          </p>
        </div>
      </div>

      {/* Modaler */}
      {openModal === "anvanda" && (
        <Modal
          onClose={() => setOpenModal(null)}
          eyebrow={`Det du använder · ${formatKr(anvandaKr)} kr / år`}
          title="Vart pengarna går"
        >
          <ComponentRow name="Spotpriset på börsen" amountKr={costComponents.spotCostKr} recipient="elhandlaren" />
          <ComponentRow name="Påslag" amountKr={costComponents.markupCostKr} recipient="elhandlaren" />
          <ComponentRow name="Energiskatt + moms" amountKr={costComponents.energyTaxKr} recipient="staten" />
          <ComponentRow name="Överföring per kWh" amountKr={costComponents.gridTransferFeeKr} recipient="elnatet" />
        </Modal>
      )}

      {openModal === "effekt" && hasEffekt && operator?.powerChargeModel && (
        <Modal
          onClose={() => setOpenModal(null)}
          eyebrow="Effekttoppen"
          title="Så räknas effekttoppen hos dig"
        >
          <div className="mb-4 rounded-xl bg-orange-50 p-4 text-sm leading-relaxed">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-cta-orange">
              Ditt nätbolag · {operator.name}
            </div>
            <div className="mb-2 text-xs text-text-muted">
              Identifierat från din faktura · uppdaterat {operator.lastVerified}
            </div>
            <ul className="space-y-1">
              {describePowerChargeModel(operator.powerChargeModel).map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="font-bold text-cta-orange">→</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mb-1 border-b border-border pb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            Senaste året (inkl moms) — fördelat på
          </div>
          <ComponentRow
            name={`Effektavgift (snitt ${operator.powerChargeModel.numberOfPeaks} toppar)`}
            amountKr={effektKr}
            recipient="elnatet"
          />
        </Modal>
      )}

      {openModal === "effekt" && !hasEffekt && (
        <Modal
          onClose={() => setOpenModal(null)}
          eyebrow="Effekttoppen"
          title="Vad är en effektavgift?"
        >
          <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
            <p>
              Effektavgift är en del av nätavgiften som vissa nätbolag tar ut baserat
              på dina <strong className="font-semibold text-text-primary">högsta strömtimmar</strong>{" "}
              varje månad — inte bara på hur många kWh du använder totalt.
            </p>
            <p>
              <strong className="font-semibold text-text-primary">{operator?.name ?? "Ditt nätbolag"}</strong>{" "}
              tar inte ut någon effektavgift idag. Du betalar alltså inget extra för dina topptimmar.
            </p>
            <p>
              Det är en växande modell — fler nätbolag inför effekttariffer för att jämna ut
              belastningen i elnätet. Om ditt nätbolag inför det visar vi hur du kan optimera dina laster.
            </p>
          </div>
        </Modal>
      )}

      {openModal === "fasta" && (
        <Modal
          onClose={() => setOpenModal(null)}
          eyebrow={`Fasta avgifter · ${formatKr(fastaKr)} kr / år`}
          title="Vart pengarna går"
        >
          <ComponentRow name="Nätabonnemang" amountKr={costComponents.gridFixedFeeKr} recipient="elnatet" />
          {costComponents.elhandelMonthlyFeeKr > 0 && (
            <ComponentRow
              name="Fast avgift på elavtalet"
              amountKr={costComponents.elhandelMonthlyFeeKr}
              recipient="elhandlaren"
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function BucketCard({
  variant,
  title,
  amountKr,
  desc,
  insightStrong,
  actionPills,
  onMore,
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
        <div className={`text-xl font-bold tracking-tight ${colors.text}`}>
          {formatKr(amountKr)} kr
        </div>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-text-secondary">
        {desc}{" "}
        <strong className="font-semibold text-text-primary">{insightStrong}</strong>
      </p>
      {actionPills.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {actionPills.map((pill) => (
            <span
              key={pill}
              className={`rounded-full ${colors.pillBg} ${colors.pillText} px-3 py-1 text-xs font-medium`}
            >
              → {pill}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onMore}
        className="text-xs font-medium text-text-muted hover:text-text-primary"
      >
        Vart går pengarna? →
      </button>
    </div>
  );
}

/* =========================================================================
   Modal — bottom sheet på mobil, centered på desktop
   ========================================================================= */

function Modal({
  onClose,
  eyebrow,
  title,
  children,
}: {
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  // Portal till document.body så positionen är relativ till viewport
  // (inte till en ev. transformed parent). Mounted-guard för SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg-warm p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-brand-500">
          {eyebrow}
        </div>
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
    document.body,
  );
}

function ComponentRow({
  name,
  amountKr,
  recipient,
}: {
  name: string;
  amountKr: number;
  recipient: "elhandlaren" | "elnatet" | "staten";
}) {
  const recipientStyle = {
    elhandlaren: "bg-brand-50 text-brand-600",
    elnatet: "bg-orange-50 text-orange-700",
    staten: "bg-gray-100 text-gray-600",
  }[recipient];
  const recipientLabel = {
    elhandlaren: "elhandlaren",
    elnatet: "elnätet",
    staten: "staten",
  }[recipient];

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-text-primary">{name}</span>
      <span className="text-sm font-semibold tabular-nums text-text-primary">
        {formatKr(amountKr)} kr
      </span>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${recipientStyle}`}>
        {recipientLabel}
      </span>
    </div>
  );
}

/* =========================================================================
   SECTION 3 — Framtiden (kort, länkar till min-uppfoljning för djup)
   ========================================================================= */

function Section3Future({
  yearlyKr,
  spotCostKr,
}: {
  yearlyKr: number;
  spotCostKr: number;
}) {
  // Fem scenarier baserade på spotCost-multipliers. Värdena är approximationer
  // för v0.1 — kan ersättas med exakta siffror från scenarios-presets.ts +
  // ENTSO-E-data senare. ID:n speglar `upgrade-evidence.ts:scenarioShielding`
  // så vi senare kan korsreferera "vilka åtgärder skyddar mest mot scenario X".
  const scenarios = [
    {
      id: "energikrisen-2022",
      variant: "bad" as const,
      tagline: "Worst case · Sett innan",
      title: "Energikrisen 2022 återvänder",
      multiplier: 1.4,
      explanation:
        "Spotpriset i SE3 låg vintern 2022 i snitt på 120 öre/kWh — mer än dubbelt så högt som nu. Krig, gasbrist eller en kall vinter kan trigga det igen. Sannolikhet: medel — det har hänt en gång det senaste decenniet.",
    },
    {
      id: "eu-sammankoppling",
      variant: "bad" as const,
      tagline: "Pågående · Sannolikhet mycket hög",
      title: "EU-priserna sammankopplas",
      multiplier: 0.5,
      explanation:
        "Sverige följer Europas prisnivå allt mer i takt med utökade överföringsförbindelser. Vintertid driver tysk gas-priset upp svenska priser även när vi har egen vattenkraft.",
    },
    {
      id: "norra-sverige-stalboom",
      variant: "bad" as const,
      tagline: "Pågående · Sannolikhet hög",
      title: "Stålboom i norr",
      multiplier: 0.3,
      explanation:
        "H2 Green Steel + LKAB drar enorm el i SE1/SE2. Effekten på SE3-priset blir mindre direkt, men hela elsystemet pressas — utbyggnaden av kraft och nät sker långsammare än efterfrågan.",
    },
    {
      id: "eu-2030-mal",
      variant: "bad" as const,
      tagline: "5 år bort · Sannolikhet medel",
      title: "EU 2030-mål driver upp efterfrågan",
      multiplier: 0.2,
      explanation:
        "EU:s klimatmål kräver elektrifiering av transport och industri i hela Europa. Efterfrågan stiger snabbare än utbudet — speciellt under vinterhalvåret när sol-produktion är låg.",
    },
    {
      id: "fornybar-expansion",
      variant: "good" as const,
      tagline: "Best case · 5–10 år bort",
      title: "Massiv utbyggnad av sol och vind",
      multiplier: -0.25,
      explanation:
        "Om Sverige bygger ut sol, vind och batterier snabbare än beräknat kan elpriset pressas ned. Sannolikhet: låg — kräver politisk vilja och snabbt utbyggd infrastruktur.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Framtidens elpriser
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Vad händer om priserna ändras?
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          Fem scenarier — från det värsta till det bästa. Du kan inte påverka
          spotpriset eller EU-marknaden, men varje åtgärd du gör skyddar dig
          oavsett vad som händer.
        </p>
      </header>

      <div className="flex flex-col gap-3.5">
        {scenarios.map((s) => {
          const delta = Math.round(spotCostKr * s.multiplier);
          const scenarioKr = yearlyKr + delta;
          const deltaText =
            delta >= 0 ? `+${formatKr(delta)} kr` : `−${formatKr(Math.abs(delta))} kr`;
          return (
            <ScenarioCard
              key={s.id}
              variant={s.variant}
              tagline={s.tagline}
              title={s.title}
              deltaText={deltaText}
              todayKr={yearlyKr}
              scenarioKr={scenarioKr}
              explanation={s.explanation}
            />
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/app/min-uppfoljning"
          className="text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          Utforska scenarierna djupare i uppföljningen →
        </Link>
      </div>
    </div>
  );
}

function ScenarioCard({
  variant,
  tagline,
  title,
  deltaText,
  todayKr,
  scenarioKr,
  explanation,
}: {
  variant: "bad" | "good";
  tagline: string;
  title: string;
  deltaText: string;
  todayKr: number;
  scenarioKr: number;
  explanation: string;
}) {
  const colors =
    variant === "bad"
      ? { border: "border-l-[#E05C5C]", barFill: "bg-[#E05C5C]", deltaText: "text-[#C0392B]" }
      : { border: "border-l-brand-500", barFill: "bg-brand-500", deltaText: "text-brand-500" };

  const max = Math.max(todayKr, scenarioKr);

  return (
    <div className={`rounded-2xl border border-border ${colors.border} border-l-[5px] bg-white p-5`}>
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {tagline}
          </div>
          <div className="text-lg font-bold leading-tight tracking-tight text-text-primary">
            {title}
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-xl font-extrabold leading-none tracking-tight tabular-nums ${colors.deltaText}`}
          >
            {deltaText}
          </div>
          <div className="mt-1 text-xs text-text-muted">per år</div>
        </div>
      </div>
      <div className="my-3 grid grid-cols-[60px_1fr] items-center gap-3 text-xs">
        <span className="text-text-muted">Idag</span>
        <div className="h-4 rounded bg-bg-warm">
          <div
            className="flex h-full items-center justify-end rounded bg-brand-900 px-2 text-[10px] font-bold text-white"
            style={{ width: `${(todayKr / max) * 100}%` }}
          >
            {formatKr(todayKr)}
          </div>
        </div>
        <span className="text-text-muted">Scenariot</span>
        <div className="h-4 rounded bg-bg-warm">
          <div
            className={`flex h-full items-center justify-end rounded ${colors.barFill} px-2 text-[10px] font-bold text-white`}
            style={{ width: `${(scenarioKr / max) * 100}%` }}
          >
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

/* =========================================================================
   SECTION 4 — Vad du kan göra (specifika åtgärder från engine v2)
   ========================================================================= */

/** Statiska tips per kategori för åtgärder som engine v2 inte modellerar
 *  (sänk huvudsäkring, byt elhandlare, avtal utan månadsavgift, batteri som
 *  standalone) eller där batteri ska synas separat även när det bundlas
 *  med solceller. Visas efter engine-rekommendationer i kategori-korten,
 *  märkta som "tips" — utan exakt kr/år eftersom modellering saknas. */
type StaticTip = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  approxKr?: string; // t.ex. "~600 kr / år" — eller undefined för "kan vara värt undersöka"
};

const STATIC_TIPS: Record<"anvanda" | "effekt" | "fast", StaticTip[]> = {
  anvanda: [
    {
      id: "smarta-vanor",
      icon: "💡",
      title: "Smartare vanor",
      desc: "Sänk inomhustemp 1°C, stäng av standby, tvätta på 30°C. Ingen investering — börja idag.",
      approxKr: "~3 % av räkningen",
    },
  ],
  effekt: [
    {
      id: "flytta-last",
      icon: "🌙",
      title: "Flytta tvätt och disk till kvällen",
      desc: "Schemalägg tunga apparater så de inte krockar med matlagning eller hemkomst-toppen.",
      approxKr: "Gratis · ändra rutiner",
    },
    {
      id: "hembatteri-tip",
      icon: "🔋",
      title: "Hembatteri",
      desc: "Ladda billig natt-el och använd när priset är högt — eller lagra solel om du har det. Kan även ge intäkter via stödtjänster till Svenska Kraftnät (FCR-D/FFR).",
      approxKr: "3 000–8 000 kr / år i stödtjänster",
    },
  ],
  fast: [
    {
      id: "mindre-sakring",
      icon: "⚡",
      title: "Mindre huvudsäkring",
      desc: "Om dina toppar sällan går över 16 A räcker det med en mindre säkring. Kontakta nätbolaget.",
      approxKr: "~25 % av nätabonnemanget",
    },
    {
      id: "byt-elhandlare",
      icon: "📞",
      title: "Byt elhandlare",
      desc: "Jämför priser på Elskling.se eller Elpriskollen. Tar 5 minuter att byta online.",
      approxKr: "~3–5 % av elhandelskostnaden",
    },
    {
      id: "ingen-manadsavgift",
      icon: "💰",
      title: "Avtal utan månadsavgift",
      desc: "Vissa elhandlare erbjuder avtal helt utan fast månadsavgift. Spar du över 600 kr per år.",
      approxKr: "~600 kr / år",
    },
  ],
};

/** Mappar engine v2-åtgärder till de tre kategorierna från publika
 *  ResultScrollFlow ("Använd mindre", "Kapa effekttoppen", "Se över abonnemang").
 *  Att kategorierna är samma som teasern är medvetet — Sofia känner igen
 *  strukturen från där hon kom. */
const CATEGORY_FOR_UPGRADE: Record<string, "anvanda" | "effekt" | "fast"> = {
  // Använd mindre — påverkar kWh-förbrukningen
  solceller: "anvanda",
  bergvarme: "anvanda",
  luftvatten: "anvanda",
  luftluft: "anvanda",
  tillaggsisolering: "anvanda",
  fonsterbyte: "anvanda",
  eldstad: "anvanda",
  varmvattenpump: "anvanda",
  // Kapa effekttoppen — flyttar/jämnar ut last
  batteri: "effekt",
  smartstyrning: "effekt",
  // Se över abonnemang — avtalsförändringar
  dynamiskt_elpris: "fast",
};

function Section4Actions({
  recommendations,
  totalSavingsKr,
  yearlyKr,
}: {
  recommendations: Recommendation[];
  totalSavingsKr: number;
  yearlyKr: number;
}) {
  const savingsPercent =
    yearlyKr > 0 ? Math.round((totalSavingsKr / yearlyKr) * 100) : 0;

  // Distribuera engine-rekommendationer per kategori. Sortera redan efter
  // payback eftersom listan kommer sorterad så från engine.
  const byCategory: Record<"anvanda" | "effekt" | "fast", Recommendation[]> = {
    anvanda: [],
    effekt: [],
    fast: [],
  };
  for (const rec of recommendations) {
    const cat = CATEGORY_FOR_UPGRADE[rec.upgradeId];
    if (cat) byCategory[cat].push(rec);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7 text-center">
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-500">
          Vad du kan göra
        </div>
        <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
          Tre spakar du kan dra i
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
          Vi har räknat ut vilka åtgärder som lönar sig för just ditt hus.
          De ligger sorterade efter kategori — välj det som känns rätt för dig.
        </p>
      </header>

      {/* Total potential — gradient-kort */}
      <div className="mb-7 rounded-2xl bg-gradient-to-br from-brand-900 to-brand-500 p-5 text-center text-white">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest opacity-85">
          Total sparpotential
        </div>
        <div className="mb-1 text-3xl font-bold tracking-tight">
          upp till {formatKr(totalSavingsKr)} kr
        </div>
        <div className="text-sm opacity-80">
          per år · {savingsPercent} % av din nuvarande räkning
        </div>
      </div>

      {/* Tre kategori-kort */}
      <div className="flex flex-col gap-4 mb-7">
        <CategoryCard
          variant="anvanda"
          title="Använd mindre"
          desc="Allt som rör sig med din kWh-förbrukning. Den största kategorin — även där du kan investera mest."
          recs={byCategory.anvanda}
        />
        <CategoryCard
          variant="effekt"
          title="Kapa effekttoppen"
          desc="Flytta last till bättre tider eller jämna ut den. Värdet växer i takt med att fler nätbolag inför effekttariff."
          recs={byCategory.effekt}
        />
        <CategoryCard
          variant="fast"
          title="Se över abonnemang"
          desc="Snabbaste vinsterna — kräver bara ett samtal eller några klick. Inga förändringar i dina vanor."
          recs={byCategory.fast}
        />
      </div>

      {/* CTA till min-plan */}
      <div className="text-center">
        <Link
          href="/app/min-plan"
          className="inline-block rounded-2xl bg-brand-500 px-7 py-3 text-base font-bold text-white shadow-lg transition-colors hover:bg-brand-600"
        >
          Se din fullständiga plan →
        </Link>
        <p className="mt-3 text-xs text-text-muted">
          Inklusive variant-jämförelse, motivering och hur du går vidare
        </p>
      </div>
    </div>
  );
}

function CategoryCard({
  variant,
  title,
  desc,
  recs,
}: {
  variant: "anvanda" | "effekt" | "fast";
  title: string;
  desc: string;
  recs: Recommendation[];
}) {
  const colors = {
    anvanda: { border: "border-l-brand-500", text: "text-brand-500" },
    effekt: { border: "border-l-cta-orange", text: "text-cta-orange" },
    fast: { border: "border-l-[#97A39B]", text: "text-[#5E6961]" },
  }[variant];

  const totalSavings = recs.reduce((s, r) => s + r.yearlySavingsKr, 0);
  const tips = STATIC_TIPS[variant];
  const hasContent = recs.length > 0 || tips.length > 0;

  return (
    <div className={`rounded-2xl border border-border ${colors.border} border-l-[5px] bg-white p-5`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <div className="text-lg font-bold tracking-tight text-text-primary">{title}</div>
        {recs.length > 0 && (
          <div className={`text-sm font-semibold ${colors.text}`}>
            spara upp till {formatKr(totalSavings)} kr/år
          </div>
        )}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-text-muted">{desc}</p>

      {!hasContent ? (
        <div className="rounded-xl bg-bg-warm p-3 text-sm leading-relaxed text-text-secondary">
          <strong className="font-semibold text-text-primary">Du har redan optimerat den här kategorin</strong>{" "}
          — bra jobbat! Vi hittar inga åtgärder som lönar sig att lägga till.
        </div>
      ) : (
        <>
          {/* Engine-rekommendationer (med modellerade siffror) */}
          {recs.length > 0 && (
            <div className="flex flex-col gap-2">
              {recs.map((rec) => (
                <CategoryRow key={rec.upgradeId} rec={rec} />
              ))}
            </div>
          )}

          {/* Statiska tips (utan exakt modellering) */}
          {tips.length > 0 && (
            <>
              {recs.length > 0 && (
                <div className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Andra tips
                </div>
              )}
              <div className="flex flex-col gap-2">
                {tips.map((tip) => (
                  <TipRow key={tip.id} tip={tip} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function TipRow({ tip }: { tip: StaticTip }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-surface p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-bg-warm text-lg">
          {tip.icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">{tip.title}</div>
          <div className="text-xs text-text-muted leading-snug">{tip.desc}</div>
        </div>
      </div>
      {tip.approxKr && (
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-medium text-text-secondary tabular-nums">
            {tip.approxKr}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRow({ rec }: { rec: Recommendation }) {
  const upgrade = UPGRADE_DEFINITIONS.find((u) => u.id === rec.upgradeId);
  const label = upgrade?.label ?? rec.upgradeId;
  const icon = upgrade?.icon ?? "•";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-bg-warm p-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-lg">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">{label}</div>
          <div className="text-xs text-text-muted">
            {rec.investmentKr > 0
              ? `${formatKr(rec.investmentKr)} kr · ${rec.paybackYears} års payback`
              : "Ingen investering"}
          </div>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold text-energy-green tabular-nums">
          +{formatKr(rec.yearlySavingsKr)} kr
        </div>
        <div className="text-[10px] text-text-muted">per år</div>
      </div>
    </div>
  );
}
