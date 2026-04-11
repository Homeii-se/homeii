"use client";

import { STRINGS } from "../data/strings";

interface DatePickerProps {
  selectedDate: string;
  onChange: (date: string) => void;
}

export default function DatePicker({ selectedDate, onChange }: DatePickerProps) {
  // Map today's month+day to 2025 (TMY year)
  const now = new Date();
  const todayMapped = `2025-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const midwinter = "2025-01-15";
  const midsummer = "2025-06-21";

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const next = `${y}-${m}-${day}`;
    // Clamp to 2025-01-01 .. 2025-12-31
    if (next < "2025-01-01" || next > "2025-12-31") return;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <button
          onClick={() => shiftDay(-1)}
          disabled={selectedDate <= "2025-01-01"}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Föregående dag"
        >
          ‹
        </button>
        <input
          type="date"
          value={selectedDate}
          min="2025-01-01"
          max="2025-12-31"
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={() => shiftDay(1)}
          disabled={selectedDate >= "2025-12-31"}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Nästa dag"
        >
          ›
        </button>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(todayMapped)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            selectedDate === todayMapped
              ? "bg-brand-500/20 text-brand-300"
              : "bg-white/10 text-text-secondary hover:text-text-primary"
          }`}
        >
          {STRINGS.today}
        </button>
        <button
          onClick={() => onChange(midwinter)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            selectedDate === midwinter
              ? "bg-brand-500/20 text-brand-300"
              : "bg-white/10 text-text-secondary hover:text-text-primary"
          }`}
        >
          {STRINGS.midwinter}
        </button>
        <button
          onClick={() => onChange(midsummer)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            selectedDate === midsummer
              ? "bg-brand-500/20 text-brand-300"
              : "bg-white/10 text-text-secondary hover:text-text-primary"
          }`}
        >
          {STRINGS.midsummer}
        </button>
      </div>
    </div>
  );
}