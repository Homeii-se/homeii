import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileForm } from './profile-form';

export default async function SkapaProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/logga-in');
  }

  // Hämta befintlig profil — om den redan är komplett, redirect till /app/hem
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, privacy_policy_accepted_at, phone_country_code, phone_number, birth_year, referral_source, marketing_consent')
    .eq('id', user.id)
    .single();

  if (profile?.privacy_policy_accepted_at && profile.first_name && profile.last_name) {
    redirect('/app/hem');
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold">Skapa din profil</h1>
      <p className="mb-8 text-sm text-gray-600">
        Vi behöver några uppgifter för att skapa ditt konto. Mejl är redan satt
        från din inloggning.
      </p>

      <ProfileForm
        email={user.email ?? ''}
        next={next}
        initialValues={{
          first_name: profile?.first_name ?? '',
          last_name: profile?.last_name ?? '',
          phone_country_code: profile?.phone_country_code ?? '',
          phone_number: profile?.phone_number ?? '',
          birth_year: profile?.birth_year?.toString() ?? '',
          referral_source: profile?.referral_source ?? '',
          marketing_consent: profile?.marketing_consent ?? false,
        }}
      />
    </main>
  );
}