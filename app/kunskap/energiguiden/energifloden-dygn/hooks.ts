"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildScenario,
  computeAnnualSaving,
  type HourSnapshot,
  type Scenario,
  type Settings,
  type AnnualSaving,
} from "@/lib/energy-flow";
import { TEMPOS, type Tempo } from "./ui-constants";

/**
 * Memoiserat scenario som bygger om endast när settings ändras.
 * Plus parallel "yesterdayScenario" (passiv konsument samma säsong) för
 * jämförelse, och säsongsviktad årsbesparing.
 */
export function useScenario(settings: Settings): {
  scenario: Scenario;
  yesterdayScenario: Scenario;
  annualSaving: AnnualSaving;
} {
  return useMemo(() => {
    const scenario = buildScenario(settings);
    const yesterdayScenario = buildScenario({
      season: settings.season,
      hasHP: false,
      hasEV: false,
      hasSol: false,
      hasBat: false,
      hasSmart: false,
      prismodell: "manadsmedel",
    });
    const annualSaving = computeAnnualSaving(settings);
    return { scenario, yesterdayScenario, annualSaving };
  }, [
    settings.season,
    settings.hasHP,
    settings.hasEV,
    settings.hasSol,
    settings.hasBat,
    settings.hasSmart,
    settings.prismodell,
  ]);
}

/**
 * Tids-animation: hanterar minute-counter (0–1439) som driver scrubbing
 * och auto-play. Använder requestAnimationFrame för smidig progression.
 *
 * Returnerar:
 * - minute (0–1439)
 * - playing (auto-play på/av)
 * - tempo (uppspelningsfart)
 * - setMinute (för manuell scrubbing)
 * - togglePlay
 * - setTempo
 */
export function useTimeAnimation(initialMinute = 438) {
  const [minute, setMinute] = useState(initialMinute);
  const [playing, setPlaying] = useState(true);
  const [tempo, setTempo] = useState<Tempo>("normal");

  const lastTickRef = useRef<number>(0);
  const minuteRef = useRef(minute);
  const playingRef = useRef(playing);
  const tempoRef = useRef(tempo);

  // Håll refs i synk med state så animation-loopen läser senaste värdet
  useEffect(() => {
    minuteRef.current = minute;
  }, [minute]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (playingRef.current) {
        const tempoMs = TEMPOS[tempoRef.current];
        const advance = (dt * 1440) / tempoMs; // minuter att lägga på
        const next = (minuteRef.current + advance) % 1440;
        minuteRef.current = next;
        setMinute(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    minute,
    playing,
    tempo,
    setMinute,
    togglePlay: () => setPlaying((p) => !p),
    setTempo,
  };
}

/**
 * Linjär interpolation mellan två tal.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Hämtar interpolerad snapshot vid en given timme (decimal). Linterar
 * alla numeriska fält mellan timsteg i, i+1 baserat på fraktion.
 */
export function snapAt(arr: readonly HourSnapshot[], h: number): HourSnapshot {
  const i0 = Math.floor(h) % 24;
  const i1 = (i0 + 1) % 24;
  const t = h - Math.floor(h);
  const a = arr[i0] as unknown as Record<string, unknown>;
  const b = arr[i1] as unknown as Record<string, unknown>;
  const r: Record<string, unknown> = {};
  Object.keys(a).forEach((k) => {
    const av = a[k];
    const bv = b[k];
    if (typeof av === "number" && typeof bv === "number") {
      r[k] = lerp(av, bv, t);
    } else {
      r[k] = av;
    }
  });
  return r as unknown as HourSnapshot;
}
