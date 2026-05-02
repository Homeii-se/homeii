/**
 * Supabase-klient för browser/client components.
 *
 * Används i React-komponenter som körs i webbläsaren.
 * För server-side (route handlers, server components, middleware), använd
 * lib/supabase/server.ts istället.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
