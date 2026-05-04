'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

type ProfileFormState = {
  error?: string;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    birth_year?: string;
  };
};

export async function saveProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Du är inte inloggad.' };
  }

  // Hämta värden
  const firstName = formData.get('first_name')?.toString().trim() ?? '';
  const lastName = formData.get('last_name')?.toString().trim() ?? '';
  const phoneCountryCode = formData.get('phone_country_code')?.toString() || null;
  const phoneNumberRaw = formData.get('phone_number')?.toString().trim() || '';
  const birthYearRaw = formData.get('birth_year')?.toString() || '';
  const referralSource = formData.get('referral_source')?.toString().trim() || null;
  const privacyAccepted = formData.get('privacy_policy_accepted') === 'on';
  const marketingConsent = formData.get('marketing_consent') === 'on';

  // Validering
  const fieldErrors: ProfileFormState['fieldErrors'] = {};

  if (!firstName) fieldErrors.first_name = 'Förnamn krävs.';
  if (!lastName) fieldErrors.last_name = 'Efternamn krävs.';

  // Telefon: båda tomma OK, båda ifyllda OK, mellantillstånd inte OK
  let phoneNumberSaved: string | null = null;
  if (phoneCountryCode && !phoneNumberRaw) {
    fieldErrors.phone_number = 'Ange nummer eller töm landval.';
  } else if (!phoneCountryCode && phoneNumberRaw) {
    fieldErrors.phone_number = 'Välj land först.';
  } else if (phoneCountryCode && phoneNumberRaw) {
    // Trimma allt som inte är siffror
    const digits = phoneNumberRaw.replace(/\D/g, '');
    // Om börjar med 0, trimma den
    const trimmed = digits.startsWith('0') ? digits.slice(1) : digits;
    // Validera längd per land
    const validLength = isValidPhoneLength(phoneCountryCode, trimmed);
    if (!validLength) {
      fieldErrors.phone_number = 'Ogiltigt nummer för valt land.';
    } else {
      phoneNumberSaved = trimmed;
    }
  }

  // Födelseår
  let birthYearSaved: number | null = null;
  if (birthYearRaw) {
    const year = parseInt(birthYearRaw, 10);
    if (isNaN(year) || year < 1926 || year > 2008) {
      fieldErrors.birth_year = 'Ogiltigt år.';
    } else {
      birthYearSaved = year;
    }
  }

  if (!privacyAccepted) {
    return {
      error: 'Du måste acceptera integritetspolicyn för att fortsätta.',
      fieldErrors,
    };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  // Spara
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone_country_code: phoneCountryCode,
      phone_number: phoneNumberSaved,
      birth_year: birthYearSaved,
      referral_source: referralSource,
      privacy_policy_accepted_at: new Date().toISOString(),
      marketing_consent: marketingConsent,
    })
    .eq('id', user.id);

    if (updateError) {
        console.error('Profile update error:', JSON.stringify(updateError, null, 2));
        return { error: 'Kunde inte spara profilen. Försök igen.' };
      }

  revalidatePath('/app');
  redirect('/app/hem');
}

function isValidPhoneLength(countryCode: string, digits: string): boolean {
  switch (countryCode) {
    case 'SE':
      return digits.length === 9;
    case 'NO':
      return digits.length === 8;
    case 'DK':
      return digits.length === 8;
    case 'FI':
      return digits.length >= 6 && digits.length <= 10;
    case 'IS':
      return digits.length === 7;
    default:
      return false;
  }
}