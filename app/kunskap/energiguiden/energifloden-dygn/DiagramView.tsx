"use client";

import type { HourSnapshot, Settings, Scenario } from "@/lib/energy-flow";
import { STODTJANST_DAY_TOTAL } from "@/lib/energy-flow";
import { VIZ_PALETTE } from "./ui-constants";

interface DiagramViewProps {
  snapshot: HourSnapshot;
  scenario: Scenario;
  settings: Settings;
}

const fmtKW = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const MAX_KW = 10;

/**
 * Diagram-vy: två staplar — "Var elen kommer ifrån" (sol/nät/batteri/elbil V2H)
 * och "Var elen tar vägen" (bat/ev/värme/övrigt/export). Plus en kostnadsrad
 * längst ner.
 */
export default function DiagramView({
  snapshot,
  scenario,
  settings,
}: DiagramViewProps) {
  const evToHouse = snapshot.evToHouse || 0;
  const srcTotal =
    snapshot.solToHouse +
    snapshot.solToBat +
    snapshot.solToGrid +
    snapshot.gridToHouse +
    snapshot.batToHouse +
    evToHouse;
  const snkTotal =
    snapshot.solToBat +
    snapshot.gridToBat +
    snapshot.ev +
    snapshot.heatTotal +
    snapshot.other +
    snapshot.solToGrid;

  const stodTotal =
    settings.hasBat && settings.hasSmart ? STODTJANST_DAY_TOTAL : 0;
  const netCost = scenario.dayCost - stodTotal;

  return (
    <div className="grid gap-3.5 grid-cols-2 grid-rows-[1fr_auto] min-h-[470px]">
      <Column title="Var elen kommer ifrån" total={srcTotal}>
        <Bar
          color={VIZ_PALETTE.accentSun}
          label="Sol"
          kw={
            snapshot.solToHouse + snapshot.solToBat + snapshot.solToGrid
          }
        />
        <Bar
          color={VIZ_PALETTE.accentGrid}
          label="Nät"
          kw={snapshot.gridToHouse}
        />
        <Bar
          color={VIZ_PALETTE.accentStorage}
          label="Batteri"
          kw={snapshot.batToHouse}
        />
        <Bar
          color={VIZ_PALETTE.accentStorage}
          label="Elbil (V2H)"
          kw={evToHouse}
        />
      </Column>

      <Column title="Var elen tar vägen" total={snkTotal}>
        <Bar
          color={VIZ_PALETTE.accentStorage}
          label="Batteri"
          kw={snapshot.solToBat + snapshot.gridToBat}
        />
        <Bar
          color={VIZ_PALETTE.accentStorage}
          label="Elbil"
          kw={snapshot.ev}
        />
        <Bar
          color={VIZ_PALETTE.accentCons}
          label="Värme"
          kw={snapshot.heatTotal}
        />
        <Bar
          color={VIZ_PALETTE.accentCons}
          label="Övriga"
          kw={snapshot.other}
        />
        <Bar
          color="#A0A599"
          label="Till nät"
          kw={snapshot.solToGrid}
        />
      </Column>

      <div
        className="col-span-2 flex flex-wrap items-baseline gap-4 px-4 py-3 rounded-xl"
        style={{
          background: VIZ_PALETTE.bgCard,
          border: `0.5px solid ${VIZ_PALETTE.border}`,
        }}
      >
        <span className="text-[10.5px] uppercase tracking-wider font-medium text-text-muted">
          Kostnad denna dag
        </span>
        <span
          className="text-[18px] font-medium tabular-nums"
          style={{ color: VIZ_PALETTE.textPrimary }}
        >
          {(Math.round(netCost * 10) / 10).toFixed(1).replace(".", ",")} kr
        </span>
        {stodTotal > 0 && (
          <span
            className="text-[11.5px] ml-auto"
            style={{ color: VIZ_PALETTE.accent }}
          >
            varav −{stodTotal} kr stödtjänster
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  total,
  children,
}: {
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col"
      style={{
        background: VIZ_PALETTE.bgCard,
        border: `0.5px solid ${VIZ_PALETTE.border}`,
      }}
    >
      <div
        className="text-xs uppercase tracking-wider font-medium text-center mb-1"
        style={{ color: VIZ_PALETTE.textSecondary }}
      >
        {title}
      </div>
      <div
        className="text-[22px] font-medium text-center mb-3.5 tabular-nums"
        style={{
          color: VIZ_PALETTE.textPrimary,
          letterSpacing: "0.02em",
        }}
      >
        {fmtKW(total)} kW
      </div>
      <div className="flex-1 flex flex-col gap-px overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Bar({
  color,
  label,
  kw,
}: {
  color: string;
  label: string;
  kw: number;
}) {
  if (kw <= 0.05) return null;
  const pct = Math.max(0, Math.min(100, (kw / MAX_KW) * 100));
  return (
    <div
      className="px-3.5 rounded text-white text-[13px] flex flex-row justify-between items-center gap-3 transition-all"
      style={{
        background: color,
        height: `${pct}%`,
      }}
    >
      <span className="font-medium tracking-tight whitespace-nowrap leading-tight">
        {label}
      </span>
      <span className="text-xs opacity-90 tabular-nums whitespace-nowrap leading-tight">
        {fmtKW(kw)} kW
      </span>
    </div>
  );
}
