-- ============================================================================
-- Mina sidor — V2 schema (hem-baserad datamodell)
-- ============================================================================
-- 
-- Detta schema ersätter V1 (mätarpunkts-baserad) med V2 (hem-baserad).
-- Se MINA-SIDOR-ARKITEKTUR.md för fullständig beskrivning av datamodellen.
-- 
-- KÖRNINGSORDNING:
--   1. Verifiera att inga riktiga användare finns (auth.users är tomt eller 
--      bara har testkonton)
--   2. Backup av spot_prices om paranoid (vi rör den inte men ändå)
--   3. Kör hela denna fil i Supabase SQL Editor
--   4. Verifiera att alla 13 tabeller skapats + RLS aktiverad
-- 
-- Tabeller som behålls oförändrade: spot_prices, monthly_avg_prices, 
--                                   user_profiles
-- Alla andra tabeller droppas och återskapas med ny struktur.
-- 
-- FÖRUTSÄTTNINGAR från V1 som INTE rörs av detta script:
--   - public.handle_new_user() — auth-trigger-funktion, oförändrad
--   - on_auth_user_created-trigger på auth.users — oförändrad
--   - public.set_updated_at() — generisk trigger-funktion, oförändrad
--     (Definieras dock med CREATE OR REPLACE i Del 3 nedan så den 
--     existerar oavsett om V1 har körts eller inte.)
--   - public.user_email_matches(text) — auth-helper, behålls oförändrad
--     (Definieras dock med CREATE OR REPLACE i Del 4 nedan av samma skäl.)
-- 
-- Fil: supabase/schema.sql (V2)
-- Storage path-konvention: documents/{home_property_id}/{document_id}.pdf
-- 
-- ============================================================================

-- ============================================================================
-- DEL 1: DROP V1-TABELLER OCH FUNKTIONER
-- ============================================================================
-- Funktioner som refererar till V1-tabeller måste droppas innan tabellerna.
-- Ordning: drop tabeller med CASCADE, sedan recreate.

drop function if exists public.transfer_ownership(text, uuid);
drop function if exists public.user_is_member(text);
drop function if exists public.user_is_owner(text);
drop function if exists public.user_can_write(text);

-- Triggers droppas implicit via DROP TABLE CASCADE (förutom på auth.users 
-- som vi inte rör — handle_new_user-triggern överlever).

drop table if exists public.consumption_data cascade;
drop table if exists public.home_equipment cascade;
drop table if exists public.home_profile cascade;
drop table if exists public.analyses cascade;
drop table if exists public.documents cascade;
drop table if exists public.metering_point_invitations cascade;
drop table if exists public.metering_point_members cascade;
drop table if exists public.production_metering_points cascade;
drop table if exists public.consumption_metering_points cascade;
drop table if exists public.addresses cascade;

-- user_profiles: behåll strukturen, rensa rader sker via auth.users-cascade.
-- spot_prices, monthly_avg_prices: rörs inte (utanför schema.sql).

-- ============================================================================
-- DEL 2: SKAPA V2-TABELLER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1: addresses
-- Fysisk plats. Flera home_properties kan dela adress (lägenhetshus).
-- ----------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  street text not null,
  postal_code text not null,
  city text not null,
  kommun text,
  country text not null default 'SE',
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_addresses_postal_code on public.addresses(postal_code);
create index idx_addresses_country on public.addresses(country);

-- ----------------------------------------------------------------------------
-- 2.2: homes
-- Navet i V2. En användarkurerad sammanställning av en eller flera fastigheter.
-- ----------------------------------------------------------------------------
create table public.homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_homes_created_by on public.homes(created_by);
create index idx_homes_deleted_at on public.homes(deleted_at) where deleted_at is null;

-- ----------------------------------------------------------------------------
-- 2.3: home_members
-- M:N-koppling användare ↔ hem med roller.
-- ----------------------------------------------------------------------------
create table public.home_members (
  home_id uuid not null references public.homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'read_only')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (home_id, user_id)
);

create index idx_home_members_user_id on public.home_members(user_id);

-- Garantera max en aktiv ägare per hem.
create unique index idx_one_active_owner_per_home
  on public.home_members(home_id)
  where role = 'owner' and left_at is null;

-- ----------------------------------------------------------------------------
-- 2.4: home_invitations
-- Pending-invites till hem, engångs-tokens.
-- ----------------------------------------------------------------------------
create table public.home_invitations (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('member', 'read_only')),
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_home_invitations_invited_email on public.home_invitations(invited_email);
create index idx_home_invitations_token on public.home_invitations(token);

-- ----------------------------------------------------------------------------
-- 2.5: home_properties
-- En fastighet (verklig eller fiktiv) som ingår i ett hem.
-- ----------------------------------------------------------------------------
create table public.home_properties (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references public.homes(id) on delete cascade,
  property_type text not null check (property_type in ('real', 'hypothetical')),
  
  -- För verkliga fastigheter
  anlaggnings_id text,
  address_id uuid references public.addresses(id),
  zone text check (zone in ('SE1', 'SE2', 'SE3', 'SE4')),
  network_operator text,
  country text not null default 'SE',
  
  -- För fiktiva fastigheter
  hypothetical_name text,
  
  -- Metadata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  -- Constraint: real har anlaggnings_id, hypothetical har hypothetical_name
  check (
    (property_type = 'real' and anlaggnings_id is not null)
    or
    (property_type = 'hypothetical' and hypothetical_name is not null)
  )
);

create index idx_home_properties_home_id on public.home_properties(home_id);
create index idx_home_properties_anlaggnings_id on public.home_properties(anlaggnings_id) 
  where anlaggnings_id is not null;
create index idx_home_properties_address_id on public.home_properties(address_id);

-- Samma anlaggnings_id kan inte finnas två gånger inom samma hem.
create unique index idx_one_anlaggnings_id_per_home
  on public.home_properties(home_id, anlaggnings_id)
  where anlaggnings_id is not null and deleted_at is null;

-- ----------------------------------------------------------------------------
-- 2.6: home_property_production
-- Solcellskoppling. M:1 mot home_properties (i praktiken 1:0..1).
-- ----------------------------------------------------------------------------
create table public.home_property_production (
  id uuid primary key default gen_random_uuid(),
  home_property_id uuid not null references public.home_properties(id) on delete cascade,
  production_anlaggnings_id text not null,
  installed_kw numeric,
  installation_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  unique (home_property_id)
);

create index idx_home_property_production_anlaggnings_id 
  on public.home_property_production(production_anlaggnings_id);

-- ----------------------------------------------------------------------------
-- 2.7: documents
-- Sparade dokument (fakturor och offerter). PDF i Storage + parsed JSON.
-- M:N mot home_properties via home_property_documents.
-- ----------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('invoice', 'offer')),
  uploaded_by uuid not null references auth.users(id) on delete set null,
  
  -- Storage path-konvention: documents/{home_property_id}/{document_id}.pdf
  pdf_storage_path text,
  
  -- Parsed data (Anthropic-svar)
  parsed_data jsonb,
  
  -- Denormaliserade snabb-läs-fält (Beslut 7.3)
  total_kr numeric,
  consumption_kwh numeric,
  spot_price_ore_kwh numeric,
  electricity_supplier text,
  invoice_period_start date,
  invoice_period_end date,
  
  -- Metadata
  parser_confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_documents_uploaded_by on public.documents(uploaded_by);
create index idx_documents_document_type on public.documents(document_type);
create index idx_documents_deleted_at on public.documents(deleted_at) where deleted_at is null;
create index idx_documents_invoice_period on public.documents(invoice_period_start, invoice_period_end);

-- ----------------------------------------------------------------------------
-- 2.8: home_property_documents
-- M:N-kopplingstabell. Ett dokument kan tillhöra flera home_properties.
-- Ingen updated_at — kopplingar uppdateras inte, bara skapas/raderas.
-- ----------------------------------------------------------------------------
create table public.home_property_documents (
  home_property_id uuid not null references public.home_properties(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (home_property_id, document_id)
);

create index idx_home_property_documents_document_id on public.home_property_documents(document_id);

-- ----------------------------------------------------------------------------
-- 2.9: analyses
-- Anthropic-analysresultat per dokument.
-- ----------------------------------------------------------------------------
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  analysis_type text not null default 'invoice_analysis' 
    check (analysis_type in ('invoice_analysis', 'offer_analysis')),
  model_version text not null,
  result jsonb not null,
  raw_response jsonb,
  is_reference boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_analyses_document_id on public.analyses(document_id);

-- Max en aktiv referens-analys per dokument
create unique index idx_one_reference_analysis_per_document
  on public.analyses(document_id)
  where is_reference = true;

-- ----------------------------------------------------------------------------
-- 2.10: consumption_data
-- Granular kWh-data (timme/dag/månad). FK till home_properties.
-- ----------------------------------------------------------------------------
create table public.consumption_data (
  id uuid primary key default gen_random_uuid(),
  home_property_id uuid not null references public.home_properties(id) on delete cascade,
  granularity text not null check (granularity in ('hour', 'day', 'month')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  kwh numeric not null,
  source text,
  created_at timestamptz not null default now()
);

create index idx_consumption_data_home_property_id on public.consumption_data(home_property_id);
create index idx_consumption_data_period on public.consumption_data(period_start, period_end);

-- ----------------------------------------------------------------------------
-- 2.11: home_profile
-- Hemdata per fastighet (boyta, byggår, byggnadstyp, uppvärmning).
-- 1:1 med home_properties.
-- ----------------------------------------------------------------------------
create table public.home_profile (
  home_property_id uuid primary key references public.home_properties(id) on delete cascade,
  living_area_m2 numeric,
  building_year int,
  building_type text,
  heating_type text,
  num_residents int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2.12: home_equipment
-- Utrustning per fastighet — typad JSONB per equipment_key.
-- ----------------------------------------------------------------------------
create table public.home_equipment (
  home_property_id uuid not null references public.home_properties(id) on delete cascade,
  equipment_key text not null,
  equipment_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (home_property_id, equipment_key)
);

create index idx_home_equipment_equipment_key on public.home_equipment(equipment_key);

-- ============================================================================
-- DEL 3: TRIGGERS — updated_at
-- ============================================================================
-- 
-- set_updated_at-funktionen kan redan finnas från V1; CREATE OR REPLACE 
-- säkerställer att den existerar oavsett.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_addresses_updated 
  before update on public.addresses
  for each row execute function public.set_updated_at();

create trigger trg_homes_updated 
  before update on public.homes
  for each row execute function public.set_updated_at();

create trigger trg_home_properties_updated 
  before update on public.home_properties
  for each row execute function public.set_updated_at();

create trigger trg_home_property_production_updated 
  before update on public.home_property_production
  for each row execute function public.set_updated_at();

create trigger trg_documents_updated 
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger trg_home_profile_updated 
  before update on public.home_profile
  for each row execute function public.set_updated_at();

create trigger trg_home_equipment_updated 
  before update on public.home_equipment
  for each row execute function public.set_updated_at();

-- ============================================================================
-- DEL 4: RLS-HJÄLPFUNKTIONER
-- ============================================================================
-- 
-- Skopet är hem-nivå (skillnad mot V1 som hade mätarpunkt-nivå).

create or replace function public.user_is_home_member(p_home_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.home_members
    where user_id = auth.uid()
      and home_id = p_home_id
      and left_at is null
  );
$$ language sql security definer stable;

create or replace function public.user_is_home_owner(p_home_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.home_members
    where user_id = auth.uid()
      and home_id = p_home_id
      and role = 'owner'
      and left_at is null
  );
$$ language sql security definer stable;

create or replace function public.user_can_write_home(p_home_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.home_members
    where user_id = auth.uid()
      and home_id = p_home_id
      and role in ('owner', 'member')
      and left_at is null
  );
$$ language sql security definer stable;

-- user_email_matches — behålls från V1, oförändrad.
-- Används av home_invitations-policys för att verifiera att inbjuden 
-- e-post matchar inloggad användare.
-- Future optimering: kan ersättas med auth.email() (Supabase-helper) 
-- för att undvika DB-lookup.
create or replace function public.user_email_matches(p_email text)
returns boolean as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = p_email
  );
$$ language sql security definer stable;

-- ============================================================================
-- DEL 5: TRANSFER_OWNERSHIP-FUNKTION
-- ============================================================================

create or replace function public.transfer_ownership(
  p_home_id uuid,
  p_new_owner_id uuid
)
returns void as $$
begin
  -- Verifiera att anroparen är aktiv ägare
  if not exists (
    select 1 from public.home_members
    where home_id = p_home_id
      and user_id = auth.uid()
      and role = 'owner'
      and left_at is null
  ) then
    raise exception 'Endast aktiv ägare kan överlåta ägarskap';
  end if;
  
  -- Verifiera att mottagaren är aktiv medlem
  if not exists (
    select 1 from public.home_members
    where home_id = p_home_id
      and user_id = p_new_owner_id
      and left_at is null
  ) then
    raise exception 'Mottagaren måste vara aktiv medlem av hemmet';
  end if;
  
  -- Degradera nuvarande ägare till member
  update public.home_members
    set role = 'member'
    where home_id = p_home_id
      and user_id = auth.uid()
      and role = 'owner';
  
  -- Uppgradera mottagare till owner
  update public.home_members
    set role = 'owner'
    where home_id = p_home_id
      and user_id = p_new_owner_id;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- DEL 6: AKTIVERA RLS PÅ ALLA TABELLER
-- ============================================================================

alter table public.addresses enable row level security;
alter table public.homes enable row level security;
alter table public.home_members enable row level security;
alter table public.home_invitations enable row level security;
alter table public.home_properties enable row level security;
alter table public.home_property_production enable row level security;
alter table public.documents enable row level security;
alter table public.home_property_documents enable row level security;
alter table public.analyses enable row level security;
alter table public.consumption_data enable row level security;
alter table public.home_profile enable row level security;
alter table public.home_equipment enable row level security;

-- ============================================================================
-- DEL 7: RLS-POLICYS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- homes
-- ----------------------------------------------------------------------------
create policy "members see homes"
  on public.homes for select
  using (public.user_is_home_member(id));

create policy "writers update homes"
  on public.homes for update
  using (public.user_can_write_home(id));

create policy "owners delete homes"
  on public.homes for delete
  using (public.user_is_home_owner(id));

-- INSERT av nya hem hanteras via RPC (create_initial_home_from_invoice 
-- eller create_empty_home). Direkt INSERT från authenticated kräver 
-- service_role.

-- ----------------------------------------------------------------------------
-- home_members
-- ----------------------------------------------------------------------------
create policy "members see fellow members"
  on public.home_members for select
  using (public.user_is_home_member(home_id));

create policy "writers can invite new members"
  on public.home_members for insert
  with check (
    public.user_can_write_home(home_id)
    and role in ('member', 'read_only')
  );

create policy "owners manage member roles"
  on public.home_members for update
  using (public.user_is_home_owner(home_id));

create policy "owners remove members"
  on public.home_members for delete
  using (public.user_is_home_owner(home_id));

create policy "users leave homes"
  on public.home_members for update
  using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- home_invitations
-- ----------------------------------------------------------------------------
create policy "members see invitations sent"
  on public.home_invitations for select
  using (public.user_is_home_member(home_id));

create policy "users see invitations to their email"
  on public.home_invitations for select
  using (public.user_email_matches(invited_email));

create policy "writers create invitations"
  on public.home_invitations for insert
  with check (public.user_can_write_home(home_id));

create policy "users respond to their invitations"
  on public.home_invitations for update
  using (public.user_email_matches(invited_email));

-- ----------------------------------------------------------------------------
-- home_properties
-- ----------------------------------------------------------------------------
create policy "members see home properties"
  on public.home_properties for select
  using (public.user_is_home_member(home_id));

create policy "writers manage home properties"
  on public.home_properties for all
  using (public.user_can_write_home(home_id))
  with check (public.user_can_write_home(home_id));

-- ----------------------------------------------------------------------------
-- home_property_production
-- ----------------------------------------------------------------------------
create policy "members see production"
  on public.home_property_production for select
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_property_production.home_property_id
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers manage production"
  on public.home_property_production for all
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_property_production.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  )
  with check (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_property_production.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  );

-- ----------------------------------------------------------------------------
-- addresses
-- En adress är synlig om användaren är medlem i ett hem som har en 
-- home_property som pekar på adressen.
-- ----------------------------------------------------------------------------
create policy "members see addresses via home_properties"
  on public.addresses for select
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.address_id = addresses.id
        and public.user_is_home_member(hp.home_id)
    )
  );

-- INSERT/UPDATE av addresses sker via RPC eller server action med 
-- service_role.

-- ----------------------------------------------------------------------------
-- documents
-- Ett dokument är synligt om det är kopplat (via home_property_documents) 
-- till minst en home_property i ett hem som användaren är medlem i.
-- M:N-kopplingen kräver EXISTS-subquery.
-- ----------------------------------------------------------------------------
create policy "members see documents"
  on public.documents for select
  using (
    exists (
      select 1 from public.home_property_documents hpd
      join public.home_properties hp on hp.id = hpd.home_property_id
      where hpd.document_id = documents.id
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers update documents"
  on public.documents for update
  using (
    exists (
      select 1 from public.home_property_documents hpd
      join public.home_properties hp on hp.id = hpd.home_property_id
      where hpd.document_id = documents.id
        and public.user_can_write_home(hp.home_id)
    )
  );

-- INSERT av documents sker via server action (bypassar RLS via 
-- service_role eller tas via RPC-funktion).

-- ----------------------------------------------------------------------------
-- home_property_documents
-- ----------------------------------------------------------------------------
create policy "members see home_property_documents"
  on public.home_property_documents for select
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_property_documents.home_property_id
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers manage home_property_documents"
  on public.home_property_documents for all
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_property_documents.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  )
  with check (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_property_documents.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  );

-- ----------------------------------------------------------------------------
-- analyses
-- Synlig om dokumentet är synligt.
-- ----------------------------------------------------------------------------
create policy "members see analyses"
  on public.analyses for select
  using (
    exists (
      select 1 from public.documents d
      join public.home_property_documents hpd on hpd.document_id = d.id
      join public.home_properties hp on hp.id = hpd.home_property_id
      where d.id = analyses.document_id
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers create analyses"
  on public.analyses for insert
  with check (
    exists (
      select 1 from public.documents d
      join public.home_property_documents hpd on hpd.document_id = d.id
      join public.home_properties hp on hp.id = hpd.home_property_id
      where d.id = analyses.document_id
        and public.user_can_write_home(hp.home_id)
    )
  );

-- ----------------------------------------------------------------------------
-- consumption_data
-- ----------------------------------------------------------------------------
create policy "members see consumption_data"
  on public.consumption_data for select
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = consumption_data.home_property_id
        and public.user_is_home_member(hp.home_id)
    )
  );

-- INSERT/UPDATE/DELETE av consumption_data sker via service_role 
-- (cron-jobb).

-- ----------------------------------------------------------------------------
-- home_profile
-- ----------------------------------------------------------------------------
create policy "members see home_profile"
  on public.home_profile for select
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_profile.home_property_id
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers manage home_profile"
  on public.home_profile for all
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_profile.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  )
  with check (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_profile.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  );

-- ----------------------------------------------------------------------------
-- home_equipment
-- ----------------------------------------------------------------------------
create policy "members see home_equipment"
  on public.home_equipment for select
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_equipment.home_property_id
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers manage home_equipment"
  on public.home_equipment for all
  using (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_equipment.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  )
  with check (
    exists (
      select 1 from public.home_properties hp
      where hp.id = home_equipment.home_property_id
        and public.user_can_write_home(hp.home_id)
    )
  );

-- ============================================================================
-- DEL 8: GRANT-PERMISSIONS
-- ============================================================================

grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update, delete on public.homes to authenticated;
grant select, insert, update, delete on public.home_members to authenticated;
grant select, insert, update, delete on public.home_invitations to authenticated;
grant select, insert, update, delete on public.home_properties to authenticated;
grant select, insert, update, delete on public.home_property_production to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.home_property_documents to authenticated;
grant select, insert, update, delete on public.analyses to authenticated;
grant select on public.consumption_data to authenticated;  -- bara läsa
grant select, insert, update, delete on public.home_profile to authenticated;
grant select, insert, update, delete on public.home_equipment to authenticated;

grant all on public.addresses to service_role;
grant all on public.homes to service_role;
grant all on public.home_members to service_role;
grant all on public.home_invitations to service_role;
grant all on public.home_properties to service_role;
grant all on public.home_property_production to service_role;
grant all on public.documents to service_role;
grant all on public.home_property_documents to service_role;
grant all on public.analyses to service_role;
grant all on public.consumption_data to service_role;
grant all on public.home_profile to service_role;
grant all on public.home_equipment to service_role;

grant execute on function public.user_is_home_member(uuid) to authenticated;
grant execute on function public.user_is_home_owner(uuid) to authenticated;
grant execute on function public.user_can_write_home(uuid) to authenticated;
grant execute on function public.user_email_matches(text) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

-- ============================================================================
-- DEL 9: RPC-FUNKTIONER (STUBS — implementeras separat)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- create_initial_home_from_invoice
-- ----------------------------------------------------------------------------
-- Atomic save vid första-fakturan-flödet. Tar all data som behövs för att 
-- skapa en användares första hem från en uppladdad faktura.
-- 
-- TODO: Implementera när exakt parametersignatur är spikad. Behöver bl.a.:
--   - Hem-namn (default "Hem på [adress]")
--   - Adress (street, postal_code, city, country, etc.)
--   - Anlaggnings_id + zone + network_operator
--   - Document parsed_data + denormaliserade fält
--   - PDF storage path
--   - Analysis result (Anthropic-svar)
--   - Home profile-data (boyta, byggår, etc.)
-- 
-- Implementeras som SECURITY DEFINER så den kan kringgå RLS för att skapa 
-- första home_members-raden med role='owner' (vanlig INSERT på 
-- home_members är blockerad för 'owner').
-- 
-- Returnerar home_id på det skapade hemmet.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- create_empty_home
-- ----------------------------------------------------------------------------
-- Skapa ett tomt hem manuellt (via "Skapa nytt hem"-knapp i UI).
-- Tar bara namnet, skapar hem-rad + home_members-rad med role='owner'.
-- 
-- TODO: Implementera. Pseudokod:
-- 
--   create or replace function public.create_empty_home(p_name text)
--   returns uuid
--   language plpgsql
--   security definer
--   as $$
--   declare
--     v_home_id uuid;
--   begin
--     -- Validera input
--     if p_name is null or trim(p_name) = '' then
--       raise exception 'Hem-namn krävs';
--     end if;
--     
--     -- Skapa hem
--     insert into public.homes (name, created_by)
--       values (trim(p_name), auth.uid())
--       returning id into v_home_id;
--     
--     -- Skapa owner-rad
--     insert into public.home_members (home_id, user_id, role)
--       values (v_home_id, auth.uid(), 'owner');
--     
--     return v_home_id;
--   end;
--   $$;
--   
--   grant execute on function public.create_empty_home(text) to authenticated;
-- 
-- Implementeras separat när första-faktura-flödet och Mitt hem-sidan 
-- designats färdigt.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- DEL 10: STORAGE BUCKET RLS-POLICYS (för documents-bucketen)
-- ============================================================================
-- 
-- Storage-bucket 'documents' ska skapas manuellt i Supabase dashboard:
--   Storage → New bucket → name: 'documents', public: false, 
--                          file size limit: 10 MB, allowed MIME: 
--                          application/pdf
-- 
-- Sedan körs nedanstående policys för att RLS:en ska fungera.
-- 
-- Filer lagras under sökväg: documents/{home_property_id}/{document_id}.pdf

create policy "members see documents in storage"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.home_property_documents hpd
      join public.home_properties hp on hp.id = hpd.home_property_id
      join public.documents d on d.id = hpd.document_id
      where d.pdf_storage_path = storage.objects.name
        and public.user_is_home_member(hp.home_id)
    )
  );

create policy "writers upload documents to storage"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    -- Vid upload finns ingen documents-rad ännu — server action ansvarar 
    -- för att verifiera att användaren har skrivrätt till relevant hem.
    and auth.uid() is not null
  );

create policy "writers delete documents from storage"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.home_property_documents hpd
      join public.home_properties hp on hp.id = hpd.home_property_id
      join public.documents d on d.id = hpd.document_id
      where d.pdf_storage_path = storage.objects.name
        and public.user_can_write_home(hp.home_id)
    )
  );

-- ============================================================================
-- KLART
-- ============================================================================
-- 
-- Verifiera efter körning:
-- 
--   1. SELECT count(*) FROM information_schema.tables 
--      WHERE table_schema = 'public';
--      -- Förväntat: 13 (V2 Mina sidor) + 1 (user_profiles) + 2 
--      -- (spot_prices, monthly_avg_prices) = 16 tabeller
-- 
--   2. SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--      ORDER BY proname;
--      -- Förväntat: handle_new_user, set_updated_at, transfer_ownership,
--      --           user_can_write_home, user_email_matches, 
--      --           user_is_home_member, user_is_home_owner
-- 
--   3. Testa RLS genom att skapa ett hem manuellt:
--      INSERT INTO homes (name, created_by) VALUES ('Test', 'din-user-id');
--      INSERT INTO home_members (home_id, user_id, role) 
--        VALUES ('hem-id', 'din-user-id', 'owner');
--      -- Vanlig INSERT funkar bara via service_role; via authenticated 
--      -- kommer det att blockeras (det är meningen — använd 
--      -- create_empty_home eller create_initial_home_from_invoice).
-- 
-- Nästa steg: implementera create_initial_home_from_invoice + 
-- create_empty_home. Bygga om /app/spara-analys server action.
-- ============================================================================
