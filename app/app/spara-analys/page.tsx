import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function SparaAnalysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/logga-in?next=/app/spara-analys');
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold">Spara din analys</h1>
      <p className="mb-8 text-sm text-gray-600">
        Stub-sida. Här kommer användaren bekräfta adressen från fakturan och
        spara analysen permanent. Implementeras i PR #9B.
      </p>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
        <p className="mb-2 font-medium">Du är inloggad som:</p>
        <p className="text-gray-700">{user.email}</p>
        <p className="mt-4 text-xs text-gray-500">
          Analysdata finns i din browsers localStorage under nyckeln{' '}
          <code className="rounded bg-gray-200 px-1">homeii-state</code>.
        </p>
      </div>
    </main>
  );
}