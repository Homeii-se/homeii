// File: app/app/spara-analys/actions.ts
// REPLACES the existing actions.ts at this path.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseFormData, ParseError } from "@/lib/save-analysis/parse-form-data";
import { uploadPdfs, rollbackUploads, UploadError } from "@/lib/save-analysis/upload-pdfs";
import { callRpc, RpcError } from "@/lib/save-analysis/call-rpc";
import type { UploadResult } from "@/lib/save-analysis/upload-pdfs";

/**
 * Server action result returned to the client form.
 *
 * On success: { success: true } — server action has already redirected.
 * On error: { success: false, error: string, field?: string }
 *           — client renders the error inline. If field is set, can highlight 
 *           the corresponding form field.
 */
export type SaveAnalysisResult =
  | { success: true }
  | { success: false; error: string; field?: string };

/**
 * Save the analysis to the database.
 *
 * Flow:
 *   1. Verify user is authenticated
 *   2. Parse and validate form data
 *   3. Upload PDFs to Storage (in parallel could be added later)
 *   4. Call appropriate RPC based on home selection
 *   5. On success: redirect to /app/hem/{home_id}
 *   6. On RPC failure: roll back Storage uploads
 *
 * Note on "redirect inside try/catch": Next.js redirect() throws a special 
 * exception that should NOT be caught. We let it propagate by checking after 
 * the catch.
 */
export async function saveAnalysis(
  _prevState: SaveAnalysisResult | null,
  formData: FormData,
): Promise<SaveAnalysisResult> {
  // ---------------------------------------------------------------------------
  // 1. Verify user is authenticated
  // ---------------------------------------------------------------------------
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: "Du måste vara inloggad för att spara analysen.",
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Parse form data
  // ---------------------------------------------------------------------------
  let payload;
  try {
    payload = parseFormData(formData);
  } catch (err) {
    if (err instanceof ParseError) {
      return {
        success: false,
        error: err.message,
        field: err.field,
      };
    }
    return {
      success: false,
      error: "Internt fel vid behandling av formuläret. Försök igen.",
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Upload PDFs to Storage
  // ---------------------------------------------------------------------------
  let uploads: UploadResult[];
  try {
    uploads = await uploadPdfs(supabase, payload);
  } catch (err) {
    if (err instanceof UploadError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Kunde inte ladda upp PDF-filerna. Försök igen.",
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Call RPC (with rollback on failure)
  // ---------------------------------------------------------------------------
  let homeIdToRedirectTo: string;
  try {
    const result = await callRpc(supabase, payload, uploads);
    homeIdToRedirectTo = result.kind === "initial"
      ? result.data.home_id
      : result.primary_home_id;
  } catch (err) {
    // Roll back Storage uploads since RPC failed
    await rollbackUploads(supabase, uploads);

    if (err instanceof RpcError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Internt fel vid sparande. Vänligen försök igen.",
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Success — revalidate cache and redirect
  // ---------------------------------------------------------------------------
  revalidatePath("/app/hem");
  redirect(`/app/hem/${homeIdToRedirectTo}`);

  // Unreachable — redirect() throws — but TypeScript doesn't know that
  return { success: true };
}
