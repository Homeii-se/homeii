/**
 * Quick smoke test — run this with `npx tsx lib/comparison/smoke-test.ts` to
 * sanity-check that the comparison module returns reasonable values across
 * different län and user positions.
 *
 * Not a real test suite — real tests should live next to the source files
 * (e.g. compute.test.ts) once we add a test runner.
 */

import { computeComparison, kwhToAnnualKr, resolveInsightCopy } from "./index";
import { LAN_INFO, ALL_LAN_CODES } from "./data/lan";
import {
  getModeledDistribution,
  getModeledKwhDistribution,
} from "./data/distributions";

console.log("=== Modeled kr distribution per län (legacy) ===");
for (const code of ALL_LAN_CODES) {
  const info = LAN_INFO[code];
  const dist = getModeledDistribution(code);
  const kwhDist = getModeledKwhDistribution(code);
  console.log(
    `${code.padEnd(3)} ${info.shortName.padEnd(20)} ` +
      `P50=${dist.p50.toString().padStart(7)} kr  ` +
      `(P50_kWh=${kwhDist.p50.toString().padStart(6)})`
  );
}

console.log("\n=== Legacy pipeline: yearlyKr only ===");
const legacyCases: Array<{ label: string; yearlyKr: number; lat: number; lon: number }> = [
  { label: "Median Stockholm villa", yearlyKr: 22_000, lat: 59.33, lon: 18.07 },
  { label: "Above-median Stockholm villa (mockup)", yearlyKr: 25_187, lat: 59.33, lon: 18.07 },
  { label: "Heavy-use Norrbotten villa", yearlyKr: 42_000, lat: 65.58, lon: 22.15 },
  { label: "Efficient Skåne villa", yearlyKr: 9_500, lat: 55.60, lon: 13.00 },
];
for (const c of legacyCases) {
  const r = computeComparison({ yearlyKr: c.yearlyKr, latitude: c.lat, longitude: c.lon });
  console.log(`\n${c.label}`);
  console.log(`  scope: ${r.scope.id} (n≈${r.scope.sampleSize})`);
  console.log(`  dist:  P10=${r.distribution.p10}  P50=${r.distribution.p50}  P90=${r.distribution.p90}`);
  console.log(
    `  user:  ${r.user.kr} kr → P${r.user.percentile.toFixed(0)} ` +
      `(${(r.user.diffFraction * 100).toFixed(1)} % vs median)`
  );
}

console.log("\n=== New pipeline: with billData (Mattias-style SE3 villa) ===");
const mattiasBillData = {
  seZone: "SE3" as const,
  gridOperator: "Ellevio",
  gridFixedFeeKr: 240,
  gridTransferFeeOre: 28,
  gridPowerChargeKrPerKw: 60,
  gridHasPowerCharge: true,
};
const mattiasResult = computeComparison({
  yearlyKr: 24_326,
  latitude: 59.33,
  longitude: 18.07,
  area: 125,
  billData: mattiasBillData,
});
console.log(`  scope: ${mattiasResult.scope.id} (n≈${mattiasResult.scope.sampleSize})`);
console.log(
  `  dist:  P10=${mattiasResult.distribution.p10}  ` +
    `P50=${mattiasResult.distribution.p50}  P90=${mattiasResult.distribution.p90}`
);
console.log(
  `  user:  ${mattiasResult.user.kr} kr → P${mattiasResult.user.percentile.toFixed(0)} ` +
    `(${(mattiasResult.user.diffFraction * 100).toFixed(1)} % vs median)`
);
const insight = resolveInsightCopy(mattiasResult, {
  operatorName: "Ellevio Stockholm",
  potentialSavingsKr: 7500,
});
console.log(`  insight: segment=${insight.segment}, percentMore=${insight.percentMore}`);

console.log("\n=== kWh→kr conversion sanity ===");
for (const kwh of [5000, 8000, 11000, 14000, 18000, 25000]) {
  const kr = kwhToAnnualKr(kwh, mattiasBillData);
  console.log(`  ${kwh.toString().padStart(6)} kWh → ${Math.round(kr).toString().padStart(6)} kr`);
}
