// File: app/app/hem/page.tsx
// NEW FILE.

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { HemListClient } from "./hem-list-client";

/**
 * Server component for /app/hem.
 *
 * Lists user's active homes as cards.
 * Each card links to /app/hem/{home_id}.
 * "Skapa nytt hem"-button opens a modal client-side.
 */
export default async function HemListPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/logga-in?next=/app/hem");
  }

  // Fetch user's active homes with property and member counts
  const { data: homesData, error: homesError } = await supabase
    .from("homes")
    .select(`
      id, name, description, created_by, created_at, updated_at,
      home_members!inner(role, left_at, user_id),
      home_properties(id, deleted_at)
    `)
    .is("deleted_at", null)
    .eq("home_members.user_id", user.id)
    .is("home_members.left_at", null)
    .order("created_at", { ascending: false });

  if (homesError) {
    console.error("[HEM-LIST] Failed to fetch homes:", homesError);
  }

  // Normalize: extract counts and roles
  const homes = (homesData ?? []).map((h) => {
    // Count active properties (not soft-deleted)
    const activeProperties = (h.home_properties ?? []).filter(
      (p) => p.deleted_at === null,
    );

    // Find this user's role
    const myMembership = (h.home_members ?? []).find(
      (m) => m.user_id === user.id,
    );

    return {
      id: h.id,
      name: h.name,
      description: h.description,
      created_at: h.created_at,
      property_count: activeProperties.length,
      my_role: (myMembership?.role ?? "member") as
        | "owner"
        | "member"
        | "read_only",
    };
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <HemListClient homes={homes} />
    </div>
  );
}
