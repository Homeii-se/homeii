// File: app/app/skapa-analys/page.tsx
// NEW FILE.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SkapaAnalysClient } from "./skapa-analys-client";

interface PageProps {
  searchParams: Promise<{ home_id?: string }>;
}

/**
 * Server component for /app/skapa-analys (V2 logged-in flow).
 *
 * Differs from /app/spara-analys (which is the anonymous-then-login flow):
 * - User logs in FIRST, then comes here
 * - Upload + verify + select home all on this page
 * - Saves directly to database without ever going through /analys
 *
 * Optional ?home_id=... query param pre-selects a home.
 */
export default async function SkapaAnalysPage({ searchParams }: PageProps) {
  const { home_id: preselectedHomeId } = await searchParams;
  const supabase = await createClient();

  // Auth check (proxy.ts already handles, this is defense-in-depth)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/logga-in?next=/app/skapa-analys");
  }

  // Profile check
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/app/skapa-profil?next=/app/skapa-analys");
  }

  // Fetch user's active homes + their home_properties for smart match
  const { data: myHomesData, error: homesError } = await supabase
    .from("homes")
    .select(`
      id, name,
      home_members!inner(role, left_at),
      home_properties(anlaggnings_id, deleted_at)
    `)
    .is("deleted_at", null)
    .eq("home_members.user_id", user.id)
    .is("home_members.left_at", null);

  if (homesError) {
    console.error("[SKAPA-ANALYS] Failed to fetch homes:", homesError);
  }

  // Normalize to HomePicker shape
  const myHomes = (myHomesData ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    anlaggnings_ids: (h.home_properties ?? [])
      .filter((p) => p.deleted_at === null && p.anlaggnings_id !== null)
      .map((p) => p.anlaggnings_id as string),
  }));

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Skapa ny analys</h1>
      <p className="text-gray-600 mb-6">
        Ladda upp en faktura, bekräfta uppgifterna och välj vilka hem den
        ska tillhöra.
      </p>

      <SkapaAnalysClient
        myHomes={myHomes}
        preselectedHomeId={preselectedHomeId}
      />
    </div>
  );
}
