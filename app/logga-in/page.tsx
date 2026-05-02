'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus({ kind: 'sending' });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus({ kind: 'error', message: error.message });
    } else {
      setStatus({ kind: 'sent' });
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus({ kind: 'error', message: error.message });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold">Logga in</h1>
      <p className="mb-8 text-sm text-gray-600">
        Få inloggningslänk via mejl eller logga in med Google.
      </p>

      <form onSubmit={handleMagicLink} className="space-y-3">
        <label htmlFor="email" className="block text-sm font-medium">
          Mejladress
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="namn@exempel.se"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
          disabled={status.kind === 'sending' || status.kind === 'sent'}
        />
        <button
          type="submit"
          disabled={status.kind === 'sending' || status.kind === 'sent'}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {status.kind === 'sending' ? 'Skickar...' : 'Skicka inloggningslänk'}
        </button>
      </form>

      {status.kind === 'sent' && (
        <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
          Vi har skickat en inloggningslänk till {email}. Kolla din inkorg.
        </p>
      )}

      {status.kind === 'error' && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Något gick fel: {status.message}
        </p>
      )}

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-500">eller</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <button
        onClick={handleGoogle}
        className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Logga in med Google
      </button>
    </main>
  );
}