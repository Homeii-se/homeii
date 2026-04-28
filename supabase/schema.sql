-- ============================================================
-- Homeii — Mina sidor v1, databasschema
-- ============================================================
-- Baserat på MINA-SIDOR-ARKITEKTUR.md (2026-04-28)
--
-- Designprinciper:
--   * konsumtions-anläggningsID = primary key för "ett hem"
--   * Adress = metadata ovanför mätarpunkter (flera kan dela adress)
--   * Användare attacheras till mätarpunkter via members-join
--   * Soft delete via deleted_at-kolumner (GDPR-vänligt)
--   * RLS slås på alla tabeller — defaults är restrictive
--
-- Kör i Supabase SQL Editor i ordning. Tabellerna har FK-beroenden
-- så ordningen spelar roll.
-- ============================================================


-- ------------------------------------------------------------
-- 1. user_profiles  — applikationsdata kopplad till Supabase Auth
-- ------------------------------------------------------------
-- auth.users hanteras av Supabase Auth (skapas automatiskt vid signup).
-- Vi extends med profilinfo i public-schemat.

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,                          -- speglas från auth.users för bekvämlighet
  tier text not null default 'bas',             -- 'bas' | 'premium'
  notification_email boolean not null default true,
  deleted_at timestamptz,                       -- soft delete
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ------------------------------------------------------------
-- 2. addresses  — fysisk plats (gata/postnr/stad)
-- ------------------------------------------------------------
-- Flera mätarpunkter kan dela adress (BRF, hus med separat garage-mätare).

create table public.addresses (
  id uuid primary key default gen_random_uuid(),

  -- Adressfält (auto-extraheras från fakturan, bekräftas av användaren)
  street text not null,                         -- "Storgatan 5"
  postal_code text not null,                    -- "11333"
  city text not null,                           -- "Stockholm"
  municipality text,                            -- kommun — för grid operator inference
  county text,                                  -- län — för SE1-SE4 zone derivation
  country text not null default 'SE',

  -- Geokodning (för PVGIS solberäkningar)
  latitude double precision,
  longitude double precision,

  -- Bostadstyp — för benchmarking i Teaser-analysen
  building_type text,                           -- 'villa' | 'lagenhet' | 'radhus' | 'fritidshus'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 3. consumption_metering_points  — "ETT HEM" i Homeii
-- ------------------------------------------------------------
-- PK = svenskt konsumtions-anläggningsID (typiskt 18 siffror, men text för säkerhets skull).
-- Det här är navet — fakturor, medlemmar och konsumtionsdata hänger på denna.

create table public.consumption_metering_points (
  anlaggnings_id text primary key,              -- ex "735999100000000123"

  address_id uuid not null references public.addresses(id),

  -- Display-namn (defaultas till adress, kan döpas om av användaren —
  -- "Storgatan 5 (huvud)" vs "Storgatan 5 (garage)")
  display_name text,

  -- Mätarpunkt-metadata
  apartment_number text,                        -- "lgh 1101" om relevant
  grid_operator text,                           -- "Vattenfall Eldistribution AB"
  zone text check (zone in ('SE1', 'SE2', 'SE3', 'SE4')),

  deleted_at timestamptz,                       -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 4. production_metering_points  — solcells-anläggning (valfri)
-- ------------------------------------------------------------
-- Endast för solcellshushåll. Hänger på sin konsumtions-anläggning.

create table public.production_metering_points (
  anlaggnings_id text primary key,              -- separat ID för inmatning

  consumption_anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  installed_capacity_kw numeric,                -- ex 8.5
  installation_date date,
  panel_orientation text,                       -- 'south' | 'east-west' | 'mixed'

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 5. metering_point_members  — vem har tillgång till vilket "hem"
-- ------------------------------------------------------------
-- Join-tabell mellan auth.users och konsumtions-anläggningar.
-- Roll = 'owner' eller 'member'. Bara en aktiv ägare per anläggning.

create table public.metering_point_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  role text not null default 'member' check (role in ('owner', 'member')),

  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz not null default now(),

  left_at timestamptz,                          -- soft delete (när medlem lämnar)

  primary key (user_id, anlaggnings_id)
);

-- Bara en aktiv ägare per mätarpunkt
create unique index idx_one_active_owner_per_metering_point
  on public.metering_point_members(anlaggnings_id)
  where role = 'owner' and left_at is null;


-- ------------------------------------------------------------
-- 6. metering_point_invitations  — pending-invites för adress-medlemskap
-- ------------------------------------------------------------
-- Existerande ägare bjuder in via mejl. Token = engångslänk.

create table public.metering_point_invitations (
  id uuid primary key default gen_random_uuid(),

  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  invited_email text not null,
  invited_by uuid not null references auth.users(id),

  token uuid not null unique default gen_random_uuid(),

  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz
);

create index idx_invitations_email_pending
  on public.metering_point_invitations(invited_email)
  where status = 'pending';


-- ------------------------------------------------------------
-- 7. invoices  — sparad faktura (PDF + parsed JSON)
-- ------------------------------------------------------------
-- Tillhör en mätarpunkt, inte en användare (data tillhör adressen).
-- uploaded_by är bara metadata.

create table public.invoices (
  id uuid primary key default gen_random_uuid(),

  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  uploaded_by uuid references auth.users(id),

  -- Faktura-period
  period_start date not null,
  period_end date not null,

  -- PDF i Supabase Storage
  pdf_storage_path text,                        -- ex "invoices/{user_id}/{uuid}.pdf"
  pdf_size_bytes integer,

  -- Hela strukturerade datan från Anthropic-parsning
  parsed_data jsonb not null,                   -- hela BillData från bill-parser.ts

  -- Denormaliserade fält för snabb query (kopior från parsed_data)
  total_kr numeric,
  consumption_kwh numeric,
  spot_price_ore_kwh numeric,
  electricity_supplier text,

  -- Parser-version (för att kunna re-parsa om modellen blir bättre)
  parser_version text,
  parsed_at timestamptz not null default now(),

  deleted_at timestamptz,                       -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tidsserie-queries
create index idx_invoices_metering_period
  on public.invoices(anlaggnings_id, period_start);


-- ------------------------------------------------------------
-- 8. consumption_data  — finkornig konsumtion (timme/dag/månad)
-- ------------------------------------------------------------
-- För när vi har granulär data, ex från fakturan eller framtida
-- direktuppkoppling till Svenska kraftnäts Elhandelscentral.

create table public.consumption_data (
  anlaggnings_id text not null
    references public.consumption_metering_points(anlaggnings_id),

  period_type text not null
    check (period_type in ('hourly', 'daily', 'monthly', 'invoice')),
  period_start timestamptz not null,
  period_end timestamptz not null,

  consumption_kwh numeric not null,

  source text not null
    check (source in ('invoice', 'elhandelscentral', 'manual', 'estimated')),
  source_invoice_id uuid references public.invoices(id),

  recorded_at timestamptz not null default now(),

  primary key (anlaggnings_id, period_type, period_start)
);


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
-- Slå på RLS på alla tabeller. Default = ingen åtkomst, sen
-- explicita policys för läs/skriv.

alter table public.user_profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.consumption_metering_points enable row level security;
alter table public.production_metering_points enable row level security;
alter table public.metering_point_members enable row level security;
alter table public.metering_point_invitations enable row level security;
alter table public.invoices enable row level security;
alter table public.consumption_data enable row level security;


-- ------------------------------------------------------------
-- Hjälpfunktion: är inloggad användare medlem av denna mätarpunkt?
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- user_profiles: man ser och redigerar bara sin egen profil
-- ------------------------------------------------------------
create policy "users see own profile"
  on public.user_profiles for select
  using (id = auth.uid());

create policy "users update own profile"
  on public.user_profiles for update
  using (id = auth.uid());


-- ------------------------------------------------------------
-- consumption_metering_points: medlemmar har full operativ åtkomst
-- ------------------------------------------------------------
create policy "members see metering points"
  on public.consumption_metering_points for select
  using (public.user_is_member(anlaggnings_id));

create policy "members update metering points"
  on public.consumption_metering_points for update
  using (public.user_is_member(anlaggnings_id));

-- Bara ägare får soft-deleta hela mätarpunkten (= "stäng hemmet")
create policy "owners delete metering points"
  on public.consumption_metering_points for delete
  using (public.user_is_owner(anlaggnings_id));


-- ------------------------------------------------------------
-- addresses: ärver synlighet från medlemskap i mätarpunkt
-- ------------------------------------------------------------
create policy "members see linked addresses"
  on public.addresses for select
  using (
    exists (
      select 1 from public.consumption_metering_points cmp
      where cmp.address_id = addresses.id
        and public.user_is_member(cmp.anlaggnings_id)
    )
  );


-- ------------------------------------------------------------
-- production_metering_points: synlig om du är medlem av kopplad konsumtion
-- ------------------------------------------------------------
create policy "members see production points"
  on public.production_metering_points for select
  using (public.user_is_member(consumption_anlaggnings_id));


-- ------------------------------------------------------------
-- metering_point_members: medlemmar bjuder in, ägare sparkar ut
-- ------------------------------------------------------------
create policy "members see fellow members"
  on public.metering_point_members for select
  using (public.user_is_member(anlaggnings_id));

-- Medlemmar (inkl ägare) får bjuda in nya medlemmar (insert med role='member')
create policy "members can invite new members"
  on public.metering_point_members for insert
  with check (
    public.user_is_member(anlaggnings_id)
    and role = 'member'
  );

-- Bara ägare får ändra roller (t.ex. promota till owner) eller sparka ut
create policy "owners manage member roles"
  on public.metering_point_members for update
  using (public.user_is_owner(anlaggnings_id));

create policy "owners remove members"
  on public.metering_point_members for delete
  using (public.user_is_owner(anlaggnings_id));

-- Användare kan själv lämna en mätarpunkt (uppdatera left_at på sig själv)
create policy "users leave metering points"
  on public.metering_point_members for update
  using (user_id = auth.uid());


-- ------------------------------------------------------------
-- metering_point_invitations: medlemmar skapar/ser, mottagare ser sina
-- ------------------------------------------------------------
create policy "members see invitations sent"
  on public.metering_point_invitations for select
  using (public.user_is_member(anlaggnings_id));

create policy "members create invitations"
  on public.metering_point_invitations for insert
  with check (public.user_is_member(anlaggnings_id));

create policy "users see invitations to their email"
  on public.metering_point_invitations for select
  using (
    invited_email = (
      select email from auth.users where id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- invoices: medlemmar har full operativ åtkomst
-- ------------------------------------------------------------
create policy "members see invoices"
  on public.invoices for select
  using (public.user_is_member(anlaggnings_id));

create policy "members upload invoices"
  on public.invoices for insert
  with check (public.user_is_member(anlaggnings_id));

create policy "members update invoices"
  on public.invoices for update
  using (public.user_is_member(anlaggnings_id));

create policy "members delete invoices"
  on public.invoices for delete
  using (public.user_is_member(anlaggnings_id));


-- ------------------------------------------------------------
-- consumption_data: medlemmar läser
-- ------------------------------------------------------------
create policy "members see consumption data"
  on public.consumption_data for select
  using (public.user_is_member(anlaggnings_id));


-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Skapa bucket "invoices" via Supabase Studio → Storage → New bucket.
-- Sätt private = true. RLS-policys på bucket-objekten:
--
--   create policy "members read invoice pdfs"
--     on storage.objects for select
--     using (
--       bucket_id = 'invoices'
--       and exists (
--         select 1 from public.invoices i
--         where i.pdf_storage_path = storage.objects.name
--           and public.user_is_member(i.anlaggnings_id)
--       )
--     );
--
-- (Liknande för insert/update/delete enligt samma princip.)


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

create trigger trg_user_profiles_updated
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

create trigger trg_addresses_updated
  before update on public.addresses
  for each row execute procedure public.set_updated_at();

create trigger trg_consumption_mp_updated
  before update on public.consumption_metering_points
  for each row execute procedure public.set_updated_at();

create trigger trg_production_mp_updated
  before update on public.production_metering_points
  for each row execute procedure public.set_updated_at();

create trigger trg_invoices_updated
  before update on public.invoices
  for each row execute procedure public.set_updated_at();
