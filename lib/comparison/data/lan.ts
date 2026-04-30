/**
 * Sweden's 21 län (counties) — codes, names, and approximate centroids.
 *
 * Centroids are used for nearest-neighbor lookup from a user's geocoded
 * lat/lon to the most likely län. They are population-weighted approximate
 * centers, not strict geographic centers (e.g. Stockholm centroid is the
 * city of Stockholm, not the geographic center of the län).
 *
 * Sources:
 *  - ISO 3166-2:SE for codes
 *  - SCB Folkmängd per län (population centers) for centroid hints
 */

import type { LanCode } from "../types";

export interface LanInfo {
  code: LanCode;
  /** Official name, e.g. "Stockholms län". */
  name: string;
  /** Short name for UI, e.g. "Stockholm". */
  shortName: string;
  /** Approximate population-weighted center for nearest-neighbor lookup. */
  centroid: { lat: number; lon: number };
}

export const LAN_INFO: Record<LanCode, LanInfo> = {
  AB: { code: "AB", name: "Stockholms län", shortName: "Stockholm", centroid: { lat: 59.33, lon: 18.07 } },
  AC: { code: "AC", name: "Västerbottens län", shortName: "Västerbotten", centroid: { lat: 63.83, lon: 20.26 } },
  BD: { code: "BD", name: "Norrbottens län", shortName: "Norrbotten", centroid: { lat: 65.58, lon: 22.15 } },
  C:  { code: "C",  name: "Uppsala län", shortName: "Uppsala", centroid: { lat: 59.86, lon: 17.64 } },
  D:  { code: "D",  name: "Södermanlands län", shortName: "Södermanland", centroid: { lat: 59.20, lon: 16.63 } },
  E:  { code: "E",  name: "Östergötlands län", shortName: "Östergötland", centroid: { lat: 58.41, lon: 15.62 } },
  F:  { code: "F",  name: "Jönköpings län", shortName: "Jönköping", centroid: { lat: 57.78, lon: 14.16 } },
  G:  { code: "G",  name: "Kronobergs län", shortName: "Kronoberg", centroid: { lat: 56.88, lon: 14.81 } },
  H:  { code: "H",  name: "Kalmar län", shortName: "Kalmar", centroid: { lat: 56.66, lon: 16.36 } },
  I:  { code: "I",  name: "Gotlands län", shortName: "Gotland", centroid: { lat: 57.63, lon: 18.29 } },
  K:  { code: "K",  name: "Blekinge län", shortName: "Blekinge", centroid: { lat: 56.16, lon: 15.59 } },
  M:  { code: "M",  name: "Skåne län", shortName: "Skåne", centroid: { lat: 55.60, lon: 13.00 } },
  N:  { code: "N",  name: "Hallands län", shortName: "Halland", centroid: { lat: 56.67, lon: 12.86 } },
  O:  { code: "O",  name: "Västra Götalands län", shortName: "Västra Götaland", centroid: { lat: 57.71, lon: 11.97 } },
  S:  { code: "S",  name: "Värmlands län", shortName: "Värmland", centroid: { lat: 59.40, lon: 13.50 } },
  T:  { code: "T",  name: "Örebro län", shortName: "Örebro", centroid: { lat: 59.27, lon: 15.21 } },
  U:  { code: "U",  name: "Västmanlands län", shortName: "Västmanland", centroid: { lat: 59.61, lon: 16.55 } },
  W:  { code: "W",  name: "Dalarnas län", shortName: "Dalarna", centroid: { lat: 60.61, lon: 15.63 } },
  X:  { code: "X",  name: "Gävleborgs län", shortName: "Gävleborg", centroid: { lat: 60.67, lon: 17.14 } },
  Y:  { code: "Y",  name: "Västernorrlands län", shortName: "Västernorrland", centroid: { lat: 62.39, lon: 17.31 } },
  Z:  { code: "Z",  name: "Jämtlands län", shortName: "Jämtland", centroid: { lat: 63.18, lon: 14.64 } },
};

export const ALL_LAN_CODES: LanCode[] = Object.keys(LAN_INFO) as LanCode[];
