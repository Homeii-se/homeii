-- Migration: fixa update-policy på user_profiles
-- Datum: 2026-05-04
-- Bakgrund: ursprungliga policyn saknade with check-klausul, vilket
-- gjorde att alla updates avvisades med 403 Forbidden av PostgreSQL.
-- Nu lägger vi till matchande with check-klausul.

drop policy if exists "users update own profile" on public.user_profiles;
create policy "users update own profile"
  on public.user_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());