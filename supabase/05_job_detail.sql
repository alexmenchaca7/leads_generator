-- ============================================================================
--  Migración: detalle de cada búsqueda (qué negocios se agregaron / se omitieron)
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
-- ============================================================================

alter table public.scrape_jobs add column if not exists new_names     jsonb;
alter table public.scrape_jobs add column if not exists skipped_names jsonb;
