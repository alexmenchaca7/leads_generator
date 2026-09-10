-- ============================================================================
--  Migración 06: configuración del sistema editable desde el dashboard
--
--  Guarda la config (búsquedas, industrias, dominios de redes, pesos del score,
--  umbrales, listas desplegables y parámetros del scraper) en la nube, una fila
--  por sección. El dashboard la edita y el scraper de Python la lee al iniciar
--  cada corrida. Lo que no exista aquí usa los valores por defecto de config.py.
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente: puedes volver a correrla sin romper nada.
-- ============================================================================

create table if not exists public.app_config (
    key        text primary key,
    value      jsonb not null,
    updated_at timestamptz default now()
);

alter table public.app_config enable row level security;
drop policy if exists "app_config_auth_all" on public.app_config;
create policy "app_config_auth_all" on public.app_config
    for all
    to authenticated
    using (true)
    with check (true);

-- Realtime para que los cambios de config se vean en vivo entre usuarios
do $$
begin
    begin
        alter publication supabase_realtime add table public.app_config;
    exception when duplicate_object then null;
    end;
end $$;
