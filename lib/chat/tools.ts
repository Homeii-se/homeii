/**
 * Tool-definitioner för chat-LLM:en (Anthropic tool_use format).
 *
 * Varje tool exponerar en specifik beräkningsfunktion från simulatorn så att
 * Claude kan göra exakta beräkningar istället för att gissa siffror.
 *
 * Server-sidan dispatcher kallar respektive funktion baserat på tool_use-namnet
 * och returnerar resultatet som tool_result-block.
 */

import type {
  BillData,
  RefinementAnswers,
  SEZone,
  ActiveUpgrades,
  Assumptions,
  UpgradeId,
} from "../../app/simulator/types";
import { getYearlyData } from "../../app/simulator/simulation/annual";
import { getAnnualAvgSpotOre } from "../../app/simulator/data/energy-prices";
import { getEnergyTaxRateForYear } from "../../app/simulator/data/energy-tax";

// ============================================================
// Tool schema (Anthropic format)
// ============================================================

export const CHAT_TOOLS = [
  {
    name: "get_yearly_comparison",
    description:
      "Hämta 8-årsjämförelse av användarens kostnad och förbrukning (2020-2027). " +
      "Använd detta när användaren frågar om historiska prisnivåer, om 2022 års " +
      "extrempriser, eller hur kostnaden varierat mellan år.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_spot_price_summary",
    description:
      "Hämta årsmedel-spotpris (öre/kWh exkl moms) för en specifik kombination av " +
      "år och elområde. Använd när användaren frågar om priset för ett specifikt år, " +
      "eller vill jämföra mellan zoner.",
    input_schema: {
      type: "object",
      properties: {
        year: {
          type: "number",
          description: "Året att hämta (2020-2027)",
        },
        zone: {
          type: "string",
          enum: ["SE1", "SE2", "SE3", "SE4"],
          description: "Elområde",
        },
      },
      required: ["year", "zone"],
    },
  },
  {
    name: "simulate_with_upgrade",
    description:
      "Räkna ut hur användarens årskostnad skulle förändras om de aktiverade en " +
      "specifik uppgradering (solceller, batteri, värmepump etc.). Returnerar nuvarande " +
      "kostnad och simulerad ny kostnad samt skillnaden.",
    input_schema: {
      type: "object",
      properties: {
        upgrade: {
          type: "string",
          enum: [
            "solceller",
            "batteri",
            "luftluft",
            "luftvatten",
            "bergvarme",
            "tillaggsisolering",
            "smartstyrning",
            "varmvattenpump",
            "fonsterbyte",
            "dynamiskt_elpris",
          ],
          description: "Uppgraderingens id",
        },
      },
      required: ["upgrade"],
    },
  },
  {
    name: "get_historical_day_prices",
    description:
      "Hämta verkliga timpriser för en specifik dag (öre/kWh exkl moms) — användbart " +
      "när användaren frågar om en specifik dags prismönster, t.ex. 2022 augusti " +
      "extrempriser eller en typisk vinterdag.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Datum i formatet YYYY-MM-DD (2020-01-01 till idag)",
        },
        zone: {
          type: "string",
          enum: ["SE1", "SE2", "SE3", "SE4"],
          description: "Elområde",
        },
      },
      required: ["date", "zone"],
    },
  },
] as const;

// ============================================================
// Tool dispatcher (server-side)
// ============================================================

export interface ToolDispatchContext {
  bill: BillData;
  refinement: RefinementAnswers;
  seZone: SEZone;
  assumptions?: Assumptions;
  activeUpgrades?: ActiveUpgrades;
  /** Bas-URL för fetch-anrop till våra egna API-endpoints */
  baseUrl: string;
}

export async function dispatchTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolDispatchContext
): Promise<unknown> {
  switch (toolName) {
    case "get_yearly_comparison": {
      const data = getYearlyData(ctx.bill, ctx.refinement, ctx.seZone);
      return {
        years: data.map((y) => ({
          year: y.year,
          kwh: y.kwh,
          cost_kr: y.cost,
          isCurrentYear: !y.isEstimate,
        })),
        note: "Spotpriser från ENTSO-E (2020-2025) och Nasdaq OMX-terminer (2026). Energiskatt årsspecifik. Nätbolagsavgifter och elhandelsmarkup använder dagens nivåer (~1-5% felmarginal mot exakt historisk faktura).",
      };
    }

    case "get_spot_price_summary": {
      const year = toolInput.year as number;
      const zone = toolInput.zone as SEZone;
      const avgSpot = getAnnualAvgSpotOre(year, zone);
      const taxOre = getEnergyTaxRateForYear(year, zone);
      if (avgSpot === null) {
        return { error: `Ingen prisdata för ${zone} ${year}` };
      }
      return {
        year,
        zone,
        annualAvgSpotOreExclVat: Math.round(avgSpot * 10) / 10,
        energyTaxOreExclVat: taxOre,
        note: `Spotpris 2020-2025 från ENTSO-E (verkligt utfall), 2026 prognos (terminspriser).`,
      };
    }

    case "simulate_with_upgrade": {
      const upgrade = toolInput.upgrade as UpgradeId;
      // Räkna baseline (utan uppgraderingen)
      const baselineYearly = getYearlyData(ctx.bill, ctx.refinement, ctx.seZone);
      const currentYearBaseline = baselineYearly.find((y) => !y.isEstimate);

      // Förenkling: använd uppskattad besparing per upgrade-typ
      // (mer noggrant skulle kräva att köra hela simulate8760 i tool-anropet)
      const ESTIMATED_ANNUAL_SAVING_KR: Record<string, number> = {
        solceller: 8500,
        batteri: 4500,
        luftluft: 6000,
        luftvatten: 14000,
        bergvarme: 22000,
        tillaggsisolering: 5000,
        smartstyrning: 1800,
        varmvattenpump: 2500,
        fonsterbyte: 3500,
        dynamiskt_elpris: 1500,
      };
      const ESTIMATED_INVESTMENT_KR: Record<string, number> = {
        solceller: 112000, // efter ROT
        batteri: 88000,
        luftluft: 22000,
        luftvatten: 130000,
        bergvarme: 220000,
        tillaggsisolering: 100000,
        smartstyrning: 8000,
        varmvattenpump: 25000,
        fonsterbyte: 80000,
        dynamiskt_elpris: 0,
      };

      const annualSaving = ESTIMATED_ANNUAL_SAVING_KR[upgrade] ?? 0;
      const investment = ESTIMATED_INVESTMENT_KR[upgrade] ?? 0;
      const paybackYears = annualSaving > 0 ? investment / annualSaving : null;

      return {
        upgrade,
        currentAnnualCostKr: currentYearBaseline?.cost ?? null,
        estimatedAnnualSavingKr: annualSaving,
        estimatedInvestmentKr: investment,
        paybackYears: paybackYears !== null ? Math.round(paybackYears * 10) / 10 : null,
        afterUpgradeAnnualCostKr: currentYearBaseline ? currentYearBaseline.cost - annualSaving : null,
        note: "Schablonvärden från upgrade-katalogen — för exakt simulering kör simulate8760 med bill+refinement+activeUpgrades. Investeringen är efter ROT-avdrag (typiskt 20% för grön teknik).",
      };
    }

    case "get_historical_day_prices": {
      const date = toolInput.date as string;
      const zone = toolInput.zone as SEZone;
      try {
        const res = await fetch(`${ctx.baseUrl}/api/spot-prices?zone=${zone}&date=${date}`);
        const data = await res.json();
        if (!data.pricesOreExMoms) {
          return { error: `Ingen prisdata för ${zone} ${date}` };
        }
        const prices = data.pricesOreExMoms as number[];
        return {
          date,
          zone,
          source: data.source,
          hourlyPricesOreExclVat: prices.map((p, h) => ({ hour: h, oreKwh: Math.round(p * 10) / 10 })),
          summary: {
            min: Math.round(Math.min(...prices) * 10) / 10,
            max: Math.round(Math.max(...prices) * 10) / 10,
            avg: Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 10) / 10,
            peakHour: prices.indexOf(Math.max(...prices)),
            valleyHour: prices.indexOf(Math.min(...prices)),
          },
        };
      } catch (err) {
        return { error: `Kunde inte hämta data: ${(err as Error).message}` };
      }
    }

    default:
      return { error: `Okänt verktyg: ${toolName}` };
  }
}
