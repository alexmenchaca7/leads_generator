-- ============================================================================
--  Migración: búsquedas desde el dashboard (cola de trabajos + estado del worker)
--
--  El dashboard crea "trabajos" de scrapeo; un worker local (python -m src.worker)
--  los procesa con el navegador headless y sube los resultados.
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
-- ============================================================================

-- ── Cola de búsquedas ───────────────────────────────────────────────────────
create table if not exists public.scrape_jobs (
    id            uuid primary key default gen_random_uuid(),
    query         text not null,
    max_results   int,
    status        text default 'pending',   -- pending | running | done | error
    requested_by  text default '',
    new_count     int,
    dup_count     int,
    message       text default '',
    created_at    timestamptz default now(),
    started_at    timestamptz,
    finished_at   timestamptz
);
create index if not exists scrape_jobs_status_idx on public.scrape_jobs (status, created_at);

alter table public.scrape_jobs enable row level security;
drop policy if exists "scrape_jobs_auth_all" on public.scrape_jobs;
create policy "scrape_jobs_auth_all" on public.scrape_jobs
    for all to authenticated using (true) with check (true);

-- ── Estado del worker (heartbeat) ───────────────────────────────────────────
create table if not exists public.worker_status (
    id          int primary key default 1,
    last_seen   timestamptz,
    current_job uuid
);

alter table public.worker_status enable row level security;
drop policy if exists "worker_status_auth_read" on public.worker_status;
create policy "worker_status_auth_read" on public.worker_status
    for select to authenticated using (true);

-- Realtime para ver los trabajos en vivo
do $$
begin
    begin
        alter publication supabase_realtime add table public.scrape_jobs;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.worker_status;
    exception when duplicate_object then null;
    end;
end $$;
