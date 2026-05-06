// File: lib/save-analysis/call-rpc.ts

/**
 * Call the appropriate RPC function based on the user's home selection.
 *
 * Four flow branches:
 * 1. FIRST_TIME: User has no homes, no selection. → create_initial_home_from_invoice
 * 2. EXISTING_ONLY: User selected existing home(s) only. → add_invoice_to_existing_homes
 * 3. NEW_AND_EXISTING: User selected existing home(s) + create new home. 
 *    → create_empty_home, then add_invoice_to_existing_homes with all home_ids
 * 4. NEW_ONLY: User wants to create new home only (no existing selected).
 *    → create_empty_home, then add_invoice_to_existing_homes with just the new home_id
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SaveAnalysisPayload,
  CreateInitialHomeResult,
  AddInvoiceResult,
} from "@/lib/types/database";
import type { UploadResult } from "./upload-pdfs";

export type RpcResult =
  | { kind: "initial"; data: CreateInitialHomeResult }
  | { kind: "added"; data: AddInvoiceResult; primary_home_id: string };

export class RpcError extends Error {
  constructor(message: string, public original?: unknown) {
    super(message);
    this.name = "RpcError";
  }
}

/**
 * Determine the flow branch and call the right RPC sequence.
 *
 * Mutates payload.documents[].pdf_storage_path to reference uploaded PDFs.
 */
export async function callRpc(
  supabase: SupabaseClient,
  payload: SaveAnalysisPayload,
  uploads: UploadResult[],
): Promise<RpcResult> {
  // Inject pdf_storage_path into each document based on uploaded paths
  const docsWithPaths = payload.documents.map((doc) => {
    const upload = uploads.find((u) => u.document_id === doc.id);
    if (!upload) {
      throw new RpcError(
        `Internt fel: hittade inte uppladdad PDF för dokument ${doc.id}`,
      );
    }
    return { ...doc, pdf_storage_path: upload.storage_path };
  });

  const { selected_home_ids, create_new_home, new_home_name } = payload.home_selection;
  const hasExisting = selected_home_ids.length > 0;
  const hasNew = create_new_home;

  // ---------------------------------------------------------------------------
  // Branch 1: FIRST_TIME — no selection of any kind
  // (Klient skickar varken selected_home_ids eller create_new_home när 
  //  användaren inte har några hem.)
  // ---------------------------------------------------------------------------
  if (!hasExisting && !hasNew) {
    return await callCreateInitial(supabase, payload, docsWithPaths);
  }

  // ---------------------------------------------------------------------------
  // Branches 2-4: at least one of (existing, new) is set
  // ---------------------------------------------------------------------------
  const allTargetHomes: string[] = [...selected_home_ids];

  // If user wants to create new home, do that first
  if (hasNew) {
    if (!new_home_name) {
      throw new RpcError("Hem-namn krävs för att skapa nytt hem");
    }
    const newHomeId = await callCreateEmptyHome(supabase, new_home_name);
    allTargetHomes.push(newHomeId);
  }

  // Now call add_invoice_to_existing_homes with the combined list
  return await callAddInvoice(supabase, payload, docsWithPaths, allTargetHomes);
}

// ---------------------------------------------------------------------------
// Branch 1 implementation
// ---------------------------------------------------------------------------
async function callCreateInitial(
  supabase: SupabaseClient,
  payload: SaveAnalysisPayload,
  docsWithPaths: SaveAnalysisPayload["documents"],
): Promise<RpcResult> {
  // Generate UUIDs for home and home_property
  const homeId = crypto.randomUUID();
  const homePropertyId = crypto.randomUUID();

  // Build default home name "Hem på [street]" if not provided
  const homeName = payload.home_selection.new_home_name
    ?? `Hem på ${payload.address.street}`;

  const documentIds = docsWithPaths.map((d) => d.id);

  const { data, error } = await supabase.rpc("create_initial_home_from_invoice", {
    p_home_id: homeId,
    p_home_property_id: homePropertyId,
    p_document_ids: documentIds,
    p_home: { name: homeName },
    p_address: payload.address,
    p_property: payload.property,
    p_documents: docsWithPaths.map(stripBase64),
    p_analyses: payload.analyses,
    p_home_profile: payload.home_profile,
  });

  if (error) {
    throw new RpcError(
      `Kunde inte spara fakturan: ${error.message}`,
      error,
    );
  }

  return {
    kind: "initial",
    data: data as CreateInitialHomeResult,
  };
}

// ---------------------------------------------------------------------------
// Branches 2-4 implementation
// ---------------------------------------------------------------------------
async function callAddInvoice(
  supabase: SupabaseClient,
  payload: SaveAnalysisPayload,
  docsWithPaths: SaveAnalysisPayload["documents"],
  targetHomes: string[],
): Promise<RpcResult> {
  const documentIds = docsWithPaths.map((d) => d.id);

  const { data, error } = await supabase.rpc("add_invoice_to_existing_homes", {
    p_target_homes: targetHomes,
    p_anlaggnings_id: payload.property.anlaggnings_id,
    p_address: payload.address,
    p_property: payload.property,
    p_document_ids: documentIds,
    p_documents: docsWithPaths.map(stripBase64),
    p_analyses: payload.analyses,
    p_home_profile: payload.home_profile,
  });

  if (error) {
    throw new RpcError(
      `Kunde inte spara fakturan: ${error.message}`,
      error,
    );
  }

  // Pick a primary home_id to redirect to (first in the list)
  return {
    kind: "added",
    data: data as AddInvoiceResult,
    primary_home_id: targetHomes[0],
  };
}

// ---------------------------------------------------------------------------
// Branch helper: create_empty_home for "Skapa nytt hem"-flow
// ---------------------------------------------------------------------------
async function callCreateEmptyHome(
  supabase: SupabaseClient,
  name: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_empty_home", {
    p_name: name,
  });

  if (error) {
    throw new RpcError(
      `Kunde inte skapa nytt hem: ${error.message}`,
      error,
    );
  }

  return data as string;
}

// ---------------------------------------------------------------------------
// Helper: strip base64 from documents before sending to RPC
// (RPC doesn't need the PDF bytes — it only needs metadata + pdf_storage_path)
// ---------------------------------------------------------------------------
function stripBase64(doc: SaveAnalysisPayload["documents"][0]): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pdf_base64, ...rest } = doc;
  return rest;
}
