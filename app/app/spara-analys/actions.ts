'use server';

import { createClient } from '@/lib/supabase/server';

type AddressFormState = {
  error?: string;
  fieldErrors?: {
    street?: string;
    postalCode?: string;
    city?: string;
    anlaggningsId?: string;
  };
};

export async function saveAddress(
  _prevState: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Du är inte inloggad.' };
  }

  // Hämta värden
  const street = formData.get('street')?.toString().trim() ?? '';
  const postalCode = formData.get('postalCode')?.toString().trim() ?? '';
  const city = formData.get('city')?.toString().trim() ?? '';
  const anlaggningsIdRaw = formData.get('anlaggningsId')?.toString().trim() ?? '';

  // Validering
  const fieldErrors: AddressFormState['fieldErrors'] = {};

  if (!street) fieldErrors.street = 'Gata krävs.';
  else if (street.length > 200) fieldErrors.street = 'Gata är för lång.';

  // Postnummer: 5 siffror, mellanslag tillåts men trimmas bort
  const postalCodeDigits = postalCode.replace(/\s/g, '');
  if (!postalCodeDigits) fieldErrors.postalCode = 'Postnummer krävs.';
  else if (!/^\d{5}$/.test(postalCodeDigits))
    fieldErrors.postalCode = 'Postnummer måste vara 5 siffror.';

  if (!city) fieldErrors.city = 'Postort krävs.';
  else if (city.length > 100) fieldErrors.city = 'Postort är för lång.';

  // Anläggnings-ID: 18 siffror exakt, mellanslag tillåts men trimmas bort
  const anlaggningsIdDigits = anlaggningsIdRaw.replace(/\s/g, '');
  if (!anlaggningsIdDigits) fieldErrors.anlaggningsId = 'Anläggnings-ID krävs.';
  else if (!/^\d{18}$/.test(anlaggningsIdDigits))
    fieldErrors.anlaggningsId = 'Anläggnings-ID måste vara 18 siffror.';

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // Logga vad vi skulle spara - PR #9C implementerar databas-skrivning
  console.log('[SAVE-ADDRESS] Skulle spara:', {
    user_id: user.id,
    street,
    postal_code: postalCodeDigits,
    city,
    anlaggnings_id: anlaggningsIdDigits,
  });

  return {
    error:
      'PR #9B är klar. Databas-skrivning kommer i PR #9C. Kolla console-loggen i Vercel.',
  };
}