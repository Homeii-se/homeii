"use client";

import {
  type Allocation,
  type HourSnapshot,
  type Settings,
} from "@/lib/energy-flow";
import {
  FLOWS,
  NODE_POS,
  flowPathD,
  quadraticAt,
  VIZ_PALETTE,
} from "./ui-constants";

interface HouseViewProps {
  allocation: Allocation;
  snapshot: HourSnapshot;
  settings: Settings;
}

const fmtKW = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/**
 * Schematisk hus-vy med energinoder och flödeslinjer mellan källor och laster.
 * Använder SVG `<animateMotion>` med `<mpath>` för partikelanimationer som
 * följer flödesvägarna.
 *
 * Endast aktiva flöden (>0.15 kW) visas. Färg på partiklar/linjer indikerar
 * ursprung: gul = sol, grå = nät, teal = batteri/V2H.
 */
export default function HouseView({
  allocation,
  snapshot,
  settings,
}: HouseViewProps) {
  const totalLoad = snapshot.heatTotal + snapshot.ev + snapshot.other;

  return (
    <div className="w-full max-w-[700px] mx-auto">
      <svg
        viewBox="0 0 700 470"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full max-h-[470px]"
      >
        {/* Hus-silhuett (bakgrund) */}
        <g>
          <path
            d="M 60 200 L 60 430 L 640 430 L 640 200 L 350 110 Z"
            fill="rgba(36, 59, 48, 0.025)"
            stroke={VIZ_PALETTE.border}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <text
            x="350"
            y="178"
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            letterSpacing="0.18em"
            fill={VIZ_PALETTE.textSecondary}
            style={{ textTransform: "uppercase" }}
          >
            Huset
          </text>
          <text
            x="350"
            y="448"
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            letterSpacing="0.06em"
            fill={VIZ_PALETTE.textSecondary}
            style={{ textTransform: "uppercase" }}
          >
            Effekt just nu
          </text>
          <text
            x="350"
            y="465"
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="500"
            fill={VIZ_PALETTE.accentDeep}
            className="tabular-nums"
          >
            {Math.round(totalLoad)} kW
          </text>
        </g>

        {/* Definiera flödesvägar (osynliga, partiklar följer dem) */}
        <defs>
          {FLOWS.map((f) => (
            <path key={f.id} id={`fp-${f.id}`} d={flowPathD(f)} fill="none" />
          ))}
        </defs>

        {/* Synliga svagare flödeslinjer */}
        {FLOWS.map((f) => {
          const kw = allocation[f.id as keyof Allocation] ?? 0;
          if (kw <= 0.15) return null;
          const color =
            f.col === "sol"
              ? VIZ_PALETTE.accentSun
              : f.col === "grid"
              ? VIZ_PALETTE.accentGrid
              : VIZ_PALETTE.accentStorage;
          return (
            <path
              key={`line-${f.id}`}
              d={flowPathD(f)}
              fill="none"
              stroke={color}
              strokeWidth={(1 + Math.min(kw, 6) * 0.6).toFixed(1)}
              strokeLinecap="round"
              opacity="0.18"
            />
          );
        })}

        {/* Partiklar — endast aktiva flöden */}
        {FLOWS.map((f) => {
          const kw = allocation[f.id as keyof Allocation] ?? 0;
          if (kw <= 0.15) return null;
          const visParts = Math.max(1, Math.min(4, Math.round(kw / 1.5)));
          const color =
            f.col === "sol"
              ? VIZ_PALETTE.accentSun
              : f.col === "grid"
              ? VIZ_PALETTE.accentGrid
              : VIZ_PALETTE.accentStorage;
          return (
            <g key={`parts-${f.id}`}>
              {Array.from({ length: visParts }).map((_, i) => (
                <circle key={i} r="3.2" fill={color} opacity="0.95">
                  <animateMotion
                    dur="2.6s"
                    repeatCount="indefinite"
                    begin={`${i * 0.65}s`}
                  >
                    <mpath href={`#fp-${f.id}`} />
                  </animateMotion>
                </circle>
              ))}
            </g>
          );
        })}

        {/* kW-stickers vid mittpunkten av aktiva flöden */}
        {FLOWS.map((f) => {
          const kw = allocation[f.id as keyof Allocation] ?? 0;
          if (kw <= 0.15) return null;
          const a = NODE_POS[f.src];
          const b = NODE_POS[f.dst];
          const mid = quadraticAt(0.5, a, f.ctrl, b);
          return (
            <text
              key={`sticker-${f.id}`}
              x={mid.x}
              y={mid.y + 3.3}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              fill={VIZ_PALETTE.accentDeep}
              style={{
                paintOrder: "stroke",
                stroke: VIZ_PALETTE.bgStage,
                strokeWidth: 3.5,
                strokeLinejoin: "round",
              }}
              className="tabular-nums"
            >
              {fmtKW(kw)} kW
            </text>
          );
        })}

        {/* Noder */}
        <NodeSol active={settings.hasSol} />
        <NodeGrid />
        <NodeBat
          active={settings.hasBat}
          soc={snapshot.soc}
        />
        <NodeHeat />
        <NodeEv
          active={settings.hasEV}
          away={snapshot.evAway}
          mil={snapshot.evMil}
        />
        <NodeOther />
      </svg>
    </div>
  );
}

// ── Nod-komponenter ────────────────────────────────────────────────

const NODE_R = { sol: 30, grid: 30, bat: 26, heat: 26, ev: 26, other: 26 };

function NodeBase({
  cx,
  cy,
  r,
  label,
  labelY,
  opacity = 1,
  children,
}: {
  cx: number;
  cy: number;
  r: number;
  label: string;
  labelY: number;
  opacity?: number;
  children: React.ReactNode;
}) {
  return (
    <g style={{ opacity, transition: "opacity 0.4s ease" }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={VIZ_PALETTE.bgCard}
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.4"
      />
      {children}
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        fontSize="11"
        fontWeight="500"
        letterSpacing="0.05em"
        fill={VIZ_PALETTE.accentDeep}
      >
        {label}
      </text>
    </g>
  );
}

function NodeSol({ active }: { active: boolean }) {
  const { x, y } = NODE_POS.sol;
  return (
    <NodeBase
      cx={x}
      cy={y}
      r={NODE_R.sol}
      label="SOL"
      labelY={y + 45}
      opacity={active ? 1 : 0.22}
    >
      <title>
        Solpaneler — producerar el direkt från solinstrålningen. Peak-effekt:
        ca 5 kW på sommaren, 3,5 kW vår·höst, 1,2 kW på vintern. Överskott
        laddar batteriet eller säljs till nätet.
      </title>
      <circle
        cx={x}
        cy={y}
        r="9"
        fill="none"
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g
        fill="none"
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <line x1={x} y1={y - 18} x2={x} y2={y - 13} />
        <line x1={x} y1={y + 13} x2={x} y2={y + 18} />
        <line x1={x - 18} y1={y} x2={x - 13} y2={y} />
        <line x1={x + 13} y1={y} x2={x + 18} y2={y} />
        <line x1={x - 13} y1={y - 13} x2={x - 9} y2={y - 9} />
        <line x1={x + 9} y1={y + 9} x2={x + 13} y2={y + 13} />
        <line x1={x - 13} y1={y + 13} x2={x - 9} y2={y + 9} />
        <line x1={x + 9} y1={y - 9} x2={x + 13} y2={y - 13} />
      </g>
    </NodeBase>
  );
}

function NodeGrid() {
  const { x, y } = NODE_POS.grid;
  return (
    <NodeBase cx={x} cy={y} r={NODE_R.grid} label="ELNÄT" labelY={y + 45}>
      <title>
        Elnätet — extern strömkälla. Du köper kWh när huset behöver mer än det
        producerar; säljer överskott (sol-export). Pris varierar timme-för-timme
        i dynamiskt-läge, fast i månadsmedel-läge.
      </title>
      <g
        fill="none"
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d={`M ${x - 12} ${y + 17} L ${x - 6} ${y - 15} L ${x + 6} ${y - 15} L ${x + 12} ${y + 17}`} />
        <line x1={x} y1={y - 15} x2={x} y2={y - 19} />
        <line x1={x - 7} y1={y - 5} x2={x + 7} y2={y - 5} />
        <line x1={x - 9} y1={y + 7} x2={x + 9} y2={y + 7} />
        <circle cx={x - 7} cy={y - 5} r="1.2" fill={VIZ_PALETTE.accentDeep} stroke="none" />
        <circle cx={x} cy={y - 5} r="1.2" fill={VIZ_PALETTE.accentDeep} stroke="none" />
        <circle cx={x + 7} cy={y - 5} r="1.2" fill={VIZ_PALETTE.accentDeep} stroke="none" />
      </g>
    </NodeBase>
  );
}

function NodeBat({ active, soc }: { active: boolean; soc: number }) {
  const { x, y } = NODE_POS.bat;
  return (
    <g style={{ opacity: active ? 1 : 0.22, transition: "opacity 0.4s ease" }}>
      <circle
        cx={x}
        cy={y}
        r={NODE_R.bat}
        fill={VIZ_PALETTE.bgCard}
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.4"
      />
      <g
        fill="none"
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <title>
          Hushållsbatteri — 10 kWh kapacitet. Lagrar solöverskott och billig
          nattel; urladdar under dyra peak-timmar. Stödtjänster (frekvensreserv)
          ger extra intäkter.
        </title>
        <rect
          x={x - 15}
          y={y - 8}
          width="26"
          height="16"
          rx="2.5"
          fill="none"
        />
        <rect
          x={x + 11}
          y={y - 4}
          width="3"
          height="8"
          rx="1"
          fill={VIZ_PALETTE.accentDeep}
          stroke="none"
        />
        <path
          d={`M ${x + 0.5} ${y - 5.5} L ${x - 5.5} ${y + 2} L ${x - 1} ${y + 2} L ${x - 3} ${y + 6} L ${x + 4} ${y - 2} L ${x - 0.5} ${y - 2} Z`}
          fill={VIZ_PALETTE.accentDeep}
          stroke="none"
        />
      </g>
      <text
        x={x}
        y={y + 38}
        textAnchor="middle"
        fontSize="11"
        fontWeight="500"
        letterSpacing="0.05em"
        fill={VIZ_PALETTE.accentDeep}
      >
        BATTERI
      </text>
      {/* SOC-mätare */}
      <rect
        x={x - 30}
        y={y + 52}
        width="60"
        height="6"
        rx="3"
        fill={VIZ_PALETTE.gaugeBg}
      />
      <rect
        x={x - 30}
        y={y + 52}
        width={(60 * Math.max(0, Math.min(1, soc))).toFixed(1)}
        height="6"
        rx="3"
        fill={VIZ_PALETTE.accent}
      />
      <text
        x={x}
        y={y + 70}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="500"
        fill={VIZ_PALETTE.accentDeep}
        className="tabular-nums"
      >
        {Math.round(soc * 100)} %
      </text>
    </g>
  );
}

function NodeHeat() {
  const { x, y } = NODE_POS.heat;
  return (
    <NodeBase cx={x} cy={y} r={NODE_R.heat} label="VÄRME & VV" labelY={y + 38}>
      <title>
        Värme och varmvatten — husets största förbrukare. Värmepump (COP 3,2)
        drar ca 1/3 av direktel; varmvatten värms i tank ~3 timmar/dygn på
        billigaste timmar (sol eller nattel).
      </title>
      <g
        fill="none"
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <rect x={x - 12} y={y - 12} width="24" height="22" rx="2" />
        <circle cx={x} cy={y - 1} r="6" />
        <line x1={x - 4} y1={y - 5} x2={x + 4} y2={y + 3} />
        <line x1={x + 4} y1={y - 5} x2={x - 4} y2={y + 3} />
      </g>
    </NodeBase>
  );
}

function NodeEv({
  active,
  away,
  mil,
}: {
  active: boolean;
  away: boolean;
  mil: number;
}) {
  const { x, y } = NODE_POS.ev;
  const opacity = !active ? 0.22 : away ? 0.4 : 1;
  return (
    <g style={{ opacity, transition: "opacity 0.4s ease" }}>
      <circle
        cx={x}
        cy={y}
        r={NODE_R.ev}
        fill={VIZ_PALETTE.bgCard}
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.4"
      />
      <title>
        Elbil — 100 kWh batteri (50 mil räckvidd). Borta 15:00–20:00 (kör barn
        till träning). Övriga timmar matar bilen huset (V2H) under dyra timmar
        och laddas på sol eller billig nattel. Cyklar mellan 30 och 50 mil per
        dygn.
      </title>
      <g strokeLinejoin="round">
        <path
          d={`M ${x - 19} ${y + 2} Q ${x - 19} ${y - 2} ${x - 15} ${y - 5} Q ${x - 12} ${y - 9} ${x - 7} ${y - 9} L ${x + 7} ${y - 9} Q ${x + 12} ${y - 9} ${x + 15} ${y - 5} Q ${x + 19} ${y - 2} ${x + 19} ${y + 2} Z`}
          fill={VIZ_PALETTE.accentDeep}
          stroke="none"
        />
        <path
          d={`M ${x + 2} ${y - 7} L ${x - 2} ${y - 2} L ${x + 1} ${y - 2} L ${x - 1} ${y + 2} L ${x + 4} ${y - 3} L ${x + 1} ${y - 3} Z`}
          fill="#E2B945"
          stroke="none"
        />
        <circle cx={x - 9} cy={y + 4} r="3" fill={VIZ_PALETTE.accentDeep} />
        <circle cx={x + 9} cy={y + 4} r="3" fill={VIZ_PALETTE.accentDeep} />
        <circle cx={x - 9} cy={y + 4} r="1" fill={VIZ_PALETTE.bgCard} />
        <circle cx={x + 9} cy={y + 4} r="1" fill={VIZ_PALETTE.bgCard} />
      </g>
      <text
        x={x}
        y={y + 38}
        textAnchor="middle"
        fontSize="11"
        fontWeight="500"
        letterSpacing="0.05em"
        fill={VIZ_PALETTE.accentDeep}
      >
        ELBIL
      </text>
      <rect
        x={x - 30}
        y={y + 52}
        width="60"
        height="6"
        rx="3"
        fill={VIZ_PALETTE.gaugeBg}
      />
      <rect
        x={x - 30}
        y={y + 52}
        width={(60 * Math.max(0, Math.min(1, mil / 50))).toFixed(1)}
        height="6"
        rx="3"
        fill={VIZ_PALETTE.accent}
      />
      <text
        x={x}
        y={y + 70}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="500"
        fill={VIZ_PALETTE.accentDeep}
        className="tabular-nums"
      >
        {Math.round(mil)} mil · {Math.round(mil * 2)} kWh
      </text>
    </g>
  );
}

function NodeOther() {
  const { x, y } = NODE_POS.other;
  return (
    <NodeBase
      cx={x}
      cy={y}
      r={NODE_R.other}
      label="ÖVRIGA HUSET"
      labelY={y + 38}
    >
      <title>
        Övrig hushållsel — belysning, vitvaror, elektronik, ugn, dator m.m.
        Drar oftast 0,2–1,5 kW beroende på tid på dygnet.
      </title>
      <g
        fill="none"
        stroke={VIZ_PALETTE.accentDeep}
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d={`M ${x - 13} ${y - 5} L ${x - 13} ${y + 10} L ${x - 3} ${y + 10} L ${x - 3} ${y - 5} Z`} />
        <path d={`M ${x - 5} ${y - 7} L ${x - 5} ${y - 12} M ${x - 10} ${y - 7} L ${x - 10} ${y - 12}`} />
        <circle cx={x + 8} cy={y} r="3.5" />
        <circle
          cx={x + 8}
          cy={y + 7}
          r="1.4"
          fill={VIZ_PALETTE.accentDeep}
          stroke="none"
        />
      </g>
    </NodeBase>
  );
}
