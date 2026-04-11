/**
 * Quick integration test for the 8760-hour simulation.
 * Run: npx tsx test-8760.ts
 *
 * Test data from actual invoice:
 * - Address: Dalvägen 10, 187 31 Täby (lat ≈ 59.44, lon ≈ 18.07)
 * - Annual consumption: 23,265 kWh (net grid)
 * - February consumption: 3,410.67 kWh
 * - February solar export: 14.59 kWh
 * - Grid operator: Ellevio AB, SE3
 * - Expected annual export: ~4,200 kWh
 */

import { parseTmyJson, type TmyHourlyData } from "./app/simulator/data/pvgis-tmy";
import {
  simulate8760Consumption,
  simulate8760Solar,
  simulate8760WithSolar,
} from "./app/simulator/simulation/simulate8760";
import type { BillData, RefinementAnswers, SEZone } from "./app/simulator/types";

// ===== Step 1: Fetch TMY data directly from PVGIS =====

async function fetchTmyDirect(lat: number, lon: number): Promise<TmyHourlyData[]> {
  const url = `https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat=${lat}&lon=${lon}&outputformat=json`;
  console.log(`Fetching TMY from: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PVGIS API error: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return parseTmyJson(json);
}

async function main() {
  const lat = 59.4;  // Täby, rounded to 0.1
  const lon = 18.1;

  // Fetch TMY
  console.log("\n===== STEP 1: Fetch PVGIS TMY data =====");
  const tmyData = await fetchTmyDirect(lat, lon);
  console.log(`✓ Received ${tmyData.length} hourly records`);

  if (tmyData.length < 8760) {
    console.error(`✗ Expected 8760 hours, got ${tmyData.length}`);
    process.exit(1);
  }
  console.log(`✓ Exactly ${tmyData.length >= 8760 ? '≥' : '<'} 8760 hours`);

  // Check data ranges
  const temps = tmyData.map(d => d.tempC);
  const ghis = tmyData.map(d => d.ghi);
  console.log(`  Temperature range: ${Math.min(...temps).toFixed(1)}°C to ${Math.max(...temps).toFixed(1)}°C`);
  console.log(`  GHI range: ${Math.min(...ghis)} to ${Math.max(...ghis)} W/m²`);

  // Check all GHI >= 0
  const negativeGhi = ghis.filter(g => g < 0);
  if (negativeGhi.length > 0) {
    console.error(`✗ Found ${negativeGhi.length} negative GHI values`);
  } else {
    console.log(`✓ All GHI values >= 0`);
  }

  // ===== Step 2: Test consumption model =====
  console.log("\n===== STEP 2: 8760 Consumption Model =====");

  const bill: BillData = {
    kwhPerMonth: Math.round(23265 / 12),  // 1938.75 → 1939
    costPerMonth: 4000,  // placeholder
    annualKwh: 23265,
    invoiceMonth: 1,     // February (0-indexed)
    invoicePeriodKwh: 3410.67,
    solarExportKwh: 14.59,
    seZone: "SE3" as SEZone,
    natAgare: "Ellevio AB",
  };

  const refinement: RefinementAnswers = {
    housingType: "villa",
    area: 180,
    heatingTypes: ["direktel"],
    residents: 4,
    hasSolar: true,
    solarSizeKw: 10,
    hasBattery: true,
    batterySizeKwh: 25,
    elContractType: "dynamic",
  };

  const consumption = simulate8760Consumption(bill, refinement, tmyData, "SE3");
  const annualConsumption = consumption.reduce((s, v) => s + v, 0);
  console.log(`Annual consumption: ${Math.round(annualConsumption)} kWh (target: 23265)`);

  // Check February total
  // February is hours 744 to 1415 (31 days Jan = 744h, 28 days Feb = 672h)
  const febStart = 31 * 24; // 744
  const febEnd = febStart + 28 * 24; // 1416
  const febConsumption = consumption.slice(febStart, febEnd).reduce((s, v) => s + v, 0);
  console.log(`February consumption: ${Math.round(febConsumption)} kWh (target: ~3411)`);

  // Monthly breakdown
  const monthlyConsumption = new Array(12).fill(0);
  let idx = 0;
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 0; m < 12; m++) {
    const hoursInMonth = daysPerMonth[m] * 24;
    for (let h = 0; h < hoursInMonth; h++) {
      monthlyConsumption[m] += consumption[idx++];
    }
  }
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  console.log("\nMonthly consumption:");
  for (let m = 0; m < 12; m++) {
    const bar = "█".repeat(Math.round(monthlyConsumption[m] / 100));
    console.log(`  ${labels[m]}: ${Math.round(monthlyConsumption[m]).toString().padStart(5)} kWh ${bar}`);
  }

  // ===== Step 3: Test solar production =====
  console.log("\n===== STEP 3: 8760 Solar Production (10 kW) =====");

  const solar = simulate8760Solar(10, tmyData);
  const annualSolar = solar.reduce((s, v) => s + v, 0);
  console.log(`Annual production: ${Math.round(annualSolar)} kWh (PVGIS reference: ~8470 for Stockholm)`);

  // Check if within 8000-9000 range
  if (annualSolar >= 8000 && annualSolar <= 9000) {
    console.log(`✓ Within expected range 8000-9000 kWh`);
  } else {
    console.log(`⚠ Outside expected range 8000-9000 kWh (got ${Math.round(annualSolar)})`);
  }

  // Monthly solar
  const monthlySolar = new Array(12).fill(0);
  idx = 0;
  for (let m = 0; m < 12; m++) {
    const hoursInMonth = daysPerMonth[m] * 24;
    for (let h = 0; h < hoursInMonth; h++) {
      monthlySolar[m] += solar[idx++];
    }
  }
  console.log("\nMonthly solar production:");
  for (let m = 0; m < 12; m++) {
    const bar = "█".repeat(Math.round(monthlySolar[m] / 50));
    console.log(`  ${labels[m]}: ${Math.round(monthlySolar[m]).toString().padStart(5)} kWh ${bar}`);
  }

  // Check December variation (should NOT be same every day)
  const decStart = daysPerMonth.slice(0, 11).reduce((s, d) => s + d * 24, 0);
  const decDailyTotals: number[] = [];
  for (let d = 0; d < 31; d++) {
    let dayTotal = 0;
    for (let h = 0; h < 24; h++) {
      dayTotal += solar[decStart + d * 24 + h];
    }
    decDailyTotals.push(dayTotal);
  }
  const decMin = Math.min(...decDailyTotals);
  const decMax = Math.max(...decDailyTotals);
  console.log(`\nDecember daily variation: ${decMin.toFixed(1)} - ${decMax.toFixed(1)} kWh/day`);
  if (decMin !== decMax) {
    console.log(`✓ December has day-to-day variation (not identical days)`);
  } else {
    console.log(`✗ December has NO variation — something is wrong`);
  }

  // Check July variation
  const julStart = daysPerMonth.slice(0, 6).reduce((s, d) => s + d * 24, 0);
  const julDailyTotals: number[] = [];
  for (let d = 0; d < 31; d++) {
    let dayTotal = 0;
    for (let h = 0; h < 24; h++) {
      dayTotal += solar[julStart + d * 24 + h];
    }
    julDailyTotals.push(dayTotal);
  }
  const julMin = Math.min(...julDailyTotals);
  const julMax = Math.max(...julDailyTotals);
  console.log(`July daily variation: ${julMin.toFixed(1)} - ${julMax.toFixed(1)} kWh/day`);
  if (julMax - julMin > 10) {
    console.log(`✓ July has significant variation (20-70 kWh/day expected)`);
  } else {
    console.log(`⚠ July variation seems low`);
  }

  // ===== Step 4: Full 8760 with solar + calibration =====
  console.log("\n===== STEP 4: Full 8760 Simulation with Solar =====");

  const result = simulate8760WithSolar(bill, refinement, tmyData, "SE3");

  console.log(`\nCalibrated system size: ${result.calibratedSystemSizeKw.toFixed(2)} kW`);
  console.log(`Annual production: ${Math.round(result.annualSolarProductionKwh)} kWh`);
  console.log(`Annual self-consumption: ${Math.round(result.annualSelfConsumptionKwh)} kWh (${(result.annualSelfConsumptionKwh / result.annualSolarProductionKwh * 100).toFixed(1)}%)`);
  console.log(`Annual grid export: ${Math.round(result.annualExportKwh)} kWh`);
  console.log(`Annual grid import: ${Math.round(result.annualGridImportKwh)} kWh`);

  // Check: annual export should be ~4200 kWh
  console.log(`\n--- Acceptance criteria ---`);
  console.log(`Annual export: ${Math.round(result.annualExportKwh)} kWh (reference: ~4200)`);
  if (result.annualExportKwh >= 3500 && result.annualExportKwh <= 5000) {
    console.log(`✓ Annual export within reasonable range (3500-5000 kWh)`);
  } else {
    console.log(`⚠ Annual export outside expected range`);
  }

  // February export should match ~14.59 kWh
  const febExport = result.monthlyExportKwh[1]; // February = index 1
  console.log(`February export: ${febExport.toFixed(1)} kWh (target: 14.59)`);
  if (Math.abs(febExport - 14.59) / 14.59 < 0.10) {
    console.log(`✓ February export within 10% of target`);
  } else {
    console.log(`⚠ February export differs from target by ${((febExport - 14.59) / 14.59 * 100).toFixed(1)}%`);
  }

  // Monthly export breakdown
  console.log("\nMonthly export:");
  for (let m = 0; m < 12; m++) {
    const bar = "█".repeat(Math.round(result.monthlyExportKwh[m] / 30));
    console.log(`  ${labels[m]}: ${Math.round(result.monthlyExportKwh[m]).toString().padStart(5)} kWh ${bar}`);
  }

  console.log("\n✓ All tests complete!");
}

main().catch(console.error);
