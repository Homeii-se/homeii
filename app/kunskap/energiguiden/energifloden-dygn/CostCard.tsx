"use client";

import { useEffect, useRef, useState } from "react";
import type { Scenario, AnnualSaving, Settings } from "@/lib/energy-flow";
import { STODTJANST_DAY_TOTAL } from "@/lib/energy-flow";
import { VIZ_PALETTE } from "./ui-constants";

interface CostCardProps {
  scenario: Scenario;
  yesterdayScenario: Scenario;
  annualSaving: AnnualSaving;
  settings: Settings;
}

const fmtKr = (x: number) =>
  (Math.round(x * 10) / 10).toFixed(1).replace(".", ",") + " kr";

/**
 * Kostnadskort: visar dygnskostnad netto + besparing vs gårdagens hem.
 * En "i"-knapp öppnar popover med fullständig beräkning + säsongsviktad
 * årsbesparing + pedagogiska förklaringar.
 */
export default function CostCard({
  scenario,
  yesterdayScenario,
  annualSaving,
  settings,
}: CostCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Stäng popover vid klick utanför
  useEffect(() => {
    if (!popoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [popoverOpen]);

  const stodTotal =
    settings.hasBat && settings.hasSmart ? STODTJANST_DAY_TOTAL : 0;
  const netCost = scenario.dayCost - stodTotal;
  const isPreDef =
    !settings.hasHP &&
    !settings.hasEV &&
    !settings.hasSol &&
    !settings.hasBat &&
    !settings.hasSmart &&
    settings.prismodell === "manadsmedel";
  const dailySaving = !isPreDef ? yesterdayScenario.dayCost - netCost : 0;

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl px-4 py-3.5 flex flex-col justify-center"
      style={{
        background: VIZ_PALETTE.bgStat,
        border: `0.5px solid ${VIZ_PALETTE.border}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-text-muted leading-tight">
          Kostnad denna dag
        </span>
        <button
          type="button"
          aria-label="Visa hur kostnaden räknas"
          onClick={(e) => {
            e.stopPropagation();
            setPopoverOpen((p) => !p);
          }}
          className="w-4 h-4 rounded-full border border-gray-200 text-text-muted text-[10px] font-semibold flex items-center justify-center hover:bg-white hover:text-brand-900 italic font-serif"
        >
          i
        </button>
      </div>

      <div
        className="text-[22px] font-medium mt-1.5 tabular-nums"
        style={{ color: VIZ_PALETTE.textPrimary }}
      >
        {fmtKr(netCost)}
      </div>

      {dailySaving > 5 && (
        <div
          className="text-[12px] font-semibold tabular-nums mt-1.5 leading-snug"
          style={{ color: VIZ_PALETTE.accent }}
        >
          <strong className="font-bold">
            Sparar {fmtKr(dailySaving)}/dygn
          </strong>{" "}
          vs gårdagens hem
        </div>
      )}

      {stodTotal > 0 && (
        <div
          className="text-[11px] font-medium tabular-nums mt-1 opacity-85"
          style={{ color: VIZ_PALETTE.accent }}
        >
          varav −{stodTotal} kr stödtjänster
        </div>
      )}

      {popoverOpen && (
        <CostPopover
          scenario={scenario}
          yesterdayScenario={yesterdayScenario}
          annualSaving={annualSaving}
          settings={settings}
          netCost={netCost}
          stodTotal={stodTotal}
          isPreDef={isPreDef}
        />
      )}
    </div>
  );
}

function CostPopover({
  scenario,
  yesterdayScenario,
  annualSaving,
  settings,
  netCost,
  stodTotal,
  isPreDef,
}: {
  scenario: Scenario;
  yesterdayScenario: Scenario;
  annualSaving: AnnualSaving;
  settings: Settings;
  netCost: number;
  stodTotal: number;
  isPreDef: boolean;
}) {
  const exportRev = scenario.exportRevenue;
  const isPostDef =
    settings.hasHP &&
    settings.hasEV &&
    settings.hasSol &&
    settings.hasBat &&
    settings.hasSmart &&
    settings.prismodell === "dynamiskt";

  const yCost = yesterdayScenario.dayCost;
  const saving = yCost - netCost;
  const showComparison = !isPreDef && saving > 5;

  return (
    <div
      className="absolute right-0 z-20 rounded-2xl shadow-xl px-5 py-4"
      style={{
        bottom: "calc(100% + 10px)",
        width: "360px",
        maxWidth: "calc(100vw - 60px)",
        background: VIZ_PALETTE.bgCard,
        border: `0.5px solid ${VIZ_PALETTE.border}`,
      }}
    >
      <SectionHead>Beräkning denna dag</SectionHead>
      <table className="w-full text-[13px] tabular-nums">
        <tbody>
          <Row label="Köpt energi från nätet" value={fmtKr(scenario.gridCost)} />
          <Row
            label="Effektavgift"
            value={`+ ${fmtKr(scenario.effektavgift)}`}
          />
          <tr>
            <td colSpan={2} className="text-[11px] text-text-tertiary pb-1.5">
              Topp{" "}
              {(Math.round(scenario.peakKw * 10) / 10)
                .toFixed(1)
                .replace(".", ",")}{" "}
              kW × 3 kr/kW
            </td>
          </tr>
          {exportRev > 0.05 && (
            <Row
              label="Solexport"
              value={`− ${fmtKr(exportRev)}`}
              variant="rev"
            />
          )}
          {stodTotal > 0 && (
            <Row
              label="Frekvensreserv"
              value={`− ${stodTotal} kr`}
              variant="rev"
            />
          )}
          <Row label="Netto/dygn" value={fmtKr(netCost)} variant="tot" />
        </tbody>
      </table>

      {settings.hasEV && (
        <div className="mt-2.5 text-[11.5px] text-text-secondary px-2.5 py-2 bg-surface-solid rounded-md leading-snug">
          Inkluderar laddning för ca <strong className="font-semibold text-text-primary">20 mil EV-cykel</strong> per
          dygn (körning ~12 mil + V2H till huset).
        </div>
      )}

      {showComparison && (
        <>
          <Divider />
          <SectionHead>Jämfört med gårdagens hem</SectionHead>
          <table className="w-full text-[13px] tabular-nums">
            <tbody>
              <Row label="Gårdagens hem (samma dag)" value={fmtKr(yCost)} />
              <Row label="Detta hem" value={fmtKr(netCost)} />
              <Row
                label="Sparat denna dag"
                value={fmtKr(saving)}
                variant="tot rev"
              />
            </tbody>
          </table>

          <Divider />
          <SectionHead>Säsongsviktad årsbesparing</SectionHead>
          <table className="w-full text-[13px] tabular-nums">
            <tbody>
              <Row
                label="Vinter (90 dagar)"
                value={`~${Math.round(annualSaving.byseason.vinter).toLocaleString("sv-SE")} kr`}
              />
              <Row
                label="Vår·Höst (180 dagar)"
                value={`~${Math.round(annualSaving.byseason.host).toLocaleString("sv-SE")} kr`}
              />
              <Row
                label="Sommar (90 dagar)"
                value={`~${Math.round(annualSaving.byseason.sommar).toLocaleString("sv-SE")} kr`}
              />
              <Row
                label="Totalt per år"
                value={`~${(Math.round(annualSaving.total / 100) * 100).toLocaleString("sv-SE")} kr`}
                variant="tot rev"
              />
            </tbody>
          </table>
          <div className="mt-3 text-[11px] text-text-tertiary leading-snug">
            Vinterdagar är dyra för båda hemmen men investeringen i värmepump +
            smart timing slår igenom mest då. Sommardagar är redan billiga —
            där sparar du mindre.
          </div>
        </>
      )}

      {(isPostDef || (!isPreDef && saving > 5)) && (
        <>
          <Divider />
          <SectionHead>{isPostDef ? "Varför så lågt?" : "Vad du har gjort"}</SectionHead>
          <ul className="m-0 p-0 list-none text-[12.5px] leading-relaxed text-text-primary">
            <Bullet>
              <strong className="font-medium">Värmepump istället för direktel</strong> —
              sänker värmeuttaget med ~70 %.
            </Bullet>
            <Bullet>
              <strong className="font-medium">Smart timing</strong> flyttar tunga
              laster (varmvatten, EV, batteri) till nattens billigaste timmar.
            </Bullet>
            <Bullet>
              <strong className="font-medium">V2H och batteri</strong> täcker dyra
              peak-timmar — under ~11 h/dygn köps 0 kWh från nätet.
            </Bullet>
          </ul>
        </>
      )}

      {isPreDef && (
        <>
          <Divider />
          <SectionHead>Varför så högt?</SectionHead>
          <ul className="m-0 p-0 list-none text-[12.5px] leading-relaxed text-text-primary">
            <Bullet>
              <strong className="font-medium">Direktel</strong> drar full effekt rakt
              mot värmebehovet — ~3× mer än en värmepump.
            </Bullet>
            <Bullet>
              <strong className="font-medium">Månadsmedelpris</strong> — alla timmar
              kostar lika mycket, ingen vinst på att flytta laster.
            </Bullet>
            <Bullet>
              <strong className="font-medium">Inget batteri eller sol</strong> som
              kan kapa peak-timmarna.
            </Bullet>
          </ul>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "rev" | "tot" | "tot rev";
}) {
  const isTot = variant?.includes("tot");
  const isRev = variant?.includes("rev");
  return (
    <tr>
      <td
        className={`py-1 align-top ${isTot ? "pt-2 border-t border-gray-200 font-medium text-[14px]" : ""}`}
      >
        {label}
      </td>
      <td
        className={`py-1 align-top text-right whitespace-nowrap ${isRev ? "text-brand-500" : ""} ${isTot ? "pt-2 border-t border-gray-200 font-medium text-[14px]" : ""}`}
      >
        {value}
      </td>
    </tr>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider font-medium text-text-muted mb-2">
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      className="my-3"
      style={{ height: "0.5px", background: VIZ_PALETTE.border }}
    />
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="py-0.5 pl-3.5 relative">
      <span
        className="absolute left-0.5 font-semibold"
        style={{ color: VIZ_PALETTE.accent }}
        aria-hidden
      >
        •
      </span>
      {children}
    </li>
  );
}
