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
  /**
   * Optional: bill context (operator + tariff overrides). When provided,
   * the comparison runs through the new kWh→cost-model pipeline so that
   * the median villa is priced at the user's actual tariff. When absent,
   * the comparison falls back to the legacy zone-linear kr table.
   *
   * Imported lazily as a structural type to avoid a hard dependency from
   * types.ts on the simulator. The actual type is defined in
   * lib/comparison/kr-conversion.ts as `BillContext`.
   */
  billData?: import("./kr-conversion").BillContext;
}

export interface CostDistribution {
  p10: number;
  p50: number;
  p90: number;
}

/**
 * Annual kWh distribution per scope (P10/P50/P90).
 * Same shape as CostDistribution but unit is kWh, not kr — used as the
 * upstream data source before conversion to kr via cost-model.ts.
 */
export interface KwhDistribution {
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
