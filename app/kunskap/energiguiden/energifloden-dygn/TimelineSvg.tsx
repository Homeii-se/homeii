"use client";

import { useRef } from "react";
import type { Scenario, Settings } from "@/lib/energy-flow";
import { SOL_HOURS } from "@/lib/energy-flow";
import { SUN_PEAK_Y, VIZ_PALETTE } from "./ui-constants";
import { SeasonSelector } from "./Controls";

interface TimelineSvgProps {
  scenario: Scenario;
  settings: Settings;
  minute: number;
  showPrice: boolean;
  showCons: boolean;
  onScrub: (minute: number) => void;
  onSeasonChange: (s: Settings["season"]) => void;
}

const W = 700;
const GROUND_Y = 100;

function buildSunArcPath(season: Settings["season"]): string {
  const { rise, set } = SOL_HOURS[season];
  const peakY = SUN_PEAK_Y[season];
  const startX = (rise / 24) * W;
  const endX = (set / 24) * W;
  const noonX = (((rise + set) / 2) / 24) * W;
  const ctrlY = 2 * peakY - GROUND_Y;
  return `M ${startX.toFixed(1)} ${GROUND_Y} Q ${noonX.toFixed(1)} ${ctrlY} ${endX.toFixed(1)} ${GROUND_Y}`;
}

function sunPosAt(h: number, season: Settings["season"]) {
  const { rise, set } = SOL_HOURS[season];
  if (h < rise || h > set) return null;
  const peakY = SUN_PEAK_Y[season];
  const startX = (rise / 24) * W;
  const endX = (set / 24) * W;
  const noonX = (((rise + set) / 2) / 24) * W;
  const ctrlY = 2 * peakY - GROUND_Y;
  const t = (h - rise) / (set - rise);
  const x =
    (1 - t) * (1 - t) * startX +
    2 * (1 - t) * t * noonX +
    t * t * endX;
  const y =
    (1 - t) * (1 - t) * GROUND_Y +
    2 * (1 - t) * t * ctrlY +
    t * t * GROUND_Y;
  return { x, y };
}

function moonPosAt(h: number, season: Settings["season"]) {
  const { rise, set } = SOL_HOURS[season];
  if (h >= rise && h <= set) return null;
  const moonPeak = 45;
  const nightLen = 24 - set + rise;
  const t = h > set ? (h - set) / nightLen : (24 - set + h) / nightLen;
  const x = (h / 24) * W;
  const y = GROUND_Y - (GROUND_Y - moonPeak) * Math.sin(Math.PI * t);
  return { x, y };
}

/**
 * Tidslinjen med klocka, säsongsväljare under, solbåge + månbana, hour-ticks
 * 00–24, valbara lager (elpris-linje + förbrukningslinje), och scrubber.
 *
 * Klick/drag på SVG:n scrubbar tiden. Sol och måne rör sig längs sina banor.
 */
export default function TimelineSvg({
  scenario,
  settings,
  minute,
  showPrice,
  showCons,
  onScrub,
  onSeasonChange,
}: TimelineSvgProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const h = minute / 60;
  const hourString = String(Math.floor(minute / 60)).padStart(2, "0");
  const sunArcD = buildSunArcPath(settings.season);
  const sun = sunPosAt(h, settings.season);
  const moon = moonPosAt(h, settings.season);
  const nowX = (h / 24) * W;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRel = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    onScrub(Math.max(0, Math.min(1439, Math.round(xRel * 1440))));
  };

  // Pris-linje (öre/kWh)
  const priceLineD = (() => {
    if (!showPrice) return "";
    const w = W;
    const hG = 100;
    const ymax = 400;
    const yFor = (p: number) => hG - (Math.min(p, ymax) / ymax) * (hG - 10);
    if (settings.prismodell === "manadsmedel") {
      const y = yFor(scenario.monthAvg);
      return `M 0 ${y} L ${w} ${y}`;
    }
    const pts: Array<[number, number]> = [];
    for (let h2 = 0; h2 <= 24; h2++) {
      pts.push([(h2 / 24) * w, yFor(scenario.prices[h2 % 24])]);
    }
    return pts
      .map(
        (pt, i) =>
          (i === 0 ? "M" : "L") +
          ` ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`,
      )
      .join(" ");
  })();

  // Förbrukningslinje (kW)
  const consLineD = (() => {
    if (!showCons) return "";
    const w = W;
    const hG = 100;
    const kwMax = 12;
    const yFor = (kw: number) =>
      hG - (Math.min(kw, kwMax) / kwMax) * (hG - 10);
    const pts: Array<[number, number]> = [];
    for (let h2 = 0; h2 <= 24; h2++) {
      pts.push([
        (h2 / 24) * w,
        yFor(scenario.hours[h2 % 24].totalDemand),
      ]);
    }
    return pts
      .map(
        (pt, i) =>
          (i === 0 ? "M" : "L") +
          ` ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`,
      )
      .join(" ");
  })();

  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{
        background: VIZ_PALETTE.bgStage,
        userSelect: "none",
      }}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex flex-col items-center min-w-[86px] flex-shrink-0 gap-1.5">
          <span
            className="text-[11px] tracking-wider"
            style={{ color: VIZ_PALETTE.textSecondary }}
          >
            KL
          </span>
          <span
            className="text-[56px] font-medium tabular-nums leading-none"
            style={{ color: VIZ_PALETTE.textPrimary }}
          >
            {hourString}
          </span>
          <SeasonSelector value={settings.season} onChange={onSeasonChange} />
        </div>

        <div className="flex-1 min-w-0">
          <svg
            ref={svgRef}
            viewBox="0 0 700 115"
            preserveAspectRatio="none"
            className="block w-full h-[132px] cursor-ew-resize"
            onPointerDown={(e) => {
              draggingRef.current = true;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              handlePointer(e);
            }}
            onPointerMove={(e) => draggingRef.current && handlePointer(e)}
            onPointerUp={() => (draggingRef.current = false)}
            onPointerCancel={() => (draggingRef.current = false)}
          >
            {(showPrice || showCons) && (
              <g>
                <line
                  x1="0"
                  y1="32.5"
                  x2="700"
                  y2="32.5"
                  stroke={VIZ_PALETTE.lineDim}
                  strokeWidth="0.5"
                  opacity="0.7"
                />
                <line
                  x1="0"
                  y1="55"
                  x2="700"
                  y2="55"
                  stroke={VIZ_PALETTE.lineDim}
                  strokeWidth="0.5"
                  opacity="0.7"
                />
                <line
                  x1="0"
                  y1="77.5"
                  x2="700"
                  y2="77.5"
                  stroke={VIZ_PALETTE.lineDim}
                  strokeWidth="0.5"
                  opacity="0.7"
                />
              </g>
            )}
            {/* Sun arc */}
            <path
              d={sunArcD}
              fill="rgba(220,169,75,0.10)"
              stroke="rgba(220,169,75,0.35)"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1="100"
              x2="700"
              y2="100"
              stroke={VIZ_PALETTE.lineDim}
              strokeWidth="0.6"
              opacity="0.7"
            />
            {/* Pris-linje */}
            {showPrice && (
              <path
                d={priceLineD}
                fill="none"
                stroke={VIZ_PALETTE.accent}
                strokeWidth="1.8"
                strokeLinejoin="round"
              >
                <title>Spotpris inkl. moms och skatter (öre/kWh)</title>
              </path>
            )}
            {/* Förbrukningslinje */}
            {showCons && (
              <path
                d={consLineD}
                fill="none"
                stroke={VIZ_PALETTE.accentCons}
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <title>Hushållets eleffekt (kW)</title>
              </path>
            )}
            {/* Now-line */}
            <line
              x1={nowX}
              y1="0"
              x2={nowX}
              y2="100"
              stroke={VIZ_PALETTE.accentDeep}
              strokeWidth="1"
              opacity="0.3"
            />
            {/* Sun icon */}
            {sun && (
              <g>
                <circle
                  cx={sun.x}
                  cy={sun.y}
                  r="14"
                  fill={VIZ_PALETTE.accentSun}
                  opacity="0.18"
                />
                <g
                  transform={`translate(${sun.x.toFixed(1)},${sun.y.toFixed(1)})`}
                >
                  <circle r="7" fill={VIZ_PALETTE.accentSun} />
                  <g
                    stroke={VIZ_PALETTE.accentSun}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  >
                    <line x1="0" y1="-11" x2="0" y2="-15" />
                    <line x1="0" y1="11" x2="0" y2="15" />
                    <line x1="-11" y1="0" x2="-15" y2="0" />
                    <line x1="11" y1="0" x2="15" y2="0" />
                    <line x1="-8" y1="-8" x2="-11" y2="-11" />
                    <line x1="8" y1="8" x2="11" y2="11" />
                    <line x1="-8" y1="8" x2="-11" y2="11" />
                    <line x1="8" y1="-8" x2="11" y2="-11" />
                  </g>
                </g>
              </g>
            )}
            {/* Moon icon */}
            {moon && (
              <g
                transform={`translate(${moon.x.toFixed(1)},${moon.y.toFixed(1)})`}
              >
                <circle r="13" fill="#B5BAAE" opacity="0.18" />
                <circle r="7" fill="#D8DDE1" />
                <circle cx="3" cy="-1.5" r="5.8" fill="#F4F1E9" />
              </g>
            )}
            {/* Hour ticks */}
            {(
              [
                { x: 6, label: "00", anchor: "start" },
                { x: 175, label: "06", anchor: "middle" },
                { x: 350, label: "12", anchor: "middle" },
                { x: 525, label: "18", anchor: "middle" },
                { x: 694, label: "24", anchor: "end" },
              ] as const
            ).map((t) => (
              <text
                key={t.label}
                x={t.x}
                y="113"
                textAnchor={t.anchor}
                fontSize="10"
                fontWeight="500"
                fill={VIZ_PALETTE.textSecondary}
              >
                {t.label}
              </text>
            ))}
            {/* Y-axis labels */}
            {showCons &&
              [
                { y: 36, label: "9 kW" },
                { y: 58.5, label: "6 kW" },
                { y: 81, label: "3 kW" },
              ].map((l) => (
                <text
                  key={l.label}
                  x="6"
                  y={l.y}
                  fontSize="10"
                  fontWeight="500"
                  fill={VIZ_PALETTE.accentCons}
                >
                  {l.label}
                </text>
              ))}
            {showPrice &&
              [
                { y: 36, label: "300" },
                { y: 58.5, label: "200" },
                { y: 81, label: "100" },
              ].map((l) => (
                <text
                  key={l.label}
                  x="694"
                  y={l.y}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="500"
                  fill={VIZ_PALETTE.textSecondary}
                >
                  {l.label}
                </text>
              ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
