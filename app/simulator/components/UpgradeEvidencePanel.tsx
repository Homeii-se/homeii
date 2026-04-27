"use client";

/**
 * UpgradeEvidencePanel – "Så räknade vi"-panel för en åtgärd.
 * Visar källor, antaganden, beräkningssätt och skyddsvärde mot scenarier.
 */

import type { UpgradeId } from "../types";
import { UPGRADE_DEFINITIONS } from "../data/upgrade-catalog";
import { UPGRADE_EVIDENCE } from "../data/upgrade-evidence";
import { SCENARIO_PRESETS } from "../data/scenarios-presets";

interface Props {
  upgradeId: UpgradeId;
  onClose?: () => void;
}

const SHIELD_LEVELS: Record<number, { label: string; color: string }> = {
  0: { label: "Ingen effekt",   color: "text-[#1A3C2A]/40" },
  1: { label: "Något skydd",    color: "text-[#F4A261]" },
  2: { label: "Starkt skydd",   color: "text-[#2E7D52]" },
  3: { label: "Mycket starkt",  color: "text-[#1A3C2A] font-semibold" },
};

export default function UpgradeEvidencePanel({ upgradeId, onClose }: Props) {
  const upgrade = UPGRADE_DEFINITIONS.find((u) => u.id === upgradeId);
  const evidence = UPGRADE_EVIDENCE[upgradeId];
  if (!upgrade || !evidence) return null;

  return (
    <div className="rounded-xl bg-[#F7F3EE] border border-[#2E7D52]/30 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#1A3C2A]/60">Så räknade vi</div>
          <h3 className="text-lg font-bold text-[#1A3C2A]">
            {upgrade.icon ? <span className="mr-2">{upgrade.icon}</span> : null}
            {upgrade.label}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#1A3C2A]/50 hover:text-[#1A3C2A] text-sm"
            aria-label="Stäng"
          >
            ✕
          </button>
        )}
      </div>

      <p className="text-sm text-[#1A3C2A]/80 leading-relaxed">
        {evidence.whatItDoes}
      </p>

      {/* Beräkningsmetod */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[#1A3C2A] uppercase tracking-wide">Så räknas besparingen</h4>
        <p className="text-sm text-[#1A3C2A]/80 leading-relaxed">
          {evidence.savingsAssumption.description}
        </p>
        {evidence.savingsAssumption.rangeNote && (
          <p className="text-xs text-[#1A3C2A]/60 italic">
            {evidence.savingsAssumption.rangeNote}
          </p>
        )}
      </div>

      {/* Kostnad & livslängd */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white border border-[#2E7D52]/15 p-3">
          <div className="font-semibold text-[#1A3C2A] mb-1">Kostnad</div>
          <div className="text-[#1A3C2A]/80 leading-relaxed">
            {evidence.costAssumption}
          </div>
        </div>
        <div className="rounded-lg bg-white border border-[#2E7D52]/15 p-3">
          <div className="font-semibold text-[#1A3C2A] mb-1">Livslängd</div>
          <div className="text-[#1A3C2A]/80 leading-relaxed">
            {evidence.lifespanAssumption}
          </div>
        </div>
      </div>

      {/* Skyddsvärde mot scenarier */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-[#1A3C2A] uppercase tracking-wide">
          Så skyddar åtgärden mot framtida scenarier
        </h4>
        <div className="space-y-1.5">
          {SCENARIO_PRESETS.map((scenario) => {
            const shield = evidence.scenarioShielding[scenario.id];
            const level = shield?.level ?? 0;
            const meta = SHIELD_LEVELS[level];
            return (
              <div
                key={scenario.id}
                className="grid grid-cols-[1fr_auto] gap-2 text-xs items-start py-1.5 border-b border-[#2E7D52]/10 last:border-0"
              >
                <div>
                  <div className="font-medium text-[#1A3C2A]">{scenario.label}</div>
                  {shield?.why && (
                    <div className="text-[#1A3C2A]/60 leading-snug mt-0.5">{shield.why}</div>
                  )}
                </div>
                <div className={`text-[11px] whitespace-nowrap ${meta.color}`}>
                  {meta.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Källor */}
      {evidence.sources.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[#1A3C2A] uppercase tracking-wide mb-1">Källor</h4>
          <ul className="text-[11px] space-y-0.5">
            {evidence.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2E7D52] hover:underline"
                >
                  {s.label}
                </a>
                <span className="text-[#1A3C2A]/40"> · hämtat {s.retrievedAt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
