// File: app/app/hem/[home_id]/page.tsx
// REPLACES the existing file at this path.

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ home_id: string }>;
}

/**
 * Server component for /app/hem/{home_id}.
 *
 * Server action on /app/spara-analys redirects here after saving.
 * Shows: home name, properties, saved invoices (clickable), action buttons.
 *
 * Empty state: if home has no properties yet, show CTA to create first analysis.
 */
export default async function HomeDetailPage({ params }: PageProps) {
  const { home_id } = await params;

  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect(`/logga-in?next=/app/hem/${home_id}`);
  }

  // Fetch home + properties + linked documents in one query.
  // RLS will return null/empty if the user is not a member of this home.
  const { data: home, error: homeError } = await supabase
    .from("homes")
    .select(`
      id, name, description, created_at, created_by,
      home_members(role, user_id, left_at),
      home_properties(
        id, anlaggnings_id, zone, network_operator, property_type, deleted_at,
        addresses(street, postal_code, city, kommun)
      )
    `)
    .eq("id", home_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (homeError) {
    console.error("[HEM-DETAIL] Query failed:", homeError);
  }

  if (!home) {
    notFound();
  }

  // Find user's role
  const myMembership = (home.home_members ?? []).find(
    (m) => m.user_id === user.id && m.left_at === null,
  );
  if (!myMembership) {
    notFound();
  }
  const myRole = myMembership.role as "owner" | "member" | "read_only";

  // Filter active properties and normalize addresses (Supabase returns FK joins as arrays)
  const properties = (home.home_properties ?? [])
    .filter((p) => p.deleted_at === null)
    .map((p) => ({
      ...p,
      addresses: Array.isArray(p.addresses) ? (p.addresses[0] ?? null) : p.addresses,
    }));

  // Fetch documents linked to this home's properties
  const propertyIds = properties.map((p) => p.id);
  const documents: Array<{
    id: string;
    invoice_period_start: string | null;
    invoice_period_end: string | null;
    consumption_kwh: number | null;
    total_kr: number | null;
    electricity_supplier: string | null;
    pdf_storage_path: string | null;
  }> = [];

  if (propertyIds.length > 0) {
    const { data: linkedDocs, error: docsError } = await supabase
      .from("home_property_documents")
      .select(`
        document_id,
        documents!inner(
          id, invoice_period_start, invoice_period_end,
          consumption_kwh, total_kr, electricity_supplier,
          pdf_storage_path, deleted_at
        )
      `)
      .in("home_property_id", propertyIds);

    if (docsError) {
      console.error("[HEM-DETAIL] Docs query failed:", docsError);
    } else {
      const seenIds = new Set<string>();
      for (const link of linkedDocs ?? []) {
        const doc = link.documents as unknown as {
          id: string;
          invoice_period_start: string | null;
          invoice_period_end: string | null;
          consumption_kwh: number | null;
          total_kr: number | null;
          electricity_supplier: string | null;
          pdf_storage_path: string | null;
          deleted_at: string | null;
        };
        if (doc.deleted_at !== null) continue;
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);
        documents.push({
          id: doc.id,
          invoice_period_start: doc.invoice_period_start,
          invoice_period_end: doc.invoice_period_end,
          consumption_kwh: doc.consumption_kwh,
          total_kr: doc.total_kr,
          electricity_supplier: doc.electricity_supplier,
          pdf_storage_path: doc.pdf_storage_path,
        });
      }
      // Sort by invoice period descending (most recent first)
      documents.sort((a, b) => {
        const aDate = a.invoice_period_start ?? "";
        const bDate = b.invoice_period_start ?? "";
        return bDate.localeCompare(aDate);
      });
    }
  }

  const created = new Date(home.created_at).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isEmpty = properties.length === 0;

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Breadcrumb */}
      <Link
        href="/app/hem"
        className="mb-4 inline-block text-sm text-blue-600 hover:underline"
      >
        ← Mina hem
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{home.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Skapat {created} · du är{" "}
          {myRole === "owner"
            ? "ägare"
            : myRole === "member"
            ? "medlem"
            : "läs-medlem"}
        </p>
      </div>

      {/* Empty state vs. content */}
      {isEmpty ? (
        <EmptyHomeState />
      ) : (
        <>
          <PropertiesSection properties={properties} />
          <DocumentsSection documents={documents} />
          <ActionsSection />
        </>
      )}
    </div>
  );
}

function EmptyHomeState() {
  return (
    <div className="rounded-lg border border-dashed bg-gray-50 p-12 text-center">
      <p className="mb-4 text-gray-600">
        Det här hemmet har inga fastigheter än. Lägg till första fakturan för
        att skapa en första analys.
      </p>
      <Link
        href="/analys"
        className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
      >
        Skapa ny analys
      </Link>
    </div>
  );
}

function PropertiesSection({
  properties,
}: {
  properties: Array<{
    id: string;
    anlaggnings_id: string | null;
    zone: string | null;
    network_operator: string | null;
    property_type: string;
    addresses: { street: string; postal_code: string; city: string; kommun: string | null } | null;
  }>;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        Fastigheter
      </h2>
      <div className="space-y-3">
        {properties.map((p) => (
          <div key={p.id} className="rounded-lg border bg-white p-4">
            {p.addresses && (
              <p className="text-sm font-medium">
                {p.addresses.street}, {p.addresses.postal_code}{" "}
                {p.addresses.city}
              </p>
            )}
            {p.anlaggnings_id && (
              <p className="mt-1 font-mono text-xs text-gray-600">
                {p.anlaggnings_id}
              </p>
            )}
            {(p.zone || p.network_operator) && (
              <p className="mt-1 text-xs text-gray-600">
                {[p.zone, p.network_operator].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentsSection({
  documents,
}: {
  documents: Array<{
    id: string;
    invoice_period_start: string | null;
    invoice_period_end: string | null;
    consumption_kwh: number | null;
    total_kr: number | null;
    electricity_supplier: string | null;
    pdf_storage_path: string | null;
  }>;
}) {
  if (documents.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
          Sparade fakturor
        </h2>
        <p className="text-sm text-gray-600">Inga sparade fakturor än.</p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        Sparade fakturor
      </h2>
      <div className="overflow-hidden rounded-lg border bg-white">
        {documents.map((doc, idx) => (
          <DocumentRow key={doc.id} doc={doc} isLast={idx === documents.length - 1} />
        ))}
      </div>
    </section>
  );
}

function DocumentRow({
  doc,
  isLast,
}: {
  doc: {
    id: string;
    invoice_period_start: string | null;
    invoice_period_end: string | null;
    consumption_kwh: number | null;
    total_kr: number | null;
    electricity_supplier: string | null;
    pdf_storage_path: string | null;
  };
  isLast: boolean;
}) {
  const periodLabel = doc.invoice_period_start
    ? new Date(doc.invoice_period_start).toLocaleDateString("sv-SE", {
        month: "long",
        year: "numeric",
      })
    : "Okänd period";

  const periodCapitalized =
    periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  return (
    <Link
      href={`/app/dokument/${doc.id}`}
      className={`flex items-center px-4 py-3 hover:bg-gray-50 ${
        !isLast ? "border-b" : ""
      }`}
    >
      <div className="flex-1">
        <p className="text-sm">
          {periodCapitalized}
          {doc.electricity_supplier ? ` · ${doc.electricity_supplier}` : ""}
        </p>
        <p className="mt-1 text-xs text-gray-600">
          {doc.consumption_kwh != null
            ? `${Math.round(doc.consumption_kwh)} kWh`
            : "—"}
          {doc.total_kr != null
            ? ` · ${Math.round(doc.total_kr).toLocaleString("sv-SE")} kr`
            : ""}
        </p>
      </div>
      <span className="ml-3 text-sm text-gray-400">→</span>
    </Link>
  );
}

function ActionsSection() {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
        Åtgärder
      </h2>
      <Link
        href="/analys"
        className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
      >
        + Skapa ny analys
      </Link>
    </section>
  );
}
