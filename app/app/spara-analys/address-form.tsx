// File: app/app/spara-analys/address-form.tsx
// REPLACES the existing address-form.tsx at this path.

"use client";

import { useActionState, useMemo, useState } from "react";
import { saveAnalysis, type SaveAnalysisResult } from "./actions";
import { loadState } from "@/app/simulator/storage";
import type { SimulatorState } from "@/app/simulator/types";
import type { DbHome } from "@/lib/types/database";

interface AddressFormProps {
  myHomes: DbHome[];
}

export function AddressForm({ myHomes }: AddressFormProps) {
  const [state] = useState<SimulatorState | null>(() => loadState());

  // ---------------------------------------------------------------------------
  // Form state — pre-filled from localStorage via lazy initializer
  // ---------------------------------------------------------------------------
  const [street, setStreet] = useState(() => state?.billData?.street ?? "");
  const [postalCode, setPostalCode] = useState(() => state?.billData?.postalCode ?? "");
  const [city, setCity] = useState(() => state?.billData?.city ?? "");
  const [anlaggningsId, setAnlaggningsId] = useState(() => state?.billData?.anlaggningsId ?? "");

  // Home picker state (only used when myHomes.length > 0)
  const [selectedHomeIds, setSelectedHomeIds] = useState<Set<string>>(new Set());
  const [createNewHome, setCreateNewHome] = useState(false);
  const [newHomeName, setNewHomeName] = useState("");

  // ---------------------------------------------------------------------------
  // Smart match: pre-check homes that already contain this anlaggnings_id.
  // 
  // NOTE: This is a placeholder for v1. To do this properly we'd need to fetch 
  // the home_properties for each home and check anlaggnings_id matches. For now 
  // we pre-check NOTHING and let the user pick — smart match will be added in 
  // a follow-up.
  // ---------------------------------------------------------------------------
  // TODO: Implement smart match by fetching home_properties via API or RPC.

  // ---------------------------------------------------------------------------
  // Server action wiring
  // ---------------------------------------------------------------------------
  const [actionState, formAction, isPending] = useActionState<
    SaveAnalysisResult | null,
    FormData
  >(saveAnalysis, null);

  // ---------------------------------------------------------------------------
  // Adaptive UI logic
  // ---------------------------------------------------------------------------
  const isFirstTime = myHomes.length === 0;

  const introMessage = useMemo(() => {
    if (isFirstTime) {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>Det här är din första faktura.</strong> Vi skapar
            automatiskt ett hem för dig och kallar det{" "}
            <strong>&quot;Hem på {street || "din adress"}&quot;</strong>. Du kan döpa
            om hemmet senare under Inställningar, eller skapa fler hem om
            fakturan ska tillhöra flera.
          </p>
        </div>
      );
    }
    return null;
  }, [isFirstTime, street]);

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <form action={formAction} className="space-y-6">
      {introMessage}

      {/* Hidden input: serialized state */}
      <input
        type="hidden"
        name="homeii_state_json"
        value={JSON.stringify(state)}
      />

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

      {/* Home picker (only shown when user has existing homes) */}
      {!isFirstTime && (
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="font-medium px-2">Vilka hem?</legend>
          <p className="text-sm text-gray-600">
            Välj vilka hem du vill lägga till fakturan i.
          </p>

          {myHomes.map((home) => (
            <label key={home.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="selected_home_ids"
                value={home.id}
                checked={selectedHomeIds.has(home.id)}
                onChange={(e) => {
                  setSelectedHomeIds((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(home.id);
                    else next.delete(home.id);
                    return next;
                  });
                }}
              />
              <span>{home.name}</span>
            </label>
          ))}

          <label className="flex items-center gap-2 border-t pt-3">
            <input
              type="checkbox"
              name="create_new_home"
              value="true"
              checked={createNewHome}
              onChange={(e) => setCreateNewHome(e.target.checked)}
            />
            <span>Skapa nytt hem...</span>
          </label>

          {createNewHome && (
            <div className="ml-6 mt-2">
              <label htmlFor="new_home_name" className="block text-sm mb-1">
                Hem-namn
              </label>
              <input
                id="new_home_name"
                name="new_home_name"
                type="text"
                required
                maxLength={200}
                value={newHomeName}
                onChange={(e) => setNewHomeName(e.target.value)}
                className="w-full rounded border px-3 py-2"
                placeholder="t.ex. Sommarstugan"
              />
            </div>
          )}
        </fieldset>
      )}

      {/* Error display */}
      {actionState && !actionState.success && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">{actionState.error}</p>
        </div>
      )}

      {/* Submit button */}
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
