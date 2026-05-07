// File: app/app/hem/actions.ts
// NEW FILE.

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CreateHomeResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Server action for creating an empty home.
 *
 * Called from the "Skapa nytt hem"-modal on /app/hem.
 * Wraps the create_empty_home RPC and redirects to the new home on success.
 */
export async function createHome(
  _prevState: CreateHomeResult | null,
  formData: FormData,
): Promise<CreateHomeResult> {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Du måste vara inloggad." };
  }

  // Validate name
  const name = formData.get("name")?.toString().trim() ?? "";
  if (name.length === 0) {
    return { success: false, error: "Hem-namn krävs." };
  }
  if (name.length > 200) {
    return { success: false, error: "Hem-namn får vara max 200 tecken." };
  }

  // Call RPC
  const { data: newHomeId, error } = await supabase.rpc("create_empty_home", {
    p_name: name,
  });

  if (error || !newHomeId) {
    return {
      success: false,
      error: `Kunde inte skapa hemmet: ${error?.message ?? "okänt fel"}`,
    };
  }

  revalidatePath("/app/hem");
  redirect(`/app/hem/${newHomeId}`);
}
