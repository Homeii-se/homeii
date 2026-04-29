"use client";

import { STRINGS } from "../data/strings";

interface DatePickerProps {
  selectedDate: string;
  onChange: (date: string) => void;
}

export default function DatePicker({ selectedDate, onChange }: DatePickerProps) {
  const now = new Date();
  const year = now.getFullYear();
  const todayMapped = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const midwinter = `${year}-01-15`;
  const midsummer = `${year}-06-21`;

  // Allow exploration back to 2020-01-01 (Supabase historical data limit).
  // Useful for simulating 2022 extreme prices via the "fall back to historical"
  // path in /api/spot-prices.
  const minDate = "2020-01-01";
  const maxDate = `${year}-12-31`;

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const next = `${y}-${m}-${day}`;
    if (next < minDate || next > maxDate) return;
    onChange(next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <button
          onClick={() => shiftDay(-1)}
          disabled={selectedDate <= minDate}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Föregående dag"
        >
          ‹
        </button>
        <input
          type="date"
          value={selectedDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
        />
        <button
          onClick={() => shiftDay(1)}
          disabled={selectedDate >= maxDate}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
              ? "bg-brand-100 text-brand-700"
              : "bg-gray-100 text-text-secondary hover:text-text-primary"
          }`}
        >
          {STRINGS.today}
        </button>
        <button
          onClick={() => onChange(midwinter)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            selectedDate === midwinter
              ? "bg-brand-100 text-brand-700"
              : "bg-gray-100 text-text-secondary hover:text-text-primary"
          }`}
        >
          {STRINGS.midwinter}
        </button>
        <button
          onClick={() => onChange(midsummer)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            selectedDate === midsummer
              ? "bg-brand-100 text-brand-700"
              : "bg-gray-100 text-text-secondary hover:text-text-primary"
          }`}
        >
          {STRINGS.midsummer}
        </button>
      </div>
    </div>
  );
}
