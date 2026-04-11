/**
 * Battery simulation — charge/discharge over 24 hours.
 */

import { BATTERY_PARAMS } from "../data/upgrade-catalog";

/** Simulate battery behavior over 24 hours. Returns charge/discharge per hour and state. */
export function simulateBattery(
  hourlyConsumption: number[],
  hourlySolar: number[],
  hourlyPrices: number[],
  batterySizeKwh?: number
): {
  batteryCharge: number[];
  batteryState: number[];
  gridImport: number[];
  gridExport: number[];
} {
  const capacity = batterySizeKwh ?? BATTERY_PARAMS.capacityKwh;
  // Scale charge/discharge rate proportionally to capacity
  const scale = capacity / BATTERY_PARAMS.capacityKwh;
  const maxChargeRate = BATTERY_PARAMS.maxChargeRateKw * scale;
  const maxDischargeRate = BATTERY_PARAMS.maxDischargeRateKw * scale;
  const efficiency = BATTERY_PARAMS.roundTripEfficiency;

  const batteryCharge: number[] = [];
  const batteryState: number[] = [];
  const gridImport: number[] = [];
  const gridExport: number[] = [];
  let currentState = capacity * 0.5; // start at 50%

  for (let h = 0; h < 24; h++) {
    const netConsumption = hourlyConsumption[h] - hourlySolar[h];
    let charge = 0;
    let import_ = 0;
    let export_ = 0;

    if (netConsumption < 0) {
      // Solar surplus — charge battery
      const surplus = -netConsumption;
      const canCharge = Math.min(
        surplus,
        maxChargeRate,
        (capacity - currentState) / efficiency
      );
      charge = canCharge * efficiency;
      currentState += charge;
      export_ = Math.max(0, surplus - canCharge);
    } else {
      // Net consumption — discharge battery
      const canDischarge = Math.min(
        netConsumption,
        maxDischargeRate,
        currentState
      );
      charge = -canDischarge;
      currentState -= canDischarge;
      import_ = Math.max(0, netConsumption - canDischarge);
    }

    // Use price signal for smart charging (charge from grid when cheap, discharge when expensive)
    // Only charge when: price is very low, battery below 30%, and haven't exceeded daily cap
    if (hourlyPrices[h] < 0.65 && currentState < capacity * 0.3) {
      const cheapCharge = Math.min(
        maxChargeRate * 0.3, // Less aggressive: 30% of max rate
        (capacity - currentState) / efficiency,
        capacity * 0.2 // Cap total grid-charged energy per day to 20% of capacity
      );
      const actualCharge = cheapCharge * efficiency;
      currentState += actualCharge;
      charge += actualCharge;
      import_ += cheapCharge;
    }

    batteryCharge.push(Math.round(charge * 100) / 100);
    batteryState.push(Math.round(currentState * 100) / 100);
    gridImport.push(Math.round(import_ * 100) / 100);
    gridExport.push(Math.round(export_ * 100) / 100);
  }

  return { batteryCharge, batteryState, gridImport, gridExport };
}
