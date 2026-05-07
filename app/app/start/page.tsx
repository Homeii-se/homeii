// File: app/app/start/page.tsx
// NEW FILE.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Stub dashboard for /app/start.
 *
 * For merge-readiness: minimal page that doesn't crash. Real dashboard 
 * design will come in a follow-up PR.
 *
 * Currently: greeting + quick links to /app/hem and /analys.
 */
export default async function StartPage() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/logga-in?next=/app/start");
  }

  // Fetch first name from user_profiles (best-effort — show "" if missing)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const firstName = profile?.first_name ?? "";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">
        Hej {firstName ? firstName : "och välkommen"}!
      </h1>
      <p className="mb-8 text-gray-600">
        Välkommen till din startsida. Mer kommer snart.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/app/hem"
          className="block rounded-lg border bg-white p-6 transition hover:border-blue-500"
        >
          <p className="text-base font-medium">Mina hem</p>
          <p className="mt-1 text-sm text-gray-600">
            Visa och hantera dina hem och fastigheter.
          </p>
        </Link>

        <Link
          href="/analys"
          className="block rounded-lg border bg-white p-6 transition hover:border-blue-500"
        >
          <p className="text-base font-medium">Skapa ny analys</p>
          <p className="mt-1 text-sm text-gray-600">
            Ladda upp en ny faktura för analys.
          </p>
        </Link>
      </div>
    </div>
  );
}
