import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AddressForm } from './address-form';

export default async function SparaAnalysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/logga-in?next=/app/spara-analys');
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold">Bekräfta din adress</h1>
      <p className="mb-8 text-sm text-gray-600">
        Vi har läst följande från din faktura. Kontrollera att uppgifterna stämmer
        innan vi sparar analysen permanent.
      </p>

      <AddressForm />
    </main>
  );
}