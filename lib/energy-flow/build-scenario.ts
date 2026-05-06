import type { Settings, Scenario, HourSnapshot, Season } from "./types";
import {
  PRICES,
  SOL_HOURS,
  BAT_CAP,
  BAT_RATE,
  EV_RATE,
  V2H_RATE,
  DRIVE_PER_HOUR,
  KWH_PER_MIL,
  EV_MIL_MIN,
  EV_MIL_MAX,
  COP_HEAT,
  COP_COOL,
  COOLING_THRESHOLD,
  EFFEKTAVGIFT_PER_KW_PER_DAY,
  PEAK_CAP,
} from "./constants";

/**
 * Säsongsspecifik utomhustemperatur över dygnet.
 * - Vinter [-5, 1]: typisk SE3-vinter (avg -2 °C), inte kallaste januari-veckan
 * - Vår·Höst [3, 13]: övergångssäsong
 * - Sommar [16, 28]: varm sommardag som triggar AC-behov vid peak
 */
function tempRange(season: Season): [number, number] {
  if (season === "sommar") return [16, 28];
  if (season === "host") return [3, 13];
  return [-5, 1];
}

/**
 * Indoor target temperature (°C). Vid värme-uträkning används denna
 * som tröskel — om utomhustemp ligger över denna behövs ingen värme.
 */
function indoorTarget(season: Season): number {
  if (season === "sommar") return 16;
  if (season === "host") return 19;
  return 21;
}

/**
 * Värmeförlust-koefficient (kW per °C-skillnad). Vinter har högre
 * koefficient eftersom kalla dagar amplifierar förlusterna.
 */
function heatRateFor(season: Season): number {
  if (season === "vinter") return 0.2;
  if (season === "sommar") return 0.13;
  return 0.16;
}

/**
 * Solens peakeffekt i kW (när solen står som högst).
 */
function peakSolFor(season: Season): number {
  if (season === "sommar") return 5;
  if (season === "host") return 3.5;
  return 1.2;
}

/**
 * Modellerar utomhustemperatur över dygnet som en cosinus-vågform
 * som är som kallast vid h=4 (gryning).
 */
function outdoorTempAt(h: number, [tMin, tMax]: [number, number]): number {
  return tMin + (tMax - tMin) * 0.5 * (1 - Math.cos(((h - 4) * Math.PI) / 12));
}

/**
 * Säsongsspecifika "övriga"-mönster (belysning, vitvaror, elektronik).
 * Vinter har starkast kvällspeak (mörker → indoor-fokus).
 * Sommar har förskjuten sen kort kväll (folk är ute innan).
 */
function otherFor(season: Season, smart: boolean, h: number): number {
  const baseOther = season === "vinter" ? 0.3 : season === "host" ? 0.25 : 0.18;
  if (smart) {
    if (season === "vinter") {
      if (h >= 10 && h < 13) return 1.5;
      if (h >= 18 && h < 22) return 1.0;
    } else if (season === "host") {
      if (h >= 10 && h < 13) return 1.3;
      if (h >= 18 && h < 21) return 0.7;
    } else {
      if (h >= 10 && h < 14) return 1.0;
      if (h >= 20 && h < 22) return 0.7;
    }
  } else {
    if (season === "vinter") {
      if (h >= 6 && h < 9) return 1.5;
      if (h >= 17 && h < 22) return 1.8;
    } else if (season === "host") {
      if (h >= 6 && h < 9) return 1.3;
      if (h >= 18 && h < 22) return 1.4;
    } else {
      if (h >= 7 && h < 9) return 1.0;
      if (h >= 20 && h < 22) return 1.0;
    }
  }
  return baseOther;
}

/**
 * Varmvatten-last (kW). Smart styrning värmer tanken ~3 timmar/dygn på
 * billigaste timmar (sol om host/sommar, nattel om vinter).
 * Non-smart: traditionella morgon- och kvällspeak.
 */
function hotWaterFor(
  season: Season,
  smart: boolean,
  hasSol: boolean,
  sol: number,
  h: number,
): number {
  if (smart) {
    if (
      hasSol &&
      (season === "sommar" || season === "host") &&
      h >= 11 &&
      h < 14
    ) {
      return 2.5;
    }
    if (h >= 1 && h < 4 && (!hasSol || season === "vinter")) {
      return 2.5;
    }
    return 0.05;
  }
  if ((h >= 6 && h < 8) || (h >= 19 && h < 22)) return 3.0;
  return 0.05;
}

/**
 * Bygger ett dygns-scenario med 24 timsteg, full energiflödesallokering
 * och kostnadsberäkning. Använder en två-pass warmup för att låta
 * batteri-SOC och elbil-räckvidd konvergera till steady state.
 *
 * @param settings — hushålls-konfiguration och prismodell
 * @returns Scenario med hours, kostnader och peak-effekt
 */
export function buildScenario(settings: Settings): Scenario {
  const { season, hasHP, hasEV, hasSol, hasBat, hasSmart, prismodell } =
    settings;

  let soc = 0.5;
  let evMil = EV_MIL_MAX;

  const tempR = tempRange(season);
  const target = indoorTarget(season);
  const heatRate = heatRateFor(season);
  const peakSol = peakSolFor(season);
  const sunrise = SOL_HOURS[season].rise;
  const sunset = SOL_HOURS[season].set;
  const cop = hasHP ? COP_HEAT : 1.0;

  const smart = hasSmart && prismodell === "dynamiskt";
  const prices = PRICES[season];
  const monthAvg = Math.round(prices.reduce((a, b) => a + b, 0) / 24);

  let out: HourSnapshot[] = [];
  let cumCost = 0;
  let gridCost = 0;
  let exportRevenue = 0;
  let maxGridKw = 0;

  // Två-pass: pass 0 = warmup (kasseras), pass 1 = visualiserat dygn.
  // Detta låter soc och evMil konvergera till steady state.
  for (let pass = 0; pass < 2; pass++) {
    out = [];
    cumCost = 0;
    gridCost = 0;
    exportRevenue = 0;
    maxGridKw = 0;

    for (let h = 0; h < 24; h++) {
      // Solproduktion (sin-kurva mellan sunrise och sunset)
      let sol = 0;
      if (hasSol && h >= sunrise && h <= sunset) {
        sol =
          peakSol *
          Math.sin(((h - sunrise) / (sunset - sunrise)) * Math.PI);
      }

      const outT = outdoorTempAt(h, tempR);
      const heatLossKW = Math.max(0, (target - outT) * heatRate);
      const heating = heatLossKW / cop;

      // AC-kylning på sommaren när det är varmt ute
      let cooling = 0;
      if (season === "sommar" && hasHP && outT > COOLING_THRESHOLD) {
        const coolingThermalKW = (outT - COOLING_THRESHOLD) * 0.5;
        cooling = coolingThermalKW / COP_COOL;
      }

      const hotWater = hotWaterFor(season, smart, hasSol, sol, h);
      const other = otherFor(season, smart, h);

      const evAway = hasEV && h >= 15 && h < 20;
      const evAtHome = hasEV && !evAway;
      const baseDemand = other + heating + hotWater + cooling;

      // EV-laddning: prioritera sol-överskott, sedan billig natt
      let ev = 0;
      if (evAtHome) {
        const evRoom = Math.max(0, (EV_MIL_MAX - evMil) * KWH_PER_MIL);
        if (smart) {
          const solAfterBase = Math.max(0, sol - baseDemand);
          if (solAfterBase > 0.5 && evRoom > 0.5) {
            ev = Math.min(solAfterBase, EV_RATE, evRoom);
          } else if ((h >= 22 || h < 6) && evRoom > 0.5) {
            ev = Math.min(EV_RATE, evRoom);
          }
        } else if (h >= 20 && h < 24) {
          ev = Math.min(3.0, evRoom);
        }
      }

      const heatTotal = heating + hotWater + cooling;
      const totalDemand = other + heating + hotWater + cooling + ev;

      let solToHouse = 0;
      let solToBat = 0;
      let solToGrid = 0;
      let gridToHouse = 0;
      let gridToBat = 0;
      let batToHouse = 0;
      let batCharge = 0;
      let batDischarge = 0;
      let evToHouse = 0;

      // Sol → instantana laster först
      solToHouse = Math.min(sol, totalDemand);
      let surplus = sol - solToHouse;
      let remaining = totalDemand - solToHouse;

      if (hasBat) {
        // Sol-överskott → batteri
        const sCharge = Math.min(surplus, BAT_RATE, (1 - soc) * BAT_CAP);
        solToBat = sCharge;
        batCharge += sCharge;
        soc = Math.min(1, soc + sCharge / BAT_CAP);
        surplus -= sCharge;

        if (smart) {
          // Smart: ladda batteri på billiga nattimmar (vinter, eller ej minSolDay)
          const minSolDay =
            hasSol && (season === "sommar" || season === "host");
          if (h >= 1 && h < 5 && soc < 0.95 && !minSolDay) {
            const remainingRate = BAT_RATE - sCharge;
            const targetSoc = season === "vinter" ? 0.95 : 0.7;
            const gCharge = Math.min(
              remainingRate,
              Math.max(0, targetSoc - soc) * BAT_CAP,
            );
            gridToBat = gCharge;
            batCharge += gCharge;
            soc = Math.min(1, soc + gCharge / BAT_CAP);
          }
          // Smart: urladda under kvällspeak 17–21
          if (h >= 17 && h < 21 && remaining > 0 && soc > 0.1) {
            const dis = Math.min(
              remaining,
              BAT_RATE,
              (soc - 0.05) * BAT_CAP,
            );
            batToHouse = dis;
            batDischarge = dis;
            soc = Math.max(0, soc - dis / BAT_CAP);
            remaining -= dis;
          }
        } else if (remaining > 0) {
          // Non-smart: urladda hela tiden när det behövs
          const dis = Math.min(remaining, BAT_RATE, soc * BAT_CAP);
          batToHouse = dis;
          batDischarge = dis;
          soc = Math.max(0, soc - dis / BAT_CAP);
          remaining -= dis;
        }
      }

      // V2H — elbilen som flexibelt batteri på dagtid
      if (evAtHome && smart && ev === 0 && remaining > 0) {
        const inCheapNight = h >= 22 || h < 6;
        if (!inCheapNight) {
          const inPeak = (h >= 7 && h < 9) || (h >= 17 && h < 22);
          const rate = inPeak ? V2H_RATE : 2.0;
          const evAvail = (evMil - EV_MIL_MIN) * KWH_PER_MIL;
          if (evAvail > 0.5) {
            const dis = Math.min(remaining, rate, evAvail);
            evToHouse = dis;
            remaining -= dis;
          }
        }
      }

      // Peak shaving: håll nät-effekten under säsongs-tak.
      // Reducera EV-laddning först (lång tid att ladda),
      // sedan batteri-laddning (kort fönster, behövs för kvällspeak).
      if (smart) {
        const peakCap = PEAK_CAP[season];
        const provGrid = remaining + gridToBat;
        if (provGrid > peakCap) {
          let excess = provGrid - peakCap;
          if (ev > 0) {
            const evRed = Math.min(excess, ev);
            ev -= evRed;
            remaining -= evRed;
            excess -= evRed;
          }
          if (excess > 0 && gridToBat > 0) {
            const batRed = Math.min(excess, gridToBat);
            gridToBat -= batRed;
            soc -= batRed / BAT_CAP;
            batCharge -= batRed;
          }
        }
      }

      solToGrid = surplus;
      gridToHouse = remaining + gridToBat;

      // Uppdatera elbilens räckvidd
      if (evAway) {
        evMil = Math.max(EV_MIL_MIN, evMil - DRIVE_PER_HOUR);
      } else if (ev > 0) {
        evMil = Math.min(EV_MIL_MAX, evMil + ev / KWH_PER_MIL);
      } else if (evToHouse > 0) {
        evMil = Math.max(EV_MIL_MIN, evMil - evToHouse / KWH_PER_MIL);
      }

      // Kostnadsberäkning
      const effectivePrice =
        prismodell === "manadsmedel" ? monthAvg : prices[h];
      const exportPrice = Math.min(effectivePrice * 0.6, 80);
      gridCost += (gridToHouse * effectivePrice) / 100;
      exportRevenue += (solToGrid * exportPrice) / 100;
      cumCost +=
        (gridToHouse * effectivePrice - solToGrid * exportPrice) / 100;
      if (gridToHouse > maxGridKw) maxGridKw = gridToHouse;

      out.push({
        h,
        sol,
        totalDemand,
        heatTotal,
        ev,
        evToHouse,
        evAway,
        other,
        solToHouse,
        solToBat,
        solToGrid,
        gridToHouse,
        gridToBat,
        batToHouse,
        batCharge,
        batDischarge,
        soc,
        evMil,
        price: prices[h],
        effectivePrice,
        monthAvg,
        cumCost,
      });
    }
  }

  const effektavgift = maxGridKw * EFFEKTAVGIFT_PER_KW_PER_DAY;

  return {
    hours: out,
    prices,
    monthAvg,
    gridCost,
    exportRevenue,
    energyCost: cumCost,
    effektavgift,
    peakKw: maxGridKw,
    dayCost: cumCost + effektavgift,
  };
}
