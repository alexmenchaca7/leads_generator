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
    is_target       boolean default false,  -- prospecto: no tiene sitio propio
    lead_score      integer default 0,
    priority        text default 'low',     -- high | medium | low
    web_status      text default '',        -- sin_web | solo_redes | con_web
    industry        text default '',        -- segmento: "Dental", "Restaurante"…

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
create index if not exists leads_is_target_idx  on public.leads (is_target);
create index if not exists leads_score_idx      on public.leads (lead_score desc);
create index if not exists leads_web_status_idx on public.leads (web_status);
create index if not exists leads_industry_idx   on public.leads (industry);

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

-- ── Configuración del sistema (editable desde el dashboard) ─────────────────
-- Una fila por sección de config (search_queries, target_industries,
-- social_domains, scoring_weights, priority_thresholds, dropdown_options,
-- scraper_config). Lo que no exista aquí usa los valores por defecto de
-- config.py / configDefaults.ts.
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

-- ── Tablero (kanban): orden, etiquetas, notas e imágenes por tarjeta ────────
-- Posición fraccionaria dentro de la columna: al soltar una tarjeta entre otras
-- dos se le asigna el punto medio, así mover una tarjeta solo reescribe ESA
-- fila. NULL = sin ordenar a mano (el tablero las manda al inicio por score).
alter table public.leads add column if not exists board_position double precision;
alter table public.leads add column if not exists board_labels   text[] default '{}';
create index if not exists leads_board_idx on public.leads (outreach_status, board_position);

-- Bitácora de la tarjeta: cada nota es un renglón con autor y fecha (distinto
-- de leads.notes, que es un solo texto libre que se sobreescribe).
create table if not exists public.lead_comments (
    id          uuid primary key default gen_random_uuid(),
    business_id text references public.leads(business_id) on delete cascade,
    user_email  text default '',
    body        text not null default '',
    created_at  timestamptz default now()
);
create index if not exists lead_comments_biz_idx on public.lead_comments (business_id, created_at desc);

-- Imágenes/archivos de la tarjeta. El archivo vive en Storage (bucket
-- `lead-files`); aquí queda la referencia para listarlo y borrarlo.
create table if not exists public.lead_attachments (
    id          uuid primary key default gen_random_uuid(),
    business_id text references public.leads(business_id) on delete cascade,
    user_email  text default '',
    path        text not null,
    url         text not null default '',
    name        text default '',
    mime        text default '',
    size        integer,
    created_at  timestamptz default now()
);
create index if not exists lead_attachments_biz_idx on public.lead_attachments (business_id, created_at desc);

alter table public.lead_comments    enable row level security;
alter table public.lead_attachments enable row level security;

drop policy if exists "lead_comments_auth_all" on public.lead_comments;
create policy "lead_comments_auth_all" on public.lead_comments
    for all to authenticated using (true) with check (true);

drop policy if exists "lead_attachments_auth_all" on public.lead_attachments;
create policy "lead_attachments_auth_all" on public.lead_attachments
    for all to authenticated using (true) with check (true);

-- Bucket de Storage para las imágenes de las tarjetas: lectura pública (para
-- que la <img> cargue directo), subir y borrar solo con sesión.
insert into storage.buckets (id, name, public)
values ('lead-files', 'lead-files', true)
on conflict (id) do update set public = true;

drop policy if exists "lead_files_read"   on storage.objects;
drop policy if exists "lead_files_insert" on storage.objects;
drop policy if exists "lead_files_delete" on storage.objects;

create policy "lead_files_read" on storage.objects
    for select using (bucket_id = 'lead-files');
create policy "lead_files_insert" on storage.objects
    for insert to authenticated with check (bucket_id = 'lead-files');
create policy "lead_files_delete" on storage.objects
    for delete to authenticated using (bucket_id = 'lead-files');

-- ── Realtime: el dashboard recibe cambios en vivo ───────────────────────────
-- Se ejecuta AL FINAL, cuando todas las tablas ya existen.
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
    begin
        alter publication supabase_realtime add table public.app_config;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.lead_comments;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.lead_attachments;
    exception when duplicate_object then null;
    end;
end $$;
