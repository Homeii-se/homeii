import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Skydda /app/*-routes — oautentiserade redirectas till /logga-in
  if (!user && request.nextUrl.pathname.startsWith('/app')) {
    const url = request.nextUrl.clone();
    url.pathname = '/logga-in';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

// Skydda /app/*-routes mot ofullständiga profiler
if (
  user &&
  request.nextUrl.pathname.startsWith('/app') &&
  !request.nextUrl.pathname.startsWith('/app/skapa-profil')
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, privacy_policy_accepted_at')
    .eq('id', user.id)
    .single();

  const isIncomplete =
    !profile?.first_name ||
    !profile?.last_name ||
    !profile?.privacy_policy_accepted_at;

  if (isIncomplete) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/skapa-profil';
    return NextResponse.redirect(url);
  }
}
  return response;
}

export const config = {
  matcher: [
    /*
     * Matcha alla request-paths utom de som börjar med:
     * - _next/static (statiska filer)
     * - _next/image (bildoptimering)
     * - favicon.ico
     * - api/ (API-routes hanterar egen auth)
     * - publika filer (.svg, .png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};