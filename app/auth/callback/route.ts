import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Explicit next-param: honour it (e.g. from proxy redirect or SignupCta)
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // No explicit destination — decide based on profile completeness
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, privacy_policy_accepted_at')
          .eq('id', user.id)
          .maybeSingle();

        const hasProfile =
          !!profile?.first_name &&
          !!profile?.last_name &&
          !!profile?.privacy_policy_accepted_at;

        if (hasProfile) {
          return NextResponse.redirect(`${origin}/app/start`);
        }
      }

      // New user or incomplete profile — create profile first, then land on /analys
      return NextResponse.redirect(`${origin}/app/skapa-profil?next=/analys`);
    }
  }

  return NextResponse.redirect(`${origin}/logga-in?error=auth-callback-failed`);
}
