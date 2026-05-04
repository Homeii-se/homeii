'use client';

import { useActionState, useState } from 'react';
import { saveAddress } from './actions';

const STORAGE_KEY = 'homeii-state';

type AddressData = {
  street: string;
  postalCode: string;
  city: string;
  anlaggningsId: string;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'no-data' }
  | { kind: 'ready'; data: AddressData };

export function AddressForm() {
    const [loadState] = useState<LoadState>(() => {
        if (typeof window === 'undefined') return { kind: 'loading' };
    
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (!raw) return { kind: 'no-data' };
    
          const state = JSON.parse(raw);
          const billData = state?.billData;
          if (!billData) return { kind: 'no-data' };
    
          return {
            kind: 'ready',
            data: {
              street: billData.street ?? '',
              postalCode: billData.postalCode ?? '',
              city: billData.city ?? '',
              anlaggningsId: billData.anlaggningsId ?? '',
            },
          };
        } catch (err) {
          console.error('Kunde inte läsa localStorage:', err);
          return { kind: 'no-data' };
        }
      });
  const [formState, formAction, isPending] = useActionState(saveAddress, {});

  if (loadState.kind === 'loading') {
    return <p className="text-sm text-gray-500">Laddar dina uppgifter...</p>;
  }

  if (loadState.kind === 'no-data') {
    return (
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm">
        <p className="mb-2 font-medium">Vi hittar ingen analys att spara.</p>
        <p className="mb-4 text-gray-700">
          Du måste först ladda upp en elräkning för att vi ska kunna spara den.
        </p>
        <a
          href="/analys"
          className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Ladda upp en faktura
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label htmlFor="street" className="block text-sm font-medium mb-1">
          Gata <span className="text-red-600">*</span>
        </label>
        <input
          id="street"
          name="street"
          type="text"
          required
          defaultValue={loadState.data.street}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        {formState.fieldErrors?.street && (
          <p className="mt-1 text-xs text-red-600">{formState.fieldErrors.street}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium mb-1">
            Postnummer <span className="text-red-600">*</span>
          </label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            required
            inputMode="numeric"
            defaultValue={loadState.data.postalCode}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {formState.fieldErrors?.postalCode && (
            <p className="mt-1 text-xs text-red-600">{formState.fieldErrors.postalCode}</p>
          )}
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium mb-1">
            Postort <span className="text-red-600">*</span>
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            defaultValue={loadState.data.city}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
          {formState.fieldErrors?.city && (
            <p className="mt-1 text-xs text-red-600">{formState.fieldErrors.city}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="anlaggningsId" className="block text-sm font-medium mb-1">
          Anläggnings-ID <span className="text-red-600">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-600">
          18-siffrig identifierare för din mätarpunkt. Står på fakturan.
        </p>
        <input
          id="anlaggningsId"
          name="anlaggningsId"
          type="text"
          required
          inputMode="numeric"
          defaultValue={loadState.data.anlaggningsId}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none font-mono"
        />
        {formState.fieldErrors?.anlaggningsId && (
          <p className="mt-1 text-xs text-red-600">{formState.fieldErrors.anlaggningsId}</p>
        )}
      </div>

      {formState.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {formState.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? 'Sparar...' : 'Spara'}
      </button>
    </form>
  );
}