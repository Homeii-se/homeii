"use client";

import { useState } from "react";
import {
  allocate,
  buildNarrative,
  type Settings,
} from "@/lib/energy-flow";
import { snapAt, useScenario, useTimeAnimation } from "./hooks";
import { VIZ_PALETTE, type Tempo, type ViewMode } from "./ui-constants";
import HeroPresets from "./HeroPresets";
import Controls from "./Controls";
import TimelineSvg from "./TimelineSvg";
import HouseView from "./HouseView";
import DiagramView from "./DiagramView";
import NarrativeBox from "./NarrativeBox";
import CostCard from "./CostCard";

const PRESET_PRE: Settings = {
  season: "host",
  hasHP: false,
  hasEV: false,
  hasSol: false,
  hasBat: false,
  hasSmart: false,
  prismodell: "manadsmedel",
};

const PRESET_POST: Settings = {
  season: "host",
  hasHP: true,
  hasEV: true,
  hasSol: true,
  hasBat: true,
  hasSmart: true,
  prismodell: "dynamiskt",
};

/**
 * Huvudkomponenten för energiflödes-visualiseringen.
 * Håller all state (settings, vy-läge, tid, lager-toggles) och komponerar
 * sub-komponenter till en sammanhängande layout.
 */
export default function EnergyFlowApp() {
  const [settings, setSettings] = useState<Settings>(PRESET_PRE);
  const [viewMode, setViewMode] = useState<ViewMode>("hus");
  const [showPrice, setShowPrice] = useState(false);
  const [showCons, setShowCons] = useState(false);

  const { minute, playing, tempo, setMinute, togglePlay, setTempo } =
    useTimeAnimation(438);

  const { scenario, yesterdayScenario, annualSaving } = useScenario(settings);

  const h = minute / 60;
  const snapshot = snapAt(scenario.hours, h);
  const allocation = allocate(snapshot);
  const narrative = buildNarrative(settings, h, snapshot);

  const handlePreset = (which: "pre" | "post") => {
    setSettings(which === "pre" ? { ...PRESET_PRE, season: settings.season } : { ...PRESET_POST, season: settings.season });
  };

  return (
    <div
      className="grid gap-4 items-start"
      style={{ gridTemplateColumns: "1fr 280px" }}
    >
      <div
        className="rounded-2xl p-5 flex flex-col gap-3"
        style={{
          background: VIZ_PALETTE.bgCard,
          border: `0.5px solid ${VIZ_PALETTE.border}`,
        }}
      >
        <HeroPresets settings={settings} onPreset={handlePreset} />

        <div
          className="rounded-2xl p-3.5"
          style={{ background: VIZ_PALETTE.bgStage }}
        >
          <Controls
            settings={settings}
            onSettingsChange={(next) =>
              setSettings((s) => ({ ...s, ...next }))
            }
          />

          {/* Tabs hus-vy / diagram-vy */}
          <div
            className="flex gap-0 mb-3"
            style={{ borderBottom: `1px solid ${VIZ_PALETTE.border}` }}
          >
            <Tab
              active={viewMode === "hus"}
              onClick={() => setViewMode("hus")}
              label="Hus-vy"
            />
            <Tab
              active={viewMode === "diagram"}
              onClick={() => setViewMode("diagram")}
              label="Diagram-vy"
            />
          </div>

          <div className="min-h-[470px] flex items-center justify-center">
            {viewMode === "hus" ? (
              <HouseView
                allocation={allocation}
                snapshot={snapshot}
                settings={settings}
              />
            ) : (
              <DiagramView
                snapshot={snapshot}
                scenario={scenario}
                settings={settings}
              />
            )}
          </div>
        </div>

        <TimelineSvg
          scenario={scenario}
          settings={settings}
          minute={minute}
          showPrice={showPrice}
          showCons={showCons}
          onScrub={setMinute}
          onSeasonChange={(season) => setSettings((s) => ({ ...s, season }))}
        />

        <div className="flex flex-wrap gap-2 items-center pl-[100px]">
          <LayerToggle
            active={showPrice}
            color={VIZ_PALETTE.accent}
            label="Visa elpris"
            tooltip="Spotpris inkl. moms och skatter (öre/kWh)"
            onClick={() => setShowPrice((p) => !p)}
          />
          <LayerToggle
            active={showCons}
            color={VIZ_PALETTE.accentCons}
            label="Visa elanvändning"
            tooltip="Hushållets eleffekt (kW)"
            onClick={() => setShowCons((p) => !p)}
          />
          <div className="ml-auto inline-flex gap-2 items-center">
            <button
              type="button"
              onClick={togglePlay}
              className="min-w-[60px] px-3.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium hover:bg-surface-solid"
              style={{ color: VIZ_PALETTE.textPrimary }}
            >
              {playing ? "Paus" : "Play"}
            </button>
            <select
              value={tempo}
              onChange={(e) => setTempo(e.target.value as Tempo)}
              className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg"
              aria-label="Tempo"
            >
              <option value="slow">0,5x</option>
              <option value="normal">1x</option>
              <option value="fast">2x</option>
            </select>
          </div>
        </div>

        <div
          className="grid gap-2.5 mt-2.5"
          style={{ gridTemplateColumns: "1fr 160px" }}
        >
          <NarrativeBox narrative={narrative} />
          <CostCard
            scenario={scenario}
            yesterdayScenario={yesterdayScenario}
            annualSaving={annualSaving}
            settings={settings}
          />
        </div>
      </div>

      <aside
        className="flex flex-col gap-3 sticky top-4"
        style={{ alignSelf: "start" }}
      >
        <SidePanel title="Två hem">
          <p className="text-sm leading-relaxed mb-2">
            <strong className="font-medium">Gårdagens hem</strong> — passiv
            konsument: direktel, inget annat. Köper varje kilowattimme när den
            behövs.
          </p>
          <p className="text-sm leading-relaxed">
            <strong className="font-medium">Morgondagens hem</strong> — aktiv
            prosument: värmepump, sol, batteri, elbil och smart styrning.
            Samtidigt konsument <em>och</em> producent.
          </p>
        </SidePanel>
      </aside>
    </div>
  );
}

function Tab({
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
      className="px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors"
      style={{
        marginBottom: "-1px",
        borderBottom: active
          ? `2px solid ${VIZ_PALETTE.accentDeep}`
          : "2px solid transparent",
        color: active ? VIZ_PALETTE.accentDeep : VIZ_PALETTE.textSecondary,
      }}
    >
      {label}
    </button>
  );
}

function LayerToggle({
  active,
  color,
  label,
  tooltip,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className="inline-flex items-center gap-1.5 px-3 py-1 text-[11.5px] rounded-full border transition-colors"
      style={{
        borderColor: active ? VIZ_PALETTE.borderStrong : VIZ_PALETTE.border,
        background: active ? VIZ_PALETTE.bgCard : "transparent",
        color: active ? color : VIZ_PALETTE.textSecondary,
      }}
    >
      <span
        className="inline-block w-[9px] h-[9px] rounded-full border-[1.5px]"
        style={{
          borderColor: active ? color : "currentColor",
          background: active ? color : "transparent",
        }}
      />
      {label}
    </button>
  );
}

function SidePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: VIZ_PALETTE.bgCard,
        border: `0.5px solid ${VIZ_PALETTE.border}`,
      }}
    >
      <h3
        className="text-xs uppercase tracking-wider font-medium mb-2"
        style={{ color: VIZ_PALETTE.textSecondary }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
