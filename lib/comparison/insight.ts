/**
 * Insight bubble — classifies a comparison result into a copy segment
 * and surfaces the interpolation values (operator name, percentile, savings)
 * that the segment's template needs.
 *
 * The actual Swedish copy templates live in
 * app/simulator/components/ResultV2/strings.ts under INSIGHT_BUBBLE,
 * keeping all user-facing strings in one file (per CLAUDE.md conventions).
 */

import type { ComparisonResult } from "./types";

/**
 * Segment classifications based on user.diffFraction. Bands are asymmetric
 * — under-bands are wider so users who are *slightly* below average aren't
 * told they are efficient when they are really just average.
 */
export type InsightSegment = "wellBelow" | "below" | "near" | "above" | "wellAbove";

export function classifyInsight(diffFraction: number): InsightSegment {
  if (diffFraction < -0.15) return "wellBelow";
  if (diffFraction < -0.05) return "below";
  if (diffFraction < 0.05) return "near";
  if (diffFraction < 0.20) return "above";
  return "wellAbove";
}

/**
 * Context that influences which copy variant to show.
 */
export interface InsightContext {
  /** Operator name (e.g. "Ellevio Stockholm") — surfaces in copy. */
  operatorName?: string;
  /** Concrete savings potential in kr/år from the recommendations engine. */
  potentialSavingsKr?: number;
  /** True if the user heats with district heating — caveats the comparison. */
  hasFjarrvarme?: boolean;
}

/**
 * Resolved interpolation values + segment, ready for the copy template.
 */
export interface InsightCopyData {
  segment: InsightSegment;
  /** % of villas that pay more than the user (rounded, ≥1). */
  percentMore: number;
  /** % of villas that pay less than the user (rounded, ≥1). */
  percentLess: number;
  /**
   * Absolute kr difference from median, rounded to nearest 100.
   * Always non-negative — direction is encoded in `segment`.
   */
  diffKr: number;
  /** Operator name if known, else undefined. */
  operatorName?: string;
  /** Savings in kr/år if known and ≥1000, else undefined. */
  savingsKr?: number;
  /** Echo through to template logic. */
  hasFjarrvarme: boolean;
}

/**
 * Resolve segment + interpolation values from a comparison result.
 * Stateless. The caller picks the right template from INSIGHT_BUBBLE
 * based on the returned segment and interpolates the values.
 */
export function resolveInsightCopy(
  result: ComparisonResult,
  ctx: InsightContext = {}
): InsightCopyData {
  const segment = classifyInsight(result.user.diffFraction);
  const percentLess = Math.max(1, Math.round(result.user.percentile));
  const percentMore = Math.max(1, Math.round(100 - result.user.percentile));
  const diffKr = Math.round(Math.abs(result.user.diffFromMedian) / 100) * 100;
  const savingsKr =
    ctx.potentialSavingsKr && ctx.potentialSavingsKr >= 1000
      ? ctx.potentialSavingsKr
      : undefined;

  return {
    segment,
    percentMore,
    percentLess,
    diffKr,
    operatorName: ctx.operatorName,
    savingsKr,
    hasFjarrvarme: ctx.hasFjarrvarme ?? false,
  };
}
