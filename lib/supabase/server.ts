/**
 * Supabase-klient för server-side: route handlers, server components, middleware.
 *
 * Hanterar cookies via Next.js cookies()-API så att sessions följer användaren
 * mellan requests. För browser-side, använd lib/supabase/client.ts.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Anropas från Server Component — kan ignoreras om middleware
            // refreshar sessionen.
          }
        },
      },
    },
  );
}
