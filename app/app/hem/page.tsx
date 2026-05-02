import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from './logout-button';

export default async function HemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold">Hem</h1>
      <p className="mb-8 text-sm text-gray-600">
        Stub-sida för Mina sidor. Kommer ersättas av riktigt dashboard.
      </p>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
        <p className="mb-2 font-medium">Du är inloggad som:</p>
        <p className="text-gray-700">{user?.email}</p>
      </div>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}