-- ============================================================================
--  Migración: vista de tablero (kanban) con tarjetas tipo Trello
--
--  Agrega lo necesario para arrastrar leads entre columnas de estado y para
--  que cada tarjeta tenga su propia bitácora de notas e imágenes, compartida
--  entre todos los usuarios.
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente: puedes volver a correrla sin romper nada.
-- ============================================================================

-- ── Orden dentro de cada columna del tablero ────────────────────────────────
-- Posición fraccionaria: al soltar una tarjeta entre otras dos se le asigna el
-- punto medio, así mover una tarjeta solo reescribe ESA fila (no toda la
-- columna). NULL = todavía sin ordenar a mano; el tablero las manda al inicio
-- ordenadas por score, que es justo donde quieres ver un lead recién scrapeado.
alter table public.leads add column if not exists board_position double precision;

-- Etiquetas de color de la tarjeta (como las labels de Trello).
alter table public.leads add column if not exists board_labels text[] default '{}';

create index if not exists leads_board_idx
    on public.leads (outreach_status, board_position);

-- ── Bitácora de la tarjeta: notas con autor y fecha ─────────────────────────
-- Distinto de leads.notes (que es UN texto libre editable): aquí cada nota es
-- un renglón nuevo, se ve quién la escribió y no se pisa con la anterior.
create table if not exists public.lead_comments (
    id          uuid primary key default gen_random_uuid(),
    business_id text references public.leads(business_id) on delete cascade,
    user_email  text default '',
    body        text not null default '',
    created_at  timestamptz default now()
);
create index if not exists lead_comments_biz_idx
    on public.lead_comments (business_id, created_at desc);

-- ── Imágenes y archivos adjuntos de la tarjeta ──────────────────────────────
-- El archivo vive en Storage (bucket `lead-files`); aquí guardamos la
-- referencia para poder listarlo, borrarlo y saber quién lo subió.
create table if not exists public.lead_attachments (
    id          uuid primary key default gen_random_uuid(),
    business_id text references public.leads(business_id) on delete cascade,
    user_email  text default '',
    path        text not null,          -- ruta dentro del bucket
    url         text not null default '',
    name        text default '',
    mime        text default '',
    size        integer,
    created_at  timestamptz default now()
);
create index if not exists lead_attachments_biz_idx
    on public.lead_attachments (business_id, created_at desc);

-- ── Seguridad: mismo criterio que el resto (usuarios autenticados) ──────────
alter table public.lead_comments    enable row level security;
alter table public.lead_attachments enable row level security;

drop policy if exists "lead_comments_auth_all" on public.lead_comments;
create policy "lead_comments_auth_all" on public.lead_comments
    for all to authenticated using (true) with check (true);

drop policy if exists "lead_attachments_auth_all" on public.lead_attachments;
create policy "lead_attachments_auth_all" on public.lead_attachments
    for all to authenticated using (true) with check (true);

-- ── Storage: bucket para las imágenes de las tarjetas ───────────────────────
-- Público de lectura para que la <img> cargue directo sin firmar cada URL;
-- subir y borrar solo usuarios con sesión.
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

-- ── Realtime: el tablero se actualiza solo para los dos usuarios ────────────
do $$
begin
    begin
        alter publication supabase_realtime add table public.lead_comments;
    exception when duplicate_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.lead_attachments;
    exception when duplicate_object then null;
    end;
end $$;
