# CURSOR-PROMPT-12: Real Invoice Parser + Multi-Invoice Upload

## Goal
Replace the stub invoice parser (random values) with a real LLM-based parser that extracts structured data from Swedish electricity invoices. Support uploading both elhandel and elnät invoices — either one at a time or both. Allow users to "add more" invoices later to improve accuracy.

## Anti-Truncation Rules
⚠️ CRITICAL — follow these rules EXACTLY:
- Edit ONE file at a time. Do NOT batch multiple file edits.
- After each file edit, run `npx tsc --noEmit` and verify 0 errors before proceeding.
- NEVER truncate code. If a function is 80 lines, write all 80 lines.
- Use APPEND strategy: read existing code, then add/modify only what's needed.
- If any `tsc` check fails, fix the error before moving to the next file.

---

## Step 1: Expand BillData in types.ts

**File:** `app/simulator/types.ts`

The current BillData is too minimal. Expand it to hold everything we can extract from invoices:

```typescript
export interface BillData {
  // --- Core (required) ---
  kwhPerMonth: number;
  costPerMonth: number;

  // --- From invoice header (either elnät or elhandel) ---
  natAgare?: string;
  annualKwh?: number;
  seZone?: SEZone;
  elhandlare?: string;

  // --- From elhandel invoice ---
  elContractType?: ElContractType;
  /** Volume-weighted avg spot price for the invoiced month (öre/kWh exkl moms) */
  invoiceSpotPriceOre?: number;
  /** Elhandlarens påslag — total of rörliga + fasta (öre/kWh exkl moms) */
  invoiceMarkupOre?: number;
  /** Elhandlarens månadsavgift (kr exkl moms) */
  invoiceMonthlyFeeKr?: number;
  /** Invoice period month (0-11) — to calibrate season */
  invoiceMonth?: number;
  /** Invoice total for elhandel only (kr inkl moms) */
  invoiceElhandelTotalKr?: number;

  // --- From elnät invoice ---
  /** Fast nätavgift (kr/mån exkl moms) */
  gridFixedFeeKr?: number;
  /** Överföringsavgift (öre/kWh exkl moms) */
  gridTransferFeeOre?: number;
  /** Effektavgift (kr/kW/mån exkl moms) */
  gridPowerChargeKrPerKw?: number;
  /** Does this grid operator charge effektavgift? */
  gridHasPowerCharge?: boolean;
  /** Energiskatt from invoice (öre/kWh exkl moms) */
  invoiceEnergyTaxOre?: number;
  /** Elnät invoice total (kr inkl moms) */
  invoiceElnatTotalKr?: number;

  // --- Solar indicators ---
  hasProductionRevenue?: boolean;
  hasDualMeteringIds?: boolean;
  /** Export kWh from production meter */
  solarExportKwh?: number;
  /** Export revenue (kr) */
  solarExportRevenueKr?: number;

  // --- Metadata ---
  /** Which invoice types have been uploaded */
  uploadedInvoiceTypes?: ("elhandel" | "elnat")[];
  /** Raw extracted data for debugging */
  parserConfidence?: number;
}
```

Keep `kwhPerMonth` and `costPerMonth` as required — they're the minimum the system needs. Everything else is optional enrichment.

Run `npx tsc --noEmit` — fix any downstream errors from the expanded interface.

---

## Step 2: Create API route for LLM invoice parsing

**File:** `app/api/parse-invoice/route.ts` (NEW)

Create a Next.js API route that:
1. Receives an uploaded PDF or image file
2. Extracts text from the PDF using pdf-parse (for PDFs) or sends the image directly
3. Sends the text to an LLM (Claude via Anthropic API) with a structured extraction prompt
4. Returns structured JSON matching BillData fields

```typescript
import { NextRequest, NextResponse } from "next/server";

// For PDF text extraction — install: npm install pdf-parse
// For image-based invoices, we send the image to Claude directly

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText = "";
    let imageBase64: string | null = null;

    if (file.type === "application/pdf") {
      // Extract text from PDF
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } else if (file.type.startsWith("image/")) {
      // For images, encode as base64 for Claude vision
      imageBase64 = buffer.toString("base64");
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // Call Claude API for structured extraction
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are an expert at reading Swedish electricity invoices (elfakturor).
Your job is to extract structured data from the invoice text or image.

Swedish invoices come in two types:
1. ELHANDEL (electricity trading) — from companies like Tibber, Green Hero, Vattenfall, E.ON
   Contains: spotpris, påslag, månadsavgift, förbrukning i kWh, avtalstyp
2. ELNÄT (grid) — from companies like Ellevio, Vattenfall Eldistribution, Göteborg Energi
   Contains: fast nätavgift, överföringsavgift, effektavgift, energiskatt

Key fields to look for:
- "Beräknad årsförbrukning" — annual consumption estimate (VERY IMPORTANT, on every invoice)
- "Elområde" — SE1, SE2, SE3, or SE4
- "Nätleverantör" — grid operator name
- "Spotpris" or "Rörligt pris" + quantity in kWh and öre/kWh — energy price and consumption
- "Påslag" or "Rörliga kostnader" or "Fasta påslag" — markup per kWh
- "Månadsavgift" — monthly fee
- Contract type: "Spotpris - timme" = dynamic, "Rörligt pris" = monthly, "Fast pris" = fixed
- "Fast nätavgift" or "Abonnemang" — grid fixed fee
- "Överföringsavgift" or "Elöverföring" — grid transfer fee per kWh
- "Effektavgift" — power charge per kW
- "Energiskatt" — energy tax per kWh
- Production meter: look for "produktionsanläggning" or a second Anläggnings-ID with very low "Beräknad årsförbrukning" (e.g. 1 kWh)

Return ONLY valid JSON. All monetary values in the units specified. Prices in öre/kWh where noted, fees in kr.
If a field is not found on the invoice, omit it from the JSON.
For "invoiceType": use "elhandel" if it's from an electricity retailer, "elnat" if from a grid operator, "combined" if it includes both.`;

    const userMessage = `Extract all structured data from this Swedish electricity invoice.

Return JSON with these fields (omit any not found):
{
  "invoiceType": "elhandel" | "elnat" | "combined",
  "kwhForPeriod": <number — total kWh consumed in this invoice period>,
  "totalCostInklMoms": <number — total invoice amount inkl moms in kr>,
  "annualKwh": <number — "Beräknad årsförbrukning" in kWh>,
  "seZone": "SE1" | "SE2" | "SE3" | "SE4",
  "natAgare": "<grid operator name>",
  "elhandlare": "<electricity retailer name>",
  "contractType": "dynamic" | "monthly" | "fixed",
  "spotPriceOreExMoms": <number — average spot price öre/kWh exkl moms>,
  "markupOreExMoms": <number — total markup (rörliga + fasta påslag) öre/kWh exkl moms>,
  "monthlyFeeKrExMoms": <number — månadsavgift kr exkl moms>,
  "invoiceMonth": <number 0-11 — which month the invoice covers>,
  "gridFixedFeeKrExMoms": <number — fast nätavgift kr/mån exkl moms>,
  "gridTransferFeeOreExMoms": <number — överföringsavgift öre/kWh exkl moms>,
  "gridPowerChargeKrPerKwExMoms": <number — effektavgift kr/kW exkl moms>,
  "energyTaxOreExMoms": <number — energiskatt öre/kWh exkl moms>,
  "hasProductionRevenue": <boolean — true if production/export revenue found>,
  "solarExportKwh": <number — exported kWh if found>,
  "solarExportRevenueKr": <number — export revenue kr if found>,
  "confidence": <number 0-1 — how confident you are in the extraction>
}`;

    const messages: any[] = [];
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: file.type, data: imageBase64 },
          },
          { type: "text", text: userMessage },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Here is the text extracted from a Swedish electricity invoice PDF:\n\n---\n${extractedText}\n---\n\n${userMessage}`,
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      return NextResponse.json({ error: "LLM parsing failed" }, { status: 500 });
    }

    const result = await response.json();
    const textContent = result.content?.find((c: any) => c.type === "text")?.text ?? "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse LLM response" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Parse invoice error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Install pdf-parse:
```bash
npm install pdf-parse
```

Add to `.env.local` (DO NOT commit):
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Step 3: Create helper to merge parsed data into BillData

**File:** `app/simulator/inference/bill-parser.ts` (REPLACE stub)

Replace the entire file with a function that converts the API response into BillData fields, and a merge function for combining multiple invoices:

```typescript
/**
 * Bill parser — convert LLM extraction results into BillData fields,
 * and merge multiple invoices into a single BillData.
 */

import type { BillData, ElContractType, SEZone } from "../types";

/** Shape returned by /api/parse-invoice */
export interface ParsedInvoice {
  invoiceType?: "elhandel" | "elnat" | "combined";
  kwhForPeriod?: number;
  totalCostInklMoms?: number;
  annualKwh?: number;
  seZone?: string;
  natAgare?: string;
  elhandlare?: string;
  contractType?: string;
  spotPriceOreExMoms?: number;
  markupOreExMoms?: number;
  monthlyFeeKrExMoms?: number;
  invoiceMonth?: number;
  gridFixedFeeKrExMoms?: number;
  gridTransferFeeOreExMoms?: number;
  gridPowerChargeKrPerKwExMoms?: number;
  energyTaxOreExMoms?: number;
  hasProductionRevenue?: boolean;
  solarExportKwh?: number;
  solarExportRevenueKr?: number;
  confidence?: number;
}

/**
 * Convert a single parsed invoice into partial BillData.
 * Uses annualKwh / 12 as kwhPerMonth if available (more accurate than single-month kWh).
 */
export function parsedInvoiceToBillData(parsed: ParsedInvoice): Partial<BillData> {
  const result: Partial<BillData> = {};

  // Annual consumption → monthly average (preferred over single-month value)
  if (parsed.annualKwh && parsed.annualKwh > 0) {
    result.annualKwh = parsed.annualKwh;
    result.kwhPerMonth = Math.round(parsed.annualKwh / 12);
  } else if (parsed.kwhForPeriod && parsed.kwhForPeriod > 0) {
    result.kwhPerMonth = parsed.kwhForPeriod;
  }

  // Total cost → costPerMonth
  if (parsed.totalCostInklMoms && parsed.totalCostInklMoms > 0) {
    result.costPerMonth = Math.round(parsed.totalCostInklMoms);
  }

  // Zone and operators
  if (parsed.seZone && ["SE1", "SE2", "SE3", "SE4"].includes(parsed.seZone)) {
    result.seZone = parsed.seZone as SEZone;
  }
  if (parsed.natAgare) result.natAgare = parsed.natAgare;
  if (parsed.elhandlare) result.elhandlare = parsed.elhandlare;

  // Contract type
  if (parsed.contractType && ["dynamic", "monthly", "fixed"].includes(parsed.contractType)) {
    result.elContractType = parsed.contractType as ElContractType;
  }

  // Elhandel details
  if (parsed.spotPriceOreExMoms !== undefined) result.invoiceSpotPriceOre = parsed.spotPriceOreExMoms;
  if (parsed.markupOreExMoms !== undefined) result.invoiceMarkupOre = parsed.markupOreExMoms;
  if (parsed.monthlyFeeKrExMoms !== undefined) result.invoiceMonthlyFeeKr = parsed.monthlyFeeKrExMoms;
  if (parsed.invoiceMonth !== undefined) result.invoiceMonth = parsed.invoiceMonth;
  if (parsed.invoiceType === "elhandel" && parsed.totalCostInklMoms) {
    result.invoiceElhandelTotalKr = parsed.totalCostInklMoms;
  }

  // Elnät details
  if (parsed.gridFixedFeeKrExMoms !== undefined) result.gridFixedFeeKr = parsed.gridFixedFeeKrExMoms;
  if (parsed.gridTransferFeeOreExMoms !== undefined) result.gridTransferFeeOre = parsed.gridTransferFeeOreExMoms;
  if (parsed.gridPowerChargeKrPerKwExMoms !== undefined) {
    result.gridPowerChargeKrPerKw = parsed.gridPowerChargeKrPerKwExMoms;
    result.gridHasPowerCharge = true;
  }
  if (parsed.energyTaxOreExMoms !== undefined) result.invoiceEnergyTaxOre = parsed.energyTaxOreExMoms;
  if (parsed.invoiceType === "elnat" && parsed.totalCostInklMoms) {
    result.invoiceElnatTotalKr = parsed.totalCostInklMoms;
  }

  // Solar
  if (parsed.hasProductionRevenue) result.hasProductionRevenue = true;
  if (parsed.solarExportKwh !== undefined) result.solarExportKwh = parsed.solarExportKwh;
  if (parsed.solarExportRevenueKr !== undefined) result.solarExportRevenueKr = parsed.solarExportRevenueKr;

  // Metadata
  if (parsed.confidence !== undefined) result.parserConfidence = parsed.confidence;
  if (parsed.invoiceType === "elhandel" || parsed.invoiceType === "elnat") {
    result.uploadedInvoiceTypes = [parsed.invoiceType];
  } else if (parsed.invoiceType === "combined") {
    result.uploadedInvoiceTypes = ["elhandel", "elnat"];
  }

  return result;
}

/**
 * Merge new parsed data into existing BillData.
 * New values overwrite old ones where present.
 * uploadedInvoiceTypes is merged (union).
 * costPerMonth: if we have both elhandel and elnät totals, sum them.
 */
export function mergeBillData(existing: BillData, newData: Partial<BillData>): BillData {
  // Merge uploaded invoice types
  const existingTypes = existing.uploadedInvoiceTypes ?? [];
  const newTypes = newData.uploadedInvoiceTypes ?? [];
  const mergedTypes = [...new Set([...existingTypes, ...newTypes])];

  const merged: BillData = {
    ...existing,
    ...newData,
    uploadedInvoiceTypes: mergedTypes.length > 0 ? mergedTypes as ("elhandel" | "elnat")[] : undefined,
  };

  // If we have both elhandel and elnät totals, compute combined monthly cost
  const elhandelTotal = merged.invoiceElhandelTotalKr ?? newData.invoiceElhandelTotalKr ?? existing.invoiceElhandelTotalKr;
  const elnatTotal = merged.invoiceElnatTotalKr ?? newData.invoiceElnatTotalKr ?? existing.invoiceElnatTotalKr;
  if (elhandelTotal && elnatTotal) {
    merged.costPerMonth = Math.round(elhandelTotal + elnatTotal);
  }

  // Ensure kwhPerMonth uses annualKwh if available
  if (merged.annualKwh && merged.annualKwh > 0) {
    merged.kwhPerMonth = Math.round(merged.annualKwh / 12);
  }

  return merged;
}
```

Run `npx tsc --noEmit`.

---

## Step 4: Update UploadBill.tsx — real parsing + multi-invoice support

**File:** `app/simulator/components/UploadBill.tsx`

Major rewrite. The new component should:

1. Call `/api/parse-invoice` with the uploaded file
2. Display what was extracted (with a summary card)
3. Allow adding more invoices ("Lägg till fler fakturor")
4. Show which invoice types have been uploaded (elhandel ✓ / elnät ✗)
5. Allow proceeding with what we have

Key changes:
- Replace `handleFile` random values with actual API call
- Add state for `parsedBillData: BillData`
- Add "add more" flow
- Show extraction results before proceeding

Here is the complete new component:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import type { BillData } from "../types";
import { STRINGS } from "../data/strings";
import ProcessingAnimation from "./ProcessingAnimation";
import { parsedInvoiceToBillData, mergeBillData } from "../inference/bill-parser";

interface UploadBillProps {
  onComplete: (data: BillData) => void;
  initialData?: BillData;
}

type Phase = "upload" | "processing" | "result" | "confirm";

const EMPTY_BILL: BillData = { kwhPerMonth: 0, costPerMonth: 0 };

export default function UploadBill({ onComplete, initialData }: UploadBillProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [billData, setBillData] = useState<BillData>(initialData ?? EMPTY_BILL);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Manual entry fields (for skip/fallback)
  const [manualKwh, setManualKwh] = useState(initialData?.kwhPerMonth ?? 1500);
  const [manualCost, setManualCost] = useState(initialData?.costPerMonth ?? 2500);
  const [manualNatAgare, setManualNatAgare] = useState(initialData?.natAgare ?? "");
  const [manualAnnualKwh, setManualAnnualKwh] = useState<number | "">(initialData?.annualKwh ?? "");

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setPhase("processing");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? "Kunde inte tolka fakturan");
      }

      const parsed = await response.json();
      const extracted = parsedInvoiceToBillData(parsed);

      // Merge with existing data (supports adding second invoice)
      const merged = mergeBillData(billData, extracted);
      setBillData(merged);
      setPhase("result");
    } catch (err: any) {
      console.error("Invoice parse error:", err);
      setError(err.message ?? "Något gick fel vid tolkning av fakturan");
      setPhase("upload");
    }
  }, [billData]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSkip = useCallback(() => {
    setPhase("confirm");
  }, []);

  const handleProceed = useCallback(() => {
    if (billData.kwhPerMonth > 0 && billData.costPerMonth > 0) {
      onComplete(billData);
    }
  }, [billData, onComplete]);

  const handleAddMore = useCallback(() => {
    setPhase("upload");
    setFileName("");
  }, []);

  // Processing phase
  if (phase === "processing") {
    return (
      <ProcessingAnimation onComplete={() => {
        // Animation will complete, but we wait for the API call via handleFile
        // If still processing, stay on this phase
      }} />
    );
  }

  // Result phase — show what was extracted
  if (phase === "result") {
    const types = billData.uploadedInvoiceTypes ?? [];
    const hasElhandel = types.includes("elhandel");
    const hasElnat = types.includes("elnat");

    return (
      <div className="mx-auto max-w-md px-4 animate-fade-in">
        <h2 className="mb-2 text-2xl font-bold text-text-primary">
          Vi hittade följande
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          Från {fileName}
        </p>

        {/* Extraction summary */}
        <div className="glass-card-strong rounded-2xl p-4 flex flex-col gap-3">
          {billData.annualKwh && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Årsförbrukning</span>
              <span className="text-sm font-bold text-text-primary">{billData.annualKwh.toLocaleString("sv-SE")} kWh</span>
            </div>
          )}
          {billData.kwhPerMonth > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Snitt per månad</span>
              <span className="text-sm font-bold text-text-primary">{billData.kwhPerMonth.toLocaleString("sv-SE")} kWh</span>
            </div>
          )}
          {billData.costPerMonth > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Fakturabelopp</span>
              <span className="text-sm font-bold text-text-primary">{billData.costPerMonth.toLocaleString("sv-SE")} kr</span>
            </div>
          )}
          {billData.seZone && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Elområde</span>
              <span className="text-sm font-bold text-text-primary">{billData.seZone}</span>
            </div>
          )}
          {billData.natAgare && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Nätbolag</span>
              <span className="text-sm font-bold text-text-primary">{billData.natAgare}</span>
            </div>
          )}
          {billData.elhandlare && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Elhandlare</span>
              <span className="text-sm font-bold text-text-primary">{billData.elhandlare}</span>
            </div>
          )}
          {billData.elContractType && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Avtalstyp</span>
              <span className="text-sm font-bold text-text-primary">
                {billData.elContractType === "dynamic" ? "Timpris" : billData.elContractType === "monthly" ? "Rörligt" : "Fast"}
              </span>
            </div>
          )}
          {billData.invoiceSpotPriceOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Spotpris (snitt)</span>
              <span className="text-sm font-bold text-text-primary">{billData.invoiceSpotPriceOre.toFixed(1)} öre/kWh</span>
            </div>
          )}
          {billData.invoiceMarkupOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Påslag</span>
              <span className="text-sm font-bold text-text-primary">{billData.invoiceMarkupOre.toFixed(1)} öre/kWh</span>
            </div>
          )}
          {billData.hasProductionRevenue && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Solproduktion</span>
              <span className="text-sm font-bold text-green-400">Ja ✓</span>
            </div>
          )}
        </div>

        {/* Invoice type indicators */}
        <div className="mt-4 flex gap-3">
          <div className={`flex-1 rounded-xl border-2 px-3 py-2 text-center text-sm ${
            hasElhandel ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-border text-text-muted"
          }`}>
            {hasElhandel ? "✓ " : ""}Elhandel
          </div>
          <div className={`flex-1 rounded-xl border-2 px-3 py-2 text-center text-sm ${
            hasElnat ? "border-green-500/50 bg-green-500/10 text-green-400" : "border-border text-text-muted"
          }`}>
            {hasElnat ? "✓ " : ""}Elnät
          </div>
        </div>

        {/* Add more or proceed */}
        {(!hasElhandel || !hasElnat) && (
          <button
            onClick={handleAddMore}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-brand-300/50 px-4 py-3 text-sm font-medium text-brand-300 hover:bg-brand-500/5 transition-colors"
          >
            + Lägg till {!hasElnat ? "elnätsfaktura" : "elhandelsfaktura"}
          </button>
        )}

        <button
          onClick={handleProceed}
          disabled={billData.kwhPerMonth <= 0}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STRINGS.next}
        </button>
      </div>
    );
  }

  // Manual confirm phase (skip upload)
  if (phase === "confirm") {
    return (
      <div className="mx-auto max-w-md px-4 animate-fade-in">
        <h2 className="mb-2 text-2xl font-bold text-text-primary">
          Ange dina uppgifter
        </h2>
        <p className="mb-6 text-text-secondary">Fyll i uppgifter från din senaste elräkning.</p>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Förbrukning per månad</span>
            <div className="relative">
              <input
                type="number"
                value={manualKwh}
                onChange={(e) => setManualKwh(Number(e.target.value))}
                min={0}
                className="w-full glass-card rounded-lg px-4 py-3 pr-16 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">kWh</span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Total elkostnad per månad</span>
            <span className="text-[11px] text-text-muted -mt-0.5">Helst totalbeloppet inkl. nätavgift, energiskatt och moms</span>
            <div className="relative">
              <input
                type="number"
                value={manualCost}
                onChange={(e) => setManualCost(Number(e.target.value))}
                min={0}
                className="w-full glass-card rounded-lg px-4 py-3 pr-16 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">kr</span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              Ditt nätbolag <span className="text-text-muted font-normal">(valfritt)</span>
            </span>
            <input
              type="text"
              value={manualNatAgare}
              onChange={(e) => setManualNatAgare(e.target.value)}
              placeholder="T.ex. Ellevio, Vattenfall, E.ON..."
              className="w-full glass-card rounded-lg px-4 py-3 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-text-muted/50"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              Årsförbrukning <span className="text-text-muted font-normal">(om den syns på fakturan)</span>
            </span>
            <div className="relative">
              <input
                type="number"
                value={manualAnnualKwh}
                onChange={(e) => setManualAnnualKwh(e.target.value === "" ? "" : Number(e.target.value))}
                min={0}
                placeholder="T.ex. 18000"
                className="w-full glass-card rounded-lg px-4 py-3 pr-16 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-text-muted/50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">kWh/år</span>
            </div>
          </label>
        </div>

        <button
          onClick={() => onComplete({
            kwhPerMonth: manualKwh,
            costPerMonth: manualCost,
            ...(manualNatAgare.trim() ? { natAgare: manualNatAgare.trim() } : {}),
            ...(manualAnnualKwh !== "" && manualAnnualKwh > 0 ? { annualKwh: manualAnnualKwh } : {}),
          })}
          disabled={manualKwh <= 0 || manualCost <= 0}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STRINGS.next}
        </button>
      </div>
    );
  }

  // Upload phase
  return (
    <div className="mx-auto max-w-md px-4 animate-fade-in">
      <h2 className="mb-2 text-2xl font-bold text-text-primary">
        {STRINGS.uploadTitle}
      </h2>
      <p className="mb-6 text-text-secondary">{STRINGS.uploadSubtitle}</p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`glass-card flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition-colors ${
          dragOver ? "border-brand-500 !bg-brand-500/10" : "border-border hover:border-brand-300"
        }`}
      >
        <svg
          className={`h-12 w-12 transition-colors ${dragOver ? "text-brand-500" : "text-text-muted"}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium text-text-primary">
          {STRINGS.uploadDrop}
        </span>
        <span className="text-xs text-text-muted">Elhandel- eller elnätsfaktura (PDF eller bild)</span>
        <input type="file" accept="image/*,.pdf" onChange={handleFileInput} className="hidden" />
      </label>

      <div className="mt-4 text-center">
        <button onClick={handleSkip} className="text-sm text-brand-300 hover:text-brand-200 underline underline-offset-2">
          Eller ange uppgifter manuellt
        </button>
      </div>
    </div>
  );
}
```

Run `npx tsc --noEmit`.

---

## Step 5: Wire extracted BillData fields into VerificationScreen

**File:** `app/simulator/components/VerificationScreen.tsx`

The VerificationScreen should pre-populate fields from the parsed invoice:

1. `seZone` — if `billData.seZone` exists, use it as default (instead of "SE3")
2. `elContractType` — if `billData.elContractType` exists, use it as default
3. `hasSolar` — if `billData.hasProductionRevenue`, default to true
4. Show the extracted `annualKwh` in the summary text (already does this via `billData.annualKwh`)

Change these initializations:
```typescript
const [seZone, setSeZone] = useState<SEZone>(initialSeZone ?? billData.seZone ?? "SE3");
const [elContractType, setElContractType] = useState<ElContractType>(
  initialRefinement?.elContractType ?? billData.elContractType ?? "monthly"
);
const [hasSolar, setHasSolar] = useState(
  initialRefinement?.hasSolar ?? billData.hasProductionRevenue ?? false
);
```

Run `npx tsc --noEmit`.

---

## Step 6: Wire extracted pricing into cost model via Assumptions

**File:** `app/page.tsx`

In `handleVerificationComplete`, pass the invoice-extracted pricing into assumptions so the cost model uses real values:

After the `updatedAssumptions` object is created (around line 62-66), add:

```typescript
// Use invoice-extracted pricing if available
const billPricing = state.billData!;
if (billPricing.natAgare) {
  updatedAssumptions.gridOperator = billPricing.natAgare;
}
if (billPricing.gridFixedFeeKr !== undefined) {
  updatedAssumptions.gridFixedFeeKr = billPricing.gridFixedFeeKr;
}
if (billPricing.gridTransferFeeOre !== undefined) {
  updatedAssumptions.gridTransferFeeOre = billPricing.gridTransferFeeOre;
}
if (billPricing.gridPowerChargeKrPerKw !== undefined) {
  updatedAssumptions.gridPowerChargeKrPerKw = billPricing.gridPowerChargeKrPerKw;
  updatedAssumptions.gridHasPowerCharge = true;
}
if (billPricing.invoiceMarkupOre !== undefined) {
  updatedAssumptions.elhandelMarkupOre = billPricing.invoiceMarkupOre;
}
```

This requires that the Assumptions type supports these fields. Check `app/simulator/types.ts` for the Assumptions interface and add any missing fields.

Run `npx tsc --noEmit`.

---

## Step 7: Handle the ProcessingAnimation timing

**File:** `app/simulator/components/ProcessingAnimation.tsx`

The current ProcessingAnimation calls `onComplete` after a fixed timer. But now the real API call may take longer. The simplest fix: make ProcessingAnimation accept an optional `minDuration` prop and have UploadBill control when to transition.

Alternative (simpler): In the new UploadBill, the processing animation runs in parallel with the API call. When both are done (animation minimum time elapsed AND API returned), transition to the result phase.

The current implementation calls `onComplete` after animation. Since we moved the API call to `handleFile`, the animation's `onComplete` is now just a minimum display time. The `handleFile` function updates phase to "result" when the API returns, but only if the animation has finished. This needs coordination.

**Simplest approach**: Remove the dependency. Let `handleFile` set phase to "result" directly when the API returns. The processing animation is shown while waiting. If the API is fast, the animation will cut short — that's fine, it's better than waiting artificially.

To do this, the processing animation should NOT call onComplete to change phase. Instead, it just renders. The phase change happens in `handleFile` when data arrives.

Update ProcessingAnimation to accept a `phase` or remove the timer-based callback. Or, keep it simple: render ProcessingAnimation as a loading indicator without `onComplete`, and let `handleFile`'s state update handle the transition.

In the new UploadBill code above, the `ProcessingAnimation onComplete` callback is empty — this is intentional. The phase transitions via `handleFile`'s `setPhase("result")`.

Run `npx tsc --noEmit`.

---

## Verification

After all changes:
```bash
npx tsc --noEmit
```

Test by:
1. Start the app with `npm run dev`
2. Upload Gustaf's Green Hero invoice PDF
3. Verify the extraction shows: 23,265 kWh/år, SE3, Ellevio, Green Hero, timpris, 105.65 öre spotpris, etc.
4. Proceed through the flow and check that the cost breakdown now shows realistic numbers

## Summary of Changes

| File | Change |
|------|--------|
| `types.ts` | Expand BillData with ~20 new optional fields |
| `app/api/parse-invoice/route.ts` | NEW — API route for LLM-based invoice parsing |
| `inference/bill-parser.ts` | REPLACE stub — conversion + merge functions |
| `components/UploadBill.tsx` | REWRITE — real parsing, result display, multi-invoice |
| `components/VerificationScreen.tsx` | Pre-populate seZone, elContractType, hasSolar from billData |
| `app/page.tsx` | Wire invoice pricing into Assumptions |
| `package.json` | Add pdf-parse dependency |
| `.env.local` | Add ANTHROPIC_API_KEY (not committed) |
