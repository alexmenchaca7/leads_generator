-- ============================================================================
--  Leads Generator — esquema de Supabase
--  Cómo usarlo:
--    1. Crea un proyecto en https://supabase.com
--    2. Abre  SQL Editor  →  New query
--    3. Pega TODO este archivo y dale  Run
--  Es idempotente: puedes volver a correrlo sin romper nada.
-- ============================================================================

-- ── Tabla principal: un renglón por negocio ─────────────────────────────────
create table if not exists public.leads (
    business_id     text primary key,
    name            text not null default '',
    category        text default '',
    address         text default '',
    phone           text default '',
    website         text default '',
    rating          numeric,
    reviews_count   integer,
    lat             numeric,
    lng             numeric,
    maps_url        text default '',
    no_website      boolean default false,
    lead_score      integer default 0,
    priority        text default 'low',     -- high | medium | low
    website_status  text default '',        -- has_website | no_website

    -- Campos que escribe el scraper
    first_seen      date default current_date,
    last_seen       date default current_date,

    -- Campos manuales (editables desde el dashboard) — el scraper NO los pisa
    outreach_status text default 'pendiente',  -- pendiente|contactado|no contestó|interesado|no interesado|cliente
    contacted       text default 'no',         -- sí | no
    follow_up       date,
    notes           text default '',

    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- Índices para filtros típicos del dashboard
create index if not exists leads_priority_idx   on public.leads (priority);
create index if not exists leads_no_website_idx on public.leads (no_website);
create index if not exists leads_score_idx      on public.leads (lead_score desc);

-- ── Bitácora de contactos: varios renglones por negocio ─────────────────────
create table if not exists public.contacts (
    id             uuid primary key default gen_random_uuid(),
    business_id    text references public.leads(business_id) on delete cascade,
    name           text default '',
    phone          text default '',
    contacted_date date default current_date,
    response       text default '',
    next_action    text default '',
    deal_status    text default 'prospecto',  -- prospecto|negociando|ganado|perdido
    notes          text default '',
    created_at     timestamptz default now()
);

create index if not exists contacts_business_idx on public.contacts (business_id);

-- ── updated_at automático al editar un lead ─────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
    before update on public.leads
    for each row execute function public.set_updated_at();

-- ── Realtime: el dashboard recibe cambios en vivo ───────────────────────────
-- (ignora el error "already member" si lo corres dos veces)
do $$
begin
    begin
        alter publication supabase_realtime add table public.leads;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.contacts;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.activity_log;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.scrape_jobs;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.worker_status;
    exception when duplicate_object then null;
    end;
end $$;

-- ============================================================================
--  Seguridad (Row Level Security)
--  - El scraper usa la SERVICE ROLE key → ignora RLS, puede escribir siempre.
--  - El dashboard usa la ANON key + sesión de usuario → solo usuarios
--    autenticados (tú y tu socio) pueden leer y editar.
-- ============================================================================
alter table public.leads    enable row level security;
alter table public.contacts enable row level security;

-- leads: usuarios autenticados pueden todo
drop policy if exists "leads_auth_all" on public.leads;
create policy "leads_auth_all" on public.leads
    for all
    to authenticated
    using (true)
    with check (true);

-- contacts: usuarios autenticados pueden todo
drop policy if exists "contacts_auth_all" on public.contacts;
create policy "contacts_auth_all" on public.contacts
    for all
    to authenticated
    using (true)
    with check (true);

-- ── Log de actividad (auditoría) ────────────────────────────────────────────
create table if not exists public.activity_log (
    id            uuid primary key default gen_random_uuid(),
    user_email    text default '',
    action        text not null,            -- update | create | delete | recover
    business_id   text,
    business_name text default '',
    changes       jsonb,
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

-- ── Búsquedas desde el dashboard: cola + estado del worker ──────────────────
create table if not exists public.scrape_jobs (
    id            uuid primary key default gen_random_uuid(),
    query         text not null,
    max_results   int,
    status        text default 'pending',   -- pending | running | done | error
    requested_by  text default '',
    new_count     int,
    dup_count     int,
    new_names     jsonb,
    skipped_names jsonb,
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

create table if not exists public.worker_status (
    id          int primary key default 1,
    last_seen   timestamptz,
    current_job uuid
);
alter table public.worker_status enable row level security;
drop policy if exists "worker_status_auth_read" on public.worker_status;
create policy "worker_status_auth_read" on public.worker_status
    for select to authenticated using (true);

-- ── Blocklist: leads vetados (borrados a propósito desde el dashboard) ───────
-- El scraper nunca los vuelve a insertar aunque sigan en Google Maps.
create table if not exists public.blocklist (
    business_id text primary key,
    name        text default '',
    reason      text default 'eliminado desde dashboard',
    data        jsonb,                       -- copia del lead para poder recuperarlo
    created_at  timestamptz default now()
);
alter table public.blocklist add column if not exists data jsonb;

alter table public.blocklist enable row level security;

drop policy if exists "blocklist_auth_all" on public.blocklist;
create policy "blocklist_auth_all" on public.blocklist
    for all
    to authenticated
    using (true)
    with check (true);
