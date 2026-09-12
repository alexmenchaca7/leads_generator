# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Commercial-prospecting tool for a **web-development agency**. It scrapes Google Maps for local
businesses across the Guadalajara metro area (ZMG), scores them by **web presence + industry fit +
size + contactability**, and tracks outreach. The core lead signal is inverted from the usual: the
**best prospect is a business with no website of its own**, because that is exactly what the agency
sells. It has two halves that can run independently:

- **Scraper (Python)** — local, in the repo root + `src/`. Drives a real Chromium browser via
  Playwright, persists to a master Excel file, and optionally syncs to Supabase.
- **Dashboard (Next.js)** — in `dashboard/`, deployed to Vercel. Reads/edits the same data from
  Supabase with live updates and password login.

The code and UI comments are in **Spanish** — match that when editing.

## Commands

### Scraper (run from repo root, Python 3.12)
```powershell
pip install -r requirements.txt
playwright install chromium          # one-time browser install

python main.py                       # scrape all SEARCH_QUERIES in config.py
python main.py --headless            # no visible browser window
python main.py --query "dentista en Guadalajara"   # single query, overrides config
python main.py --max-results 30      # cap results per query
python main.py --snapshot            # also write a dated copy to data/runs/
python main.py --mode refresh        # rebuild filtered Excel sheets, no scraping
python main.py --mode rescore        # re-score existing leads with the current config

python -m src.db --migrate           # one-time: push the whole Excel to Supabase
python -m src.worker                 # long-running: process scrape jobs queued from the dashboard
python -m src.worker --once          # drain pending jobs, then exit
```

### Dashboard (run from `dashboard/`)
```powershell
npm install
npm run dev      # http://localhost:3000
npm run build
```

There are no automated tests in this project. ESLint is not configured (`next lint` prompts for
setup) — verify with `npx tsc --noEmit` and `npx next build`.

## Architecture & data flow

```
Scraper / worker (Python)  ──push──►  Supabase (Postgres + Auth + Realtime)  ◄──►  Dashboard (Vercel)
        │
        └─────────────────────────►  data/business_leads.xlsx  (local source of truth)
```

**Excel is the source of truth for the scraper; Supabase mirrors it for the dashboard.** A run can
succeed with no `.env` — the Supabase sync is skipped and only Excel is written.

### Scraper internals (`src/`)
- `main.py` orchestrates a scrape run: applies remote config, loads known URLs (dedup) and blocked
  IDs, loops queries, saves, then syncs to Supabase. Also hosts `--mode rescore`.
- `scraper.py` — `GoogleMapsScraper`. Two-phase: (1) scroll the `div[role="feed"]` panel collecting
  `/maps/place/` URLs, (2) visit each place page and extract fields via ordered selector bundles.
  Selectors are brittle by nature — if extraction breaks, Google changed its DOM; update the
  `_*_SELECTORS` lists. It tracks `last_skipped_names` / `last_seen_again_ids` for the worker.
- `excel_manager.py` — `ExcelManager`. Owns the XLSX. Only ever **appends** new rows to `raw_leads`;
  never edits existing rows, so manual edits/colors/notes survive. Rebuilds the auto-generated
  `target_leads` and `high_priority` views on each save; the `contacted` sheet is protected.
- `lead_scoring.py` — `classify_web()` (the core signal), `classify_industry()`, `calculate_score()`.
  All read from the `config` **module** (not `from config import X`) so `remote_config` overrides
  apply without reimporting.
- `db.py` — `SupabaseSync`. Uses the **service-role key** (bypasses RLS). Upserts with
  `on_conflict=business_id, ignore_duplicates=True` so it inserts new leads but **never overwrites**
  dashboard edits. `update_scores()` mirrors a rescore to the DB.
- `worker.py` — polls the `scrape_jobs` queue in Supabase, runs the scraper headless, writes a
  `worker_status` heartbeat, logs to `activity_log`, and prunes old history hourly. This is how
  dashboard-initiated searches execute (the browser lives on the local PC).
- `config.py` — all tunables: `SEARCH_QUERIES`, `SOCIAL_DOMAINS`, `TARGET_INDUSTRIES`,
  `SCRAPER_CONFIG`, scoring weights/thresholds, Excel `DROPDOWN_OPTIONS`. These are the **defaults**.
  Note: the scraper stores the query as the lead's `category`, so query buckets feed industry
  classification too.
- `remote_config.py` — `apply_overrides(client)` reads the Supabase `app_config` table (edited from
  the dashboard `/config` page) and **mutates the `config` module dicts/lists in place**. Called at
  the start of every run (`main.py`) and every worker job. Missing keys fall back to `config.py`
  defaults; failures are tolerated.
- **Re-scoring**: `ExcelManager.rescore_all()` recomputes `is_target`/`lead_score`/`priority`/
  `web_status`/`industry` for all rows with the current config (manual columns untouched);
  `SupabaseSync.update_scores()` mirrors it to the DB. Triggered by `python main.py --mode rescore`
  or a `scrape_jobs` row with `query="__rescore__"` (the dashboard "Recalcular" button), handled by
  `worker._run_rescore_job`.

### The domain model (critical — this is what makes it a *web agency* tool)
- `web_status` is the core column, one of three values from `config.py`:
  - `sin_web` — no link at all on the Maps listing. The ideal prospect.
  - `solo_redes` — the "website" link is a Facebook/Instagram/link-aggregator/free auto-generated
    site (`business.site`, `wixsite.com`…) or a marketplace/directory. **Still a prospect**, and
    usually the easiest close: they already know they need to be online.
  - `con_web` — a real site of their own. Not a prospect for a new build.
  - The match list is `config.SOCIAL_DOMAINS`, editable from `/config`.
- `is_target` (bool) = `web_status != "con_web"`. A lead that is not a target is **forced to
  priority `low`** regardless of score.
- `industry` is a *segment label*, not a gate: it adds `target_industry` points because some trades
  (dental, restaurants, lawyers) buy a website more readily, but a business with no site is a
  prospect whatever its trade.
- These names are mirrored across `config.py`/`lead_scoring.py`/`excel_manager.py`/`db.py`,
  `supabase/schema.sql`, and the dashboard (`types.ts`, `LeadsTable.tsx`, `EditModal.tsx`,
  `ActivityModal.tsx`) — rename in lockstep.
- They replaced the older `no_website`/`website_status` pair; `supabase/07_presencia_web.sql` is the
  migration (it backfills, and leaves the old columns in place for safety).

### Deduplication & identity (critical, easy to break)
- `business_id` = first 12 chars of SHA-256 of the **normalized** maps URL, falling back to
  `name|address`.
- `normalize_url` strips the `/data=<CID>` segment and lowercases/unquotes — but that segment is
  **required for navigation** (without it the place page is blank). So: keep the full URL for
  visiting/storing, normalize **only** to compute the dedup key. Don't conflate the two.
- Dedup happens twice: before visiting (skip known/blocked URLs) and at save time (skip existing
  IDs/URLs).
- **Blocklist vs purge**: leads *vetted* from the dashboard go into the `blocklist` table and the
  scraper skips them forever (recoverable). Leads *purged* are deleted outright — not recoverable,
  but the scraper may re-add them later. Both are logged to `activity_log`.

### Dashboard internals (`dashboard/`, Next.js 15 App Router, React 19)
- Auth via `@supabase/ssr`. `middleware.ts` → `lib/supabase/middleware.ts` refreshes the session on
  every request and gates routes; unauthenticated users are sent to `/login`. Three Supabase clients:
  `lib/supabase/{client,server,middleware}.ts` for browser / server-component / middleware contexts.
- `app/dashboard/page.tsx` is a force-dynamic server component that fetches leads + `app_config` and
  hands them to `LeadsTable.tsx` (the main client UI: filtering, sorting, inline editing, bulk
  actions, realtime subscriptions, quick filters for web presence).
- `app/scrape/` queues searches into `scrape_jobs` (uses configured `search_queries`/max results),
  shows worker status + job progress live, and an in-dashboard operational guide (`WorkerGuide.tsx`)
  since the end client only has the dashboard, not the repo.
- **Two views over the same leads**, toggled in `LeadsTable.tsx` (`view` state, remembered in
  `localStorage.leads_view`): the table, and `LeadsBoard.tsx` — a Trello-style kanban whose columns
  are the `outreach_status` options from `app_config` (falls back to `OUTREACH_OPTIONS`). Both share
  the same filters, search, KPIs, realtime and `updateLead`, so a board drag is just an ordinary
  lead update and lands in `activity_log` like any other (and is undoable from the history).
  Dragging uses native HTML5 DnD — desktop only; on phones the card modal's "Columna" select is how
  you move a card, which is why it must stay. The board has its own sort control (score, rating,
  reviews, follow-up, industry, name) on top of the shared filters; picking anything but "Manual"
  overrides `board_position`, so dragging then only changes column and the card highlights whichever
  field is driving the order.
- `CardModal.tsx` is the card detail: labels, follow-up date, the `notes` field, a per-lead comment
  timeline (`lead_comments`), and image/PDF attachments (`lead_attachments` + Storage), with
  drag-drop and Ctrl+V paste upload. The first image doubles as the card's cover on the board.
- `app/guia/` (`/guia`) is the **WhatsApp prospecting playbook**: message scripts with copy buttons,
  the step-by-step sale, objections, packages and funnel math. Static content held as data arrays at
  the top of `PlaybookGuide.tsx` — add a script or objection by editing an array, not the JSX. It is
  written against `web_status` (`sin_web` vs `solo_redes` get different scripts), so if those labels
  change, the guide's copy changes too.
- `app/config/` (`/config`) edits `app_config`; `app/admin/` (`/admin`) is the **user-management**
  panel (create/delete users, reset passwords). **Any authenticated user** can manage users. Admin
  actions go through the server route `app/api/admin/users/route.ts`, which uses a **service-role**
  client (`lib/supabase/admin.ts`, env `SUPABASE_SERVICE_ROLE_KEY`, server-only) and only requires a
  valid session. Self password change is `AccountButton.tsx` (anon client, `auth.updateUser`).
  `app/api/worker-env/route.ts` serves a ready-to-use `conexion.env` (service key) to logged-in users
  for the in-dashboard worker guide.
- `dashboard/public/motor-busquedas.zip` is the downloadable worker bundle the guide links to.
  Regenerate it when the Python side changes (see the zip-building snippet in the README).
- Edits write straight to Supabase from the client (RLS allows any authenticated user full access).
  Realtime keeps both users' views in sync.

### Supabase schema (`supabase/`)
`schema.sql` is the full, idempotent schema — run it in the SQL Editor. The numbered files
(`02_blocklist.sql` … `08_tablero.sql`) are incremental migrations for databases created before
those features existed. Tables: `leads` (manual columns `outreach_status`/`contacted`/`follow_up`/
`notes` are never overwritten by sync), `contacts`, `activity_log`, `scrape_jobs`, `worker_status`,
`blocklist`, `app_config` (one jsonb row per config section), `lead_comments` and `lead_attachments`
(the board's card timeline and files). RLS: authenticated users get full access; the scraper's
service-role key bypasses it. **Realtime publication block must stay at the end of `schema.sql`**
(after all tables exist) or a fresh run fails.

`08_tablero.sql` also creates the **`lead-files` Storage bucket** (public read so `<img>` loads
without signing; insert/delete require a session) and adds `leads.board_position` /
`leads.board_labels`. Both are **Supabase-only** — they are not in `_LEAD_COLUMNS` (`db.py`) nor in
the Excel, exactly like every other dashboard-owned field, so the scraper never touches them.

## Conventions & gotchas
- **Config defaults live twice**: `config.py` (Python) and `dashboard/lib/configDefaults.ts` (TS).
  They mirror each other — change both in lockstep. Supabase `app_config` overrides them at runtime
  on both sides.
- **Never let two processes touch `data/business_leads.xlsx` at once.** `_safe_save` writes to a temp
  file + atomic rename and raises a clear PermissionError if Excel has the file open — don't swallow it.
- Manual Excel columns (`outreach_status`, `contacted`, `follow_up`, `notes`) and the `contacted`
  sheet are user-owned. Code only appends/refreshes views — preserve this invariant in any change to
  `excel_manager.py`.
- Phone numbers are stored **exactly as the Maps listing shows them**; `+52` normalization happens
  only at click time (`lib/clean.ts` `phoneTel`/`phoneWa`, `src/utils.py` `normalize_phone`).
  `db.py` reads the Excel with `dtype=str` so pandas can't turn a phone into a float.
- Logging is forced to UTF-8 on Windows (cp1252 terminals) and writes a timestamped file to `logs/`.
- Two `.env` files, different keys: repo root `.env` / `conexion.env` (`SUPABASE_URL`,
  `SUPABASE_SERVICE_KEY` — secret, scraper) vs `dashboard/.env.local`
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public; plus
  `SUPABASE_SERVICE_ROLE_KEY` — secret, server-only). Never commit either.
- **PostgREST caps every query at 1000 rows.** It does not error — it just returns fewer, so the
  dashboard silently stops seeing leads past that count. `app/dashboard/page.tsx` pages through with
  `.range()` until a chunk comes back short, ordering by `lead_score` **plus `business_id`** as a
  tiebreaker so rows can't shuffle between chunks and get duplicated or dropped. Any new
  "fetch everything" query needs the same treatment.
- **`board_position` is a fractional index, not a row number.** Dropping a card between two others
  stores the midpoint of its neighbours, so a move rewrites one row instead of renumbering the
  column. `NULL` means "nobody has ordered this by hand yet": `LeadsBoard.effPos()` maps null to a
  large negative value derived from `lead_score`, which floats a freshly scraped high-score lead to
  the top of its column. If you change that mapping, change the sort and the drop math together —
  they must agree or cards land somewhere other than where they were dropped.
- Vercel deploys with **Root Directory = `dashboard`** (the app is not in the repo root). See
  `dashboard/DEPLOY.md` for the full setup walkthrough.
