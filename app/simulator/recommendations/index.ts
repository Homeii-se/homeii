/**
 * Recommendations layer — engine, lifestyle tips, and reasoning.
 * Master re-export for the recommendations/ directory.
 */

export { generateRecommendations } from "./engine";
export { generateLifestyleTips } from "./lifestyle-tips";
export type { LifestyleTip, TipCategory } from "./lifestyle-tips";
export { buildReasoningChain } from "./reasoning";
export type { ReasoningChain, ReasoningFactor } from "./reasoning";