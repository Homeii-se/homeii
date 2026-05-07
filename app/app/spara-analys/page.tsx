// File: app/app/spara-analys/page.tsx
// REPLACES the existing page.tsx at this path.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddressForm } from "./address-form";

/**
 * Server component for /app/spara-analys.
 *
 * Responsibilities:
 *   1. Verify user is authenticated
 *   2. Verify user has completed profile
 *   3. Fetch the user's existing homes WITH their home_properties (for smart match)
 *   4. Render AddressForm with myHomes prop
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
  // 2. Profile check
  // -----------------------------------------------------------------
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/app/skapa-profil?next=/app/spara-analys");
  }

  // -----------------------------------------------------------------
  // 3. Fetch user's active homes + their home_properties for smart match
  // 
  // The home_properties join returns each home's properties so the client 
  // can pre-check homes whose property anlaggnings_id matches the invoice.
  // -----------------------------------------------------------------
  const { data: myHomesData, error: homesError } = await supabase
    .from("homes")
    .select(`
      id, name, description, created_by, created_at, updated_at, deleted_at,
      home_members!inner(role, left_at),
      home_properties(anlaggnings_id, deleted_at)
    `)
    .is("deleted_at", null)
    .eq("home_members.user_id", user.id)
    .is("home_members.left_at", null);

  if (homesError) {
    console.error("[SPARA-ANALYS] Failed to fetch homes:", homesError);
  }

  // Normalize to the shape AddressForm expects.
  // We extract anlaggnings_id values from each home's properties (filtering 
  // out soft-deleted properties). null values (hypothetical properties) are 
  // dropped — they cant participate in smart match.
  const myHomes: HomeWithAnlaggnings[] = (myHomesData ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    description: h.description,
    created_by: h.created_by,
    created_at: h.created_at,
    updated_at: h.updated_at,
    deleted_at: h.deleted_at,
    anlaggnings_ids: (h.home_properties ?? [])
      .filter((p) => p.deleted_at === null && p.anlaggnings_id !== null)
      .map((p) => p.anlaggnings_id as string),
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

/**
 * Shape passed to the client component.
 * Extends DbHome with the anlaggnings_ids from this home's home_properties 
 * so smart match can pre-check hems with matching anlaggnings_id.
 */
export interface HomeWithAnlaggnings {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** anlaggnings_id values for all real, non-deleted home_properties in this home */
  anlaggnings_ids: string[];
}
