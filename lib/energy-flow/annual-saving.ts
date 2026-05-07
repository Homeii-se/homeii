import { buildScenario } from "./build-scenario";
import { STODTJANST_DAY_TOTAL, SEASON_DAYS } from "./constants";
import type { Settings, Season, AnnualSaving } from "./types";

/**
 * Beräknar säsongsviktad årsbesparing jämfört med "gårdagens hem"
 * (passiv konsument 2015 — inget annat än direktel + månadsmedel).
 *
 * Ett dygns simuleringsresultat extrapolerat × 365 är missvisande eftersom
 * vinterdagar är dramatiskt dyrare än sommardagar. Den här funktionen
 * kör scenariot för alla tre säsonger och viktar resultatet enligt
 * SEASON_DAYS (90 vinter + 180 vår·höst + 90 sommar = 360 dagar/år).
 *
 * Returnerar 0 om input är 2015-passiv (jämför med sig själv → ingen
 * besparing) — anropare kan då undvika att visa jämförelsen.
 */
export function computeAnnualSaving(settings: Settings): AnnualSaving {
  const { hasHP, hasEV, hasSol, hasBat, hasSmart, prismodell } = settings;

  const isPassive =
    !hasHP && !hasEV && !hasSol && !hasBat && !hasSmart &&
    prismodell === "manadsmedel";

  const result: AnnualSaving = {
    total: 0,
    byseason: { vinter: 0, host: 0, sommar: 0 },
  };

  if (isPassive) return result;

  const stodPerDay = hasBat && hasSmart ? STODTJANST_DAY_TOTAL : 0;

  (Object.keys(SEASON_DAYS) as Season[]).forEach((seasonKey) => {
    const cur = buildScenario({ ...settings, season: seasonKey });
    const yest = buildScenario({
      season: seasonKey,
      hasHP: false,
      hasEV: false,
      hasSol: false,
      hasBat: false,
      hasSmart: false,
      prismodell: "manadsmedel",
    });
    const dailySaving = yest.dayCost - (cur.dayCost - stodPerDay);
    const annualForSeason = dailySaving * SEASON_DAYS[seasonKey];
    result.byseason[seasonKey] = annualForSeason;
    result.total += annualForSeason;
  });

  return result;
}
