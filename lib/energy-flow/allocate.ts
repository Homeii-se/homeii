import type { HourSnapshot, Allocation, AllocationKey } from "./types";

/**
 * Fördelar varje energikällas bidrag proportionellt över de tre lasterna
 * (värme, EV-laddning, övrig hushållsel) baserat på deras andel av total
 * efterfrågan.
 *
 * Detta är en pedagogisk modell. I verkligheten är el fungibel — du kan
 * inte spåra vilken elektron som gick var. Men för visualiseringen ger
 * proportionell fördelning den tydligaste bilden av vart varje källas
 * energi tar vägen.
 *
 * Exempel: Sol producerar 4 kW, husets laster är heat=2, ev=1, other=1
 * (totalt 4 kW). Allokeringen blir:
 *   sol-heat = 2 (sol × 2/4)
 *   sol-ev   = 1 (sol × 1/4)
 *   sol-other = 1
 *
 * Returnerar 15 nycklar (3 laster × 4 källor + 3 lagring/export-flöden).
 */
export function allocate(s: HourSnapshot): Allocation {
  const loads = { heat: s.heatTotal, ev: s.ev, other: s.other };
  const totalLoad = loads.heat + loads.ev + loads.other;

  // gridToLoads = den del av nät-importen som går direkt till laster
  // (inte till batteri-laddning, som hanteras separat via 'grid-bat').
  const gridToLoads = Math.max(0, s.gridToHouse - s.gridToBat);

  const supply = {
    sol: s.solToHouse,
    grid: gridToLoads,
    bat: s.batToHouse,
    ev: s.evToHouse || 0,
  } as const;

  const result: Partial<Record<AllocationKey, number>> = {};

  if (totalLoad < 0.01) {
    // Inga laster — sätt alla last-allokeringar till 0
    (Object.keys(supply) as Array<keyof typeof supply>).forEach((k) => {
      (["heat", "ev", "other"] as const).forEach((l) => {
        result[`${k}-${l}` as AllocationKey] = 0;
      });
    });
  } else {
    (Object.keys(supply) as Array<keyof typeof supply>).forEach((k) => {
      const supplied = supply[k];
      (["heat", "ev", "other"] as const).forEach((l) => {
        result[`${k}-${l}` as AllocationKey] =
          supplied * (loads[l] / totalLoad);
      });
    });
  }

  // V2H matar inte sig själv
  result["ev-ev"] = 0;
  // Lagring och export hanteras separat (inte proportionellt)
  result["sol-bat"] = s.solToBat;
  result["grid-bat"] = s.gridToBat;
  result["sol-grid"] = s.solToGrid;

  return result as Allocation;
}
