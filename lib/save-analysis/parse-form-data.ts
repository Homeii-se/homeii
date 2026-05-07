// File: lib/save-analysis/parse-form-data.ts

/**
 * Parse FormData from /app/spara-analys into a structured SaveAnalysisPayload.
 *
 * The form contains:
 * - Visible fields: street, postal_code, city, anlaggnings_id
 * - Hidden input "homeii_state_json": full SimulatorState as JSON string
 * - Home selection fields: selected_home_ids (multi), create_new_home (boolean),
 *   new_home_name (string)
 *
 * This function validates structure and types, then maps to SaveAnalysisPayload.
 * Throws ParseError with user-friendly messages on validation failure.
 */

import type { SaveAnalysisPayload, SaveAnalysisDocument, SaveAnalysisAnalysis } from "@/lib/types/database";
import type { BillData, SimulatorState } from "@/app/simulator/types";

export class ParseError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Convert FormData from spara-analys-form to a payload ready for server action use.
 * 
 * UUIDs for documents are pre-generated here so storage upload paths can be 
 * constructed before RPC call.
 */
export function parseFormData(formData: FormData): SaveAnalysisPayload {
  // ---------------------------------------------------------------------------
  // 1. Visible address fields
  // ---------------------------------------------------------------------------
  const street = formData.get("street")?.toString().trim() ?? "";
  const postalCode = formData.get("postal_code")?.toString().trim() ?? "";
  const city = formData.get("city")?.toString().trim() ?? "";
  const anlaggningsId = formData.get("anlaggnings_id")?.toString().trim() ?? "";

  if (!street) throw new ParseError("street", "Gata krävs");
  if (!postalCode) throw new ParseError("postal_code", "Postnummer krävs");
  if (!city) throw new ParseError("city", "Postort krävs");
  if (!/^\d{18}$/.test(anlaggningsId)) {
    throw new ParseError(
      "anlaggnings_id",
      "Anläggnings-ID måste vara exakt 18 siffror",
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Parse homeii_state_json (hidden input)
  // ---------------------------------------------------------------------------
  const stateJson = formData.get("homeii_state_json")?.toString();
  if (!stateJson) {
    throw new ParseError(
      "homeii_state_json",
      "Internt fel: analysdata saknas. Vänligen ladda upp fakturan igen.",
    );
  }

  let state: SimulatorState;
  try {
    state = JSON.parse(stateJson) as SimulatorState;
  } catch {
    throw new ParseError(
      "homeii_state_json",
      "Internt fel: analysdata är skadad. Vänligen ladda upp fakturan igen.",
    );
  }

  if (!state.billData) {
    throw new ParseError(
      "homeii_state_json",
      "Ingen fakturadata hittades. Vänligen ladda upp en faktura först.",
    );
  }

  const billData = state.billData;

  // ---------------------------------------------------------------------------
  // 3. Validate uploaded PDFs exist
  // ---------------------------------------------------------------------------
  const uploadedDocs = billData.uploadedDocuments ?? [];
  if (uploadedDocs.length === 0) {
    throw new ParseError(
      "homeii_state_json",
      "Inga PDF-filer hittades. Vänligen ladda upp fakturan igen.",
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Home selection
  // ---------------------------------------------------------------------------
  // selected_home_ids comes as multiple values with the same name
  const selectedHomeIds = formData
    .getAll("selected_home_ids")
    .map((v) => v.toString())
    .filter((v) => v.length > 0);

  const createNewHome = formData.get("create_new_home")?.toString() === "true";
  const newHomeName = formData.get("new_home_name")?.toString().trim();

  if (createNewHome && (!newHomeName || newHomeName.length === 0)) {
    throw new ParseError(
      "new_home_name",
      "Hem-namn krävs när du skapar ett nytt hem",
    );
  }

  if (newHomeName && newHomeName.length > 200) {
    throw new ParseError(
      "new_home_name",
      "Hem-namn får vara max 200 tecken",
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Build documents array with pre-generated UUIDs
  // ---------------------------------------------------------------------------
  const documents: SaveAnalysisDocument[] = uploadedDocs.map((doc) => ({
    id: crypto.randomUUID(),
    document_type: "invoice" as const,
    pdf_base64: doc.base64,
    pdf_filename: doc.name,
    parsed_data: extractParsedDataFromBillData(billData),
    total_kr: billData.costPerMonth,
    consumption_kwh: billData.kwhPerMonth,
    spot_price_ore_kwh: billData.invoiceSpotPriceOre,
    electricity_supplier: billData.elhandlare,
    invoice_period_start: buildInvoicePeriodStart(billData),
    invoice_period_end: buildInvoicePeriodEnd(billData),
    parser_confidence: billData.parserConfidence,
  }));

  // ---------------------------------------------------------------------------
  // 6. Build analyses array (one per document, mapped by index)
  // ---------------------------------------------------------------------------
  const analyses: SaveAnalysisAnalysis[] = documents.map((doc) => ({
    document_id: doc.id,
    analysis_type: "invoice_analysis" as const,
    model_version: "claude-sonnet-4-20250514", // TODO: read from API response when available
    result: state.recommendations ?? {},
    raw_response: undefined,
  }));

  // ---------------------------------------------------------------------------
  // 7. Build home_profile from refinement + answeredQuestions
  // ---------------------------------------------------------------------------
  const homeProfile = {
    living_area_m2: state.refinement?.area,
    building_year: undefined, // not collected in current refinement flow
    building_type: state.refinement?.housingType,
    heating_type: state.refinement?.heatingType,
    num_residents: state.refinement?.residents,
  };

  // ---------------------------------------------------------------------------
  // 8. Assemble payload
  // ---------------------------------------------------------------------------
  return {
    address: {
      street,
      postal_code: postalCode,
      city,
      kommun: undefined, // not collected in current form
      country: "SE",
      latitude: billData.latitude,
      longitude: billData.longitude,
    },
    property: {
      anlaggnings_id: anlaggningsId,
      zone: billData.seZone,
      network_operator: billData.natAgare,
      country: "SE",
    },
    home_selection: {
      selected_home_ids: selectedHomeIds,
      create_new_home: createNewHome,
      new_home_name: newHomeName || undefined,
    },
    documents,
    analyses,
    home_profile: homeProfile,
  };
}

// ---------------------------------------------------------------------------
// Helper: extract parsed data subset for storage in documents.parsed_data
// ---------------------------------------------------------------------------
function extractParsedDataFromBillData(billData: BillData): unknown {
  // Store the full billData minus the heavy uploadedDocuments field.
  // uploadedDocuments contains base64 PDFs which are stored separately in Storage,
  // not duplicated in the parsed_data jsonb.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { uploadedDocuments, ...rest } = billData;
  return rest;
}

// ---------------------------------------------------------------------------
// Helper: build invoice period dates from invoiceMonth + invoiceYear
// ---------------------------------------------------------------------------
function buildInvoicePeriodStart(billData: BillData): string | undefined {
  if (billData.invoiceMonth === undefined || billData.invoiceYear === undefined) {
    return undefined;
  }
  // invoiceMonth is 0-11 in BillData
  const month = String(billData.invoiceMonth + 1).padStart(2, "0");
  return `${billData.invoiceYear}-${month}-01`;
}

function buildInvoicePeriodEnd(billData: BillData): string | undefined {
  if (billData.invoiceMonth === undefined || billData.invoiceYear === undefined) {
    return undefined;
  }
  // Last day of the invoice month
  const year = billData.invoiceYear;
  const month = billData.invoiceMonth; // 0-11
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthStr = String(month + 1).padStart(2, "0");
  const dayStr = String(lastDay).padStart(2, "0");
  return `${year}-${monthStr}-${dayStr}`;
}
