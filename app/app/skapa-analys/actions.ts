// File: app/app/skapa-analys/actions.ts
// NEW FILE.

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseFormData, ParseError } from "@/lib/save-analysis/parse-form-data";
import { uploadPdfs, rollbackUploads, UploadError } from "@/lib/save-analysis/upload-pdfs";
import { callRpc, RpcError } from "@/lib/save-analysis/call-rpc";
import type { UploadResult } from "@/lib/save-analysis/upload-pdfs";

export type SkapaAnalysResult =
  | { success: true }
  | { success: false; error: string; field?: string };

/**
 * Server action for /app/skapa-analys (V2 logged-in flow).
 *
 * This is essentially the same as /app/spara-analys/actions.ts (saveAnalysis), 
 * because both flows save the same way — the difference is only in WHERE 
 * the user starts:
 *   - /app/spara-analys: anonymous user finishes their analysis, signs up, 
 *     lands here with billData in localStorage
 *   - /app/skapa-analys: logged-in user uploads + verifies + selects home 
 *     all on one page, no localStorage involved (state is in component)
 *
 * Both POST a homeii_state_json hidden input, so the server action looks 
 * identical to parseFormData.
 */
export async function saveSkapaAnalys(
  _prevState: SkapaAnalysResult | null,
  formData: FormData,
): Promise<SkapaAnalysResult> {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: "Du måste vara inloggad för att spara analysen.",
    };
  }

  // 2. Parse form data
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

  // 3. Upload PDFs to Storage
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

  // 4. Call RPC (with rollback on failure)
  let homeIdToRedirectTo: string;
  try {
    const result = await callRpc(supabase, payload, uploads);
    homeIdToRedirectTo = result.kind === "initial"
      ? result.data.home_id
      : result.primary_home_id;
  } catch (err) {
    await rollbackUploads(supabase, uploads);

    if (err instanceof RpcError) {
      return { success: false, error: err.message };
    }
    return {
      success: false,
      error: "Internt fel vid sparande. Vänligen försök igen.",
    };
  }

  // 5. Success — revalidate and redirect to the home detail page
  revalidatePath("/app/hem");
  redirect(`/app/hem/${homeIdToRedirectTo}`);
}
