"use client";

interface BarData {
  label: string;
  value: number;
  secondary?: number;
  highlight?: boolean;
  overlay?: number;
  baseline?: number;
  /** Optional line value (e.g. spot price öre/kWh) plotted as a line overlay */
  lineValue?: number;
}

interface EnergyChartProps {
  data: BarData[];
  unit: string;
  secondaryUnit?: string;
  /** Label for the line overlay, e.g. "öre/kWh" */
  lineUnit?: string;
  height?: number;
}

export default function EnergyChart({
  data,
  unit,
  secondaryUnit,
  lineUnit,
  height = 240,
}: EnergyChartProps) {
  if (data.length === 0) return null;

  const hasOverlay = data.some((d) => d.overlay && d.overlay > 0);
  const hasBaseline = data.some((d) => d.baseline && d.baseline > 0);
  const hasLine = data.some((d) => d.lineValue !== undefined && d.lineValue > 0);

  const allValues = data.flatMap((d) => [
    d.value,
    d.overlay ?? 0,
    d.baseline ?? 0,
  ]);
  const maxValue = Math.max(...allValues);

  const padding = { top: 20, right: hasLine ? 55 : 10, bottom: 40, left: 10 };
  const chartWidth = 600;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const barGap = 4;
  const barWidth = Math.max(
    8,
    (innerWidth - barGap * (data.length - 1)) / data.length
  );

  return (
    <div className="w-full overflow-x-auto">
      {/* Legend */}
      {(hasOverlay || hasBaseline || hasLine) && (
        <div className="mb-2 flex items-center gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-sm bg-brand-500/80" />
            <span>Förbrukning</span>
          </div>
          {hasOverlay && (
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-energy-yellow" />
              <span>Solproduktion</span>
            </div>
          )}
          {hasBaseline && (
            <div className="flex items-center gap-1">
              <div
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: "rgba(46,125,82,0.2)" }}
              />
              <span>Utan åtgärder</span>
            </div>
          )}
          {hasLine && (
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4 rounded" style={{ background: "#f97316" }} />
              <span>Elpris</span>
            </div>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + innerHeight * (1 - frac);
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={y}
                y2={y}
                stroke="rgba(26,60,42,0.08)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left}
                y={y - 4}
                fontSize="10"
                fill="#8a8a80"
                textAnchor="start"
              >
                {Math.round(maxValue * frac)} {unit}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + i * (barWidth + barGap);

          // Baseline bar (transparent, behind main bar)
          const baselineHeight =
            d.baseline && maxValue > 0
              ? (d.baseline / maxValue) * innerHeight
              : 0;
          const baselineY = padding.top + innerHeight - baselineHeight;

          // Main bar
          const barHeight =
            maxValue > 0 ? (d.value / maxValue) * innerHeight : 0;
          const y = padding.top + innerHeight - barHeight;

          // Overlay bar (solar)
          const overlayHeight =
            d.overlay && maxValue > 0
              ? (d.overlay / maxValue) * innerHeight
              : 0;
          const overlayY = padding.top + innerHeight - overlayHeight;

          return (
            <g key={i}>
              {/* Baseline bar */}
              {baselineHeight > 0 && (
                <rect
                  x={x}
                  y={baselineY}
                  width={barWidth}
                  height={baselineHeight}
                  rx={3}
                  fill="rgba(46,125,82,0.15)"
                  className="animate-bar-grow"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              )}

              {/* Main consumption bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                className="animate-bar-grow"
                style={{ animationDelay: `${i * 40}ms` }}
                fill={d.highlight ? "#256B45" : "#2E7D52"}
                opacity={d.highlight ? 1 : 0.75}
              />

              {/* Overlay bar (solar) — rendered as a semi-transparent bar from bottom */}
              {overlayHeight > 0 && (
                <rect
                  x={x + 1}
                  y={overlayY}
                  width={barWidth - 2}
                  height={overlayHeight}
                  rx={2}
                  fill="#eab308"
                  opacity={0.6}
                  className="animate-bar-grow"
                  style={{ animationDelay: `${i * 40 + 200}ms` }}
                />
              )}

              {/* Value on top */}
              <text
                x={x + barWidth / 2}
                y={Math.min(y, overlayHeight > 0 ? overlayY : y) - 4}
                fontSize="9"
                fill="#4a4a4a"
                textAnchor="middle"
              >
                {unit === "kr" || unit === "kW"
                  ? d.value.toLocaleString("sv-SE", { minimumFractionDigits: d.value < 10 ? 1 : 0, maximumFractionDigits: d.value < 10 ? 1 : 0 })
                  : d.value.toLocaleString("sv-SE")}
              </text>

              {/* Label below */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - padding.bottom + 16}
                fontSize="11"
                fill="#4a4a4a"
                textAnchor="middle"
              >
                {d.label}
              </text>

              {/* Secondary value */}
              {d.secondary !== undefined && secondaryUnit && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight - padding.bottom + 30}
                  fontSize="9"
                  fill="#8a8a80"
                  textAnchor="middle"
                >
                  {d.secondary.toLocaleString("sv-SE")} {secondaryUnit}
                </text>
              )}
            </g>
          );
        })}

        {/* Price line overlay */}
        {hasLine && (() => {
          const lineValues = data.map((d) => d.lineValue ?? 0);
          const maxLine = Math.max(...lineValues);
          const minLine = Math.min(...lineValues.filter((v) => v > 0));
          // Add 20% headroom so line doesn't touch the top
          const lineMax = maxLine * 1.2;
          const lineMin = Math.max(0, minLine * 0.8);
          const lineRange = lineMax - lineMin || 1;

          const points = data.map((d, i) => {
            const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
            const val = d.lineValue ?? 0;
            const y = padding.top + innerHeight * (1 - (val - lineMin) / lineRange);
            return `${x},${y}`;
          });

          // Right-side Y-axis grid labels
          const lineGridFracs = [0, 0.5, 1];
          const rightAxisX = chartWidth - padding.right + 2;

          return (
            <g>
              {/* Line path */}
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
              {/* Dots at each point */}
              {data.map((d, i) => {
                if (!d.lineValue) return null;
                const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
                const y = padding.top + innerHeight * (1 - (d.lineValue - lineMin) / lineRange);
                return (
                  <circle
                    key={`dot-${i}`}
                    cx={x}
                    cy={y}
                    r={2.5}
                    fill="#f97316"
                    opacity={0.9}
                  />
                );
              })}
              {/* Right Y-axis labels */}
              {lineGridFracs.map((frac) => {
                const y = padding.top + innerHeight * (1 - frac);
                const val = lineMin + lineRange * frac;
                return (
                  <text
                    key={`line-label-${frac}`}
                    x={rightAxisX}
                    y={y + 3}
                    fontSize="9"
                    fill="#f97316"
                    textAnchor="start"
                    opacity={0.7}
                  >
                    {Math.round(val)} {lineUnit ?? ""}
                  </text>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
