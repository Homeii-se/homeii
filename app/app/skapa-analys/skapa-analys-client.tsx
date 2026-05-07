// File: app/app/skapa-analys/skapa-analys-client.tsx
// NEW FILE.
// 
// All-on-one-page flow for V2 logged-in users:
//   1. Upload + parse (UploadBill)
//   2. Verify/edit parsed data (VerificationScreen)
//   3. Confirm address + select home (HomePicker)
//   4. Save to database (server action)

"use client";

import { useActionState, useState } from "react";
import { saveSkapaAnalys, type SkapaAnalysResult } from "./actions";
import { HomePicker, type HomePickerHome } from "@/lib/components/HomePicker";
import UploadBill from "@/app/simulator/components/UploadBill";
import VerificationScreen from "@/app/simulator/components/VerificationScreen";
import type { BillData, RefinementAnswers, SEZone } from "@/app/simulator/types";

interface SkapaAnalysClientProps {
  myHomes: HomePickerHome[];
  preselectedHomeId?: string;
}

type Phase = "upload" | "verify" | "save";

export function SkapaAnalysClient({
  myHomes,
  preselectedHomeId,
}: SkapaAnalysClientProps) {
  const [phase, setPhase] = useState<Phase>("upload");

  // After UploadBill
  const [billData, setBillData] = useState<BillData | null>(null);

  // After VerificationScreen
  const [refinement, setRefinement] = useState<RefinementAnswers | null>(null);
  const [seZone, setSeZone] = useState<SEZone | null>(null);
  const [editedBillData, setEditedBillData] = useState<BillData | null>(null);

  // Address fields (editable in save phase)
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [anlaggningsId, setAnlaggningsId] = useState("");

  // Home picker state
  const [selectedHomeIds, setSelectedHomeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [createNewHome, setCreateNewHome] = useState(false);
  const [newHomeName, setNewHomeName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [actionState, formAction, isPending] = useActionState<
    SkapaAnalysResult | null,
    FormData
  >(saveSkapaAnalys, null);

  // ---------------------------------------------------------------------------
  // Phase transition: upload → verify
  // ---------------------------------------------------------------------------
  const handleBillComplete = (data: BillData) => {
    setBillData(data);

    // Pre-fill address fields from parsed data
    if (data.street) setStreet(data.street);
    if (data.postalCode) setPostalCode(data.postalCode);
    if (data.city) setCity(data.city);
    if (data.anlaggningsId) setAnlaggningsId(data.anlaggningsId);

    setPhase("verify");
  };

  // ---------------------------------------------------------------------------
  // Phase transition: verify → save
  // ---------------------------------------------------------------------------
  const handleVerificationComplete = (
    zone: SEZone,
    ref: RefinementAnswers,
    _answeredQuestions: number,
    edited: BillData,
  ) => {
    setSeZone(zone);
    setRefinement(ref);
    setEditedBillData(edited);

    // Initialize home picker selection based on smart match
    const matching = myHomes.filter((h) =>
      anlaggningsId.length === 18 && h.anlaggnings_ids.includes(anlaggningsId),
    );

    // Apply preselected home (from ?home_id param) or smart match
    const initialIds = new Set<string>(matching.map((h) => h.id));
    if (preselectedHomeId && myHomes.some((h) => h.id === preselectedHomeId)) {
      initialIds.add(preselectedHomeId);
    }
    setSelectedHomeIds(initialIds);
    setCreateNewHome(myHomes.length > 0 && initialIds.size === 0);

    setPhase("save");
  };

  // ---------------------------------------------------------------------------
  // Form submit (only in save phase)
  // ---------------------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const isFirstTime = myHomes.length === 0;
    if (!isFirstTime) {
      if (selectedHomeIds.size === 0 && !createNewHome) {
        e.preventDefault();
        setValidationError(
          "Du måste välja minst ett hem eller skapa ett nytt hem.",
        );
        return;
      }
      if (createNewHome && !newHomeName.trim()) {
        e.preventDefault();
        setValidationError("Skriv ett namn för det nya hemmet.");
        return;
      }
    }
    setValidationError(null);
  };

  // ---------------------------------------------------------------------------
  // Render — phase-based
  // ---------------------------------------------------------------------------

  if (phase === "upload") {
    return (
      <div>
        <UploadBill
          onComplete={handleBillComplete}
        />
      </div>
    );
  }

  if (phase === "verify" && billData) {
    return (
      <div>
        <VerificationScreen
          billData={billData}
          onComplete={handleVerificationComplete}
        />
      </div>
    );
  }

  // Save phase: address + home picker + save button
  if (phase === "save" && editedBillData && refinement && seZone) {
    const isFirstTime = myHomes.length === 0;
    const selectedHomeIdsArray = Array.from(selectedHomeIds);

    // Build the state JSON the server action expects (mirrors homeii-state shape)
    const stateForServer = {
      billData: editedBillData,
      refinement,
      seZone,
      // recommendations not run yet — empty
      recommendations: undefined,
    };

    return (
      <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
        <input
          type="hidden"
          name="homeii_state_json"
          value={JSON.stringify(stateForServer)}
        />

        {selectedHomeIdsArray.map((id) => (
          <input
            key={id}
            type="hidden"
            name="selected_home_ids"
            value={id}
          />
        ))}
        <input
          type="hidden"
          name="create_new_home"
          value={createNewHome ? "true" : "false"}
        />
        {createNewHome && newHomeName && (
          <input type="hidden" name="new_home_name" value={newHomeName} />
        )}

        {/* Address fields (editable) */}
        <fieldset className="space-y-4">
          <legend className="font-medium mb-2">Adress</legend>

          <div>
            <label htmlFor="street" className="block text-sm font-medium mb-1">
              Gata
            </label>
            <input
              id="street"
              name="street"
              type="text"
              required
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="postal_code" className="block text-sm font-medium mb-1">
                Postnummer
              </label>
              <input
                id="postal_code"
                name="postal_code"
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium mb-1">
                Postort
              </label>
              <input
                id="city"
                name="city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="anlaggnings_id" className="block text-sm font-medium mb-1">
              Anläggnings-ID (18 siffror)
            </label>
            <input
              id="anlaggnings_id"
              name="anlaggnings_id"
              type="text"
              pattern="\d{18}"
              required
              value={anlaggningsId}
              onChange={(e) => setAnlaggningsId(e.target.value)}
              className="w-full rounded border px-3 py-2 font-mono"
            />
          </div>
        </fieldset>

        <HomePicker
          myHomes={myHomes}
          anlaggningsId={anlaggningsId}
          street={street}
          selectedHomeIds={selectedHomeIds}
          onSelectedHomeIdsChange={setSelectedHomeIds}
          createNewHome={createNewHome}
          onCreateNewHomeChange={setCreateNewHome}
          newHomeName={newHomeName}
          onNewHomeNameChange={setNewHomeName}
        />

        {validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">{validationError}</p>
          </div>
        )}

        {actionState && !actionState.success && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">{actionState.error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium disabled:opacity-50"
        >
          {isPending ? "Sparar..." : isFirstTime ? "Spara fakturan i ditt nya hem" : "Spara"}
        </button>
      </form>
    );
  }

  return null;
}
