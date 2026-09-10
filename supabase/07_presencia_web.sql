-- ============================================================================
--  Migración 07: presencia web + industria (agencia de desarrollo web)
--
--  Cambia el modelo de "¿tiene web sí/no?" a algo que sí sirve para vender
--  sitios web:
--
--    is_target   → ¿es prospecto? (no tiene sitio PROPIO)
--    web_status  → sin_web | solo_redes | con_web
--                  "solo_redes" = el link de Google Maps es un Facebook, un
--                  Instagram o una página gratis (business.site, wixsite…).
--                  Ese negocio SIGUE siendo prospecto y suele ser el más fácil
--                  de cerrar: ya sabe que necesita estar en línea.
--    industry    → segmento del giro ("Dental", "Restaurante", "Abogados"…)
--
--  Reemplaza a las columnas viejas `no_website` y `website_status`, que se
--  quedan en la tabla sin usarse (no se borran para no perder datos; puedes
--  eliminarlas a mano después con el bloque comentado del final).
--
--  Cómo correrla: Supabase → SQL Editor → New query → pega esto → Run.
--  Es idempotente: puedes volver a correrla sin romper nada.
--
--  IMPORTANTE: el backfill de abajo es solo una aproximación para que el
--  dashboard no se vea vacío de inmediato. Los valores definitivos los calcula
--  el worker: entra a  ⚙ Configurar  y presiona  «Recalcular leads».
-- ============================================================================

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────
alter table public.leads add column if not exists is_target  boolean default false;
alter table public.leads add column if not exists web_status text    default '';
alter table public.leads add column if not exists industry   text    default '';

-- ── 2. Backfill desde los datos que ya tienes ───────────────────────────────
-- Sin link => sin_web. Con link de red social/página gratis => solo_redes.
-- Cualquier otro link => con_web.
update public.leads
set web_status = case
        when coalesce(nullif(trim(website), ''), '') = '' then 'sin_web'
        when lower(website) similar to
             '%(facebook.com|fb.com|fb.me|instagram.com|tiktok.com|twitter.com|linkedin.com|wa.me|whatsapp.com|linktr.ee|beacons.ai|bio.link|business.site|negocio.site|sites.google.com|wixsite.com|blogspot.com|wordpress.com|weebly.com|godaddysites.com|carrd.co|mercadolibre.com|doctoralia.com|ubereats.com|rappi.com|booking.com|airbnb.com|tripadvisor)%'
             then 'solo_redes'
        else 'con_web'
    end
where web_status is null or web_status = '';

-- Es prospecto todo el que no tenga sitio propio.
update public.leads
set is_target = (web_status <> 'con_web')
where web_status is not null and web_status <> '';

-- ── 3. Índices ──────────────────────────────────────────────────────────────
create index if not exists leads_is_target_idx  on public.leads (is_target);
create index if not exists leads_web_status_idx on public.leads (web_status);
create index if not exists leads_industry_idx   on public.leads (industry);

-- ── 4. Limpieza de las columnas viejas (OPCIONAL) ───────────────────────────
-- Descomenta y corre esto SOLO cuando ya hayas verificado que el dashboard se
-- ve bien con las columnas nuevas. Una vez borradas no se pueden recuperar.
--
-- drop index if exists public.leads_no_website_idx;
-- alter table public.leads drop column if exists no_website;
-- alter table public.leads drop column if exists website_status;
