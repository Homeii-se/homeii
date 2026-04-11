import { NextRequest, NextResponse } from "next/server";
import { fetchMonthlyAverageSpotPrice } from "../../simulator/data/historical-spot";
import { inferZoneFromGridOperator } from "../../simulator/data/grid-operators";
import { geocodeAddress } from "../../simulator/data/geocoding";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Support both single "file" and multiple "files" fields
    const files: File[] = [];
    const singleFile = formData.get("file") as File | null;
    if (singleFile) files.push(singleFile);
    const multiFiles = formData.getAll("files") as File[];
    files.push(...multiFiles);

    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Build content blocks for all files
    const contentBlocks: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      if (file.type === "application/pdf") {
        contentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
      } else if (file.type.startsWith("image/")) {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: file.type, data: base64 },
        });
      } else {
        console.warn(`[PARSE-INVOICE] Skipping unsupported file type: ${file.type}`);
      }
    }

    if (contentBlocks.length === 0) {
      return NextResponse.json({ error: "No supported files provided" }, { status: 400 });
    }

    console.log(`[PARSE-INVOICE] Processing ${contentBlocks.length} file(s): ${files.map(f => f.name).join(", ")}`);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are an expert at reading Swedish electricity invoices (elfakturor).
Your job is to extract structured data from the invoice text or image.

You may receive MULTIPLE images or documents. They could be:
A) Multiple pages of the SAME invoice (e.g. page 1 and page 2 of an Ellevio bill) — treat as ONE invoice
B) TWO SEPARATE invoices (e.g. one elhandel + one elnät) — return data from BOTH

If you see TWO SEPARATE invoices (different companies or different invoice types), return a JSON ARRAY with one object per invoice: [{...elhandel...}, {...elnät...}]
If it's a single invoice (even across multiple pages/images), return a single JSON object: {...}

Swedish invoices come in two types:
1. ELHANDEL (electricity trading) — from companies like Tibber, Green Hero, Soldags, Vattenfall, E.ON
   Contains: spotpris, påslag, månadsavgift, förbrukning i kWh, avtalstyp
2. ELNÄT (grid) — from companies like Ellevio, Vattenfall Eldistribution, Göteborg Energi
   Contains: fast nätavgift, överföringsavgift, effektavgift, energiskatt

CRITICAL — SOLAR INVOICES WITH TWO METERS:
Many invoices contain BOTH a consumption meter ("förbrukningsanläggning") and a production meter ("produktionsanläggning"). These are often on separate pages of the same PDF.
- The CONSUMPTION meter has "Beräknad årsförbrukning" of thousands of kWh (e.g. 23 265 kWh)
- The PRODUCTION meter has "Beräknad årsförbrukning" of 1 kWh and shows negative amounts (export revenue)
YOU MUST ONLY extract data from the CONSUMPTION meter. Ignore the production meter entirely for all fields EXCEPT:
- hasProductionRevenue: set to true if a production meter exists
- solarExportKwh: the exported kWh from the production meter (shown as a positive number of kWh)
- solarExportRevenueKr: the export revenue (shown as negative kr amount — return as positive number)

For totalCostInklMoms: use ONLY the consumption meter's costs (spotpris + påslag + månadsavgift). Do NOT include production meter amounts. Do NOT use the invoice's combined "Att betala" amount, as it nets production against consumption.
For kwhForPeriod: use ONLY the consumption meter's kWh (the "Antal" column on the spotpris/consumption line).
For annualKwh: use ONLY the "Beräknad årsförbrukning" from the CONSUMPTION meter (the one with thousands of kWh, NOT the production meter's 1 kWh).

Key fields to look for:
- "Beräknad årsförbrukning" — annual consumption estimate. ONLY extract this if the EXACT phrase literally appears on the invoice. Do NOT calculate or estimate it yourself.
- "Elområde" — SE1, SE2, SE3, or SE4
- "Nätleverantör" — grid operator name
- "Spotpris" or "Rörligt pris" + quantity in kWh and öre/kWh — energy price and consumption
- "Påslag" or "Rörliga kostnader" or "Fasta påslag" — markup per kWh
- "Månadsavgift" — monthly fee
- Contract type: "Spotpris - timme" = dynamic, "Rörligt pris" = monthly, "Fast pris" = fixed
- "Fast nätavgift" or "Abonnemang" — grid fixed fee
- "Överföringsavgift" or "Elöverföring" — grid transfer fee per kWh
- "Effektavgift" — power charge per kW. Look for BOTH the rate (kr/kW) AND actual peak kW values.
  Ellevio and similar operators show "Snitt effekttoppar" (average peak kW used for billing)
  and "Dina 3 högsta effekttoppar" (the 3 highest individual peaks with dates and kW values).
  Extract the "Snitt" value as gridPeakKw and the individual peaks as gridTop3PeakKw.
- "Energiskatt" — energy tax per kWh

Return ONLY valid JSON. All monetary values in the units specified. Prices in öre/kWh where noted, fees in kr.
If a field is not found on the invoice, omit it from the JSON.
For "invoiceType": use "elhandel" if it's from an electricity retailer, "elnat" if from a grid operator, "combined" if it includes both.`;

    const userMessage = `Extract all structured data from this Swedish electricity invoice (or invoices if multiple).

${contentBlocks.length > 1 ? `You are seeing ${contentBlocks.length} images/documents. Determine if they are pages of the SAME invoice or SEPARATE invoices. If separate, return a JSON array [{...}, {...}].` : ""}

Return JSON with these fields (omit any not found):
{
  "invoiceType": "elhandel" | "elnat" | "combined",
  "kwhForPeriod": <number — kWh consumed from CONSUMPTION meter only>,
  "totalCostInklMoms": <number — consumption costs only (inkl moms)>,
  "annualKwh": <number — ONLY if "Beräknad årsförbrukning" literally appears>,
  "seZone": "SE1" | "SE2" | "SE3" | "SE4",
  "natAgare": "<grid operator name>",
  "elhandlare": "<electricity retailer name>",
  "contractType": "dynamic" | "monthly" | "fixed",
  "spotPriceOreExMoms": <number — average spot price öre/kWh exkl moms>,
  "markupOreExMoms": <number — total markup öre/kWh exkl moms>,
  "monthlyFeeKrExMoms": <number — månadsavgift kr exkl moms>,
  "invoiceMonth": <number 0-11 — which month the invoice covers (0=January)>,
  "invoiceYear": <number — which year the invoice period covers (e.g. 2025)>,
  "gridFixedFeeKrExMoms": <number — fast nätavgift kr/mån exkl moms>,
  "gridTransferFeeOreExMoms": <number — överföringsavgift öre/kWh exkl moms>,
  "gridPowerChargeKrPerKwExMoms": <number — effektavgift kr/kW exkl moms>,
  "gridPeakKw": <number — actual average peak kW billed (e.g. "Snitt" value from effekttoppar)>,
  "gridTop3PeakKw": [<number>, <number>, <number>] — top 3 peak kW values if listed>,
  "energyTaxOreExMoms": <number — energiskatt öre/kWh exkl moms>,
  "hasProductionRevenue": <boolean — true if production/export revenue found>,
  "solarExportKwh": <number — exported kWh if found>,
  "solarExportRevenueKr": <number — export revenue kr if found>,
  "address": "<string — leveransadress / anläggningsadress if visible on invoice>",
  "confidence": <number 0-1 — how confident you are in the extraction>
}`;

    const messages = [
      {
        role: "user",
        content: [
          ...contentBlocks,
          { type: "text", text: userMessage },
        ],
      },
    ];

    // Retry logic for transient API errors (429, 529, 5xx)
    const MAX_RETRIES = 3;
    let result: Record<string, unknown> | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: systemPrompt,
          messages,
        }),
      });

      if (response.ok) {
        result = await response.json();
        break;
      }

      const errorText = await response.text();
      console.error(`Anthropic API error (attempt ${attempt}/${MAX_RETRIES}):`, response.status, errorText);

      // Retry on overloaded/rate-limit/server errors
      if ((response.status === 429 || response.status === 529 || response.status >= 500) && attempt < MAX_RETRIES) {
        const delay = attempt * 2000; // 2s, 4s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // User-friendly error messages
      if (response.status === 529 || response.status === 503) {
        return NextResponse.json(
          { error: "Tjänsten är tillfälligt överbelastad. Vänta en stund och försök igen." },
          { status: 503 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: "För många förfrågningar just nu. Vänta en stund och försök igen." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Kunde inte analysera fakturan just nu. Försök igen om en stund." },
        { status: 500 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: "Tjänsten är tillfälligt överbelastad. Vänta en stund och försök igen." },
        { status: 503 }
      );
    }
    const contentArray = result.content as Array<{ type: string; text?: string }> | undefined;
    const textContent = contentArray?.find(
      (c) => c.type === "text"
    )?.text ?? "";

    // Extract JSON from response — could be a single object or an array
    const jsonMatch = textContent.match(/[\[{][\s\S]*[\]}]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse LLM response" }, { status: 500 });
    }

    let parsed = JSON.parse(jsonMatch[0]);

    // Normalize: always work with an array of invoices
    const invoices: Array<Record<string, unknown>> = Array.isArray(parsed) ? parsed : [parsed];

    console.log(`[PARSE-INVOICE] LLM returned ${Array.isArray(parsed) ? 'ARRAY' : 'SINGLE'} (${invoices.length} invoice(s))`);
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      console.log(`[PARSE-INVOICE] Invoice ${i + 1} extracted:`, JSON.stringify({
        invoiceType: inv.invoiceType,
        annualKwh: inv.annualKwh,
        kwhForPeriod: inv.kwhForPeriod,
        totalCostInklMoms: inv.totalCostInklMoms,
        seZone: inv.seZone,
        natAgare: inv.natAgare,
        elhandlare: inv.elhandlare,
        contractType: inv.contractType,
        spotPriceOreExMoms: inv.spotPriceOreExMoms,
        markupOreExMoms: inv.markupOreExMoms,
        monthlyFeeKrExMoms: inv.monthlyFeeKrExMoms,
        invoiceMonth: inv.invoiceMonth,
        invoiceYear: inv.invoiceYear,
        confidence: inv.confidence,
      }));
    }

    // Enrich each invoice
    for (const invoice of invoices) {
      // Fallback 1: infer seZone from grid operator
      if (!invoice.seZone && invoice.natAgare) {
        const inferredZone = inferZoneFromGridOperator(invoice.natAgare as string);
        if (inferredZone) {
          invoice.seZone = inferredZone;
          console.log(`[PARSE-INVOICE] seZone inferred from natAgare "${invoice.natAgare}": ${inferredZone}`);
        }
      }

      // Fallback 2: infer invoiceYear
      if (invoice.invoiceYear === undefined && invoice.invoiceMonth !== undefined) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        invoice.invoiceYear = (invoice.invoiceMonth as number) >= currentMonth
          ? currentYear - 1
          : currentYear;
        console.log(`[PARSE-INVOICE] invoiceYear inferred: ${invoice.invoiceYear} (month=${invoice.invoiceMonth}, current=${currentMonth})`);
      }

      console.log(`[PARSE-INVOICE] Historical spot check: seZone=${invoice.seZone}, month=${invoice.invoiceMonth}, year=${invoice.invoiceYear}`);

      // Fetch historical spot price
      if (
        invoice.seZone &&
        invoice.invoiceMonth !== undefined &&
        invoice.invoiceYear !== undefined &&
        ["SE1", "SE2", "SE3", "SE4"].includes(invoice.seZone as string)
      ) {
        try {
          const historicalAvg = await fetchMonthlyAverageSpotPrice(
            invoice.invoiceYear as number,
            invoice.invoiceMonth as number,
            invoice.seZone as "SE1" | "SE2" | "SE3" | "SE4"
          );
          if (historicalAvg !== null) {
            invoice.historicalSpotPriceOre = historicalAvg;
            console.log(
              `[PARSE-INVOICE] Historical spot for ${invoice.seZone} ${invoice.invoiceYear}-${String((invoice.invoiceMonth as number) + 1).padStart(2, "0")}: ${historicalAvg} öre/kWh exkl moms`
            );
          } else {
            console.warn(`[PARSE-INVOICE] Historical spot returned null`);
          }
        } catch (err) {
          console.warn("[PARSE-INVOICE] Failed to fetch historical spot price:", err);
        }
      }

      // Geocode address to lat/lon (for PVGIS TMY data)
      if (invoice.address && typeof invoice.address === "string") {
        try {
          const coords = await geocodeAddress(invoice.address);
          if (coords) {
            invoice.latitude = coords.lat;
            invoice.longitude = coords.lon;
            console.log(`[PARSE-INVOICE] Geocoded "${invoice.address}" → ${coords.lat}, ${coords.lon}`);
          } else {
            console.warn(`[PARSE-INVOICE] Geocoding returned null for "${invoice.address}"`);
          }
        } catch (err) {
          console.warn("[PARSE-INVOICE] Failed to geocode address:", err);
        }
      }
    } // end for-loop over invoices

    // Return: single object if one invoice, array if multiple
    if (invoices.length === 1) {
      return NextResponse.json(invoices[0]);
    }
    return NextResponse.json(invoices);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PARSE-INVOICE] Fatal error:", message);
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500 }
    );
  }
}