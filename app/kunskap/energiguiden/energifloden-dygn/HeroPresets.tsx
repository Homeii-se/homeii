"use client";

import type { Settings } from "@/lib/energy-flow";

interface HeroPresetsProps {
  settings: Settings;
  onPreset: (preset: "pre" | "post") => void;
}

/**
 * Hero-kort: gårdagens hem (passiv konsument) vs morgondagens hem (aktiv prosument).
 * Klick aktiverar respektive preset.
 */
export default function HeroPresets({ settings, onPreset }: HeroPresetsProps) {
  const isPre =
    !settings.hasHP &&
    !settings.hasEV &&
    !settings.hasSol &&
    !settings.hasBat &&
    !settings.hasSmart &&
    settings.prismodell === "manadsmedel";

  const isPost =
    settings.hasHP &&
    settings.hasEV &&
    settings.hasSol &&
    settings.hasBat &&
    settings.hasSmart &&
    settings.prismodell === "dynamiskt";

  return (
    <div className="text-center pb-4">
      <div className="text-xs text-text-muted mb-2.5">
        Klicka för att jämföra gårdagens och morgondagens hem
      </div>
      <div className="inline-flex flex-wrap items-center justify-center gap-2.5">
        <PresetCard
          active={isPre}
          onClick={() => onPreset("pre")}
          title="Gårdagens hem"
          desc="Passiv konsument"
          illustration={<PreIllustration />}
        />
        <span className="text-base text-text-tertiary opacity-55 select-none">
          →
        </span>
        <PresetCard
          active={isPost}
          onClick={() => onPreset("post")}
          title="Morgondagens hem"
          desc="Aktiv prosument"
          illustration={<PostIllustration />}
        />
      </div>
    </div>
  );
}

function PresetCard({
  active,
  onClick,
  title,
  desc,
  illustration,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  illustration: React.ReactNode;
}) {
  const base =
    "w-44 px-3.5 py-3 rounded-xl border-[1.5px] flex flex-col items-center gap-1.5 transition-colors cursor-pointer";
  const variant = active
    ? "bg-brand-900 border-brand-900 text-white"
    : "bg-white border-gray-200 text-brand-900 hover:bg-surface-solid hover:border-gray-300";
  return (
    <button type="button" className={`${base} ${variant}`} onClick={onClick}>
      {illustration}
      <div className="text-[13.5px] font-medium tracking-tight">{title}</div>
      <div className="text-[10.5px] uppercase tracking-wider opacity-80">
        {desc}
      </div>
    </button>
  );
}

function PreIllustration() {
  return (
    <svg className="w-full h-[50px]" viewBox="0 0 160 70" fill="none">
      <line
        x1="10"
        y1="62"
        x2="150"
        y2="62"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeDasharray="2 2"
        opacity="0.5"
      />
      <path
        d="M 42 62 L 42 38 L 80 18 L 118 38 L 118 62 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M 73 62 L 73 50 L 87 50 L 87 62"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <rect
        x="50"
        y="44"
        width="11"
        height="9"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <rect
        x="99"
        y="44"
        width="11"
        height="9"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <rect
        x="100"
        y="22"
        width="5"
        height="10"
        stroke="currentColor"
        strokeWidth="1"
      />
      <g
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.55"
      >
        <path d="M 102 18 Q 104 14 102 12 Q 100 9 102 6" />
      </g>
    </svg>
  );
}

function PostIllustration() {
  return (
    <svg className="w-full h-[50px]" viewBox="0 0 160 70" fill="none">
      <line
        x1="10"
        y1="62"
        x2="150"
        y2="62"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeDasharray="2 2"
        opacity="0.5"
      />
      <path
        d="M 42 62 L 42 38 L 80 18 L 118 38 L 118 62 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M 73 62 L 73 50 L 87 50 L 87 62"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <rect
        x="50"
        y="44"
        width="11"
        height="9"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <rect
        x="99"
        y="44"
        width="11"
        height="9"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <g stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round">
        <path d="M 51 35 L 57 24 L 70 24 L 64 35 Z" />
        <path d="M 90 24 L 103 24 L 109 35 L 96 35 Z" />
        <line x1="56" y1="29.5" x2="68" y2="29.5" />
        <line x1="92" y1="29.5" x2="106" y2="29.5" />
      </g>
      <rect
        x="22"
        y="50"
        width="13"
        height="10"
        stroke="currentColor"
        strokeWidth="1.1"
        rx="1"
      />
      <circle
        cx="28.5"
        cy="55"
        r="2.4"
        stroke="currentColor"
        strokeWidth="0.9"
      />
      <rect
        x="125"
        y="46"
        width="11"
        height="14"
        stroke="currentColor"
        strokeWidth="1.1"
        rx="1"
      />
      <line
        x1="128"
        y1="50"
        x2="133"
        y2="50"
        stroke="currentColor"
        strokeWidth="0.7"
      />
      <line
        x1="128"
        y1="54"
        x2="133"
        y2="54"
        stroke="currentColor"
        strokeWidth="0.7"
      />
      <line
        x1="128"
        y1="58"
        x2="133"
        y2="58"
        stroke="currentColor"
        strokeWidth="0.7"
      />
      <g stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
        <path d="M 4 60 L 6 54 L 16 54 L 18 60 Z" />
        <line x1="3" y1="60" x2="19" y2="60" />
        <circle cx="7" cy="62" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="15" cy="62" r="1.3" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
