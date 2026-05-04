'use client';

import { useActionState } from 'react';
import { saveProfile } from './actions';

const COUNTRIES = [
  { code: '', label: 'Välj land' },
  { code: 'SE', label: 'Sverige (+46)' },
  { code: 'NO', label: 'Norge (+47)' },
  { code: 'DK', label: 'Danmark (+45)' },
  { code: 'FI', label: 'Finland (+358)' },
  { code: 'IS', label: 'Island (+354)' },
];

const REFERRAL_OPTIONS = [
  { value: '', label: 'Välj alternativ' },
  { value: 'google', label: 'Google-sökning' },
  { value: 'social_media', label: 'Sociala medier' },
  { value: 'friend', label: 'Vän eller bekant' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'newspaper', label: 'Tidning eller artikel' },
  { value: 'annat', label: 'Annat' },
];

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from(
  { length: CURRENT_YEAR - 18 - 1925 },
  (_, i) => CURRENT_YEAR - 18 - i,
);

type InitialValues = {
  first_name: string;
  last_name: string;
  phone_country_code: string;
  phone_number: string;
  birth_year: string;
  referral_source: string;
  marketing_consent: boolean;
};

export function ProfileForm({
  email,
  initialValues,
}: {
  email: string;
  initialValues: InitialValues;
}) {
  const [state, formAction, isPending] = useActionState(saveProfile, {});

  return (
    <form action={formAction} className="space-y-6">
      {/* Förnamn */}
      <div>
        <label htmlFor="first_name" className="block text-sm font-medium mb-1">
          Förnamn <span className="text-red-600">*</span>
        </label>
        <input
          id="first_name"
          name="first_name"
          type="text"
          required
          defaultValue={initialValues.first_name}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        {state.fieldErrors?.first_name && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.first_name}</p>
        )}
      </div>

      {/* Efternamn */}
      <div>
        <label htmlFor="last_name" className="block text-sm font-medium mb-1">
          Efternamn <span className="text-red-600">*</span>
        </label>
        <input
          id="last_name"
          name="last_name"
          type="text"
          required
          defaultValue={initialValues.last_name}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        {state.fieldErrors?.last_name && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.last_name}</p>
        )}
      </div>

      {/* Mejl - read only */}
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-600">
          Mejladress
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
        />
      </div>

      {/* Telefon */}
      <div>
        <label className="block text-sm font-medium mb-1">Mobilnummer</label>
        <p className="mb-2 text-xs text-gray-600">Frivilligt.</p>
        <div className="flex gap-2">
          <select
            name="phone_country_code"
            defaultValue={initialValues.phone_country_code}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label}
              </option>
            ))}
          </select>
          <input
            name="phone_number"
            type="tel"
            placeholder="070-123 45 67"
            defaultValue={initialValues.phone_number}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
        {state.fieldErrors?.phone_number && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.phone_number}</p>
        )}
      </div>

      {/* Födelseår */}
      <div>
        <label htmlFor="birth_year" className="block text-sm font-medium mb-1">
          Födelseår
        </label>
        <p className="mb-2 text-xs text-gray-600">Frivilligt.</p>
        <select
          id="birth_year"
          name="birth_year"
          defaultValue={initialValues.birth_year}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="">Välj år</option>
          {BIRTH_YEARS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {state.fieldErrors?.birth_year && (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.birth_year}</p>
        )}
      </div>

      {/* Hur fick du höra om Homeii */}
      <div>
        <label htmlFor="referral_source" className="block text-sm font-medium mb-1">
          Hur fick du höra om Homeii?
        </label>
        <p className="mb-2 text-xs text-gray-600">Frivilligt.</p>
        <select
          id="referral_source"
          name="referral_source"
          defaultValue={initialValues.referral_source}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          {REFERRAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Integritetspolicy */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="privacy_policy_accepted"
            required
            className="mt-0.5"
          />
          <span>
            Jag godkänner Homeiis{' '}
            <a
              href="/om/integritet"
              target="_blank"
              className="text-blue-600 underline"
            >
              integritetspolicy
            </a>{' '}
            och att mina personuppgifter sparas. <span className="text-red-600">*</span>
          </span>
        </label>
      </div>

      {/* Marknadsföringssamtycke */}
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="marketing_consent"
            defaultChecked={initialValues.marketing_consent}
            className="mt-0.5"
          />
          <span>
            Jag vill ha Homeiis nyhetsbrev med tips och nyheter om elmarknaden.
          </span>
        </label>
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isPending ? 'Sparar...' : 'Spara och fortsätt'}
      </button>
    </form>
  );
}