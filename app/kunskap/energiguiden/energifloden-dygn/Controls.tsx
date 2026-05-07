"use client";

import { useState } from "react";
import type { Settings, Season, PriceModel } from "@/lib/energy-flow";

interface ControlsProps {
  settings: Settings;
  onSettingsChange: (next: Partial<Settings>) => void;
}

/**
 * Kontrollpanel ovanför stage: prismodell-toggle, "anpassa själv"-knapp som
 * öppnar utrustnings-toggles. Säsongsväljaren ligger i klockan (i tidslinjen).
 */
export default function Controls({ settings, onSettingsChange }: ControlsProps) {
  const [anpassaOpen, setAnpassaOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 mb-3">
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          Pris
        </span>
        <Segmented
          value={settings.prismodell}
          options={[
            { value: "manadsmedel", label: "Månadsmedel" },
            { value: "dynamiskt", label: "Dynamiskt" },
          ]}
          onChange={(v) => onSettingsChange({ prismodell: v as PriceModel })}
        />
      </div>

      <button
        type="button"
        className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:bg-surface-solid"
        onClick={() => setAnpassaOpen((o) => !o)}
      >
        {anpassaOpen ? "Dölj ↑" : "Anpassa själv ↓"}
      </button>

      {anpassaOpen && (
        <div className="basis-full flex flex-wrap items-center gap-1.5 px-2.5 py-2 bg-black/[0.03] rounded-lg">
          <span className="text-[11px] uppercase tracking-wider text-text-muted mr-1">
            Anpassa
          </span>
          <AssetToggle
            active={settings.hasHP}
            onClick={() => onSettingsChange({ hasHP: !settings.hasHP })}
            label="+ Värmepump"
          />
          <AssetToggle
            active={settings.hasEV}
            onClick={() => onSettingsChange({ hasEV: !settings.hasEV })}
            label="+ Elbil"
          />
          <AssetToggle
            active={settings.hasSol}
            onClick={() => onSettingsChange({ hasSol: !settings.hasSol })}
            label="+ Sol"
          />
          <AssetToggle
            active={settings.hasBat}
            onClick={() => onSettingsChange({ hasBat: !settings.hasBat })}
            label="+ Batteri"
          />
          <AssetToggle
            active={settings.hasSmart}
            onClick={() => onSettingsChange({ hasSmart: !settings.hasSmart })}
            label="+ Smart"
          />
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-xs px-3 py-1.5 ${
            i > 0 ? "border-l border-gray-200" : ""
          } ${
            value === opt.value
              ? "bg-brand-900 text-white font-medium"
              : "bg-transparent text-brand-900 hover:bg-surface-solid"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function AssetToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11.5px] px-2.5 py-1 rounded-md border ${
        active
          ? "bg-brand-500 border-brand-500 text-white"
          : "bg-transparent border-gray-200 text-brand-900 hover:bg-surface-solid"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Säsongsväljare (används separat under klockan i tidslinjen).
 */
export function SeasonSelector({
  value,
  onChange,
}: {
  value: Season;
  onChange: (v: Season) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Season)}
      className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 bg-white"
      aria-label="Säsong"
    >
      <option value="vinter">Vinter</option>
      <option value="host">Vår·Höst</option>
      <option value="sommar">Sommar</option>
    </select>
  );
}
