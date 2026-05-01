import type {
  ComparisonInput,
  ComparisonResult,
  ComparisonScope,
  CostDistribution,
  KwhDistribution,
} from "./types";
import { resolveLan } from "./scope";
import {
  getModeledDistribution,
  getModeledKwhDistribution,
  getSampleSize,
  getAvgAreaM2,
  getFixedCostForLan,
} from "./data/distributions";
import { kwhDistributionToKr } from "./kr-conversion";

export function findPercentile(value: number, dist: CostDistribution): number {
  const { p10, p50, p90 } = dist;
  if (value <= p10) {
    if (p10 <= 0) return 0;
    return Math.max(0, Math.min(10, value * (10 / p10)));
  }
  if (value <= p50) {
    return 10 + ((value - p10) / (p50 - p10)) * 40;
  }
  if (value <= p90) {
    return 50 + ((value - p50) / (p90 - p50)) * 40;
  }
  const slope = 40 / (p90 - p50);
  return Math.max(0, Math.min(100, 90 + (value - p90) * slope));
}

/**
 * National size-bucket proportions (HELA RIKET 2024 from SCB T3.2):
 * 0-50, 51-100, 101-150, 151-200, 201+ m².
 * Used to estimate the share of a län's villas that fall in the user's
 * size bucket when filtering sample size.
 */
const NATIONAL_BUCKET_PROPS = [0.0105, 0.1465, 0.375, 0.265, 0.203];

function getSizeBucketIndex(area: number): number {
  if (area <= 50) return 0;
  if (area <= 100) return 1;
  if (area <= 150) return 2;
  if (area <= 200) return 3;
  return 4;
}

function buildScope(
  lan: ReturnType<typeof resolveLan>,
  area?: number
): ComparisonScope {
  const totalSize = getSampleSize(lan);
  // If area is provided, shrink sample size to the matching size bucket
  // (estimated via national bucket distribution × län total).
  const sampleSize = area
    ? Math.round(totalSize * NATIONAL_BUCKET_PROPS[getSizeBucketIndex(area)])
    : totalSize;
  return {
    kind: "lan",
    id: lan,
    label: "ditt område",
    sampleSize,
    mode: "modeled",
  };
}

/**
 * Scale a cost distribution to a specific house size (legacy kr-domain).
 *
 * Assumption: cost = fixed + variable × area (approximately). We hold the
 * fixed part constant and scale the variable part by ratio = userArea / lanAvgArea,
 * clamped to [0.5, 2.0] to avoid extreme values.
 */
function scaleDistributionForSize(
  dist: CostDistribution,
  fixedCost: number,
  userArea: number,
  lanAvgArea: number
): CostDistribution {
  const ratio = Math.max(0.5, Math.min(2.0, userArea / lanAvgArea));
  const scale = (kr: number): number =>
    Math.round((fixedCost + (kr - fixedCost) * ratio) / 100) * 100;
  return { p10: scale(dist.p10), p50: scale(dist.p50), p90: scale(dist.p90) };
}

/**
 * Scale a kWh distribution to a specific house size.
 *
 * Linear scaling on kWh: a 200 m² villa uses ~ratio× as much kWh as the
 * län-average villa. No fixed-component to hold constant — fixed costs
 * enter via cost-model.ts during kr conversion. Clamped to [0.5, 2.0].
 */
function scaleKwhDistributionForSize(
  dist: KwhDistribution,
  userArea: number,
  lanAvgArea: number
): KwhDistribution {
  const ratio = Math.max(0.5, Math.min(2.0, userArea / lanAvgArea));
  return {
    p10: Math.round(dist.p10 * ratio),
    p50: Math.round(dist.p50 * ratio),
    p90: Math.round(dist.p90 * ratio),
  };
}

export function computeComparison(input: ComparisonInput): ComparisonResult {
  const lan = resolveLan(input.latitude, input.longitude);
  const scope = buildScope(lan, input.area);

  let distribution: CostDistribution;

  if (input.billData) {
    // --- New pipeline: kWh distribution → per-user tariff via cost-model ---
    const baseKwhDist = getModeledKwhDistribution(lan);
    const kwhDist = input.area
      ? scaleKwhDistributionForSize(baseKwhDist, input.area, getAvgAreaM2(lan))
      : baseKwhDist;
    distribution = kwhDistributionToKr(kwhDist, input.billData);
  } else {
    // --- Legacy pipeline: zone-linear kr table ---
    const baseDistribution = getModeledDistribution(lan);
    distribution = input.area
      ? scaleDistributionForSize(
          baseDistribution,
          getFixedCostForLan(lan),
          input.area,
          getAvgAreaM2(lan)
        )
      : baseDistribution;
  }

  const percentile = findPercentile(input.yearlyKr, distribution);
  const diffFromMedian = input.yearlyKr - distribution.p50;
  const diffFraction = distribution.p50 > 0 ? diffFromMedian / distribution.p50 : 0;

  return {
    scope,
    distribution,
    user: { kr: input.yearlyKr, percentile, diffFromMedian, diffFraction },
  };
}
