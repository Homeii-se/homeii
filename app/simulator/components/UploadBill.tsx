"use client";

import { useState, useCallback, useRef } from "react";
import type { BillData } from "../types";
import { STRINGS } from "../data/strings";
import ProcessingAnimation from "./ProcessingAnimation";
import { parsedInvoiceToBillData, mergeBillData, validateExtraction } from "../inference/bill-parser";
import type { ParsedInvoice, ValidationResult } from "../inference/bill-parser";

interface UploadBillProps {
  onComplete: (data: BillData) => void;
  initialData?: BillData;
}

type Phase = "upload" | "processing" | "result" | "confirm" | "validation-failed";

const EMPTY_BILL: BillData = { kwhPerMonth: 0, costPerMonth: 0 };

// Reads a File object as a base64 string (without the "data:..." prefix).
// Used to persist uploaded PDFs in homeii-state so they survive navigation
// to /app/spara-analys and can be uploaded to Supabase Storage on save.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader did not return a string'));
        return;
      }
      // result is "data:application/pdf;base64,XXXXX" — we want only XXXXX
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

// Error message shown when the user uploads invoices for different metering points.
const ERR_MULTIPLE_METERING_POINTS =
  'Fakturorna kommer från olika fastigheter (olika anläggnings-ID). Vi kan bara analysera ett hem åt gången — ta bort fakturorna som hör till andra fastigheter och försök igen.';
// Maximum time to wait for /api/parse-invoice before aborting. Anthropic
// usually responds in 10–30 s; 45 s gives healthy headroom while still
// rescuing the user from an indefinite hang if the upstream is unhealthy.
const PARSE_TIMEOUT_MS = 45_000;

export default function UploadBill({ onComplete, initialData }: UploadBillProps) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [billData, setBillData] = useState<BillData>(initialData ?? EMPTY_BILL);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  // Signals to ProcessingAnimation that the API call has finished (success
  // or recoverable failure). Keeps the animation's last-step spinner active
  // while the request is still in flight so the user does not see a "done"
  // state before the work is really done.
  const [apiCompleted, setApiCompleted] = useState(false);

  // Staged files — user can add multiple before submitting
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry fields (for skip/fallback)
  const [manualKwh, setManualKwh] = useState(initialData?.kwhPerMonth ?? 1500);
  const [manualCost, setManualCost] = useState(initialData?.costPerMonth ?? 2500);
  const [manualNatAgare, setManualNatAgare] = useState(initialData?.natAgare ?? "");
  const [manualAnnualKwh, setManualAnnualKwh] = useState<number | "">(initialData?.annualKwh ?? "");

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

  const handleSubmitFiles = useCallback(async () => {
    if (stagedFiles.length === 0) return;

    setFileNames(stagedFiles.map((f) => f.name));
    setError(null);
    setApiCompleted(false);
    setPhase("processing");

    // Abort the request if it takes longer than PARSE_TIMEOUT_MS. Without
    // this the user can sit on the processing screen indefinitely if the
    // upstream Anthropic call hangs.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);

    try {
      const formData = new FormData();
      for (const file of stagedFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/parse-invoice", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? "Kunde inte tolka fakturan");
      }

      const parsed = await response.json();
      console.log('[UPLOAD] API response:', JSON.stringify(parsed, null, 2));

      // Handle both single invoice and array of invoices
      const invoices: ParsedInvoice[] = Array.isArray(parsed) ? parsed : [parsed];
      console.log(`[UPLOAD] Processing ${invoices.length} invoice(s)`);

      // Validate each invoice BEFORE converting to BillData
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

      // Store warnings (if any) for display on result page
      if (allIssues.length > 0) {
        setValidationResult({ ok: true, issues: allIssues });
      } else {
        setValidationResult(null);
      }

      // Block if invoices come from different metering points (different anlaggnings_id).
      // We can only save one home at a time — schema has anlaggnings_id as primary key
      // on consumption_metering_points, so two different IDs can't coexist in one save.
      const uniqueMeteringPoints = new Set(
        invoices
          .map((i) => i.anlaggningsId)
          .filter((id): id is string => Boolean(id)),
      );
      if (uniqueMeteringPoints.size > 1) {
        setError(ERR_MULTIPLE_METERING_POINTS);
        setPhase("upload");
        return;
      }

      // Merge parserns output med eventuell tidigare bill-data (för fall där användaren
      // laddat upp flera fakturor i sekvens) och advance:a direkt till nästa steg —
      // användaren får bekräfta + komplettera på den kombinerade VerificationScreen.
      let mergedBill = billData;
      for (const invoice of invoices) {
        const extracted = parsedInvoiceToBillData(invoice);
        console.log('[UPLOAD] Extracted BillData:', JSON.stringify(extracted));
        mergedBill = mergeBillData(mergedBill, extracted);
      }
      console.log('[UPLOAD] After merge:', JSON.stringify({
        kwhPerMonth: mergedBill.kwhPerMonth,
        annualKwh: mergedBill.annualKwh,
        costPerMonth: mergedBill.costPerMonth,
        seZone: mergedBill.seZone,
        natAgare: mergedBill.natAgare,
        spotPriceRatio: mergedBill.spotPriceRatio,
      }));

    // Read all uploaded PDFs as base64 and attach to billData. Bilder hoppas över
    // — bara PDF:er kan sparas som dokument i v1 (Supabase Storage-bucket är
    // konfigurerad för PDF). Stöd för bilder kan läggas till senare om behov uppstår.
    const pdfFiles = stagedFiles.filter((f) => f.type === "application/pdf");
    if (pdfFiles.length > 0) {
      try {
        const documents = await Promise.all(
          pdfFiles.map(async (file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            base64: await fileToBase64(file),
          })),
        );
        mergedBill = { ...mergedBill, uploadedDocuments: documents };
        console.log(`[UPLOAD] Encoded ${documents.length} PDF(s) as base64 for storage`);
      } catch (err) {
        // base64-konvertering felade — logga men blockera inte. Användaren kan
        // fortfarande se sin analys, men kan inte spara den till databas senare.
        console.error('[UPLOAD] Failed to encode PDF(s) as base64:', err);
      }
    }

    setBillData(mergedBill);
    setStagedFiles([]);
      setApiCompleted(true);

      // Hoppa direkt till onComplete — VerificationScreen visar nu parsed data + hus-frågor i en vy
      if (mergedBill.kwhPerMonth > 0 && mergedBill.costPerMonth > 0) {
        onComplete(mergedBill);
      } else {
        // Saknas grunddata — visa fortfarande result-fasen så användaren kan komplettera
        setPhase("result");
      }
    } catch (err: unknown) {
      console.error("Invoice parse error:", err);
      // AbortError = our 45 s timeout fired — give the user a clear,
      // actionable message instead of the generic parse error.
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      setError(
        isTimeout
          ? STRINGS.processingTimeoutError
          : err instanceof Error
          ? err.message
          : STRINGS.processingGenericError
      );
      setPhase("upload");
    } finally {
      clearTimeout(timeoutId);
    }
  }, [stagedFiles, billData, onComplete]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
      // Reset input so the same file(s) can be selected again
      e.target.value = "";
    },
    [addFiles]
  );

  const handleSkip = useCallback(() => {
    setPhase("confirm");
  }, []);

  const handleProceed = useCallback(() => {
    if (billData.kwhPerMonth > 0 && billData.costPerMonth > 0) {
      onComplete(billData);
    }
  }, [billData, onComplete]);

  const handleAddMore = useCallback(() => {
    setPhase("upload");
    setFileNames([]);
    setStagedFiles([]);
  }, []);

  // Processing phase
  if (phase === "processing") {
    return (
      <ProcessingAnimation
        onComplete={() => {}}
        apiCompleted={apiCompleted}
      />
    );
  }

  // Validation failed phase — extraction was unreliable
  if (phase === "validation-failed") {
    const errors = validationResult?.issues.filter((i) => i.severity === "error") ?? [];

    return (
      <div className="mx-auto max-w-md px-4 animate-fade-in">
        <h2 className="mb-2 text-2xl font-bold text-text-primary">
          Kunde inte avläsa fakturan
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          Vi kunde inte läsa av tillförlitlig data från {fileNames.length > 1 ? "filerna" : "filen"}.
          Det kan bero på bildkvalitet eller att fakturans format inte stöds fullt ut.
        </p>

        {/* Show specific issues */}
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2">
          {errors.map((issue, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm text-amber-700">
              <span className="mt-0.5 flex-shrink-0">⚠</span>
              <span>{issue.message}</span>
            </div>
          ))}
        </div>

        <p className="mb-6 text-sm text-text-secondary">
          Prova att ladda upp en tydligare bild eller en PDF, eller ange uppgifterna manuellt.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setPhase("upload");
              setStagedFiles([]);
              setFileNames([]);
              setValidationResult(null);
              setError(null);
            }}
            className="w-full rounded-2xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl"
          >
            Ladda upp igen
          </button>
          <button
            onClick={() => {
              setValidationResult(null);
              setPhase("confirm");
            }}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-secondary hover:bg-gray-100 transition-colors"
          >
            Ange uppgifter manuellt
          </button>
        </div>
      </div>
    );
  }

  // Result phase — show what was extracted
  if (phase === "result") {
    const types = billData.uploadedInvoiceTypes ?? [];
    const hasElhandel = types.includes("elhandel");
    const hasElnat = types.includes("elnat");

    return (
      <div className="mx-auto max-w-md px-4 animate-fade-in">
        <h2 className="mb-2 text-2xl font-bold text-text-primary">
          Vi hittade följande
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          Från {fileNames.length > 1 ? `${fileNames.length} filer` : fileNames[0]}
        </p>

        {/* Validation warnings (if any) */}
        {validationResult && validationResult.issues.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-1.5">
            {validationResult.issues.map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="mt-0.5 flex-shrink-0">⚠</span>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Extraction summary */}
        <div className="card-strong rounded-2xl p-4 flex flex-col gap-3">
          {billData.invoicePeriodKwh && billData.invoiceMonth !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">
                Förbrukning ({["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"][billData.invoiceMonth]})
              </span>
              <span className="text-sm font-bold text-text-primary">{Math.round(billData.invoicePeriodKwh).toLocaleString("sv-SE")} kWh</span>
            </div>
          )}
          {billData.annualKwh && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Beräknad årsförbrukning</span>
              <span className="text-sm font-bold text-text-primary">{billData.annualKwh.toLocaleString("sv-SE")} kWh</span>
            </div>
          )}
          {billData.costPerMonth > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">
                Periodens kostnad {billData.invoiceMonth !== undefined ? `(${["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"][billData.invoiceMonth]})` : ""}
              </span>
              <span className="text-sm font-bold text-text-primary">{billData.costPerMonth.toLocaleString("sv-SE")} kr</span>
            </div>
          )}
          {billData.seZone && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Elområde</span>
              <span className="text-sm font-bold text-text-primary">{billData.seZone}</span>
            </div>
          )}
          {billData.natAgare && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Nätbolag</span>
              <span className="text-sm font-bold text-text-primary">{billData.natAgare}</span>
            </div>
          )}
          {billData.elhandlare && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Elhandlare</span>
              <span className="text-sm font-bold text-text-primary">{billData.elhandlare}</span>
            </div>
          )}
          {billData.elContractType && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Avtalstyp</span>
              <span className="text-sm font-bold text-text-primary">
                {billData.elContractType === "dynamic" ? "Dynamiskt pris" : billData.elContractType === "monthly" ? "Månadsmedel" : "Fast"}
              </span>
            </div>
          )}
          {billData.invoiceSpotPriceOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Spotpris (snitt)</span>
              <span className="text-sm font-bold text-text-primary">{billData.invoiceSpotPriceOre.toFixed(1)} öre/kWh</span>
            </div>
          )}
          {billData.invoiceMarkupOre !== undefined && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Påslag</span>
              <span className="text-sm font-bold text-text-primary">{billData.invoiceMarkupOre.toFixed(1)} öre/kWh</span>
            </div>
          )}
          {billData.hasProductionRevenue && (
            <div className="flex justify-between">
              <span className="text-sm text-text-secondary">Solproduktion</span>
              <span className="text-sm font-bold text-energy-green">Ja</span>
            </div>
          )}
        </div>

        {/* Invoice type indicators */}
        <div className="mt-4 flex gap-3">
          <div className={`flex-1 rounded-xl border-2 px-3 py-2 text-center text-sm ${
            hasElhandel ? "border-green-500/50 bg-green-50 text-green-700" : "border-border text-text-muted"
          }`}>
            {hasElhandel ? "✓ " : ""}Elhandel
          </div>
          <div className={`flex-1 rounded-xl border-2 px-3 py-2 text-center text-sm ${
            hasElnat ? "border-green-500/50 bg-green-50 text-green-700" : "border-border text-text-muted"
          }`}>
            {hasElnat ? "✓ " : ""}Elnät
          </div>
        </div>

        {/* Add more or proceed */}
        {(!hasElhandel || !hasElnat) && (
          <button
            onClick={handleAddMore}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-brand-500/50 px-4 py-3 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors"
          >
            + Lägg till {!hasElnat ? "elnätsfaktura" : "elhandelsfaktura"}
          </button>
        )}

        <button
          onClick={handleProceed}
          disabled={billData.kwhPerMonth <= 0}
          className="mt-4 w-full rounded-2xl bg-cta-orange px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STRINGS.next}
        </button>
      </div>
    );
  }

  // Manual confirm phase (skip upload)
  if (phase === "confirm") {
    return (
      <div className="mx-auto max-w-md px-4 animate-fade-in">
        <h2 className="mb-2 text-2xl font-bold text-text-primary">
          Ange dina uppgifter
        </h2>
        <p className="mb-6 text-text-secondary">Fyll i uppgifter från din senaste elräkning.</p>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Förbrukning per månad</span>
            <div className="relative">
              <input
                type="number"
                value={manualKwh}
                onChange={(e) => setManualKwh(Number(e.target.value))}
                min={0}
                className="w-full card rounded-lg px-4 py-3 pr-16 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">kWh</span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Total elkostnad per månad</span>
            <span className="text-[11px] text-text-muted -mt-0.5">Helst totalbeloppet inkl. nätavgift, energiskatt och moms</span>
            <div className="relative">
              <input
                type="number"
                value={manualCost}
                onChange={(e) => setManualCost(Number(e.target.value))}
                min={0}
                className="w-full card rounded-lg px-4 py-3 pr-16 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">kr</span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              Ditt nätbolag <span className="text-text-muted font-normal">(valfritt)</span>
            </span>
            <input
              type="text"
              value={manualNatAgare}
              onChange={(e) => setManualNatAgare(e.target.value)}
              placeholder="T.ex. Ellevio, Vattenfall, E.ON..."
              className="w-full card rounded-lg px-4 py-3 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-text-muted/50"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              Årsförbrukning <span className="text-text-muted font-normal">(om den syns på fakturan)</span>
            </span>
            <div className="relative">
              <input
                type="number"
                value={manualAnnualKwh}
                onChange={(e) => setManualAnnualKwh(e.target.value === "" ? "" : Number(e.target.value))}
                min={0}
                placeholder="T.ex. 18000"
                className="w-full card rounded-lg px-4 py-3 pr-16 text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 placeholder:text-text-muted/50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">kWh/år</span>
            </div>
          </label>
        </div>

        <button
          onClick={() => onComplete({
            kwhPerMonth: manualKwh,
            costPerMonth: manualCost,
            ...(manualNatAgare.trim() ? { natAgare: manualNatAgare.trim() } : {}),
            ...(manualAnnualKwh !== "" && manualAnnualKwh > 0 ? { annualKwh: manualAnnualKwh } : {}),
          })}
          disabled={manualKwh <= 0 || manualCost <= 0}
          className="mt-6 w-full rounded-2xl bg-cta-orange px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STRINGS.next}
        </button>
      </div>
    );
  }

  // Upload phase — with staging area for multiple files
  return (
    <div className="mx-auto max-w-md px-4 animate-fade-in">
      <h2 className="mb-2 text-2xl font-bold text-text-primary">
        {STRINGS.uploadTitle}
      </h2>
      <p className="mb-6 text-text-secondary">{STRINGS.uploadSubtitle}</p>
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
        För bästa resultat: ladda upp elhandelsfakturan som PDF, inte som skärmdump.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`card flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
          dragOver ? "border-brand-500 !bg-brand-50" : "border-border hover:border-brand-500"
        }`}
      >
        <svg
          className={`h-10 w-10 transition-colors ${dragOver ? "text-brand-500" : "text-text-muted"}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M12 16V4m0 0L8 8m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium text-text-primary">
          {stagedFiles.length === 0 ? STRINGS.uploadDrop : "Lägg till fler filer"}
        </span>
        <span className="text-xs text-text-muted">
          PDF eller bilder (JPG, PNG) — du kan välja flera
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      </label>

      {/* Staged files list */}
      {stagedFiles.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {stagedFiles.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="card rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0">
                  {file.type === "application/pdf" ? "📄" : "🖼️"}
                </span>
                <span className="text-sm text-text-primary truncate">{file.name}</span>
                <span className="text-xs text-text-muted flex-shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="text-text-muted hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                title="Ta bort"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}

          {/* Submit button */}
          <button
            onClick={handleSubmitFiles}
            className="mt-2 w-full rounded-2xl bg-brand-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl"
          >
            Analysera {stagedFiles.length === 1 ? "faktura" : `${stagedFiles.length} filer`}
          </button>
        </div>
      )}

      <div className="mt-4 text-center">
        <button onClick={handleSkip} className="text-sm text-brand-600 hover:text-brand-500 underline underline-offset-2">
          Eller ange uppgifter manuellt
        </button>
      </div>
    </div>
  );
}
