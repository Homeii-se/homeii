// File: lib/components/HomePicker.tsx
// NEW FILE.

"use client";

import { useMemo } from "react";

export interface HomePickerHome {
  id: string;
  name: string;
  /** anlaggnings_id values for all real, non-deleted home_properties in this home */
  anlaggnings_ids: string[];
}

interface HomePickerProps {
  /** All homes the user is an active member of */
  myHomes: HomePickerHome[];
  /** anlaggnings_id from the parsed invoice (used for smart match) */
  anlaggningsId: string;
  /** street name for default home name when first-time */
  street: string;
  /** Currently selected home IDs */
  selectedHomeIds: Set<string>;
  /** Callback when selection changes */
  onSelectedHomeIdsChange: (next: Set<string>) => void;
  /** Whether user has chosen "create new home" */
  createNewHome: boolean;
  onCreateNewHomeChange: (value: boolean) => void;
  /** New home name (when createNewHome is true) */
  newHomeName: string;
  onNewHomeNameChange: (value: string) => void;
  /** A home_id to pre-select (e.g. via ?home_id query param). 
   *  If set, this home is added to selectedHomeIds on mount. */
  preselectedHomeId?: string;
}

/**
 * Reusable home-picker for both anonymous-then-login (/app/spara-analys) 
 * and authenticated (/app/skapa-analys) flows.
 *
 * Renders:
 *   - Adaptive intro message (first-time / 1 match / multiple matches / no match)
 *   - Checkbox list of homes with "(matchande anläggning)" badge
 *   - "Skapa nytt hem" with name input
 *
 * Smart match: pre-checks homes whose home_properties have an anlaggnings_id 
 * matching the invoice. The parent component is responsible for initializing 
 * selectedHomeIds — this component reads/writes via the controlled props.
 */
export function HomePicker({
  myHomes,
  anlaggningsId,
  street,
  selectedHomeIds,
  onSelectedHomeIdsChange,
  createNewHome,
  onCreateNewHomeChange,
  newHomeName,
  onNewHomeNameChange,
}: HomePickerProps) {
  const isFirstTime = myHomes.length === 0;

  // Smart match: which homes contain this anlaggnings_id?
  const matchingHomes = useMemo(() => {
    if (!anlaggningsId || anlaggningsId.length !== 18) return [];
    return myHomes.filter((h) => h.anlaggnings_ids.includes(anlaggningsId));
  }, [myHomes, anlaggningsId]);

  // Adaptive intro message
  const introMessage = useMemo(() => {
    if (isFirstTime) {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>Det här är din första faktura.</strong> Vi skapar
            automatiskt ett hem för dig och kallar det{" "}
            <strong>&quot;Hem på {street || "din adress"}&quot;</strong>. Du
            kan döpa om hemmet senare under Inställningar, eller skapa fler
            hem om fakturan ska tillhöra flera.
          </p>
        </div>
      );
    }

    if (matchingHomes.length === 1) {
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-6">
          <p className="text-sm text-green-900">
            Den här anläggningen finns redan i{" "}
            <strong>&quot;{matchingHomes[0].name}&quot;</strong>. För att
            bara lägga till den där tryck Spara, annars välj vilket/vilka
            hem du vill lägga till fakturan i.
          </p>
        </div>
      );
    }

    if (matchingHomes.length > 1) {
      const names = matchingHomes.map((h) => `"${h.name}"`);
      const formatted =
        names.length === 2
          ? `${names[0]} och ${names[1]}`
          : `${names.slice(0, -1).join(", ")} och ${names[names.length - 1]}`;
      return (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-6">
          <p className="text-sm text-green-900">
            Den här anläggningen finns redan i <strong>{formatted}</strong>.
            För att lägga till den där tryck Spara, annars välj vilka hem du
            vill lägga till fakturan i.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-6">
        <p className="text-sm text-gray-900">
          Vi kunde inte hitta liknande fakturor i något befintligt hem. Välj
          vilket/vilka hem du vill lägga till fakturan i.
        </p>
      </div>
    );
  }, [isFirstTime, matchingHomes, street]);

  // First-time: render only the intro message and (optionally) name field.
  // No checkbox list to choose from.
  if (isFirstTime) {
    return (
      <fieldset className="space-y-3">
        {introMessage}
      </fieldset>
    );
  }

  // Has homes: render intro + checkbox list + "create new home"
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="font-medium px-2">Vilka hem?</legend>

      {introMessage}

      {myHomes.map((home) => {
        const isMatching = matchingHomes.some((m) => m.id === home.id);
        return (
          <label key={home.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedHomeIds.has(home.id)}
              onChange={(e) => {
                const next = new Set(selectedHomeIds);
                if (e.target.checked) next.add(home.id);
                else next.delete(home.id);
                onSelectedHomeIdsChange(next);
              }}
            />
            <span>
              {home.name}
              {isMatching && (
                <span className="ml-2 text-xs text-green-700">
                  (matchande anläggning)
                </span>
              )}
            </span>
          </label>
        );
      })}

      <label className="flex items-center gap-2 border-t pt-3">
        <input
          type="checkbox"
          checked={createNewHome}
          onChange={(e) => onCreateNewHomeChange(e.target.checked)}
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
            type="text"
            required
            maxLength={200}
            value={newHomeName}
            onChange={(e) => onNewHomeNameChange(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="t.ex. Sommarstugan"
          />
        </div>
      )}
    </fieldset>
  );
}
