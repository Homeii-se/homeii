// File: app/app/spara-analys/address-form.tsx
// REPLACES the existing file at this path.
// 
// Refactored to use the shared HomePicker component.

"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAnalysis, type SaveAnalysisResult } from "./actions";
import { loadState } from "@/app/simulator/storage";
import type { SimulatorState } from "@/app/simulator/types";
import type { HomeWithAnlaggnings } from "./page";
import { HomePicker } from "@/lib/components/HomePicker";

interface AddressFormProps {
  myHomes: HomeWithAnlaggnings[];
}

export function AddressForm({ myHomes }: AddressFormProps) {
  // Lazy load homeii-state from localStorage on mount
  const [state] = useState<SimulatorState | null>(() => loadState());

  // Form state
  const [street, setStreet] = useState(() => state?.billData?.street ?? "");
  const [postalCode, setPostalCode] = useState(() => state?.billData?.postalCode ?? "");
  const [city, setCity] = useState(() => state?.billData?.city ?? "");
  const [anlaggningsId, setAnlaggningsId] = useState(() => state?.billData?.anlaggningsId ?? "");

  // Smart match — same calculation as HomePicker, used for initial selection
  const matchingHomesForInitialSelection = useMemo(() => {
    if (!anlaggningsId || anlaggningsId.length !== 18) return [];
    return myHomes.filter((h) =>
      h.anlaggnings_ids.includes(anlaggningsId),
    );
  }, [myHomes, anlaggningsId]);

  const [selectedHomeIds, setSelectedHomeIds] = useState<Set<string>>(
    () => new Set(matchingHomesForInitialSelection.map((h) => h.id)),
  );
  const [createNewHome, setCreateNewHome] = useState(
    () => myHomes.length > 0 && matchingHomesForInitialSelection.length === 0,
  );
  const [newHomeName, setNewHomeName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const [actionState, formAction, isPending] = useActionState<
    SaveAnalysisResult | null,
    FormData
  >(saveAnalysis, null);

  const isFirstTime = myHomes.length === 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

  if (!state?.billData) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-900">
          Ingen analys hittades. Vänligen{" "}
          <a href="/analys" className="underline">
            ladda upp en faktura först
          </a>
          .
        </p>
      </div>
    );
  }

  // Convert Set to hidden inputs for the form
  const selectedHomeIdsArray = Array.from(selectedHomeIds);

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input
        type="hidden"
        name="homeii_state_json"
        value={JSON.stringify(state)}
      />

      {/* Hidden inputs for the home selection (HomePicker is controlled) */}
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

      {/* Address fields */}
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

      {/* Home picker (shared component) */}
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
