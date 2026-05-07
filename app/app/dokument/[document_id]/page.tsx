// File: app/app/dokument/[document_id]/page.tsx
// NEW FILE.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ document_id: string }>;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const STORAGE_BUCKET = "documents";

/**
 * Server component for /app/dokument/{document_id}.
 *
 * Shows metadata + linked homes + embedded PDF for a saved document.
 *
 * RLS does access validation: if the user is not a member of any home that 
 * links to this document, the query returns null and we render notFound().
 */
export default async function DocumentDetailPage({ params }: PageProps) {
  const { document_id } = await params;

  const supabase = await createClient();

  // Auth check (defense-in-depth — proxy.ts already handles)
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect(`/logga-in?next=/app/dokument/${document_id}`);
  }

  // Fetch document + linked homes
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select(`
      id, document_type, electricity_supplier,
      invoice_period_start, invoice_period_end,
      consumption_kwh, total_kr, spot_price_ore_kwh,
      pdf_storage_path, deleted_at,
      home_property_documents(
        home_property_id,
        home_properties(
          home_id,
          homes(id, name, deleted_at)
        )
      )
    `)
    .eq("id", document_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (docError) {
    console.error("[DOC-DETAIL] Query failed:", docError);
  }

  if (!doc) {
    notFound();
  }

  // Extract linked homes (deduplicated, filter soft-deleted)
  const linkedHomesMap = new Map<string, { id: string; name: string }>();
  for (const link of doc.home_property_documents ?? []) {
    // The Supabase types here are a bit awkward — the join returns 
    // single rows but typed as arrays.
    const hp = link.home_properties as unknown as
      | { home_id: string; homes: { id: string; name: string; deleted_at: string | null } | null }
      | null;
    if (!hp?.homes) continue;
    if (hp.homes.deleted_at !== null) continue;
    if (!linkedHomesMap.has(hp.homes.id)) {
      linkedHomesMap.set(hp.homes.id, { id: hp.homes.id, name: hp.homes.name });
    }
  }
  const linkedHomes = Array.from(linkedHomesMap.values());

  // Generate signed URL for PDF (1 hour TTL)
  let signedPdfUrl: string | null = null;
  if (doc.pdf_storage_path) {
    // pdf_storage_path is the path within the bucket (e.g. "{document_id}.pdf")
    // — no transformation needed.
    const { data: signed, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.pdf_storage_path, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      console.error("[DOC-DETAIL] Failed to sign URL:", signError);
    } else {
      signedPdfUrl = signed?.signedUrl ?? null;
    }
  }

  // Format header values
  const periodLabel = doc.invoice_period_start
    ? new Date(doc.invoice_period_start).toLocaleDateString("sv-SE", {
        month: "long",
        year: "numeric",
      })
    : "Okänd period";
  const periodCapitalized =
    periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  const subtitleParts: string[] = [];
  if (doc.electricity_supplier) subtitleParts.push(doc.electricity_supplier);
  subtitleParts.push(doc.document_type === "invoice" ? "Faktura" : "Offert");

  // Pick a "back to" link — first linked home if any
  const backToHome = linkedHomes[0];

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Breadcrumb */}
      {backToHome ? (
        <Link
          href={`/app/hem/${backToHome.id}`}
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          ← {backToHome.name}
        </Link>
      ) : (
        <Link
          href="/app/hem"
          className="mb-4 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Mina hem
        </Link>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{periodCapitalized}</h1>
        <p className="mt-1 text-sm text-gray-600">{subtitleParts.join(" · ")}</p>
      </div>

      {/* Metadata block */}
      <MetadataBlock doc={doc} linkedHomes={linkedHomes} />

      {/* PDF section */}
      <PdfSection signedUrl={signedPdfUrl} />
    </div>
  );
}

interface MetadataBlockProps {
  doc: {
    consumption_kwh: number | null;
    total_kr: number | null;
    invoice_period_start: string | null;
    invoice_period_end: string | null;
    spot_price_ore_kwh: number | null;
  };
  linkedHomes: Array<{ id: string; name: string }>;
}

function MetadataBlock({ doc, linkedHomes }: MetadataBlockProps) {
  // Build list of metadata fields that have values (dynamic)
  const fields: Array<{ label: string; value: string }> = [];

  if (doc.consumption_kwh != null) {
    fields.push({
      label: "Förbrukning",
      value: `${Math.round(doc.consumption_kwh)} kWh`,
    });
  }

  if (doc.total_kr != null) {
    fields.push({
      label: "Total kostnad",
      value: `${Math.round(doc.total_kr).toLocaleString("sv-SE")} kr`,
    });
  }

  if (doc.invoice_period_start && doc.invoice_period_end) {
    fields.push({
      label: "Period",
      value: formatPeriod(doc.invoice_period_start, doc.invoice_period_end),
    });
  }

  if (doc.spot_price_ore_kwh != null) {
    fields.push({
      label: "Snitt-spotpris",
      value: `${doc.spot_price_ore_kwh.toFixed(1).replace(".", ",")} öre/kWh`,
    });
  }

  // If no metadata at all and no linked homes, hide the block
  if (fields.length === 0 && linkedHomes.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border bg-white p-5">
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-5">
          {fields.map((field) => (
            <div key={field.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {field.label}
              </p>
              <p className="mt-1 text-base font-medium">{field.value}</p>
            </div>
          ))}
        </div>
      )}

      {linkedHomes.length > 0 && (
        <div
          className={`${
            fields.length > 0 ? "mt-4 border-t pt-3" : ""
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {linkedHomes.length === 1 ? "Kopplad till" : "Kopplad till"}
          </p>
          <p className="mt-1 text-sm">
            {linkedHomes.map((h, idx) => (
              <span key={h.id}>
                {idx > 0 && ", "}
                <Link
                  href={`/app/hem/${h.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {h.name}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

function PdfSection({ signedUrl }: { signedUrl: string | null }) {
  if (!signedUrl) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-sm text-gray-600">PDF-filen kunde inte laddas.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Original
        </p>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          ↗ Öppna i nytt fönster
        </a>
      </div>

      <iframe
        src={signedUrl}
        className="h-[600px] w-full rounded-lg border bg-white"
        title="PDF-faktura"
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);

  // If same month/year: "1 mar – 31 mar 2026"
  // If different: "15 feb – 14 mar 2026"
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();

  const startStr_ = sameMonth
    ? start.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
    : start.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });

  const endStr_ = end.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${startStr_} – ${endStr_}`;
}
