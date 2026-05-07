-- Migration: GRANT-permissions till authenticated och service_role
-- Datum: 2026-05-04
-- Bakgrund: schemat saknade explicita GRANT-statements pa nya tabeller.
-- Authenticated saknade SELECT/INSERT/UPDATE/DELETE-rattigheter, vilket
-- gjorde att alla skriv-operationer failade med 403. service_role far
-- explicita grants for tydlighet, aven om den bypassa RLS automatiskt.
-- Anon-rollen far inga grants — Mina sidor-data ar alltid privat.

-- authenticated: full CRUD pa anvandares egna data (RLS filtrerar rader)
grant select, insert, update, delete on public.user_profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, update, delete on public.consumption_metering_points to authenticated;
grant select, insert, update, delete on public.production_metering_points to authenticated;
grant select, insert, update, delete on public.metering_point_members to authenticated;
grant select, insert, update, delete on public.metering_point_invitations to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.analyses to authenticated;
grant select, insert, update, delete on public.home_profile to authenticated;
grant select, insert, update, delete on public.home_equipment to authenticated;
grant select on public.consumption_data to authenticated;

-- service_role: full CRUD pa allt (anvands fran API-routes server-side)
grant select, insert, update, delete on public.user_profiles to service_role;
grant select, insert, update, delete on public.addresses to service_role;
grant select, insert, update, delete on public.consumption_metering_points to service_role;
grant select, insert, update, delete on public.production_metering_points to service_role;
grant select, insert, update, delete on public.metering_point_members to service_role;
grant select, insert, update, delete on public.metering_point_invitations to service_role;
grant select, insert, update, delete on public.documents to service_role;
grant select, insert, update, delete on public.analyses to service_role;
grant select, insert, update, delete on public.home_profile to service_role;
grant select, insert, update, delete on public.home_equipment to service_role;
grant select, insert, update, delete on public.consumption_data to service_role;