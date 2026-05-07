/**
 * V2 databas-typer — råa rad-typer som speglar tabellerna i supabase/schema.sql.
 *
 * Konvention:
 * - Snake_case-fältnamn matchar databaskolumner exakt
 * - Fält som kan vara null i databasen är typade som `T | null` (inte `T | undefined`)
 * - Datum-fält är ISO-strings (timestamptz från Postgres)
 * - jsonb-fält är typade som specifika strukturer där möjligt
 *
 * Dessa typer är vad supabase-klienten returnerar direkt från SELECT.
 * För användning i UI: konvertera till domain-typer via mappers.ts.
 *
 * Källa till sanning: supabase/schema.sql Del 2.
 */

// ---------------------------------------------------------------------------
// Enum-liknande typer
// ---------------------------------------------------------------------------

export type HomeRole = "owner" | "member" | "read_only";
export type PropertyType = "real" | "hypothetical";
export type DocumentType = "invoice" | "offer";
export type AnalysisType = "invoice_analysis" | "offer_analysis";
export type ConsumptionGranularity = "hour" | "day" | "month";
export type SEZone = "SE1" | "SE2" | "SE3" | "SE4";

// ---------------------------------------------------------------------------
// Tabell-rad-typer (1:1 mot supabase/schema.sql Del 2)
// ---------------------------------------------------------------------------

/** public.addresses */
export interface DbAddress {
  id: string;
  street: string;
  postal_code: string;
  city: string;
  kommun: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

/** public.homes */
export interface DbHome {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** public.home_members */
export interface DbHomeMember {
  home_id: string;
  user_id: string;
  role: HomeRole;
  joined_at: string;
  left_at: string | null;
}

/** public.home_invitations */
export interface DbHomeInvitation {
  id: string;
  home_id: string;
  invited_by: string;
  invited_email: string;
  role: Exclude<HomeRole, "owner">; // bara member/read_only kan inviteras
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/** public.home_properties */
export interface DbHomeProperty {
  id: string;
  home_id: string;
  property_type: PropertyType;
  // För 'real':
  anlaggnings_id: string | null;
  address_id: string | null;
  zone: SEZone | null;
  network_operator: string | null;
  country: string;
  // För 'hypothetical':
  hypothetical_name: string | null;
  // Metadata:
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** public.home_property_production */
export interface DbHomePropertyProduction {
  id: string;
  home_property_id: string;
  production_anlaggnings_id: string;
  installed_kw: number | null;
  installation_year: number | null;
  created_at: string;
  updated_at: string;
}

/** public.documents */
export interface DbDocument {
  id: string;
  document_type: DocumentType;
  uploaded_by: string | null; // nullable pga ON DELETE SET NULL
  pdf_storage_path: string | null;
  parsed_data: unknown; // jsonb — typas mot ParsedInvoice externt
  // Denormaliserade fält
  total_kr: number | null;
  consumption_kwh: number | null;
  spot_price_ore_kwh: number | null;
  electricity_supplier: string | null;
  invoice_period_start: string | null; // date som ISO-string
  invoice_period_end: string | null;
  // Metadata
  parser_confidence: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** public.home_property_documents */
export interface DbHomePropertyDocument {
  home_property_id: string;
  document_id: string;
  created_at: string;
}

/** public.analyses */
export interface DbAnalysis {
  id: string;
  document_id: string;
  analysis_type: AnalysisType;
  model_version: string;
  result: unknown; // jsonb
  raw_response: unknown | null;
  is_reference: boolean;
  created_at: string;
}

/** public.consumption_data */
export interface DbConsumptionData {
  id: string;
  home_property_id: string;
  granularity: ConsumptionGranularity;
  period_start: string;
  period_end: string;
  kwh: number;
  source: string | null;
  created_at: string;
}

/** public.home_profile */
export interface DbHomeProfile {
  home_property_id: string;
  living_area_m2: number | null;
  building_year: number | null;
  building_type: string | null;
  heating_type: string | null;
  num_residents: number | null;
  created_at: string;
  updated_at: string;
}

/** public.home_equipment */
export interface DbHomeEquipment {
  home_property_id: string;
  equipment_key: string;
  equipment_data: unknown; // jsonb — typas via EquipmentDataMap i home-equipment.ts
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Server action payload — vad klient skickar till server action
// ---------------------------------------------------------------------------

/**
 * SaveAnalysisPayload — vad server action på /app/spara-analys får som input.
 *
 * Server action:
 * 1. Tar emot adressfält (synligt formulär)
 * 2. Tar emot homeii_state_json (hidden input med BillData + state)
 * 3. Tar emot hem-val (selected_home_ids + create_new_home + new_home_name)
 *
 * Server action mappar sedan till denna interna typ för konsistens.
 *
 * Detta är INTE en databas-rad — det är payload som server action sammanställer
 * innan RPC-anrop.
 */
export interface SaveAnalysisPayload {
  // Bekräftade adressfält från synligt formulär
  address: {
    street: string;
    postal_code: string;
    city: string;
    kommun?: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };

  // Fastighetsdata
  property: {
    anlaggnings_id: string;
    zone?: SEZone;
    network_operator?: string;
    country: string;
  };

  // Hem-val (en av tre kombinationer)
  home_selection: {
    /** UUID:er för befintliga hem användaren vill spara fakturan i */
    selected_home_ids: string[];
    /** Om användaren även vill skapa ett nytt hem */
    create_new_home: boolean;
    /** Namn på nytt hem (krävs om create_new_home=true) */
    new_home_name?: string;
  };

  // Dokument-data (en eller flera fakturor)
  documents: SaveAnalysisDocument[];

  // Analyser (en per dokument typiskt sett)
  analyses: SaveAnalysisAnalysis[];

  // Hem-profil-data (för fastigheten — fylls från refinement + answeredQuestions)
  home_profile: {
    living_area_m2?: number;
    building_year?: number;
    building_type?: string;
    heating_type?: string;
    num_residents?: number;
  };
}

/** Ett dokument i SaveAnalysisPayload (innan PDF-upload till Storage) */
export interface SaveAnalysisDocument {
  /** Förgenererad UUID (från server action) */
  id: string;
  document_type: DocumentType;
  /** PDF som base64 — server action laddar upp till Storage före RPC */
  pdf_base64: string;
  pdf_filename: string;
  /** Anthropic-svaret som JSON */
  parsed_data: unknown;
  // Denormaliserade snabb-läs-fält
  total_kr?: number;
  consumption_kwh?: number;
  spot_price_ore_kwh?: number;
  electricity_supplier?: string;
  invoice_period_start?: string;
  invoice_period_end?: string;
  parser_confidence?: number;
}

/** En analys i SaveAnalysisPayload */
export interface SaveAnalysisAnalysis {
  /** UUID på det dokument denna analys hör till */
  document_id: string;
  analysis_type: AnalysisType;
  model_version: string;
  result: unknown;
  raw_response?: unknown;
}

// ---------------------------------------------------------------------------
// RPC return-typer
// ---------------------------------------------------------------------------

/** Returvärde från create_initial_home_from_invoice */
export interface CreateInitialHomeResult {
  home_id: string;
  home_property_id: string;
  document_ids: string[];
}

/** Returvärde från add_invoice_to_existing_homes */
export interface AddInvoiceResult {
  /** Map från home_id → home_property_id (vilken property:t fakturan kopplades till) */
  home_property_ids: Record<string, string>;
  document_ids: string[];
}
