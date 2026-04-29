/**
 * Bygg en kompakt textsammanfattning av användarens situation som
 * Claude kan använda som kontext i chatten.
 *
 * Designmål:
 *  - Token-effektivt (max ~600 tokens) — vi vill inte bränna bort context window
 *  - Strukturerat så LLM:en kan referera till specifika fält
 *  - Inkluderar bara fält som faktiskt har värde (utelämnar tomma/null)
 */

import type {
  BillData,
  RefinementAnswers,
  Assumptions,
  ActiveUpgrades,
  SEZone,
} from "../../app/simulator/types";
import type { YearlyDataPoint } from "../../app/simulator/types";

export interface ChatUserContext {
  bill: BillData;
  refinement: RefinementAnswers;
  seZone: SEZone;
  assumptions?: Assumptions;
  activeUpgrades?: ActiveUpgrades;
  yearlyComparison?: YearlyDataPoint[];
}

/**
 * Producera en strukturerad textsammanfattning av användarens data.
 * Returneras som ett block som kan injiceras i system-prompten eller som
 * första user-message.
 */
export function buildUserContext(ctx: ChatUserContext): string {
  const parts: string[] = [];

  parts.push("# ANVÄNDARENS SITUATION");
  parts.push("");

  // --- Faktura-data ---
  parts.push("## Faktura och förbrukning");
  const annualKwh = ctx.bill.annualKwh ?? ctx.bill.kwhPerMonth * 12;
  parts.push(`- Årsförbrukning: ${Math.round(annualKwh).toLocaleString("sv-SE")} kWh`);
  parts.push(`- Månadssnitt: ${Math.round(ctx.bill.kwhPerMonth).toLocaleString("sv-SE")} kWh / ${Math.round(ctx.bill.costPerMonth).toLocaleString("sv-SE")} kr`);
  parts.push(`- Elområde: ${ctx.seZone}`);

  if (ctx.bill.elhandlare) parts.push(`- Elhandlare: ${ctx.bill.elhandlare}`);
  if (ctx.bill.natAgare) parts.push(`- Nätbolag: ${ctx.bill.natAgare}`);
  if (ctx.bill.elContractType) {
    const contractLabel = {
      dynamic: "Timspot (rörligt timpris)",
      monthly: "Månadsspot (rörligt månadsmedel)",
      fixed: "Fastpris",
    }[ctx.bill.elContractType];
    parts.push(`- Avtalstyp: ${contractLabel}`);
  }

  if (ctx.bill.invoiceSpotPriceOre !== undefined) {
    parts.push(`- Spotpris (snitt fakturamånad): ${ctx.bill.invoiceSpotPriceOre.toFixed(1)} öre/kWh exkl moms`);
  }
  if (ctx.bill.invoiceMarkupOre !== undefined) {
    parts.push(`- Elhandlarens påslag: ${ctx.bill.invoiceMarkupOre.toFixed(1)} öre/kWh exkl moms`);
  }
  if (ctx.bill.invoiceMonthlyFeeKr !== undefined && ctx.bill.invoiceMonthlyFeeKr > 0) {
    parts.push(`- Elhandlarens månadsavgift: ${ctx.bill.invoiceMonthlyFeeKr.toFixed(0)} kr/mån exkl moms`);
  }
  if (ctx.bill.gridFixedFeeKr !== undefined) {
    parts.push(`- Nätbolagets fasta avgift: ${ctx.bill.gridFixedFeeKr.toFixed(0)} kr/mån exkl moms`);
  }
  if (ctx.bill.gridTransferFeeOre !== undefined) {
    parts.push(`- Nätbolagets överföringsavgift: ${ctx.bill.gridTransferFeeOre.toFixed(1)} öre/kWh exkl moms`);
  }
  if (ctx.bill.invoicePeakKw !== undefined) {
    parts.push(`- Snitt-effekttopp på fakturan: ${ctx.bill.invoicePeakKw.toFixed(1)} kW`);
  }

  if (ctx.bill.spotPriceRatio !== undefined) {
    const ratio = ctx.bill.spotPriceRatio;
    let interpretation: string;
    if (ratio < 0.95) interpretation = `${Math.round((1 - ratio) * 100)}% under snittet — smart förbrukning`;
    else if (ratio > 1.05) interpretation = `${Math.round((ratio - 1) * 100)}% över snittet — kan optimeras`;
    else interpretation = "nära genomsnittet";
    parts.push(`- Smartness-index (spotpris vs zon-snitt): ${ratio.toFixed(2)} (${interpretation})`);
  }
  parts.push("");

  // --- Hus / boende ---
  parts.push("## Hus och boende");
  if (ctx.refinement.housingType) {
    const housingLabel = {
      villa: "Villa",
      radhus: "Radhus",
      lagenhet: "Lägenhet",
    }[ctx.refinement.housingType];
    parts.push(`- Boende: ${housingLabel}`);
  }
  if (ctx.refinement.area) parts.push(`- Boyta: ${ctx.refinement.area} m²`);
  if (ctx.refinement.residents) parts.push(`- Antal boende: ${ctx.refinement.residents}`);

  const heatingTypes = ctx.refinement.heatingTypes ?? (ctx.refinement.heatingType ? [ctx.refinement.heatingType] : []);
  if (heatingTypes.length > 0) {
    const heatingLabels: Record<string, string> = {
      direktel: "Direktverkande el",
      luftluft: "Luft-luft-värmepump",
      luftvatten: "Luft-vatten-värmepump",
      bergvarme: "Bergvärmepump",
      fjarrvarme: "Fjärrvärme",
    };
    parts.push(`- Uppvärmning: ${heatingTypes.map((h) => heatingLabels[h] ?? h).join(", ")}`);
  }

  if (ctx.refinement.bigConsumers && ctx.refinement.bigConsumers.length > 0) {
    const consumerLabels: Record<string, string> = {
      elbil: "Elbil",
      pool: "Pool",
      spabad: "Spabad",
      bastu: "Bastu",
    };
    parts.push(`- Stora elförbrukare: ${ctx.refinement.bigConsumers.map((c) => consumerLabels[c] ?? c).join(", ")}`);
  }
  parts.push("");

  // --- Befintlig utrustning ---
  parts.push("## Befintlig utrustning");
  if (ctx.refinement.hasSolar) {
    parts.push(`- Solceller: ${ctx.refinement.solarSizeKw ?? "okänd storlek"} kW`);
  } else {
    parts.push(`- Solceller: nej`);
  }
  if (ctx.refinement.hasBattery) {
    parts.push(`- Hembatteri: ${ctx.refinement.batterySizeKwh ?? "okänd storlek"} kWh`);
  } else {
    parts.push(`- Hembatteri: nej`);
  }
  parts.push("");

  // --- Aktiva uppgraderingar (om de simulerar något) ---
  if (ctx.activeUpgrades) {
    const activeIds = Object.entries(ctx.activeUpgrades)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeIds.length > 0) {
      parts.push("## För närvarande simulerade uppgraderingar");
      parts.push(`- ${activeIds.join(", ")}`);
      parts.push("");
    }
  }

  // --- 8-årsjämförelse om tillgänglig ---
  if (ctx.yearlyComparison && ctx.yearlyComparison.length > 0) {
    parts.push("## 8-årsjämförelse av kostnad (kr/år)");
    for (const y of ctx.yearlyComparison) {
      const marker = y.isEstimate ? "" : " ← innevarande år";
      parts.push(`- ${y.year}: ${y.cost.toLocaleString("sv-SE")} kr (${y.kwh.toLocaleString("sv-SE")} kWh)${marker}`);
    }
    parts.push("");
  }

  parts.push("---");
  parts.push("");
  parts.push("Hänvisa till dessa siffror när du svarar. Använd verktyg (function calls) när användaren ber om något som kräver beräkning utöver dessa data.");

  return parts.join("\n");
}
