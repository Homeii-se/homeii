"use client";

import { useState } from "react";
import type { ActiveUpgrades, AnnualSummary, UpgradeId } from "../types";
import { STRINGS } from "../data/strings";
import { UPGRADE_DEFINITIONS } from "../data/upgrade-catalog";
import UpgradeToggle from "./UpgradeToggle";
import UpgradeEvidencePanel from "./UpgradeEvidencePanel";

interface UpgradePanelProps {
  activeUpgrades: ActiveUpgrades;
  onToggle: (id: UpgradeId) => void;
  annualSummary: AnnualSummary;
  recommendedUpgradeIds?: UpgradeId[];
}

export default function UpgradePanel({
  activeUpgrades,
  onToggle,
  annualSummary,
  recommendedUpgradeIds,
}: UpgradePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<UpgradeId | null>(null);

  const anyActive = Object.values(activeUpgrades).some(Boolean);

  function getDisabledReason(upgrade: (typeof UPGRADE_DEFINITIONS)[0]): string | undefined {
    if (upgrade.requires && !activeUpgrades[upgrade.requires]) {
      return STRINGS.requiresSolar;
    }
    if (upgrade.incompatibleWith) {
      const conflict = upgrade.incompatibleWith.find(
        (id) => activeUpgrades[id as UpgradeId]
      );
      if (conflict) {
        return STRINGS.incompatiblePump;
      }
    }
    return undefined;
  }

  function isDisabled(upgrade: (typeof UPGRADE_DEFINITIONS)[0]): boolean {
    return !!getDisabledReason(upgrade);
  }

  return (
    <div className="card-strong rounded-2xl">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            {STRINGS.upgradesTitle}
          </h3>
          <p className="text-xs text-text-muted">
            {STRINGS.upgradesSubtitle}
          </p>
        </div>
        <svg
          className={`h-5 w-5 text-text-muted transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable grid */}
      {expanded && (
        <div className="border-t border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {UPGRADE_DEFINITIONS.map((upgrade) => (
              <div key={upgrade.id} className="relative">
                {recommendedUpgradeIds?.includes(upgrade.id) && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center rounded-full bg-cta-orange px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Rek.
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEvidenceFor(upgrade.id); }}
                  className="absolute bottom-2 right-2 z-10 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2E7D52]/10 hover:bg-[#2E7D52]/25 text-[#2E7D52] text-xs font-semibold transition"
                  title="Så räknade vi"
                  aria-label={`Så räknade vi - ${upgrade.label}`}
                >
                  i
                </button>
                <UpgradeToggle
                  upgrade={upgrade}
                  active={activeUpgrades[upgrade.id]}
                  disabled={isDisabled(upgrade)}
                  disabledReason={getDisabledReason(upgrade)}
                  onToggle={(id) => onToggle(id as UpgradeId)}
                />
              </div>
            ))}
          </div>

          {/* Evidens-panel för vald åtgärd */}
          {evidenceFor && (
            <div className="mt-4">
              <UpgradeEvidencePanel
                upgradeId={evidenceFor}
                onClose={() => setEvidenceFor(null)}
              />
            </div>
          )}

          {/* Summary footer */}
          {anyActive && (
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
              <div>
                <span className="text-text-muted">{STRINGS.totalInvestment}: </span>
                <span className="font-semibold text-text-primary">
                  {annualSummary.totalInvestmentCost.toLocaleString("sv-SE")} kr
                </span>
              </div>
              {annualSummary.paybackYears > 0 && (
                <div>
                  <span className="text-text-muted">{STRINGS.paybackTime}: </span>
                  <span className="font-semibold text-text-primary">
                    {annualSummary.paybackYears} {STRINGS.years}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}