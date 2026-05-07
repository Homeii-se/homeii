// File: app/app/hem/create-home-modal.tsx
// NEW FILE.

"use client";

import { useActionState, useEffect, useState } from "react";
import { createHome, type CreateHomeResult } from "./actions";

interface CreateHomeModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateHomeModal({ open, onClose }: CreateHomeModalProps) {
  const [name, setName] = useState("");
  const [actionState, formAction, isPending] = useActionState<
    CreateHomeResult | null,
    FormData
  >(createHome, null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset name when modal opens. Intentional: fresh field on each open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-home-title"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-home-title" className="text-lg font-medium">
            Skapa nytt hem
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Ge ditt nya hem ett namn. Du kan döpa om det senare.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="home_name"
              className="mb-1 block text-sm font-medium"
            >
              Hem-namn
            </label>
            <input
              id="home_name"
              name="name"
              type="text"
              required
              maxLength={200}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Sommarstugan"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {actionState && !actionState.success && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-900">{actionState.error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isPending || name.trim().length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {isPending ? "Skapar..." : "Skapa hem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
