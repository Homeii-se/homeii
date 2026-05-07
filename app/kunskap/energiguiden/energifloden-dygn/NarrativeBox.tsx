"use client";

import type { Narrative } from "@/lib/energy-flow";
import { VIZ_PALETTE } from "./ui-constants";

interface NarrativeBoxProps {
  narrative: Narrative;
}

/**
 * Mörk grön ruta med rubrik och brödtext som beskriver vad som händer just nu
 * i scenariot. Vänsterborder-färg ändras baserat på mood:
 *   - 'warn' → gul varningsfärg
 *   - 'peak-good' → ljusgrön (bra peak-shaving)
 *   - '' → ingen border-färg
 */
export default function NarrativeBox({ narrative }: NarrativeBoxProps) {
  const borderColor =
    narrative.mood === "warn"
      ? "#D9A742"
      : narrative.mood === "peak-good"
      ? "#6B9C84"
      : "transparent";
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: VIZ_PALETTE.bgNarrative,
        color: VIZ_PALETTE.textOnDark,
        borderLeft: `4px solid ${borderColor}`,
        transition: "border-left-color 0.3s ease",
      }}
    >
      <div className="font-medium text-base leading-tight mb-2">
        {narrative.head}
      </div>
      <div className="text-sm leading-relaxed" style={{ color: "rgba(230,237,231,0.88)" }}>
        {narrative.body}
      </div>
    </div>
  );
}
