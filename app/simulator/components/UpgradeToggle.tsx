"use client";

import type { UpgradeDefinition } from "../types";

interface UpgradeToggleProps {
  upgrade: UpgradeDefinition;
  active: boolean;
  disabled: boolean;
  disabledReason?: string;
  onToggle: (id: string) => void;
}

export default function UpgradeToggle({
  upgrade,
  active,
  disabled,
  disabledReason,
  onToggle,
}: UpgradeToggleProps) {
  return (
    <button
      onClick={() => !disabled && onToggle(upgrade.id)}
      disabled={disabled}
      className={`glass-card flex flex-col gap-1.5 rounded-xl !border-2 p-3 text-left transition-all ${
        active
          ? "!border-energy-green !bg-green-500/10"
          : disabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:!border-brand-300 cursor-pointer"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{upgrade.icon}</span>
          <span className="text-sm font-semibold text-text-primary">
            {upgrade.label}
          </span>
        </div>
        <div
          className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
            active ? "bg-energy-green" : "bg-slate-500"
          }`}
        >
          <div
            className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
              active ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </div>
      </div>
      <p className="text-xs text-text-muted leading-tight">
        {upgrade.description}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          {upgrade.investmentCostSEK.toLocaleString("sv-SE")} kr
        </span>
        <span className="text-xs text-text-muted">
          {upgrade.lifespanYears} år
        </span>
      </div>
      {disabled && disabledReason && (
        <span className="text-xs text-energy-red">{disabledReason}</span>
      )}
    </button>
  );
}
