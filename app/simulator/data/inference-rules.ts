/**
 * Inference rules — data used by the profile inference engine.
 */

import type { SEZone } from "../types";

/**
 * Nätägare → SE-zon mappning (fuzzy-matchas mot lowercase)
 * @source Energimarknadsinspektionen
 * @updated 2026-04-04
 * @notes Vanligaste nätägarna per elområde
 */
export const NATAGARE_SE_ZONE: Record<string, SEZone> = {
  "luleå energi": "SE1", "gällivare energi": "SE1", "kiruna energi": "SE1",
  "boden energi": "SE1", "piteå energi": "SE1", "skellefteå kraft": "SE1",
  "jämtkraft": "SE2", "sundsvall elnät": "SE2", "härnösand energi": "SE2",
  "sollefteå kraft": "SE2", "örnsköldsvik energi": "SE2",
  "ellevio": "SE3", "vattenfall": "SE3", "nacka energi": "SE3",
  "göteborg energi": "SE3", "tekniska verken": "SE3", "mälarenergi": "SE3",
  "örebro energi": "SE3", "gävle energi": "SE3", "fortum": "SE3",
  "kraftringen": "SE4", "e.on": "SE4", "eon": "SE4",
  "kalmar energi": "SE4", "karlskrona energi": "SE4", "växjö energi": "SE4",
  "halmstad energi": "SE4", "helsingborg energi": "SE4",
};
