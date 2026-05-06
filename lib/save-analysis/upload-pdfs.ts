// File: lib/save-analysis/upload-pdfs.ts

/**
 * Upload PDF documents from SaveAnalysisPayload to Supabase Storage.
 *
 * Storage path convention: documents/{document_id}.pdf
 *
 * Returns a list of uploaded paths so they can be rolled back if RPC fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SaveAnalysisPayload } from "@/lib/types/database";

export interface UploadResult {
  document_id: string;
  storage_path: string;
}

export class UploadError extends Error {
  constructor(public document_id: string, message: string) {
    super(message);
    this.name = "UploadError";
  }
}

const STORAGE_BUCKET = "documents";

/**
 * Upload all PDFs in payload.documents to Supabase Storage.
 *
 * On any upload failure, throws UploadError. Caller is responsible for rolling
 * back any successful uploads (use rollbackUploads with results from this fn).
 */
export async function uploadPdfs(
  supabase: SupabaseClient,
  payload: SaveAnalysisPayload,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (const doc of payload.documents) {
    const path = `${doc.id}.pdf`; // bucket prefix is implicit ('documents/')

    // Decode base64 to a Blob for upload
    const buffer = base64ToUint8Array(doc.pdf_base64);
    const blob = new Blob([buffer.buffer.slice(0) as ArrayBuffer], { type: "application/pdf" });

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType: "application/pdf",
        upsert: false, // fail if path already exists (UUID collision = bug)
      });

    if (error) {
      throw new UploadError(
        doc.id,
        `Kunde inte ladda upp PDF "${doc.pdf_filename}": ${error.message}`,
      );
    }

    results.push({
      document_id: doc.id,
      storage_path: `${STORAGE_BUCKET}/${path}`,
    });
  }

  return results;
}

/**
 * Roll back uploaded PDFs (delete from Storage). Use after RPC failure.
 *
 * Best-effort — if a delete fails, log but continue (don't throw, since we're
 * already in error path).
 */
export async function rollbackUploads(
  supabase: SupabaseClient,
  uploads: UploadResult[],
): Promise<void> {
  for (const upload of uploads) {
    // strip "documents/" prefix when calling Storage API
    const pathInBucket = upload.storage_path.replace(`${STORAGE_BUCKET}/`, "");
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([pathInBucket]);

    if (error) {
      console.error(
        `[ROLLBACK] Failed to delete ${upload.storage_path}: ${error.message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: base64 string → Uint8Array
// ---------------------------------------------------------------------------
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
