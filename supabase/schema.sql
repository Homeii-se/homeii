-- Homeii — Mina sidor v1, databasschema
-- ============================================================
-- Baserat på MINA-SIDOR-ARKITEKTUR.md (uppdaterad 2026-04-30)
--
-- Designprinciper:
--   * konsumtions-anläggningsID = primary key för "ett hem"
--   * Adress = metadata ovanför mätarpunkter (flera kan dela adress)
--   * Användare attacheras till mätarpunkter via members-join (owner/member/read_only)
--   * Soft delete via deleted_at-kolumner (GDPR-vänligt)
--   * RLS slås på alla tabeller — defaults är restrictive
--   * Strukturerade data där typer är stabila (home_profile)
--   * jsonb där datatypen kan växa (analyses.result, home_equipment.equipment_data)
--   * Idempotenta create-statements så scriptet kan köras om vid behov
--   * En källa till sanning: data som finns på fakturan dupliceras inte i home_profile
--
-- Kör i Supabase SQL Editor i ordning. Tabellerna har FK-beroenden
-- så ordningen spelar roll.
-- ============================================================


-- ============================================================
-- HJÄLPFUNKTIONER (skapas först — används av RLS-policies)
-- ============================================================

create or replace function public.user_is_member(p_anlaggnings_id text)
returns boolean as $$
  select exists (
    select 1 from public.metering_point_members
    where user_id = auth.uid()
      and anlaggnings_id = p_anlaggnings_id
      and left_at is null
  );
$$ language sql security definer stable;

create or replace function public.user_is_owner(p_anlaggnings_id text)
returns boolean as $$
  select exists (
    select 1 from public.metering_point_members
    where user_id = auth.uid()
      and anlaggnings_id = p_anlaggnings_id
      and role = 'owner'
      and left_at is null
  );
$$ language sql security definer stable;

-- Skrivbehörighet: owner och member kan skriva, read_only kan inte
create or replace function public.user_can_write(p_anlaggnings_id text)
returns boolean as $$
  select exists (
    select 1 from public.metering_point_members
    where user_id = auth.uid()
      and anlaggnings_id = p_anlaggnings_id
      and role in ('owner', 'member')
      and left_at is null
  );
$$ language sql security definer stable;

create or replace function public.user_email_matches(p_email text)
returns boolean as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = p_email
  );
$$ language sql security definer stable;


-- ============================================================
-- 1. user_profiles
-- ============================================================

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null unique,
  tier text not null default 'bas' check (tier in ('bas', 'premium')),
  notification_email boolean not null default true,

  -- Plats för framtida Stripe-integration (prio 3)
  subscription_status text check (subscription_status in ('active', 'canceled', 'past_due')),
  subscription_external_id text,
  subscription_active_until timestamptz,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-skapa profil när någon registrerar sig via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. addresses
-- ============================================================

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),

  street text not null,
  postal_code text not null,
  city text not null,
  municipality text,
  county text,
  country text not null default 'SE',

  latitude double precision,
  longitude double precision,

  building_type text check (building_type in ('villa', 'lagenhet', 'radhus', 'fritidshus') or building_type is null),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 3. consumption_metering_points
-- ============================================================

create table if not exists public.consumption_metering_points (
  anlaggnings_id text primary key,

  address_id uuid not null references public.addresses(id),

  display_name text,
  apartment_number text,
  grid_operator text,
  zone text check (zone in ('SE1', 'SE2', 'SE3', 'SE4') or zone is null),
  country text not null default 'SE',

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 4. production_metering_points
-- ============================================================
-- En solcellsanläggning per konsumtionspunkt (säkras via unique constraint).

create table if not exists public.production_metering_points (
  anlaggnings_id text primary key,

  consumption_anlaggnings_id text not null unique
    references public.consumption_metering_points(anlaggnings_id),

  installed_capacity_kw numeric,
  installation_date date,
  panel_orientation text check (panel_orientation in ('south', 'east', 'west', 'east_west', 'mixed', 'other') or panel_orientation is null),

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 5. metering_point_members
-- ============================================================
-- Tre roller: owner (full kontroll), member (läs+skriv), read_only (bara läs).
-- En användare har en separat rad per fastighet, så roller per fastighet är oberoende.

create table if not exists public.metering_point_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  role text not null default 'member' check (role in ('owner', 'member', 'read_only')),

  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz not null default now(),

  left_at timestamptz,

  primary key (user_id, anlaggnings_id)
);

-- Bara en aktiv ägare per mätarpunkt
create unique index if not exists idx_one_active_owner_per_metering_point
  on public.metering_point_members(anlaggnings_id)
  where role = 'owner' and left_at is null;

-- Snabb "vilka mätpunkter har den här användaren"
create index if not exists idx_active_memberships_per_user
  on public.metering_point_members(user_id)
  where left_at is null;


-- ============================================================
-- 6. metering_point_invitations
-- ============================================================

create table if not exists public.metering_point_invitations (
  id uuid primary key default gen_random_uuid(),

  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  invited_email text not null,
  invited_by uuid not null references auth.users(id),

  -- Roll som inbjudan ska resultera i vid accept
  invited_role text not null default 'member' check (invited_role in ('member', 'read_only')),

  token uuid not null unique default gen_random_uuid(),

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz
);

create index if not exists idx_invitations_email_pending
  on public.metering_point_invitations(invited_email)
  where status = 'pending';


-- ============================================================
-- 7. documents (fakturor och offerter)
-- ============================================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),

  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  uploaded_by uuid references auth.users(id),

  document_type text not null check (document_type in ('invoice', 'offer')),

  -- Tidsperiod (relevant för fakturor, kan vara null för offerter)
  period_start date,
  period_end date,

  -- PDF i Supabase Storage
  pdf_storage_path text,
  pdf_size_bytes integer,

  -- Råparsad data från Anthropic-parsning
  parsed_data jsonb not null,

  -- Denormaliserade fält för snabb query (null för offerter)
  total_kr numeric,
  consumption_kwh numeric,
  spot_price_ore_kwh numeric,
  electricity_supplier text,

  parser_version text,
  parsed_at timestamptz not null default now(),

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_metering_period
  on public.documents(anlaggnings_id, period_start);

create index if not exists idx_documents_type
  on public.documents(anlaggnings_id, document_type);


-- ============================================================
-- 8. analyses
-- ============================================================
-- En analys är vad Homeii-modellen producerar för ett dokument.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),

  document_id uuid not null references public.documents(id),
  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  analysis_type text not null check (analysis_type in ('invoice_analysis', 'offer_review')),

  -- Resultatet — struktur skiljer sig per analysis_type, definieras i applikationen
  result jsonb not null,

  -- Är detta den analys som "uppföljning" jämför mot?
  is_reference boolean not null default false,

  analysis_version text,

  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bara en aktiv referens-analys per mätpunkt
create unique index if not exists idx_one_reference_analysis
  on public.analyses(anlaggnings_id)
  where is_reference = true and deleted_at is null;

create index if not exists idx_analyses_document
  on public.analyses(document_id);


-- ============================================================
-- 9. home_profile
-- ============================================================
-- Stabila kärnattribut. Strukturerade fält där typerna är låsta.

create table if not exists public.home_profile (
  anlaggnings_id text primary key
    references public.consumption_metering_points(anlaggnings_id),

  heating_type text check (heating_type in (
    'heat_pump_air', 'heat_pump_geothermal', 'heat_pump_exhaust',
    'district', 'electric_direct', 'wood', 'oil', 'gas', 'mixed', 'other'
  ) or heating_type is null),

  living_area_m2 integer,
  num_residents integer,
  building_year integer,

  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);


-- ============================================================
-- 10. home_equipment
-- ============================================================
-- Key-value med jsonb. Listan över utrustning kan växa utan migration.
-- equipment_data är strukturerad jsonb — TypeScript-typer i lib/types/home-equipment.ts
-- är källa till sanning för strukturen.

create table if not exists public.home_equipment (
  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  equipment_key text not null,
  equipment_data jsonb not null,

  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  primary key (anlaggnings_id, equipment_key)
);


-- ============================================================
-- 11. consumption_data
-- ============================================================

create table if not exists public.consumption_data (
  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  period_type text not null
    check (period_type in ('hourly', 'daily', 'monthly', 'invoice')),
  period_start timestamptz not null,
  period_end timestamptz not null,

  consumption_kwh numeric not null,

  source text not null
    check (source in ('invoice', 'elhandelscentral', 'manual', 'estimated')),
  source_document_id uuid references public.documents(id),

  recorded_at timestamptz not null default now(),

  primary key (anlaggnings_id, period_type, period_start)
);


-- ============================================================
-- TRANSFER OWNERSHIP — atomic swap
-- ============================================================
-- Anropas från frontend när nuvarande ägare överför ägarskap till en annan medlem.
-- Sker som atomisk operation så det aldrig finns två aktiva ägare samtidigt.

create or replace function public.transfer_ownership(
  p_anlaggnings_id text,
  p_new_owner_id uuid
)
returns void as $$
begin
  -- Verifiera att den som anropar är nuvarande ägare
  if not public.user_is_owner(p_anlaggnings_id) then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  -- Verifiera att mottagaren redan är aktiv medlem
  if not exists (
    select 1 from public.metering_point_members
    where user_id = p_new_owner_id
      and anlaggnings_id = p_anlaggnings_id
      and left_at is null
  ) then
    raise exception 'New owner must already be an active member of the metering point';
  end if;

  -- Atomisk swap inom samma transaktion
  update public.metering_point_members
  set role = 'member'
  where user_id = auth.uid()
    and anlaggnings_id = p_anlaggnings_id;

  update public.metering_point_members
  set role = 'owner'
  where user_id = p_new_owner_id
    and anlaggnings_id = p_anlaggnings_id;
end;
$$ language plpgsql security definer;


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.user_profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.consumption_metering_points enable row level security;
alter table public.production_metering_points enable row level security;
alter table public.metering_point_members enable row level security;
alter table public.metering_point_invitations enable row level security;
alter table public.documents enable row level security;
alter table public.analyses enable row level security;
alter table public.home_profile enable row level security;
alter table public.home_equipment enable row level security;
alter table public.consumption_data enable row level security;


-- ------------------------------------------------------------
-- user_profiles
-- ------------------------------------------------------------
drop policy if exists "users see own profile" on public.user_profiles;
create policy "users see own profile"
  on public.user_profiles for select
  using (id = auth.uid());

drop policy if exists "users update own profile" on public.user_profiles;
create policy "users update own profile"
  on public.user_profiles for update
  using (id = auth.uid());


-- ------------------------------------------------------------
-- consumption_metering_points
-- ------------------------------------------------------------
drop policy if exists "members see metering points" on public.consumption_metering_points;
create policy "members see metering points"
  on public.consumption_metering_points for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers update metering points" on public.consumption_metering_points;
create policy "writers update metering points"
  on public.consumption_metering_points for update
  using (public.user_can_write(anlaggnings_id));

drop policy if exists "owners delete metering points" on public.consumption_metering_points;
create policy "owners delete metering points"
  on public.consumption_metering_points for delete
  using (public.user_is_owner(anlaggnings_id));


-- ------------------------------------------------------------
-- addresses
-- ------------------------------------------------------------
drop policy if exists "members see linked addresses" on public.addresses;
create policy "members see linked addresses"
  on public.addresses for select
  using (
    exists (
      select 1 from public.consumption_metering_points cmp
      where cmp.address_id = addresses.id
        and public.user_is_member(cmp.anlaggnings_id)
    )
  );

drop policy if exists "writers update linked addresses" on public.addresses;
create policy "writers update linked addresses"
  on public.addresses for update
  using (
    exists (
      select 1 from public.consumption_metering_points cmp
      where cmp.address_id = addresses.id
        and public.user_can_write(cmp.anlaggnings_id)
    )
  );


-- ------------------------------------------------------------
-- production_metering_points
-- ------------------------------------------------------------
drop policy if exists "members see production points" on public.production_metering_points;
create policy "members see production points"
  on public.production_metering_points for select
  using (public.user_is_member(consumption_anlaggnings_id));

drop policy if exists "writers manage production points" on public.production_metering_points;
create policy "writers manage production points"
  on public.production_metering_points for insert
  with check (public.user_can_write(consumption_anlaggnings_id));

drop policy if exists "writers update production points" on public.production_metering_points;
create policy "writers update production points"
  on public.production_metering_points for update
  using (public.user_can_write(consumption_anlaggnings_id));

drop policy if exists "writers delete production points" on public.production_metering_points;
create policy "writers delete production points"
  on public.production_metering_points for delete
  using (public.user_can_write(consumption_anlaggnings_id));


-- ------------------------------------------------------------
-- metering_point_members
-- ------------------------------------------------------------
drop policy if exists "members see fellow members" on public.metering_point_members;
create policy "members see fellow members"
  on public.metering_point_members for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers can invite new members" on public.metering_point_members;
create policy "writers can invite new members"
  on public.metering_point_members for insert
  with check (
    public.user_can_write(anlaggnings_id)
    and role in ('member', 'read_only')
  );

drop policy if exists "owners manage member roles" on public.metering_point_members;
create policy "owners manage member roles"
  on public.metering_point_members for update
  using (public.user_is_owner(anlaggnings_id));

drop policy if exists "owners remove members" on public.metering_point_members;
create policy "owners remove members"
  on public.metering_point_members for delete
  using (public.user_is_owner(anlaggnings_id));

drop policy if exists "users leave metering points" on public.metering_point_members;
create policy "users leave metering points"
  on public.metering_point_members for update
  using (user_id = auth.uid());


-- ------------------------------------------------------------
-- metering_point_invitations
-- ------------------------------------------------------------
drop policy if exists "members see invitations sent" on public.metering_point_invitations;
create policy "members see invitations sent"
  on public.metering_point_invitations for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers create invitations" on public.metering_point_invitations;
create policy "writers create invitations"
  on public.metering_point_invitations for insert
  with check (public.user_can_write(anlaggnings_id));

drop policy if exists "users see invitations to their email" on public.metering_point_invitations;
create policy "users see invitations to their email"
  on public.metering_point_invitations for select
  using (public.user_email_matches(invited_email));

drop policy if exists "users respond to their invitations" on public.metering_point_invitations;
create policy "users respond to their invitations"
  on public.metering_point_invitations for update
  using (public.user_email_matches(invited_email));


-- ------------------------------------------------------------
-- documents
-- ------------------------------------------------------------
drop policy if exists "members see documents" on public.documents;
create policy "members see documents"
  on public.documents for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers upload documents" on public.documents;
create policy "writers upload documents"
  on public.documents for insert
  with check (public.user_can_write(anlaggnings_id));

drop policy if exists "writers update documents" on public.documents;
create policy "writers update documents"
  on public.documents for update
  using (public.user_can_write(anlaggnings_id));

drop policy if exists "writers delete documents" on public.documents;
create policy "writers delete documents"
  on public.documents for delete
  using (public.user_can_write(anlaggnings_id));


-- ------------------------------------------------------------
-- analyses
-- ------------------------------------------------------------
drop policy if exists "members see analyses" on public.analyses;
create policy "members see analyses"
  on public.analyses for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers create analyses" on public.analyses;
create policy "writers create analyses"
  on public.analyses for insert
  with check (public.user_can_write(anlaggnings_id));

drop policy if exists "writers update analyses" on public.analyses;
create policy "writers update analyses"
  on public.analyses for update
  using (public.user_can_write(anlaggnings_id));


-- ------------------------------------------------------------
-- home_profile
-- ------------------------------------------------------------
drop policy if exists "members see home profile" on public.home_profile;
create policy "members see home profile"
  on public.home_profile for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers upsert home profile" on public.home_profile;
create policy "writers upsert home profile"
  on public.home_profile for insert
  with check (public.user_can_write(anlaggnings_id));

drop policy if exists "writers update home profile" on public.home_profile;
create policy "writers update home profile"
  on public.home_profile for update
  using (public.user_can_write(anlaggnings_id));


-- ------------------------------------------------------------
-- home_equipment
-- ------------------------------------------------------------
drop policy if exists "members see home equipment" on public.home_equipment;
create policy "members see home equipment"
  on public.home_equipment for select
  using (public.user_is_member(anlaggnings_id));

drop policy if exists "writers upsert home equipment" on public.home_equipment;
create policy "writers upsert home equipment"
  on public.home_equipment for insert
  with check (public.user_can_write(anlaggnings_id));

drop policy if exists "writers update home equipment" on public.home_equipment;
create policy "writers update home equipment"
  on public.home_equipment for update
  using (public.user_can_write(anlaggnings_id));

drop policy if exists "writers delete home equipment" on public.home_equipment;
create policy "writers delete home equipment"
  on public.home_equipment for delete
  using (public.user_can_write(anlaggnings_id));


-- ------------------------------------------------------------
-- consumption_data
-- ------------------------------------------------------------
drop policy if exists "members see consumption data" on public.consumption_data;
create policy "members see consumption data"
  on public.consumption_data for select
  using (public.user_is_member(anlaggnings_id));


-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Skapa bucket "documents" via Supabase Studio → Storage → New bucket.
-- Sätt private = true. RLS-policys på bucket-objekten:
--
--   create policy "members read document pdfs"
--     on storage.objects for select
--     using (
--       bucket_id = 'documents'
--       and exists (
--         select 1 from public.documents d
--         where d.pdf_storage_path = storage.objects.name
--           and public.user_is_member(d.anlaggnings_id)
--       )
--     );
--
--   create policy "writers upload document pdfs"
--     on storage.objects for insert
--     with check (
--       bucket_id = 'documents'
--       and exists (
--         select 1 from public.documents d
--         where d.pdf_storage_path = storage.objects.name
--           and public.user_can_write(d.anlaggnings_id)
--       )
--     );
--
-- (Liknande för update/delete enligt samma princip.)


-- ============================================================
-- TRIGGERS för updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_addresses_updated on public.addresses;
create trigger trg_addresses_updated
  before update on public.addresses
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_consumption_mp_updated on public.consumption_metering_points;
create trigger trg_consumption_mp_updated
  before update on public.consumption_metering_points
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_production_mp_updated on public.production_metering_points;
create trigger trg_production_mp_updated
  before update on public.production_metering_points
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_documents_updated on public.documents;
create trigger trg_documents_updated
  before update on public.documents
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_home_profile_updated on public.home_profile;
create trigger trg_home_profile_updated
  before update on public.home_profile
  for each row execute procedure public.set_updated_at();

drop trigger if exists trg_home_equipment_updated on public.home_equipment;
create trigger trg_home_equipment_updated
  before update on public.home_equipment
  for each row execute procedure public.set_updated_at();
