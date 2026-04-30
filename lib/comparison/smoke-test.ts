/**
 * Quick smoke test — run this with `npx tsx lib/comparison/smoke-test.ts` to
 * sanity-check that the comparison module returns reasonable values across
 * different län and user positions.
 *
 * Not a real test suite — real tests should live next to the source files
 * (e.g. compute.test.ts) once we add a test runner.
 */

import { computeComparison } from "./index";
import { LAN_INFO, ALL_LAN_CODES } from "./data/lan";
import { getModeledDistribution } from "./data/distributions";

console.log("=== Modeled distribution per län ===");
for (const code of ALL_LAN_CODES) {
  const info = LAN_INFO[code];
  const dist = getModeledDistribution(code);
  console.log(
    `${code.padEnd(3)} ${info.shortName.padEnd(20)} P10=${dist.p10
      .toString()
      .padStart(7)}  P50=${dist.p50.toString().padStart(7)}  P90=${dist.p90
      .toString()
      .padStart(7)}`
  );
}

console.log("\n=== Sample user comparisons ===");

const cases: Array<{ label: string; yearlyKr: number; lat: number; lon: number }> = [
  { label: "Median Stockholm villa", yearlyKr: 22_000, lat: 59.33, lon: 18.07 },
  { label: "Below-median Stockholm villa", yearlyKr: 14_000, lat: 59.33, lon: 18.07 },
  { label: "Above-median Stockholm villa (mockup example)", yearlyKr: 25_187, lat: 59.33, lon: 18.07 },
  { label: "Heavy-use Norrbotten villa", yearlyKr: 42_000, lat: 65.58, lon: 22.15 },
  { label: "Efficient Skåne villa", yearlyKr: 9_500, lat: 55.60, lon: 13.00 },
];

for (const c of cases) {
  const r = computeComparison({ yearlyKr: c.yearlyKr, latitude: c.lat, longitude: c.lon });
  console.log(`\n${c.label}`);
  console.log(`  scope: ${r.scope.kind}=${r.scope.id} (${r.scope.label}, n≈${r.scope.sampleSize}, ${r.scope.mode})`);
  console.log(`  distribution: P10=${r.distribution.p10}  P50=${r.distribution.p50}  P90=${r.distribution.p90}`);
  console.log(
    `  user: ${r.user.kr} kr → percentile ${r.user.percentile.toFixed(1)} ` +
      `(${r.user.diffFromMedian >= 0 ? "+" : ""}${r.user.diffFromMedian} kr vs median, ` +
      `${(r.user.diffFraction * 100).toFixed(1)} %)`
  );
}
