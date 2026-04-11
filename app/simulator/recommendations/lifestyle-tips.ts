/**
 * Lifestyle tips — low/no-cost behavioral recommendations.
 * These complement investment recommendations with actionable habits.
 */

import type { RefinementAnswers, BillData, SEZone, Assumptions } from "../types";
import { SE_ZONE_TOTAL_CONSUMER_PRICE } from "../data/energy-prices";

export type TipCategory = "transport" | "contract" | "finance" | "heating" | "appliances" | "general";

export interface LifestyleTip {
  id: string;
  title: string;
  description: string;
  estimatedSavingsKwhPerYear: number;
  estimatedSavingsKrPerYear: number;
  category: TipCategory;
  applicableIf?: (r: RefinementAnswers, b: BillData) => boolean;
}

/**
 * Generate personalized lifestyle tips based on household profile.
 */
export function generateLifestyleTips(
  billData: BillData,
  refinement: RefinementAnswers,
  seZone: SEZone,
  _assumptions?: Assumptions
): LifestyleTip[] {
  const yearlyKwh = billData.annualKwh ?? billData.kwhPerMonth * 12;
  const avgPriceOre = SE_ZONE_TOTAL_CONSUMER_PRICE[seZone]?.reduce((a, b) => a + b, 0) / 12 || 100;

  const allTips: LifestyleTip[] = [
    {
      id: "lower-indoor-temp",
      title: "Sänk inomhustemperaturen 1°C",
      description: "Varje grad lägre sparar ca 5% av uppvärmningskostnaden. Prova 20°C istället för 21°C.",
      estimatedSavingsKwhPerYear: Math.round(yearlyKwh * 0.03),
      estimatedSavingsKrPerYear: Math.round(yearlyKwh * 0.03 * avgPriceOre / 100),
      category: "heating",
    },
    {
      id: "wash-lower-temp",
      title: "Tvätta på 30°C istället för 40°C",
      description: "Modern tvättmedel fungerar lika bra på lägre temperatur och sparar energi.",
      estimatedSavingsKwhPerYear: 200,
      estimatedSavingsKrPerYear: Math.round(200 * avgPriceOre / 100),
      category: "appliances",
    },
    {
      id: "standby-off",
      title: "Stäng av standby-läge",
      description: "Elektronik i standby drar 5-10% av hushållets elförbrukning. Använd grenuttag med strömbrytare.",
      estimatedSavingsKwhPerYear: Math.round(yearlyKwh * 0.05),
      estimatedSavingsKrPerYear: Math.round(yearlyKwh * 0.05 * avgPriceOre / 100),
      category: "appliances",
    },
    {
      id: "smart-charging",
      title: "Ladda elbilen nattetid",
      description: "Spotpriset är lägst mellan 02-06. Schemalägg laddningen för att spara på timprisavtalet.",
      estimatedSavingsKwhPerYear: 500,
      estimatedSavingsKrPerYear: Math.round(500 * avgPriceOre / 100 * 0.4),
      category: "transport",
      applicableIf: (r) => r.elCar === "ja" || (r.bigConsumers ?? []).includes("elbil"),
    },
    {
      id: "review-contract",
      title: "Se över elavtalet",
      description: "Jämför elhandlare på Elpriskollen.se. Byt till timprisavtal om du kan vara flexibel.",
      estimatedSavingsKwhPerYear: 0,
      estimatedSavingsKrPerYear: Math.round(yearlyKwh * 0.05 * avgPriceOre / 100),
      category: "contract",
    },
    {
      id: "rot-deduction",
      title: "Utnyttja ROT- och grönt teknikavdrag",
      description: "30% skattereduktion på arbetskostnad för solceller, batteri och laddbox (max 50 000 kr/år).",
      estimatedSavingsKwhPerYear: 0,
      estimatedSavingsKrPerYear: 0,
      category: "finance",
    },
  ];

  return allTips.filter((tip) => {
    if (tip.applicableIf) return tip.applicableIf(refinement, billData);
    return true;
  });
}