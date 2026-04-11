/**
 * Adapters to convert between UI state (BillData + RefinementAnswers) and HouseholdProfile.
 * Used internally by the simulation layer.
 */

import type {
  BillData,
  RefinementAnswers,
  SEZone,
  Assumptions,
  HouseholdProfile,
} from "../types";

/**
 * Build a unified HouseholdProfile from UI state pieces.
 * This is the bridge between the UI layer's scattered state and
 * the simulation layer's clean input interface.
 */
export function buildHouseholdProfile(
  bill: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  assumptions: Assumptions
): HouseholdProfile {
  const annualKwh = bill.annualKwh ?? bill.kwhPerMonth * 12;

  const bigConsumers = refinement.bigConsumers ?? [];
  const hasEv = refinement.elCar === "ja" || bigConsumers.includes("elbil");

  return {
    monthlyKwh: bill.kwhPerMonth,
    monthlyCostKr: bill.costPerMonth,
    annualKwh,
    housingType: refinement.housingType ?? "villa",
    heatingTypes: refinement.heatingTypes
      ?? (refinement.heatingType ? [refinement.heatingType] : ["direktel"]),
    areaM2: refinement.area ?? 120,
    residents: refinement.residents ?? 2,
    seZone,
    gridOperator: bill.natAgare,
    gridFeeMonthlyKr: assumptions.gridFeeKrPerMonth,
    powerFeePerKw: assumptions.powerFeeKrPerKw,
    elContractType: refinement.elContractType ?? "monthly",
    bigConsumers,
    hasElbil: hasEv,
    hasSolar: refinement.hasSolar ?? false,
    solarSizeKw: refinement.solarSizeKw ?? assumptions.solarSizeKw,
    hasBattery: refinement.hasBattery ?? false,
    batterySizeKwh: refinement.batterySizeKwh ?? assumptions.batterySizeKwh,
  };
}

/**
 * Reverse adapter: extract BillData from a HouseholdProfile.
 */
export function profileToBillData(profile: HouseholdProfile): BillData {
  return {
    kwhPerMonth: profile.monthlyKwh,
    costPerMonth: profile.monthlyCostKr,
    annualKwh: profile.annualKwh,
    ...(profile.gridOperator ? { natAgare: profile.gridOperator } : {}),
  };
}

/**
 * Reverse adapter: extract RefinementAnswers from a HouseholdProfile.
 */
export function profileToRefinement(profile: HouseholdProfile): RefinementAnswers {
  return {
    housingType: profile.housingType,
    area: profile.areaM2,
    heatingTypes: profile.heatingTypes,
    residents: profile.residents,
    elCar: profile.hasElbil ? "ja" : "nej",
    bigConsumers: profile.bigConsumers,
    hasSolar: profile.hasSolar,
    solarSizeKw: profile.solarSizeKw,
    hasBattery: profile.hasBattery,
    batterySizeKwh: profile.batterySizeKwh,
    elContractType: profile.elContractType,
  };
}

/**
 * Build Assumptions from a HouseholdProfile.
 */
export function profileToAssumptions(profile: HouseholdProfile): Assumptions {
  return {
    solarSizeKw: profile.solarSizeKw ?? 0,
    batterySizeKwh: profile.batterySizeKwh ?? 0,
    gridFeeKrPerMonth: profile.gridFeeMonthlyKr ?? 320,
    powerFeeKrPerKw: profile.powerFeePerKw ?? 44,
  };
}