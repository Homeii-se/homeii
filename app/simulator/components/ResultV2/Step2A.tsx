"use client";

/**
 * Steg 2A — "Vart pengarna går"
 *
 * Alternativ design för kostnadsnedbrytning som lägger fokus på *pedagogik*
 * snarare än fullständig komponentlista. Tre kategorier som speglar hur
 * Sofia kan agera: "Det du använder" (kWh-bundet), "Effekttoppen" (om
 * bolaget har effekttariff), "Fasta avgifter" (oavsett förbrukning).
 *
 * Datakällor:
 *  - costComponents: AnnualCostComponents (samma som CostBreakdownCard använder)
 *  - gridOperatorName: optional, för att hämta effekttariff-modell + visa
 *    nätbolagsspecifik förklaring i popup
 */

import { useState } from "react";
import type { AnnualCostComponents } from "../../types";
import {
  findGridOperator,
  describePowerChargeModel,
  withVat,
  type GridOperatorPricing,
} from "../../data/grid-operators";

interface Step2AProps {
  costComponents: AnnualCostComponents;
  /** Bolagsnamn från fakturadata. Används för att hämta effekttariff-modell. */
  gridOperatorName?: string;
}

type ModalKey = "anvanda" | "effekt" | "fasta" | null;

function formatKr(value: number): string {
  return Math.round(value).toLocaleString("sv-SE");
}

export default function Step2A({ costComponents, gridOperatorName }: Step2AProps) {
  const [openModal, setOpenModal] = useState<ModalKey>(null);

  // Bucket categorize 7 cost components into 3 actionable categories
  const anvandaKr =
    costComponents.spotCostKr +
    costComponents.markupCostKr +
    costComponents.energyTaxKr +
    costComponents.gridTransferFeeKr;
  const effektKr = costComponents.gridPowerChargeKr;
  const fastaKr = costComponents.gridFixedFeeKr + costComponents.elhandelMonthlyFeeKr;
  const totalKr = anvandaKr + effektKr + fastaKr;

  const operator: GridOperatorPricing | null = gridOperatorName
    ? findGridOperator(gridOperatorName)
    : null;
  const hasEffekt = (operator?.hasPowerCharge ?? false) && effektKr > 0;

  const anvandaPct = totalKr > 0 ? (anvandaKr / totalKr) * 100 : 0;
  const effektPct = totalKr > 0 ? (effektKr / totalKr) * 100 : 0;
  const fastaPct = totalKr > 0 ? (fastaKr / totalKr) * 100 : 0;

  const paverkbarPct = Math.round(anvandaPct + effektPct);

  const operatorDesc = operator?.powerChargeModel
    ? describePowerChargeModel(operator.powerChargeModel)
    : null;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
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

      {/* Stapelbar */}
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
        <span style={{ flex: anvandaPct }} className="pl-1">Det du använder</span>
        {hasEffekt && <span style={{ flex: effektPct }} className="text-center">Effekttopp</span>}
        <span style={{ flex: fastaPct }} className="pr-1 text-right">Fast</span>
      </div>

      {/* Kort */}
      <div className="flex flex-col gap-3.5">
        {/* Det du använder */}
        <CostCard
          variant="anvanda"
          title="Det du använder"
          amountKr={anvandaKr}
          desc="Allt det som rör sig med varje kWh — själva elen, skatt, påslag och överföring."
          insightStrong="Använder du mindre, sjunker hela summan."
          actionPills={["Värmepump", "Solceller", "Tilläggsisolering", "Smartare vanor"]}
          onMore={() => setOpenModal("anvanda")}
        />

        {/* Effekttoppen — visas bara om bolaget har det */}
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

        {/* Fasta avgifter */}
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

      {/* Slutsats */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-surface p-4">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-500">!</div>
        <p className="text-sm leading-relaxed text-text-primary">
          <strong className="font-bold text-text-primary">Slutsats:</strong>{" "}
          {paverkbarPct} % av din räkning kan du påverka — antingen genom att använda mindre el
          {hasEffekt ? ", eller genom att flytta din användning till bättre tider" : ""}.
          Bara {Math.round(fastaPct)} % är fast.
        </p>
      </div>

      {/* Modaler */}
      {openModal === "anvanda" && (
        <Modal onClose={() => setOpenModal(null)} eyebrow={`Det du använder · ${formatKr(anvandaKr)} kr / år`} title="Vart pengarna går">
          <ComponentRow name="Spotpriset på börsen" amountKr={withVat(costComponents.spotCostKr)} recipient="elhandlaren" />
          <ComponentRow name="Påslag" amountKr={withVat(costComponents.markupCostKr)} recipient="elhandlaren" />
          <ComponentRow name="Energiskatt + moms" amountKr={withVat(costComponents.energyTaxKr)} recipient="staten" />
          <ComponentRow name="Överföring per kWh" amountKr={withVat(costComponents.gridTransferFeeKr)} recipient="elnatet" />
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
            name={
              operator?.powerChargeModel
                ? `Effektavgift (snitt ${operator.powerChargeModel.numberOfPeaks} toppar)`
                : "Effektavgift"
            }
            amountKr={withVat(effektKr)}
            recipient="elnatet"
          />
        </Modal>
      )}

      {openModal === "fasta" && (
        <Modal onClose={() => setOpenModal(null)} eyebrow={`Fasta avgifter · ${formatKr(fastaKr)} kr / år`} title="Vart pengarna går">
          <ComponentRow name="Nätabonnemang" amountKr={withVat(costComponents.gridFixedFeeKr)} recipient="elnatet" />
          {costComponents.elhandelMonthlyFeeKr > 0 && (
            <ComponentRow name="Fast avgift på elavtalet" amountKr={withVat(costComponents.elhandelMonthlyFeeKr)} recipient="elhandlaren" />
          )}
        </Modal>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

interface CostCardProps {
  variant: "anvanda" | "effekt" | "fast";
  title: string;
  amountKr: number;
  desc: string;
  insightStrong: string;
  actionPills: string[];
  onMore: () => void;
}

function CostCard({ variant, title, amountKr, desc, insightStrong, actionPills, onMore }: CostCardProps) {
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
        {desc} <strong className="font-semibold text-text-primary">{insightStrong}</strong>
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {actionPills.map((pill) => (
          <button
            key={pill}
            type="button"
            className={`rounded-full ${colors.pillBg} ${colors.pillText} px-3 py-1 text-xs font-medium transition hover:brightness-95`}
          >
            → {pill}
          </button>
        ))}
      </div>
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

interface ModalProps {
  onClose: () => void;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

function Modal({ onClose, eyebrow, title, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface-solid p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-brand-500">{eyebrow}</div>
        <div className="mb-4 text-lg font-bold tracking-tight text-text-primary">{title}</div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border bg-transparent py-3 text-sm font-medium text-text-primary transition hover:bg-white"
        >
          Stäng
        </button>
      </div>
    </div>
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
      <span className="text-sm font-semibold tabular-nums text-text-primary">{formatKr(amountKr)} kr</span>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${recipientStyle}`}>
        {recipientLabel}
      </span>
    </div>
  );
}
