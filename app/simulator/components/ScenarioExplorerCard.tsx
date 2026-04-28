"use client";

/**
 * ScenarioExplorerCard - splitscreen, mobilanpassad, kallor synliga.
 * Zon-medveten - anvandarens SE-zon paverkar vilken multiplier som anvands.
 */

import { useEffect, useMemo, useState } from "react";
import type { SEZone } from "../types";
import type { Simulate8760Result } from "../simulation/simulate8760";
import {
  computeScenarioFromPreset,
  type FutureScenarioResult,
} from "../simulation/future-scenario";
import {
  fetchAndComputeHistoricalScenario,
  type PriceResolutionChoice,
} from "../simulation/historical-scenario";
import {
  sortedPresetsForUI,
  getPresetById,
  type ScenarioPreset,
} from "../data/scenarios-presets";
import { topShieldingUpgrades, UPGRADE_EVIDENCE } from "../data/upgrade-evidence";
import { UPGRADE_DEFINITIONS } from "../data/upgrade-catalog";

interface Props {
  sim8760: Simulate8760Result | null;
  seZone: SEZone;
  baselineAnnualSpotKr: number;
  baselineAnnualTotalKr: number;
  baselineMonthlyKr: number[];
}

const MONTH_LABELS = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];

type Selection =
  | { kind: "preset"; presetId: string }
  | { kind: "custom"; year: number };

function formatKr(n: number): string {
  return new Intl.NumberFormat("sv-SE").format(Math.round(n)) + " kr";
}
function formatKrShort(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k kr`;
  return `${v} kr`;
}

export default function ScenarioExplorerCard({
  sim8760, seZone, baselineAnnualSpotKr, baselineAnnualTotalKr, baselineMonthlyKr,
}: Props) {
  const presets = useMemo(() => sortedPresetsForUI(), []);
  const [selection, setSelection] = useState<Selection>({ kind: "preset", presetId: presets[0]?.id ?? "" });
  const [priceResolution, setPriceResolution] = useState<PriceResolutionChoice>("hourly");
  const [result, setResult] = useState<FutureScenarioResult["result"] | null>(null);
  const [meta, setMeta] = useState<FutureScenarioResult["meta"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Baseline-spot beräknad från SAMMA ENTSO-E-data som scenarierna - så
  // jämförelsen stämmer. Fallback: baselineAnnualSpotKr från Dashboard.
  const [baselineSpotFromEntsoe, setBaselineSpotFromEntsoe] = useState<number | null>(null);

  const gridImport8760 = sim8760?.gridImport ?? null;
  const hasProfile = gridImport8760 !== null && gridImport8760.length === 8760;
  // Hämta ENTSO-E 2025 för user-zon och räkna baseline-spot (konsistent med scenarier)
  useEffect(() => {
    const gi = sim8760?.gridImport;
    if (!gi || gi.length !== 8760) return;
    let cancelled = false;
    fetch(`/api/historical-prices?zone=${seZone}&year=2025`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.points) return;
        const prices: number[] = data.points.map((p: { priceOreKwh: number }) => p.priceOreKwh);
        let totalOre = 0;
        const len = Math.min(8760, prices.length);
        for (let i = 0; i < len; i++) totalOre += gi[i] * prices[i];
        // inkl moms 25 %
        setBaselineSpotFromEntsoe(Math.round((totalOre / 100) * 1.25));
      })
      .catch((e) => console.warn("[ScenarioExplorer] baseline fetch:", e));
    return () => { cancelled = true; };
  }, [sim8760, seZone]);

  // Använd ENTSO-E-baseline om klar, annars fallback till Dashboard-värdet
  const effectiveBaselineSpot = baselineSpotFromEntsoe ?? baselineAnnualSpotKr;
  const baselineNonSpotKr = Math.max(0, baselineAnnualTotalKr - effectiveBaselineSpot);
  const nonSpotPerMonth = baselineNonSpotKr / 12;

  const selectedPreset = useMemo(() => {
    if (selection.kind === "preset") return getPresetById(selection.presetId) ?? null;
    return null;
  }, [selection]);

  const selectedLabel = useMemo(() => {
    if (selection.kind === "preset") {
      return selectedPreset?.label ?? "Scenario";
    }
    return `År ${selection.year} (${seZone})`;
  }, [selection, selectedPreset, seZone]);

  async function runSelection(sel: Selection, resolution: PriceResolutionChoice) {
    if (!gridImport8760) return;
    setLoading(true);
    setError(null);
    try {
      if (sel.kind === "preset") {
        const preset = getPresetById(sel.presetId);
        if (!preset) throw new Error(`Okant scenario: ${sel.presetId}`);
        const r = await computeScenarioFromPreset(preset, gridImport8760, seZone, resolution);
        setResult(r.result);
        setMeta(r.meta);
      } else {
        const r = await fetchAndComputeHistoricalScenario(sel.year, gridImport8760, seZone, resolution);
        setResult(r);
        setMeta({ method: "direct", explanation: `Anpassat val: hela ${sel.year} (${seZone})` });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function pickPreset(preset: ScenarioPreset) {
    const sel: Selection = { kind: "preset", presetId: preset.id };
    setSelection(sel);
    runSelection(sel, priceResolution);
  }
  function pickCustomYear(year: number) {
    const sel: Selection = { kind: "custom", year };
    setSelection(sel);
    runSelection(sel, priceResolution);
  }
  function toggleResolution(next: PriceResolutionChoice) {
    setPriceResolution(next);
    runSelection(selection, next);
  }

  if (!hasProfile) {
    return (
      <div className="rounded-2xl p-6 bg-[#E8F0E8] border border-[#2E7D52]/20">
        <h2 className="text-xl font-semibold text-[#1A3C2A] mb-2">Vad-om-scenarier</h2>
        <p className="text-[#1A3C2A]/70">
          Scenarier blir tillgängliga när din timprofil har beräknats klart.
        </p>
      </div>
    );
  }

  const scenarioTotalKr = result ? result.totalSpotCostKr + baselineNonSpotKr : 0;
  // Baseline-total i samma datafot: ENTSO-E-baseline-spot + non-spot
  const effectiveBaselineTotalKr = effectiveBaselineSpot + baselineNonSpotKr;
  const delta = result ? scenarioTotalKr - effectiveBaselineTotalKr : 0;
  const deltaPositive = delta > 50;
  const deltaNegative = delta < -50;

  const scenarioMonths = result
    ? result.monthlySpotCostKr.map((s) => s + nonSpotPerMonth)
    : [];
  // Skala månadsvärden om effektiv baseline skiljer sig
  const baselineScaleFactor = baselineAnnualTotalKr > 0 ? effectiveBaselineTotalKr / baselineAnnualTotalKr : 1;
  const effectiveBaselineMonthlyKr = baselineMonthlyKr.map((v) => v * baselineScaleFactor);
  const maxMonth = Math.max(
    ...(effectiveBaselineMonthlyKr.length ? effectiveBaselineMonthlyKr : [1]),
    ...(scenarioMonths.length ? scenarioMonths : [1]),
    1
  );

  return (
    <div className="rounded-2xl p-4 sm:p-6 bg-[#F7F3EE] border border-[#2E7D52]/20 space-y-5">
      <header>
        <h2 className="text-lg sm:text-xl font-bold text-[#1A3C2A]">
          Så påverkas du av framtiden
        </h2>
        <p className="text-xs sm:text-sm text-[#1A3C2A]/70 mt-1">
          Välj ett scenario nedan. Jämförelsen utgår från din nuvarande förbrukning UTAN åtgärder — scenariot visar din riskexponering om du inte gör något. Multipliers för framtidsscenarier varierar per elzon ({seZone} aktiv).
        </p>
      </header>

      {/* SPLITSCREEN: preset-kort till vanster, resultat till hoger pa desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 lg:gap-5">
        {/* VANSTRA KOLUMNEN: preset-kort + utforska */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {presets.map((p) => {
              const selected = selection.kind === "preset" && selection.presetId === p.id;
              const category = p.category === "history" ? "Historiskt" : p.category === "special" ? "Grannmarknad" : "Framåt";
              return (
                <button
                  key={p.id}
                  onClick={() => pickPreset(p)}
                  className={[
                    "text-left p-3 rounded-xl border transition w-full",
                    selected
                      ? "bg-[#2E7D52] text-white border-[#2E7D52] shadow-sm"
                      : "bg-white hover:bg-[#E8F0E8] text-[#1A3C2A] border-[#2E7D52]/20",
                  ].join(" ")}
                >
                  <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{category}</div>
                  <div className="font-semibold text-sm leading-snug">{p.label}</div>
                  {p.subtitle && (
                    <div className={`text-xs mt-1 ${selected ? "opacity-80" : "text-[#1A3C2A]/60"}`}>
                      {p.subtitle}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Utforska sjalv - kompakt */}
          <div className="rounded-xl bg-white border border-[#2E7D52]/20 p-3">
            <div className="text-xs font-semibold text-[#1A3C2A] mb-2">Utforska enskilt år ({seZone})</div>
            <div className="flex flex-wrap gap-1.5">
              {[2020, 2021, 2022, 2023, 2024, 2025].map((y) => {
                const active = selection.kind === "custom" && selection.year === y;
                return (
                  <button
                    key={y}
                    onClick={() => pickCustomYear(y)}
                    className={[
                      "px-2.5 py-1 text-xs rounded-md border transition",
                      active
                        ? "bg-[#2E7D52] text-white border-[#2E7D52]"
                        : "bg-[#F7F3EE] hover:bg-[#E8F0E8] text-[#1A3C2A] border-[#2E7D52]/20",
                    ].join(" ")}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Avtalstyp */}
          <div className="rounded-xl bg-white border border-[#2E7D52]/20 p-3">
            <div className="text-xs font-semibold text-[#1A3C2A] mb-2">Ditt elavtal</div>
            <div className="inline-flex rounded-lg bg-[#F7F3EE] border border-[#2E7D52]/20 p-1">
              {(["hourly", "monthly"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => toggleResolution(r)}
                  className={[
                    "px-3 py-1 rounded-md text-xs font-medium transition",
                    priceResolution === r ? "bg-[#2E7D52] text-white" : "text-[#1A3C2A] hover:bg-[#E8F0E8]",
                  ].join(" ")}
                >
                  {r === "hourly" ? "Timavtal" : "Månadsavtal"}
                </button>
              ))}
            </div>
            <div className="text-xs text-[#1A3C2A]/60 mt-1.5">
              {priceResolution === "hourly"
                ? "Timmens faktiska spotpris – smart styrning lönar sig."
                : "Månadens snitt – timvariationer spelar ingen roll."}
            </div>
          </div>
        </div>

        {/* HOGRA KOLUMNEN: resultat */}
        <div className="space-y-3">
          {loading && (
            <div className="rounded-xl bg-white border border-[#2E7D52]/20 p-8 text-center text-[#1A3C2A]/70">
              Räknar om scenariot…
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-[#E05C5C]/10 border border-[#E05C5C]/30 p-4 text-sm text-[#E05C5C]">
              Kunde inte hämta scenariot: {error}
            </div>
          )}

          {!loading && !error && result && (
            <>
              {/* Jamforelse-kort */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl bg-white border-2 border-[#2E7D52]/20 p-3 sm:p-4 text-center">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wide text-[#1A3C2A]/60 mb-1">Idag utan åtgärder</div>
                  <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#1A3C2A]">
                    {formatKr(effectiveBaselineTotalKr)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-[#1A3C2A]/60 mt-1">per år</div>
                </div>
                <div
                  className={[
                    "rounded-xl border-2 p-3 sm:p-4 text-center",
                    deltaPositive ? "bg-[#E05C5C]/8 border-[#E05C5C]/40"
                    : deltaNegative ? "bg-[#2E7D52]/10 border-[#2E7D52]/40"
                    : "bg-white border-[#2E7D52]/20",
                  ].join(" ")}
                >
                  <div className="text-[10px] sm:text-xs uppercase tracking-wide text-[#1A3C2A]/60 mb-1 truncate" title={selectedLabel}>
                    {selectedLabel}
                  </div>
                  <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${deltaPositive ? "text-[#E05C5C]" : deltaNegative ? "text-[#2E7D52]" : "text-[#1A3C2A]"}`}>
                    {formatKr(scenarioTotalKr)}
                  </div>
                  <div className={`text-[10px] sm:text-xs mt-1 font-medium ${deltaPositive ? "text-[#E05C5C]" : deltaNegative ? "text-[#2E7D52]" : "text-[#1A3C2A]/60"}`}>
                    {delta > 50 ? `+${formatKrShort(delta)}` : delta < -50 ? formatKrShort(delta) : "ungefär samma"}
                  </div>
                </div>
              </div>

              {/* Manadsbar */}
              <div className="rounded-xl bg-white border border-[#2E7D52]/20 p-3">
                <div className="flex items-center justify-between mb-2 text-[10px] sm:text-xs">
                  <span className="font-semibold text-[#1A3C2A]">Månadskostnad – idag vs scenario</span>
                  <div className="flex gap-2 text-[#1A3C2A]/70">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1A3C2A]/30"/>Idag
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#2E7D52]"/>Scenario
                    </span>
                  </div>
                </div>
                <div className="flex items-end gap-0.5 sm:gap-1 h-20 sm:h-24">
                  {MONTH_LABELS.map((lbl, i) => {
                    const baselineVal = effectiveBaselineMonthlyKr[i] ?? 0;
                    const scenarioVal = scenarioMonths[i] ?? 0;
                    const hBase = Math.max(3, (baselineVal / maxMonth) * 80);
                    const hScen = Math.max(3, (scenarioVal / maxMonth) * 80);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="flex gap-[1px] items-end h-[80px]">
                          <div className="w-1.5 sm:w-2 bg-[#1A3C2A]/30 rounded-t-sm" style={{ height: `${hBase}px` }} title={`${lbl} idag: ${formatKr(baselineVal)}`}/>
                          <div className="w-1.5 sm:w-2 bg-[#2E7D52] rounded-t-sm" style={{ height: `${hScen}px` }} title={`${lbl} scenario: ${formatKr(scenarioVal)}`}/>
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-[#1A3C2A]/60">{lbl}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Uppdelning */}
              <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                <div className="rounded-lg bg-[#E8F0E8] p-2.5">
                  <div className="text-[#1A3C2A]/70">Spotpris i scenariot</div>
                  <div className="font-semibold text-[#1A3C2A] text-sm">{formatKr(result.totalSpotCostKr)}</div>
                  <div className="text-[#1A3C2A]/60 mt-0.5">{result.weightedAvgOreKwh} öre/kWh snitt</div>
                </div>
                <div className="rounded-lg bg-[#F7F3EE] p-2.5 border border-[#2E7D52]/10">
                  <div className="text-[#1A3C2A]/70">Nätavgift + skatt + fasta</div>
                  <div className="font-semibold text-[#1A3C2A] text-sm">{formatKr(baselineNonSpotKr)}</div>
                  <div className="text-[#1A3C2A]/60 mt-0.5">Oförändrat från idag</div>
                </div>
              </div>

              {/* Beskrivning + kallor */}
              {selectedPreset && (
                <div className="rounded-xl bg-white border border-[#2E7D52]/20 p-3 sm:p-4 space-y-2">
                  <div className="text-sm font-semibold text-[#1A3C2A]">{selectedPreset.label}</div>
                  <p className="text-xs text-[#1A3C2A]/80 leading-relaxed">
                    {selectedPreset.description}
                  </p>
                  {selectedPreset.methodNote && (
                    <details className="text-xs text-[#1A3C2A]/70">
                      <summary className="cursor-pointer hover:text-[#1A3C2A] select-none font-medium">
                        Så räknade vi
                      </summary>
                      <p className="mt-2 border-l-2 border-[#2E7D52]/20 pl-3 leading-relaxed">
                        {selectedPreset.methodNote}
                      </p>
                    </details>
                  )}
                  {meta && (
                    <div className="text-[10px] text-[#1A3C2A]/60 pt-2 border-t border-[#2E7D52]/10">
                      <span className="font-medium">Metod:</span>{" "}
                      {meta.method === "direct" ? "Faktisk data" : meta.method === "projected" ? "Framtidsprojektion" : "Approximation"}
                      {meta.appliedZoneMultiplier && ` (${seZone}-faktor ${meta.appliedZoneMultiplier.toFixed(2)}×)`}
                    </div>
                  )}
                  {selectedPreset.sources.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[10px] uppercase tracking-wide text-[#1A3C2A]/50 mb-1">Källor</div>
                      <ul className="text-[10px] space-y-0.5">
                        {selectedPreset.sources.map((s, i) => (
                          <li key={i}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#2E7D52] hover:underline"
                            >
                              {s.label}
                            </a>
                            <span className="text-[#1A3C2A]/40"> · {s.retrievedAt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="rounded-xl bg-[#F4A261]/15 border border-[#F4A261]/30 p-3">
                <div className="text-xs sm:text-sm text-[#1A3C2A]">
                  <strong>
                    {deltaPositive ? "Så kan du klara det:" : deltaNegative ? "Glad nyhet:" : "Insikt:"}
                  </strong>{" "}
                  {deltaPositive
                    ? "Byt till timavtal om du inte redan har det, och installera smart styrning eller batteri för att flytta förbrukning till billigare timmar."
                    : deltaNegative
                    ? "Din profil gynnas av detta prisläge. Överväg att låsa ett fastprisavtal om sådant läge närmar sig."
                    : "Detta scenario påverkar inte just din faktura så mycket. Prova ett annat scenario för större skillnad."}
                </div>
              </div>

              {/* Åtgärder som skyddar mest mot detta scenario */}
              {selectedPreset && (() => {
                const topIds = topShieldingUpgrades(selectedPreset.id, 3);
                if (topIds.length === 0) return null;
                return (
                  <div className="rounded-xl bg-white border border-[#2E7D52]/20 p-3 sm:p-4">
                    <div className="text-xs font-semibold text-[#1A3C2A] mb-2">
                      Åtgärder som skyddar mest mot detta scenario
                    </div>
                    <ul className="space-y-2">
                      {topIds.map((id) => {
                        const def = UPGRADE_DEFINITIONS.find((u) => u.id === id);
                        const shield = UPGRADE_EVIDENCE[id].scenarioShielding[selectedPreset.id];
                        if (!def || !shield) return null;
                        return (
                          <li key={id} className="flex items-start gap-2 text-xs text-[#1A3C2A]">
                            <span className="flex-shrink-0 text-base">{def.icon ?? "•"}</span>
                            <div>
                              <span className="font-semibold">{def.label}</span>
                              <span className="text-[#1A3C2A]/70"> — {shield.why}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-2 text-[10px] text-[#1A3C2A]/60">
                      Klicka på <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#2E7D52]/10 text-[#2E7D52] text-[9px] font-bold mx-0.5">i</span> i Åtgärdspanelen för detaljer och källor.
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
