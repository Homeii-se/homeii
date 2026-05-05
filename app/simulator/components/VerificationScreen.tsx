"use client";

import { useState, useEffect, useRef } from "react";
import type {
  RefinementAnswers,
  SEZone,
  HousingType,
  HeatingType,
  BigConsumer,
  BillData,
  ElContractType,
} from "../types";
import { STRINGS } from "../data/strings";
import { BIG_CONSUMER_PROFILES } from "../data/energy-profiles";
import { GRID_OPERATORS } from "../data/grid-operators";

const SE_ZONES: { value: SEZone; label: string; description: string }[] = [
  { value: "SE1", label: "SE1", description: "Norra Sverige (Luleå)" },
  { value: "SE2", label: "SE2", description: "Mellannorrland (Sundsvall)" },
  { value: "SE3", label: "SE3", description: "Mellansverige (Stockholm)" },
  { value: "SE4", label: "SE4", description: "Södra Sverige (Malmö)" },
];

const HOUSING_OPTIONS: { value: HousingType; label: string; description: string }[] = [
  { value: "villa", label: "Villa", description: "Fristående hus" },
  { value: "radhus", label: "Radhus", description: "Rad-/kedjehus" },
  { value: "lagenhet", label: "Lägenhet", description: "Bostadsrätt/hyresrätt" },
];

const HEATING_OPTIONS: { value: HeatingType; label: string; description: string }[] = [
  { value: "direktel", label: "Direktel", description: "Element eller golvvärme" },
  { value: "luftluft", label: "Luft/luft-värmepump", description: "Vanligast i villor" },
  { value: "luftvatten", label: "Luft/vatten-värmepump", description: "Värmer hela huset via vatten" },
  { value: "bergvarme", label: "Bergvärme", description: "Borrhål, stabil COP" },
  { value: "fjarrvarme", label: "Fjärrvärme", description: "Vanligt i lägenheter/radhus" },
];

const EL_CONTRACT_OPTIONS: { value: ElContractType; label: string; description: string }[] = [
  { value: "dynamic", label: "Dynamiskt pris", description: "Timpris eller kvartspris — du betalar aktuellt spotpris" },
  { value: "monthly", label: "Månadsmedel", description: "Genomsnittligt spotpris per månad (hette tidigare rörligt pris)" },
  { value: "fixed", label: "Fast", description: "Fast pris — avtalat pris oavsett marknad" },
];

const BIG_CONSUMER_OPTIONS: { value: BigConsumer; label: string; icon: string }[] = [
  { value: "elbil", label: "Elbil", icon: BIG_CONSUMER_PROFILES.elbil.icon },
  { value: "pool", label: "Pool", icon: BIG_CONSUMER_PROFILES.pool.icon },
  { value: "spabad", label: "Spabad", icon: BIG_CONSUMER_PROFILES.spabad.icon },
  { value: "bastu", label: "Bastu", icon: BIG_CONSUMER_PROFILES.bastu.icon },
];

interface ProfileFormProps {
  billData: BillData;
  initialRefinement?: RefinementAnswers;
  initialSeZone?: SEZone;
  /**
   * Called when the user submits. The 4th argument carries any inline
   * edits the user made to the AI-extracted bill data — the parent should
   * persist this back into state.billData so downstream consumers
   * (recommendations, comparison) see the corrected values.
   */
  onComplete: (
    seZone: SEZone,
    refinement: RefinementAnswers,
    answeredQuestions: number,
    editedBillData: BillData
  ) => void;
}

/**
 * The "Vi hittade följande" rows the user can correct inline. Tariff
 * details (gridFixedFeeKr, transferFeeOre, etc.) are intentionally left
 * out — they belong in the post-login energy-profile, not in the AHA-
 * focused Teaser flow.
 */
type EditableField =
  | "invoicePeriodKwh"
  | "annualKwh"
  | "costPerMonth"
  | "seZone"
  | "elhandlare"
  | "natAgare"
  | "elContractType"
  | "invoiceSpotPriceOre"
  | "invoiceMarkupOre";

const SE_ZONE_OPTIONS: SEZone[] = ["SE1", "SE2", "SE3", "SE4"];
const CONTRACT_OPTIONS: { value: ElContractType; label: string }[] = [
  { value: "dynamic", label: "Timspot" },
  { value: "monthly", label: "Månadsmedel" },
  { value: "fixed", label: "Fastpris" },
];
const OPERATOR_OPTIONS = GRID_OPERATORS.map((op) => op.name).sort((a, b) =>
  a.localeCompare(b, "sv")
);
const OPERATOR_OTHER = "__other__";

/**
 * One row in the "Vi hittade följande" panel. In display mode it shows a
 * label + value + tiny pen icon; clicking the row switches to an inline
 * editor (text input, number input, or a small button group depending on
 * `inputType`). Auto-focuses the input when entering edit mode and
 * commits on Enter / blur, cancels on Escape.
 */
interface EditableRowProps {
  label: string;
  /** Current value (string for text/select, number for numeric inputs). */
  value: string | number | undefined;
  /** Pre-formatted display string (e.g. "13 500 kWh"). */
  display: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  /** Called with the new committed value (string|number). */
  onSave: (next: string | number | undefined) => void;
  inputType: "text" | "number" | "zone" | "contract" | "operator";
  /** Suffix shown after a number input (e.g. "kWh", "kr", "öre/kWh"). */
  suffix?: string;
  /** Decimals for number inputs (default 0). */
  decimals?: number;
  /** Placeholder text when value is empty. */
  placeholder?: string;
  /**
   * If true, render the row even when value is undefined — used for
   * `natAgare` so the user can fill it in when AI missed it.
   */
  alwaysVisible?: boolean;
  /**
   * When false, the row is read-only — no pen icon, not clickable. The
   * user must explicitly enter edit-mode for the whole card before any
   * row becomes editable. Keeps Sofia from feeling she "must" verify
   * each row.
   */
  editModeActive: boolean;
  /**
   * Called when the user clicks a "missing data" row (placeholder
   * showing) in default read-only mode. The parent should activate
   * edit-mode for the entire card so the same click also opens this
   * row's input — turning the visible "Klicka för att välja"-CTA into
   * a real one-click action.
   */
  onActivateMode?: () => void;
}

function EditableRow({
  label,
  value,
  display,
  isEditing,
  onStartEdit,
  onCancel,
  onSave,
  inputType,
  suffix,
  decimals = 0,
  placeholder,
  alwaysVisible,
  editModeActive,
  onActivateMode,
}: EditableRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  // For "operator" inputType: track whether user picked the "Annat" path
  // (free-text fallback for grid operators not in our list). Initial mode
  // derived from the current value via lazy useState init — no useEffect
  // needed, so we don't trip the react-hooks/set-state-in-effect rule.
  const [operatorMode, setOperatorMode] = useState<"select" | "other">(() => {
    if (
      inputType === "operator" &&
      typeof value === "string" &&
      value &&
      !OPERATOR_OPTIONS.includes(value)
    ) {
      return "other";
    }
    return "select";
  });

  // Auto-focus the editor when entering edit mode. This is a DOM side
  // effect — no React state changes — so it's allowed inside useEffect.
  useEffect(() => {
    if (!isEditing) return;
    queueMicrotask(() => {
      if (inputType === "operator") selectRef.current?.focus();
      else inputRef.current?.focus();
    });
  }, [isEditing, inputType]);

  // Hide the row entirely if there's no value and we're not in edit mode
  // and the row isn't flagged as always visible.
  if (value === undefined && !isEditing && !alwaysVisible) return null;

  // --- Display mode ---
  if (!isEditing) {
    const showPlaceholder = (value === undefined || value === "") && !!placeholder;

    // When edit-mode isn't active for the whole card, render the row as
    // a plain non-interactive line so Sofia doesn't feel pressured to
    // verify each row. Exception: if the row is missing data and shows
    // a "Klicka för att..."-placeholder, make it directly clickable so
    // the visible CTA actually works — clicking activates edit-mode for
    // the whole card AND opens this row's input in one shot.
    if (!editModeActive) {
      if (showPlaceholder && onActivateMode) {
        return (
          <button
            type="button"
            onClick={() => {
              onActivateMode();
              onStartEdit();
            }}
            className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-left transition-colors hover:bg-brand-100/40"
            aria-label={`Fyll i ${label.toLowerCase()}`}
          >
            <span className="text-text-secondary">{label}</span>
            <span className="font-semibold text-text-muted italic">
              {placeholder}
            </span>
          </button>
        );
      }
      return (
        <div className="flex w-full items-center justify-between gap-2 py-1">
          <span className="text-text-secondary">{label}</span>
          <span
            className={`font-semibold ${
              showPlaceholder ? "text-text-muted italic" : "text-text-primary"
            }`}
          >
            {showPlaceholder ? placeholder : display}
          </span>
        </div>
      );
    }

    // Edit-mode is active — show the pen icon and make the row clickable.
    return (
      <button
        type="button"
        onClick={onStartEdit}
        className="group flex w-full items-center justify-between gap-2 rounded-md py-1 text-left transition-colors hover:bg-brand-100/40"
        aria-label={`Rätta ${label.toLowerCase()}`}
      >
        <span className="text-text-secondary">{label}</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`font-semibold ${
              showPlaceholder ? "text-text-muted italic" : "text-text-primary"
            }`}
          >
            {showPlaceholder ? placeholder : display}
          </span>
          <svg
            className="h-3.5 w-3.5 text-text-muted opacity-60 transition-opacity group-hover:opacity-100"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM2 17a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" />
          </svg>
        </span>
      </button>
    );
  }

  // --- Edit mode ---
  const commit = (next: string | number | undefined) => {
    onSave(next);
  };

  // Read the current value from the DOM input (uncontrolled pattern) and
  // commit it. Avoids the react-hooks/set-state-in-effect issue we'd hit
  // with a controlled draft state synchronized via useEffect.
  const handleCommitFromInput = () => {
    const raw = inputRef.current?.value ?? "";
    if (inputType === "number") {
      const parsed = parseFloat(raw.replace(",", "."));
      commit(Number.isFinite(parsed) ? parsed : undefined);
    } else {
      const trimmed = raw.trim();
      commit(trimmed.length > 0 ? trimmed : undefined);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitFromInput();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  // Zon-väljare (4 buttons, instant commit)
  if (inputType === "zone") {
    return (
      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-text-secondary">{label}</span>
        <div className="flex gap-1">
          {SE_ZONE_OPTIONS.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => commit(zone)}
              className={`rounded-md border-2 px-2 py-1 text-xs font-bold transition-all ${
                value === zone
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-border text-text-secondary hover:border-brand-500"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Kontrakt-väljare (3 buttons, instant commit)
  if (inputType === "contract") {
    return (
      <div className="flex flex-col gap-1.5 py-1">
        <span className="text-text-secondary">{label}</span>
        <div className="flex gap-1">
          {CONTRACT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => commit(opt.value)}
              className={`flex-1 rounded-md border-2 px-2 py-1 text-xs font-medium transition-all ${
                value === opt.value
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-border text-text-secondary hover:border-brand-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Operatör-väljare — native <select> + valfri fritext för "Annat"
  if (inputType === "operator") {
    // Default for the <select> reflects the current bill data: a known
    // operator, the "other" sentinel if user chose Annat, or empty.
    const initialSelectValue =
      operatorMode === "other"
        ? OPERATOR_OTHER
        : typeof value === "string"
        ? value
        : "";
    // Default for the free-text input when in "other" mode — reuse the
    // AI-extracted name if it didn't match our operator list.
    const initialFreeText =
      typeof value === "string" && value && !OPERATOR_OPTIONS.includes(value)
        ? value
        : "";
    return (
      <div className="flex flex-col gap-1.5 py-1">
        <span className="text-text-secondary">{label}</span>
        <select
          ref={selectRef}
          defaultValue={initialSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OPERATOR_OTHER) {
              setOperatorMode("other");
            } else {
              setOperatorMode("select");
              commit(v.length > 0 ? v : undefined);
            }
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">Välj nätbolag…</option>
          {OPERATOR_OPTIONS.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
          <option value={OPERATOR_OTHER}>Annat — skriv in själv</option>
        </select>
        {operatorMode === "other" && (
          <>
            <input
              ref={inputRef}
              type="text"
              defaultValue={initialFreeText}
              onBlur={handleCommitFromInput}
              onKeyDown={onKeyDown}
              placeholder="Skriv ditt nätbolag"
              className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="text-[11px] leading-snug text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              💡 Vi har inte detta bolag i vår tariff-databas — schablonvärden används.
              Ladda upp din elnätsfaktura för exakta värden.
            </p>
          </>
        )}
      </div>
    );
  }

  // Text / number — vanligt input-fält. Uncontrolled (defaultValue + ref)
  // to avoid synchronizing draft state via useEffect — the input lives
  // only while isEditing is true, so it remounts on each edit session
  // and reads the latest saved value as its defaultValue.
  const initialText = value === undefined ? "" : String(value);
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-text-secondary">{label}</span>
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type={inputType === "number" ? "number" : "text"}
          inputMode={inputType === "number" ? "decimal" : undefined}
          step={inputType === "number" ? (decimals > 0 ? `0.${"0".repeat(decimals - 1)}1` : "1") : undefined}
          defaultValue={initialText}
          onBlur={handleCommitFromInput}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-32 rounded-md border border-border bg-white px-2 py-1 text-right text-sm font-semibold text-text-primary focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        {suffix && <span className="text-xs text-text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

export default function VerificationScreen({ billData, initialRefinement, initialSeZone, onComplete }: ProfileFormProps) {
  // --- Inline-edit state for the "Vi hittade följande" rows ---
  // Local copy of bill data the user can correct without triggering a
  // re-parse. Submitted back to the parent via onComplete.
  const [editedBillData, setEditedBillData] = useState<BillData>(billData);
  // Which row is currently in edit mode, or null. Only one row at a time.
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  // Whether the entire card is in edit-mode. When false the rows render
  // as plain read-only text without pen icons — Sofia doesn't feel
  // pressured to verify each row, and pulls down the link only if she
  // sees something off. Latches until she clicks "Klar med ändringar".
  const [editModeActive, setEditModeActive] = useState(false);

  // Helper: patch a single field on editedBillData.
  const updateField = <K extends keyof BillData>(key: K, value: BillData[K]) => {
    setEditedBillData((prev) => ({ ...prev, [key]: value }));
  };

  // Close edit-mode and any open input. Used by the "Klar med ändringar"
  // toggle. An open input loses its uncommitted draft — that's an
  // accepted trade-off; users actively closing the mode have already had
  // the chance to commit (Enter / blur).
  const exitEditMode = () => {
    setEditingField(null);
    setEditModeActive(false);
  };

  // Pure input — no inference. Sensible defaults instead.
  const [seZone, setSeZone] = useState<SEZone>(initialSeZone ?? billData.seZone ?? "SE3");
  const [housingType, setHousingType] = useState<HousingType>(initialRefinement?.housingType ?? "villa");
  const [heatingTypes, setHeatingTypes] = useState<HeatingType[]>(initialRefinement?.heatingTypes ?? []);
  const [area, setArea] = useState(initialRefinement?.area ?? 120);
  const [residents, setResidents] = useState(initialRefinement?.residents ?? 3);
  const [bigConsumers, setBigConsumers] = useState<BigConsumer[]>(initialRefinement?.bigConsumers ?? []);
  const [noneOfThese, setNoneOfThese] = useState(false);
  const [elContractType, setElContractType] = useState<ElContractType>(initialRefinement?.elContractType ?? billData.elContractType ?? "monthly");
  const [hasSolar, setHasSolar] = useState(initialRefinement?.hasSolar ?? billData.hasProductionRevenue ?? false);
  const [solarSizeKw, setSolarSizeKw] = useState(initialRefinement?.solarSizeKw ?? 10);
  const [hasBattery, setHasBattery] = useState(initialRefinement?.hasBattery ?? false);
  const [batterySizeKwh, setBatterySizeKwh] = useState(initialRefinement?.batterySizeKwh ?? 15);

  // Read displayed values from the edited copy so inline edits show up
  // immediately in the "Vi hittade följande" rows.
  const annualKwh = editedBillData.annualKwh ?? editedBillData.kwhPerMonth * 12;

  const toggleHeating = (ht: HeatingType) => {
    setHeatingTypes((prev) =>
      prev.includes(ht) ? prev.filter((t) => t !== ht) : [...prev, ht]
    );
  };

  const toggleBigConsumer = (bc: BigConsumer) => {
    setNoneOfThese(false);
    setBigConsumers((prev) =>
      prev.includes(bc) ? prev.filter((c) => c !== bc) : [...prev, bc]
    );
  };

  const handleNoneOfThese = () => {
    setNoneOfThese(true);
    setBigConsumers([]);
  };

  const handleSubmit = () => {
    const refinement: RefinementAnswers = {
      housingType,
      heatingTypes,
      heatingType: heatingTypes[0],
      area,
      residents,
      elContractType,
      bigConsumers: bigConsumers.length > 0 ? bigConsumers : undefined,
      hasSolar,
      solarSizeKw: hasSolar ? solarSizeKw : undefined,
      hasBattery: hasSolar ? hasBattery : false,
      batterySizeKwh: hasSolar && hasBattery ? batterySizeKwh : undefined,
    };
    // Sync the user's seZone choice into the edited bill data so any
    // downstream consumer that reads billData.seZone gets the correction.
    onComplete(seZone, refinement, 6, { ...editedBillData, seZone });
  };

  return (
    <div className="mx-auto max-w-md px-4 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-text-primary">
          Bekräfta &amp; komplettera
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Kontrollera fakturadatan vi tolkat och fyll i några uppgifter om ditt hem
          för en träffsäker analys.
        </p>
      </div>

      {/* Vi hittade följande — parsed bill data, inline-redigerbar */}
      <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Vi hittade följande på din faktura</h3>
          <span className="text-[10px] font-medium uppercase tracking-wider text-brand-600">automatiskt tolkat</span>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          {/* Förbrukning (period) — visas bara om månad finns på fakturan */}
          {editedBillData.invoiceMonth !== undefined && (
            <EditableRow
              label={`Förbrukning (${["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"][editedBillData.invoiceMonth]})`}
              value={editedBillData.invoicePeriodKwh}
              display={editedBillData.invoicePeriodKwh ? `${Math.round(editedBillData.invoicePeriodKwh).toLocaleString("sv-SE")} kWh` : "—"}
              isEditing={editingField === "invoicePeriodKwh"}
              onStartEdit={() => setEditingField("invoicePeriodKwh")}
              onCancel={() => setEditingField(null)}
              onSave={(next) => {
                if (typeof next === "number") updateField("invoicePeriodKwh", next);
                setEditingField(null);
              }}
              inputType="number"
              suffix="kWh"
              editModeActive={editModeActive}
            />
          )}

          <EditableRow
            label="Beräknad årsförbrukning"
            value={editedBillData.annualKwh ?? Math.round(annualKwh)}
            display={`${Math.round(annualKwh).toLocaleString("sv-SE")} kWh`}
            isEditing={editingField === "annualKwh"}
            onStartEdit={() => setEditingField("annualKwh")}
            onCancel={() => setEditingField(null)}
            onSave={(next) => {
              if (typeof next === "number") updateField("annualKwh", next);
              setEditingField(null);
            }}
            inputType="number"
            suffix="kWh"
            editModeActive={editModeActive}
          />

          {editedBillData.costPerMonth > 0 && (
            <EditableRow
              label="Periodens kostnad"
              value={editedBillData.costPerMonth}
              display={`${Math.round(editedBillData.costPerMonth).toLocaleString("sv-SE")} kr`}
              isEditing={editingField === "costPerMonth"}
              onStartEdit={() => setEditingField("costPerMonth")}
              onCancel={() => setEditingField(null)}
              onSave={(next) => {
                if (typeof next === "number") updateField("costPerMonth", next);
                setEditingField(null);
              }}
              inputType="number"
              suffix="kr"
              editModeActive={editModeActive}
            />
          )}

          <EditableRow
            label="Elområde"
            value={seZone}
            display={seZone}
            isEditing={editingField === "seZone"}
            onStartEdit={() => setEditingField("seZone")}
            onCancel={() => setEditingField(null)}
            onSave={(next) => {
              if (typeof next === "string" && SE_ZONE_OPTIONS.includes(next as SEZone)) {
                setSeZone(next as SEZone);
              }
              setEditingField(null);
            }}
            inputType="zone"
            editModeActive={editModeActive}
          />

          {(editedBillData.elhandlare !== undefined || editingField === "elhandlare") && (
            <EditableRow
              label="Elhandlare"
              value={editedBillData.elhandlare}
              display={editedBillData.elhandlare ?? "—"}
              isEditing={editingField === "elhandlare"}
              onStartEdit={() => setEditingField("elhandlare")}
              onCancel={() => setEditingField(null)}
              onSave={(next) => {
                updateField("elhandlare", typeof next === "string" ? next : undefined);
                setEditingField(null);
              }}
              inputType="text"
              placeholder="Klicka för att fylla i"
              editModeActive={editModeActive}
            />
          )}

          {/* Nätbolag — visas alltid (även om saknad), kritiskt för jämförelse.
              When natAgare is missing, the row is directly clickable in
              read-only mode (via onActivateMode) so the visible
              "Klicka för att välja"-CTA actually works in one click. */}
          <EditableRow
            label="Nätbolag"
            value={editedBillData.natAgare}
            display={editedBillData.natAgare ?? "—"}
            isEditing={editingField === "natAgare"}
            onStartEdit={() => setEditingField("natAgare")}
            onCancel={() => setEditingField(null)}
            onSave={(next) => {
              updateField("natAgare", typeof next === "string" && next.length > 0 ? next : undefined);
              setEditingField(null);
            }}
            inputType="operator"
            placeholder="Klicka för att välja"
            alwaysVisible
            editModeActive={editModeActive}
            onActivateMode={() => setEditModeActive(true)}
          />

          <EditableRow
            label="Avtalstyp"
            value={elContractType}
            display={
              elContractType === "dynamic" ? "Timspot" :
              elContractType === "monthly" ? "Månadsmedel" :
              "Fastpris"
            }
            isEditing={editingField === "elContractType"}
            onStartEdit={() => setEditingField("elContractType")}
            onCancel={() => setEditingField(null)}
            onSave={(next) => {
              if (next === "dynamic" || next === "monthly" || next === "fixed") {
                setElContractType(next);
                updateField("elContractType", next);
              }
              setEditingField(null);
            }}
            inputType="contract"
            editModeActive={editModeActive}
          />

          {editedBillData.invoiceSpotPriceOre !== undefined && (
            <EditableRow
              label="Spotpris (snitt)"
              value={editedBillData.invoiceSpotPriceOre}
              display={`${editedBillData.invoiceSpotPriceOre.toFixed(1)} öre/kWh`}
              isEditing={editingField === "invoiceSpotPriceOre"}
              onStartEdit={() => setEditingField("invoiceSpotPriceOre")}
              onCancel={() => setEditingField(null)}
              onSave={(next) => {
                if (typeof next === "number") updateField("invoiceSpotPriceOre", next);
                setEditingField(null);
              }}
              inputType="number"
              suffix="öre/kWh"
              decimals={1}
              editModeActive={editModeActive}
            />
          )}

          {editedBillData.invoiceMarkupOre !== undefined && (
            <EditableRow
              label="Påslag"
              value={editedBillData.invoiceMarkupOre}
              display={`${editedBillData.invoiceMarkupOre.toFixed(1)} öre/kWh`}
              isEditing={editingField === "invoiceMarkupOre"}
              onStartEdit={() => setEditingField("invoiceMarkupOre")}
              onCancel={() => setEditingField(null)}
              onSave={(next) => {
                if (typeof next === "number") updateField("invoiceMarkupOre", next);
                setEditingField(null);
              }}
              inputType="number"
              suffix="öre/kWh"
              decimals={1}
              editModeActive={editModeActive}
            />
          )}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          {editModeActive ? (
            <button
              type="button"
              className="font-medium text-brand-600 underline hover:text-brand-700"
              onClick={exitEditMode}
            >
              Klar med ändringar
            </button>
          ) : (
            <>
              Stämmer något inte?{" "}
              <button
                type="button"
                className="font-medium text-brand-600 underline hover:text-brand-700"
                onClick={() => setEditModeActive(true)}
              >
                Justera manuellt
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">Berätta om ditt hem</h3>
        <p className="mt-0.5 text-xs text-text-secondary">Hjälper oss anpassa simuleringen efter din situation.</p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Boendetyp */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Boendetyp</label>
          <div className="mt-2 flex gap-2">
            {HOUSING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHousingType(opt.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  housingType === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border text-text-secondary hover:border-brand-500"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[10px] text-text-muted font-normal">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Uppvärmning (multi-select) */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Uppvärmning</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Välj en eller flera — detta påverkar analysen mest</p>
          <div className="mt-2 flex flex-col gap-2">
            {HEATING_OPTIONS.map((opt) => {
              const checked = heatingTypes.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleHeating(opt.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                    checked
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-border text-text-secondary hover:border-brand-500"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                    checked ? "border-brand-500 bg-brand-500" : "border-gray-300"
                  }`}>
                    {checked && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span>{opt.label}</span>
                    <span className="block text-[10px] text-text-muted font-normal">{opt.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {heatingTypes.length === 0 && (
            <p className="mt-2 text-[11px] text-amber-600">Välj minst ett uppvärmningssätt för att gå vidare</p>
          )}
        </div>

        {/* Elområde */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Elområde</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Påverkar elpriser och klimatprofil</p>
          <div className="mt-2 flex gap-2">
            {SE_ZONES.map((zone) => (
              <button
                key={zone.value}
                onClick={() => setSeZone(zone.value)}
                className={`flex-1 rounded-xl border-2 px-2 py-2.5 text-center transition-all ${
                  seZone === zone.value
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-border hover:border-brand-500"
                }`}
              >
                <span className={`text-sm font-bold ${seZone === zone.value ? "text-brand-600" : "text-text-primary"}`}>
                  {zone.label}
                </span>
                <span className="block text-[10px] text-text-muted">{zone.description.split("(")[1]?.replace(")", "") ?? zone.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Elavtal */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Elavtal</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Avgör hur du kan dra nytta av prisvariationer</p>
          <div className="mt-2 flex flex-col gap-2">
            {EL_CONTRACT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setElContractType(opt.value)}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  elContractType === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border text-text-secondary hover:border-brand-500"
                }`}
              >
                <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                  elContractType === opt.value ? "border-brand-500" : "border-gray-300"
                }`}>
                  {elContractType === opt.value && (
                    <div className="h-2 w-2 rounded-full bg-brand-500" />
                  )}
                </div>
                <div>
                  <span>{opt.label}</span>
                  <span className="block text-[10px] text-text-muted font-normal">{opt.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Total bostadsyta (slider) */}
        <div className="card-strong rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-text-primary">Total bostadsyta</label>
            <span className="text-sm font-bold text-brand-600">{area} m²</span>
          </div>
          <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
            All uppvärmd yta tillsammans — boarea + biarea (källare, garage,
            vind eller tillbyggnad som du värmer upp).
          </p>
          <input
            type="range"
            min={20}
            max={400}
            step={5}
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>20 m²</span>
            <span>400 m²</span>
          </div>
        </div>

        {/* Antal boende (slider) */}
        <div className="card-strong rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-text-primary">Antal boende</label>
            <span className="text-sm font-bold text-brand-600">{residents} {residents === 1 ? "person" : "personer"}</span>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={residents}
            onChange={(e) => setResidents(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          <div className="flex justify-between text-[10px] text-text-muted">
            <span>1</span>
            <span>8</span>
          </div>
        </div>

        {/* Befintlig utrustning */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">Befintlig utrustning</label>
          <p className="mt-0.5 text-[11px] text-text-muted">Har du någon av dessa redan installerat?</p>

          {/* Solceller */}
          <div className="mt-3">
            <button
              onClick={() => {
                const next = !hasSolar;
                setHasSolar(next);
                if (!next) setHasBattery(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                hasSolar
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border text-text-secondary hover:border-brand-500"
              }`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                hasSolar ? "border-brand-500 bg-brand-500" : "border-gray-300"
              }`}>
                {hasSolar && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span>☀️ Solceller</span>
            </button>
            {hasSolar && (
              <div className="mt-2 ml-8 mr-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted">Storlek</span>
                  <span className="font-bold text-brand-600">{solarSizeKw} kW</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={solarSizeKw}
                  onChange={(e) => setSolarSizeKw(Number(e.target.value))}
                  className="mt-1 w-full accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-text-muted">
                  <span>2 kW</span>
                  <span>20 kW</span>
                </div>
              </div>
            )}
          </div>

          {/* Hembatteri (bara om solceller) */}
          {hasSolar && (
            <div className="mt-2">
              <button
                onClick={() => setHasBattery(!hasBattery)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  hasBattery
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border text-text-secondary hover:border-brand-500"
                }`}
              >
                <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                  hasBattery ? "border-brand-500 bg-brand-500" : "border-gray-300"
                }`}>
                  {hasBattery && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span>🔋 Hembatteri</span>
              </button>
              {hasBattery && (
                <div className="mt-2 ml-8 mr-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-muted">Kapacitet</span>
                    <span className="font-bold text-brand-600">{batterySizeKwh} kWh</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={1}
                    value={batterySizeKwh}
                    onChange={(e) => setBatterySizeKwh(Number(e.target.value))}
                    className="mt-1 w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>5 kWh</span>
                    <span>50 kWh</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Storförbrukare */}
        <div className="card-strong rounded-2xl p-4">
          <label className="text-sm font-semibold text-text-primary">{STRINGS.bigConsumersTitle}</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {BIG_CONSUMER_OPTIONS.map((opt) => {
              const selected = bigConsumers.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleBigConsumer(opt.value)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    selected
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-border text-text-secondary hover:border-brand-500"
                  }`}
                >
                  <span>{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
            <button
              onClick={handleNoneOfThese}
              className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                noneOfThese
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-border text-text-secondary hover:border-brand-500"
              }`}
            >
              {STRINGS.noneOfThese}
            </button>
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={heatingTypes.length === 0}
        className="mt-6 mb-8 w-full rounded-2xl bg-cta-orange px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {STRINGS.next}
      </button>
    </div>
  );
}