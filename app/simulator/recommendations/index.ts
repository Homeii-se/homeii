/**
 * Recommendations layer — engine, lifestyle tips, and reasoning.
 * Master re-export for the recommendations/ directory.
 *
 * `generateRecommendations` is the public entry point. As of PR
 * `feat/engine-v2-activation`, it delegates to the variant-aware engine v2
 * (engine-v2.ts) and unwraps the legacy-compatible result so existing
 * callers keep the same `RecommendationResult` shape they had before.
 *
 * Engine v1 (engine.ts) stays available as `generateRecommendationsLegacy`
 * for parity tests and as a production rollback target. Set the env var
 * `NEXT_PUBLIC_USE_RECOMMENDATIONS_V1=true` to fall back to v1 at runtime
 * — useful if v2 surfaces a regression in production while we investigate.
 */

import type {
  BillData,
  RefinementAnswers,
  SEZone,
  Assumptions,
  RecommendationResult,
} from "../types";
import { generateRecommendationsV2 } from "./engine-v2";
import { generateRecommendations as generateRecommendationsLegacy } from "./engine";

/** Runtime fallback to v1. Defaults to false (v2 active) when unset. */
const useLegacyEngine =
  process.env.NEXT_PUBLIC_USE_RECOMMENDATIONS_V1 === "true";

/**
 * Generate personalized energy upgrade recommendations for a household.
 *
 * Returns the legacy-compatible `RecommendationResult` shape regardless of
 * which underlying engine produced it. v2's richer per-variant data is
 * available via `generateRecommendationsV2` directly when needed.
 */
export function generateRecommendations(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions,
): RecommendationResult {
  if (useLegacyEngine) {
    return generateRecommendationsLegacy(
      billData,
      refinement,
      seZone,
      assumptions,
    );
  }
  return generateRecommendationsV2(billData, refinement, seZone, assumptions)
    .legacy;
}

export { generateRecommendationsV2 } from "./engine-v2";
export { generateRecommendationsLegacy };
export type {
  RecommendationResultV2,
  TypeComparison,
  VariantEvaluation,
} from "./engine-v2";

export { generateLifestyleTips } from "./lifestyle-tips";
export type { LifestyleTip, TipCategory } from "./lifestyle-tips";
export { buildReasoningChain } from "./reasoning";
export type { ReasoningChain, ReasoningFactor } from "./reasoning";
