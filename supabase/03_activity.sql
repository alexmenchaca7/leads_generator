-- ============================================================================
--  Migración: log de actividad (auditoría) de todos los usuarios
--  Registra cada cambio hecho desde el dashboard (editar, agregar, vetar,
--  recuperar) con quién lo hizo y qué cambió, para poder revisarlo y deshacerlo.
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
-- ============================================================================

create table if not exists public.activity_log (
    id            uuid primary key default gen_random_uuid(),
    user_email    text default '',
    action        text not null,            -- update | create | delete | recover
    business_id   text,
    business_name text default '',
    changes       jsonb,                     -- {campo: {old, new}} en ediciones
    undone        boolean default false,
    created_at    timestamptz default now()
);

create index if not exists activity_created_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists "activity_auth_all" on public.activity_log;
create policy "activity_auth_all" on public.activity_log
    for all
    to authenticated
    using (true)
    with check (true);

-- Realtime para que el historial y la actividad se vean en vivo
do $$
begin
    begin
        alter publication supabase_realtime add table public.activity_log;
    exception when duplicate_object then null;
    end;
end $$;
