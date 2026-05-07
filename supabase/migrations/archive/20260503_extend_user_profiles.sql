-- Migration: utöka user_profiles för registreringsformulär
-- Datum: 2026-05-03
-- Bakgrund: lägger till fält som samlas in vid kontoskapande
-- (förnamn, efternamn, mobilnummer, födelseår, samtycken).
-- Tar bort full_name som ersätts av first_name + last_name.

alter table public.user_profiles drop column if exists full_name;

alter table public.user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone_country_code text,
  add column if not exists phone_number text,
  add column if not exists birth_year integer,
  add column if not exists referral_source text,
  add column if not exists privacy_policy_accepted_at timestamptz,
  add column if not exists marketing_consent boolean not null default false;

-- Constraints (separat eftersom add column med constraint är knepigt med if not exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_phone_country_code_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_phone_country_code_check
      check (phone_country_code in ('SE', 'NO', 'DK', 'FI', 'IS') or phone_country_code is null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_profiles_birth_year_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_birth_year_check
      check (birth_year between 1900 and 2010 or birth_year is null);
  end if;
end $$;