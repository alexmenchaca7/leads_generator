-- ============================================================================
--  Migración: lista de vetados (blocklist)
--  Cuando borras un lead desde el dashboard, su business_id queda aquí para que
--  el scraper NUNCA lo vuelva a insertar, aunque siga apareciendo en Google Maps.
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
--  (Es idempotente; puedes correrla varias veces sin problema.)
-- ============================================================================

create table if not exists public.blocklist (
    business_id text primary key,
    name        text default '',
    reason      text default 'eliminado desde dashboard',
    created_at  timestamptz default now()
);

alter table public.blocklist enable row level security;

drop policy if exists "blocklist_auth_all" on public.blocklist;
create policy "blocklist_auth_all" on public.blocklist
    for all
    to authenticated
    using (true)
    with check (true);
