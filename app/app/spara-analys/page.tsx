// File: app/app/spara-analys/page.tsx
// REPLACES the existing page.tsx at this path.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddressForm } from "./address-form";
import type { DbHome } from "@/lib/types/database";

/**
 * Server component for /app/spara-analys.
 *
 * Responsibilities:
 *   1. Verify user is authenticated (proxy.ts already does this, but defense-in-depth)
 *   2. Verify user has completed profile (profile guard from PR #7-8B)
 *   3. Fetch the user's existing homes (for the home picker)
 *   4. Render AddressForm with myHomes prop
 *
 * The form itself reads homeii-state from localStorage on the client side
 * (lazy useState initializer in AddressForm).
 */
export default async function SparaAnalysPage() {
  const supabase = await createClient();

  // -----------------------------------------------------------------
  // 1. Auth check
  // -----------------------------------------------------------------
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/logga-in?next=/app/spara-analys");
  }

  // -----------------------------------------------------------------
  // 2. Profile check (existing logic from PR #7-8B)
  // -----------------------------------------------------------------
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/app/skapa-profil?next=/app/spara-analys");
  }

  // -----------------------------------------------------------------
  // 3. Fetch user's active homes (for home picker)
  // -----------------------------------------------------------------
  // We use an inner join via home_members so we only get homes where 
  // user is an active member (left_at IS NULL).
  const { data: myHomesData, error: homesError } = await supabase
    .from("homes")
    .select(`
      id, name, description, created_by, created_at, updated_at, deleted_at,
      home_members!inner(role, left_at)
    `)
    .is("deleted_at", null)
    .eq("home_members.user_id", user.id)
    .is("home_members.left_at", null);

  if (homesError) {
    console.error("[SPARA-ANALYS] Failed to fetch homes:", homesError);
    // Continue with empty list — better to render with no homes than crash
  }

  // Normalize to plain DbHome[] (drop the home_members join data)
  const myHomes: DbHome[] = (myHomesData ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    created_by: h.created_by,
    created_at: h.created_at,
    updated_at: h.updated_at,
    deleted_at: h.deleted_at,
  }));

  // -----------------------------------------------------------------
  // 4. Render form
  // -----------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Spara din analys</h1>
      <p className="text-gray-600 mb-6">
        Bekräfta uppgifterna nedan så sparar vi din analys.
      </p>

      <AddressForm myHomes={myHomes} />
    </div>
  );
}
