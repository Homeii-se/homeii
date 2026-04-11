/**
 * Profile inference — deduce household characteristics from bill data.
 */

import type {
  BillData,
  SEZone,
  HousingType,
  HeatingType,
  InferredValue,
  InferredProfile,
  ConfidenceLevel,
} from "../types";
import { NATAGARE_SE_ZONE } from "../data/inference-rules";
import { HEATING_SHARE } from "../data/energy-profiles";

/** Fuzzy-match nätägare name against known mappings */
export function inferSEZone(natAgare?: string): InferredValue<SEZone> {
  if (!natAgare || natAgare.trim().length === 0) {
    return {
      value: "SE3",
      confidence: "low",
      reasoning: "Ingen nätägare angiven — SE3 (vanligast) som standard",
    };
  }

  const normalized = natAgare.trim().toLowerCase();

  // Exact match
  if (NATAGARE_SE_ZONE[normalized]) {
    return {
      value: NATAGARE_SE_ZONE[normalized],
      confidence: "high",
      reasoning: `${natAgare} tillhör ${NATAGARE_SE_ZONE[normalized]}`,
    };
  }

  // Fuzzy: check if any key is contained in the input or vice versa
  for (const [key, zone] of Object.entries(NATAGARE_SE_ZONE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        value: zone,
        confidence: "medium",
        reasoning: `"${natAgare}" matchar troligen ${key} (${zone})`,
      };
    }
  }

  return {
    value: "SE3",
    confidence: "low",
    reasoning: `Okänd nätägare "${natAgare}" — SE3 som standard`,
  };
}

/** Infer housing type from annual kWh consumption */
export function inferHousingType(annualKwh: number): InferredValue<HousingType> {
  if (annualKwh > 15000) {
    return {
      value: "villa",
      confidence: annualKwh > 20000 ? "high" : "medium",
      reasoning: `${Math.round(annualKwh).toLocaleString("sv-SE")} kWh/år tyder på villa`,
    };
  }
  if (annualKwh >= 8000) {
    return {
      value: "radhus",
      confidence: "medium",
      reasoning: `${Math.round(annualKwh).toLocaleString("sv-SE")} kWh/år tyder på radhus`,
    };
  }
  return {
    value: "lagenhet",
    confidence: annualKwh < 5000 ? "high" : "medium",
    reasoning: `${Math.round(annualKwh).toLocaleString("sv-SE")} kWh/år tyder på lägenhet`,
  };
}

/** Infer heating types from consumption and housing type */
export function inferHeatingTypes(
  annualKwh: number,
  housingType: HousingType
): InferredValue<HeatingType[]> {
  if (housingType === "lagenhet") {
    return {
      value: ["fjarrvarme"],
      confidence: "medium",
      reasoning: "De flesta lägenheter har fjärrvärme",
    };
  }

  if (annualKwh > 18000) {
    return {
      value: ["direktel"],
      confidence: "medium",
      reasoning: "Hög förbrukning tyder på direktel som huvuduppvärmning",
    };
  }
  if (annualKwh > 12000) {
    return {
      value: ["luftluft", "direktel"],
      confidence: "low",
      reasoning: "Medelhög förbrukning — troligen luft/luft-värmepump med kompletterande direktel",
    };
  }
  return {
    value: ["bergvarme"],
    confidence: "low",
    reasoning: "Låg förbrukning för villa/radhus tyder på bergvärme",
  };
}

/** Back-calculate area from kWh, housing type, and heating types */
export function inferArea(
  annualKwh: number,
  housingType: HousingType,
  heatingTypes: HeatingType[]
): InferredValue<number> {
  // Baseload per person (approx 2 persons) ~ 3000 kWh/year
  const baseload = 3000;
  const heatingKwh = Math.max(0, annualKwh - baseload);

  // kWh per m² depends on heating efficiency
  const kwhPerSqm: Record<HeatingType, number> = {
    direktel: 100,
    luftluft: 60,
    luftvatten: 45,
    bergvarme: 40,
    fjarrvarme: 30,
  };

  const avgKwhPerSqm =
    heatingTypes.length > 0
      ? heatingTypes.reduce((sum, ht) => sum + kwhPerSqm[ht], 0) / heatingTypes.length
      : 75;

  let area = Math.round(heatingKwh / avgKwhPerSqm);

  // Clamp to reasonable ranges
  const minArea = housingType === "lagenhet" ? 30 : housingType === "radhus" ? 60 : 80;
  const maxArea = housingType === "lagenhet" ? 120 : housingType === "radhus" ? 180 : 350;
  area = Math.max(minArea, Math.min(maxArea, area));

  // Round to nearest 10
  area = Math.round(area / 10) * 10;

  const confidence: ConfidenceLevel = "medium";
  return {
    value: area,
    confidence,
    reasoning: `Uppskattad boarea baserat på ${Math.round(annualKwh).toLocaleString("sv-SE")} kWh/år`,
  };
}

/** Infer number of residents from consumption and housing type */
export function inferResidents(
  annualKwh: number,
  housingType: HousingType
): InferredValue<number> {
  // Remove estimated heating overhead
  const heatingOverhead: Record<HousingType, number> = {
    villa: 10000,
    radhus: 6000,
    lagenhet: 2000,
  };
  const nonHeating = Math.max(1000, annualKwh - heatingOverhead[housingType]);
  // ~1000-1200 kWh per person per year for non-heating usage
  let residents = Math.round(nonHeating / 1100);
  residents = Math.max(1, Math.min(6, residents));

  return {
    value: residents,
    confidence: "low",
    reasoning: `Uppskattat antal boende baserat på hushållsel`,
  };
}

/** Infer whether the household has solar panels from bill indicators */
export function inferSolar(billData: BillData): InferredValue<boolean> {
  const hasRevenue = !!billData.hasProductionRevenue;
  const hasDualIds = !!billData.hasDualMeteringIds;

  if (hasRevenue) {
    return {
      value: true,
      confidence: "high",
      reasoning: "Produktionsintäkter på fakturan tyder på solceller",
    };
  }
  if (hasDualIds) {
    return {
      value: true,
      confidence: "medium",
      reasoning: "Två anläggnings-ID kan tyda på solcellsanläggning",
    };
  }
  return {
    value: false,
    confidence: "low",
    reasoning: "Inga solcellsindikatorer på fakturan",
  };
}

/** Run all inference functions and return a complete InferredProfile */
export function inferProfileFromBill(billData: BillData): InferredProfile {
  const annualKwh = billData.annualKwh ?? billData.kwhPerMonth * 12;

  const seZone = inferSEZone(billData.natAgare);
  const housingType = inferHousingType(annualKwh);
  const heatingTypes = inferHeatingTypes(annualKwh, housingType.value);
  const area = inferArea(annualKwh, housingType.value, heatingTypes.value);
  const residents = inferResidents(annualKwh, housingType.value);
  const hasSolar = inferSolar(billData);

  return { seZone, housingType, heatingTypes, area, residents, hasSolar };
}
