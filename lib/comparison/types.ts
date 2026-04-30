/**
 * Type definitions for the comparison module.
 */

export type LanCode =
  | "AB" | "AC" | "BD" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
  | "K" | "M" | "N" | "O" | "S" | "T" | "U" | "W" | "X" | "Y" | "Z";

export type ScopeKind = "lan" | "kommun" | "postnummer";

export type DataMode = "modeled" | "empirical";

export interface ComparisonScope {
  kind: ScopeKind;
  id: string;
  label: string;
  sampleSize: number;
  mode: DataMode;
}

export interface ComparisonInput {
  /** User's total annual electricity cost (kr, inkl moms). */
  yearlyKr: number;
  /** Latitude of the user's home (from geocoded address). */
  latitude: number;
  /** Longitude of the user's home (from geocoded address). */
  longitude: number;
  /**
   * Optional: total uppvärmd bostadsyta inkl. biarea (m²).
   * Om angivet skalas distributionen så användaren jämförs mot villor
   * av sin storlek istället för länets snittvilla.
   */
  area?: number;
}

export interface CostDistribution {
  p10: number;
  p50: number;
  p90: number;
}

export interface ComparisonResult {
  scope: ComparisonScope;
  distribution: CostDistribution;
  user: {
    kr: number;
    percentile: number;
    diffFromMedian: number;
    diffFraction: number;
  };
}

export interface AreaDistribution {
  scope: ComparisonScope;
  distribution: CostDistribution;
}
