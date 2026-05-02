'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
    >
      Logga ut
    </button>
  );
}