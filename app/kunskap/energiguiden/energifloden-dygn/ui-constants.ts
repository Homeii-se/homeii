import type { Season } from "@/lib/energy-flow";

/**
 * UI-konstanter för energiflödes-visualiseringen.
 *
 * Här bor allt som är specifikt för det visuella (SVG-koordinater, färger,
 * flödesvägar). Ren simuleringslogik finns i `lib/energy-flow/`.
 */

/** Solens peakhöjd i SVG-viewBoxen (y-koordinat, lägre = högre upp på taket). */
export const SUN_PEAK_Y: Record<Season, number> = {
  vinter: 75,
  host: 47,
  sommar: 22,
};

/** Position för varje nod i hus-vy-SVG:n (viewBox 700×470). */
export const NODE_POS = {
  sol: { x: 130, y: 65 },
  grid: { x: 570, y: 65 },
  bat: { x: 130, y: 320 },
  heat: { x: 290, y: 320 },
  ev: { x: 430, y: 320 },
  other: { x: 570, y: 320 },
} as const;

export type NodeKey = keyof typeof NODE_POS;

/**
 * Definitioner av varje energiflöde mellan källa och destination.
 * Används av HouseView för att rita osynliga geometri-paths som
 * partiklar följer via `<animateMotion>`.
 */
export interface FlowDef {
  /** Allokeringsnyckel (matchar lib/energy-flow/types.ts). */
  id: string;
  src: NodeKey;
  dst: NodeKey;
  /** Färgklass: 'sol' (gul), 'grid' (grå), 'bat' (teal). */
  col: "sol" | "grid" | "bat";
  /** Quadratisk Bezier-kontrollpunkt [x, y]. */
  ctrl: [number, number];
}

export const FLOWS: FlowDef[] = [
  { id: "sol-heat", src: "sol", dst: "heat", col: "sol", ctrl: [200, 250] },
  { id: "sol-ev", src: "sol", dst: "ev", col: "sol", ctrl: [280, 230] },
  { id: "sol-other", src: "sol", dst: "other", col: "sol", ctrl: [350, 200] },
  { id: "sol-bat", src: "sol", dst: "bat", col: "sol", ctrl: [80, 180] },
  { id: "sol-grid", src: "sol", dst: "grid", col: "sol", ctrl: [350, 30] },
  { id: "grid-heat", src: "grid", dst: "heat", col: "grid", ctrl: [500, 250] },
  { id: "grid-ev", src: "grid", dst: "ev", col: "grid", ctrl: [550, 200] },
  { id: "grid-other", src: "grid", dst: "other", col: "grid", ctrl: [620, 180] },
  { id: "grid-bat", src: "grid", dst: "bat", col: "grid", ctrl: [350, 200] },
  { id: "bat-heat", src: "bat", dst: "heat", col: "bat", ctrl: [210, 240] },
  { id: "bat-ev", src: "bat", dst: "ev", col: "bat", ctrl: [280, 240] },
  { id: "bat-other", src: "bat", dst: "other", col: "bat", ctrl: [350, 240] },
  { id: "ev-heat", src: "ev", dst: "heat", col: "bat", ctrl: [360, 240] },
  { id: "ev-other", src: "ev", dst: "other", col: "bat", ctrl: [500, 240] },
];

/**
 * Tempo-inställningar för auto-uppspelning.
 * Värdet är millisekunder för ett helt dygn (24h sim → realtid).
 */
export const TEMPOS = {
  slow: 120000, // 0.5x
  normal: 60000, // 1x
  fast: 30000, // 2x
} as const;

export type Tempo = keyof typeof TEMPOS;

/** Visningsläge i stage-panelen. */
export type ViewMode = "hus" | "diagram";

/**
 * Beräknar punkt på en quadratisk Bezier-kurva vid parameter t (0–1).
 * Används för att placera kW-stickers i mittpunkten av varje flöde.
 */
export function quadraticAt(
  t: number,
  a: { x: number; y: number },
  ctrl: [number, number],
  b: { x: number; y: number },
): { x: number; y: number } {
  const x =
    (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrl[0] + t * t * b.x;
  const y =
    (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrl[1] + t * t * b.y;
  return { x, y };
}

/**
 * Bygger SVG-path-d för ett flöde mellan två noder.
 */
export function flowPathD(flow: FlowDef): string {
  const a = NODE_POS[flow.src];
  const b = NODE_POS[flow.dst];
  return `M ${a.x} ${a.y} Q ${flow.ctrl[0]} ${flow.ctrl[1]} ${b.x} ${b.y}`;
}

/** Visualiseringspalett — scoped CSS-variabler för komponenten. */
export const VIZ_PALETTE = {
  bgPage: "#F0EAD6",
  bgCard: "#FFFFFF",
  bgStage: "#F4F1E9",
  bgStat: "#FAF7EE",
  bgNarrative: "#1E3A2A",
  textPrimary: "#243B30",
  textSecondary: "#5C6B61",
  textTertiary: "#8C9690",
  textOnDark: "#E6EDE7",
  border: "rgba(36, 59, 48, 0.18)",
  borderStrong: "rgba(36, 59, 48, 0.32)",
  accent: "#2D7A4F",
  accentDeep: "#1E3A2A",
  accentCons: "#B97045",
  accentSun: "#DCA94B",
  accentStorage: "#2D7A6F",
  accentGrid: "#758895",
  lineDim: "#C9C4B4",
  gaugeBg: "#D5D2C5",
} as const;
