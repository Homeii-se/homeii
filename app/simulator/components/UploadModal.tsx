"use client";

/**
 * UploadModal — popup/bottom-sheet för faktura-uppladdning.
 *
 * Öppnas från landningssidans CTA. Hanterar:
 *  - Drag-drop + klicka för att välja fil
 *  - Validation (filtyp, storlek)
 *  - Parsing via /api/parse-invoice
 *  - Vid lyckad parse → stänger modal + anropar onComplete (vilken navigerar till steg 2)
 *
 * Responsiv: bottom-sheet på mobil (slidar upp från botten), centrerad
 * modal på desktop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BillData } from "../types";
import {
  parsedInvoiceToBillData,
  mergeBillData,
  validateExtraction,
} from "../inference/bill-parser";
import type { ParsedInvoice, ValidationResult } from "../inference/bill-parser";
import ProcessingAnimation from "./ProcessingAnimation";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: BillData) => void;
}

type Phase = "upload" | "processing" | "validation-failed";

const EMPTY_BILL: BillData = { kwhPerMonth: 0, costPerMonth: 0 };

export default function UploadModal({ open, onClose, onComplete }: UploadModalProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset när modalen stängs så nästa öppning är ren
  useEffect(() => {
    if (!open) {
      setPhase("upload");
      setStagedFiles([]);
      setError(null);
      setValidationResult(null);
    }
  }, [open]);

  // Esc stänger modalen (om vi inte processar)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "processing") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  // Förhindra background-scroll medan modalen är öppen
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter(
      (f) => f.type === "application/pdf" || f.type.startsWith("image/")
    );
    if (accepted.length === 0) {
      setError("Filtypen stöds inte. Använd PDF eller bild (JPG, PNG).");
      return;
    }
    setError(null);
    setStagedFiles((prev) => [...prev, ...accepted]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (stagedFiles.length === 0) return;
    setError(null);
    setPhase("processing");

    try {
      const formData = new FormData();
      for (const file of stagedFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? "Kunde inte tolka fakturan");
      }

      const parsed = await response.json();
      const invoices: ParsedInvoice[] = Array.isArray(parsed) ? parsed : [parsed];

      const allIssues: ValidationResult["issues"] = [];
      for (const invoice of invoices) {
        const validation = validateExtraction(invoice);
        allIssues.push(...validation.issues);
      }
      const hasErrors = allIssues.some((i) => i.severity === "error");

      if (hasErrors) {
        setValidationResult({ ok: false, issues: allIssues });
        setPhase("validation-failed");
        return;
      }

      let mergedBill: BillData = EMPTY_BILL;
      for (const invoice of invoices) {
        const extracted = parsedInvoiceToBillData(invoice);
        mergedBill = mergeBillData(mergedBill, extracted);
      }

      if (mergedBill.kwhPerMonth > 0 && mergedBill.costPerMonth > 0) {
        // Klart — stäng modal och navigera till nästa steg
        onComplete(mergedBill);
      } else {
        setError("Vi kunde inte läsa de viktigaste fälten på din räkning. Försök igen eller ange manuellt.");
        setPhase("upload");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Något gick fel vid tolkning av fakturan";
      setError(msg);
      setPhase("upload");
    }
  }, [stagedFiles, onComplete]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(26,60,42,0.55)",
        backdropFilter: "blur(2px)",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "processing") onClose();
      }}
    >
      <div
        style={{
          background: "white",
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          borderRadius: "20px 20px 0 0",
          padding: "12px 22px 22px",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          boxSizing: "border-box",
          animation: "slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        className="sm:rounded-2xl sm:my-auto"
      >
        {/* Drag handle (decorative on desktop, functional touch on mobile) */}
        <div
          style={{
            width: 40,
            height: 4,
            background: "rgba(0,0,0,0.15)",
            borderRadius: 2,
            margin: "0 auto 14px",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="upload-modal-title" style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#1a3a26" }}>
              Ladda upp din elräkning
            </h2>
            <p style={{ fontSize: 13, color: "#4a6b54", margin: "4px 0 0", lineHeight: 1.5 }}>
              PDF eller bild. Vi tolkar automatiskt och visar din analys på 1–2 minuter.
            </p>
          </div>
          {phase !== "processing" && (
            <button
              onClick={onClose}
              aria-label="Stäng"
              style={{
                background: "transparent",
                border: "none",
                fontSize: 22,
                color: "#4a6b54",
                cursor: "pointer",
                padding: "0 4px",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ marginTop: 16, flex: 1 }}>
          {phase === "upload" && (
            <UploadPhase
              dragOver={dragOver}
              setDragOver={setDragOver}
              handleDrop={handleDrop}
              fileInputRef={fileInputRef}
              handleFileInput={handleFileInput}
              stagedFiles={stagedFiles}
              removeFile={removeFile}
              error={error}
              onSubmit={handleSubmit}
            />
          )}

          {phase === "processing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 0", gap: 14 }}>
              <ProcessingAnimation onComplete={() => { /* drivs av API-svar, inte av animationens onComplete */ }} />
              <p style={{ fontSize: 14, color: "#1a3a26", margin: 0 }}>Tolkar din räkning...</p>
              <p style={{ fontSize: 12, color: "#4a6b54", margin: 0 }}>Detta tar oftast 10-30 sekunder</p>
            </div>
          )}

          {phase === "validation-failed" && (
            <div>
              <div
                style={{
                  background: "#fef3c7",
                  border: "1px solid #fcd34d",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: "0 0 6px" }}>
                  Vi kunde inte läsa allt vi behöver
                </p>
                {validationResult?.issues.map((issue, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#92400e", margin: "2px 0", lineHeight: 1.4 }}>
                    • {issue.message}
                  </p>
                ))}
              </div>
              <button
                onClick={() => {
                  setPhase("upload");
                  setStagedFiles([]);
                  setValidationResult(null);
                }}
                style={{
                  width: "100%",
                  background: "#e97a2c",
                  color: "white",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Försök med en annan fil
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (min-width: 640px) {
          [role="dialog"] > div { border-radius: 16px !important; max-height: 85vh !important; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// Upload phase — drag-drop area
// ============================================================

interface UploadPhaseProps {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  stagedFiles: File[];
  removeFile: (i: number) => void;
  error: string | null;
  onSubmit: () => void;
}

function UploadPhase({
  dragOver,
  setDragOver,
  handleDrop,
  fileInputRef,
  handleFileInput,
  stagedFiles,
  removeFile,
  error,
  onSubmit,
}: UploadPhaseProps) {
  return (
    <>
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "#2e7d52" : "rgba(46,125,82,0.45)"}`,
          background: dragOver ? "rgba(46,125,82,0.06)" : "white",
          borderRadius: 14,
          padding: "28px 16px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2e7d52"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ margin: "0 auto 12px", display: "block" }}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#1a3a26", margin: 0 }}>
          Dra din elräkning hit
        </p>
        <p style={{ fontSize: 13, color: "#4a6b54", margin: "4px 0 12px" }}>
          eller <span style={{ color: "#2e7d52", textDecoration: "underline", fontWeight: 500 }}>klicka för att välja fil</span>
        </p>
        <p style={{ fontSize: 11, color: "#7a8b80", margin: 0 }}>
          PDF, JPG eller PNG · max 10 MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
      </div>

      {/* Staged files list */}
      {stagedFiles.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {stagedFiles.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "rgba(46,125,82,0.06)",
                border: "0.5px solid rgba(46,125,82,0.2)",
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              <span style={{ color: "#1a3a26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                📄 {f.name}
              </span>
              <button
                onClick={() => removeFile(i)}
                aria-label="Ta bort fil"
                style={{ background: "transparent", border: "none", color: "#4a6b54", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            color: "#b91c1c",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {stagedFiles.length > 0 && (
        <button
          onClick={onSubmit}
          style={{
            marginTop: 16,
            width: "100%",
            background: "#e97a2c",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "14px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(232,130,74,0.25)",
          }}
        >
          Analysera {stagedFiles.length === 1 ? "fakturan" : `${stagedFiles.length} filer`} →
        </button>
      )}
    </>
  );
}
