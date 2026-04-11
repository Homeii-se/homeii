"use client";

import type { SEZone } from "../types";
import { STRINGS } from "../data/strings";

interface SEZoneSelectorProps {
  zone: SEZone;
  onChange: (zone: SEZone) => void;
}

const ZONES: SEZone[] = ["SE1", "SE2", "SE3", "SE4"];

export default function SEZoneSelector({ zone, onChange }: SEZoneSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-text-secondary">
        {STRINGS.seZoneLabel}
      </span>
      <div className="glass-card inline-flex rounded-xl p-1">
        {ZONES.map((z) => (
          <button
            key={z}
            onClick={() => onChange(z)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              zone === z
                ? "bg-white/10 text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {z}
          </button>
        ))}
      </div>
    </div>
  );
}
