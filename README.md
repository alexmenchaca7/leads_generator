# Google Maps Lead Generator

> **Full-stack prospecting tool** that scrapes Google Maps to find local businesses **without a website** — the ideal cold-lead list for web agencies, freelancers, and digital marketing services.

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![Playwright](https://img.shields.io/badge/Playwright-async-green?logo=playwright)](https://playwright.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)

## What it does

- Scrapes Google Maps results for any city + niche query and extracts name, category, phone, website, rating, reviews, and GPS coordinates.
- **Classifies web presence** into `sin_web` (no site at all), `solo_redes` (the "website" is a Facebook/Instagram page, a link aggregator, or a free auto-generated site like `business.site`) and `con_web` (a real site of their own). The first two are prospects — and `solo_redes` is usually the easiest close.
- **Scores each lead** on configurable signals: web presence, industry fit, review count, rating, phone. A business that already has its own site is forced to low priority.
- **Deduplicates automatically** across runs — uses normalized Maps URL + name/address fallback; never adds the same business twice.
- Writes a master **Excel file** with auto-generated filtered views (`target_leads`, `high_priority`) and a manual `contacted` sheet the scraper never overwrites.
- **Optionally syncs to Supabase** after each run so the web dashboard reflects changes in real time.
- Ships a **Next.js dashboard** with a real-time leads table, quick filters by web presence, one-click call/WhatsApp, bulk actions, an in-app config editor, user management, and a mobile-first responsive UI.

## How it works

```
$ python main.py --query "dentista en Guadalajara"

Scraper: [Playwright opens Google Maps, scrolls results]
         → 60 businesses extracted

         [Lead scorer evaluates each business]
         → dentist    · 4.8★ · 150 reviews · sin_web     →  score 88  (high)
         → taqueria   · 4.6★ · 320 reviews · solo_redes  →  score 76  (high)
         → cafe       · 4.9★ · 400 reviews · con_web     →  score 48  (low)

         [ExcelManager deduplicates and writes]
         → 47 new businesses added to raw_leads
         → 13 duplicates skipped (already in master file)
         → target_leads and high_priority views rebuilt

         [Optional: Supabase sync]
         → 47 leads pushed to cloud DB
         → dashboard reflects changes instantly

Run complete: 47 new · 13 skipped · 31 sin web · 9 solo redes
```

Supabase sync is optional — the scraper works fully standalone with Excel only. Add credentials in `.env` to enable the dashboard.

## Requirements

- **Python 3.12+** — [python.org](https://python.org)
- **pip** (comes with Python)
- **~200 MB disk space**

Node.js 18+ and a Supabase project are only needed for the optional web dashboard.

## Installation

```bash
git clone https://github.com/alexmenchaca7/leads_generator
cd leads_generator

python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium
```

To enable the optional **cloud dashboard**, create a `.env` from the example and fill in your Supabase keys:

```bash
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_KEY
```

## Usage

Edit `config.py` to set your target city and niche, then run:

```bash
# Scrape all configured queries
python main.py

# Headless (no browser window)
python main.py --headless

# Single query
python main.py --query "coffee shops in Chicago"

# Limit results per query
python main.py --max-results 30

# Save a dated snapshot to data/runs/
python main.py --snapshot

# Rebuild filtered sheets without scraping again
python main.py --mode refresh

# Re-score every existing lead with the current config
python main.py --mode rescore
```

Searches can also be launched **from the dashboard**. Leave the worker running on the
scraping PC and it will pick up queued jobs (this is what powers the *+ Buscar* screen):

```bash
python -m src.worker          # long-running: waits for jobs from the dashboard
python -m src.worker --once   # drain pending jobs, then exit
```

To run the dashboard locally:

```bash
cd dashboard
cp .env.local.example .env.local   # fill in URL + anon key + service-role key
npm install
npm run dev                         # open http://localhost:3000
```

To deploy the dashboard:

```bash
cd dashboard
npx vercel        # live in ~1 minute
```

## Tech stack

| Layer | Technology |
|---|---|
| Scraper | Python 3.12, Playwright (async) |
| Persistence | pandas + openpyxl (.xlsx) |
| Cloud DB | Supabase (PostgreSQL + Realtime) |
| Dashboard | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Auth | Supabase Auth (email + password) |
| Deploy | Vercel (zero-config) |

## Project structure

```
leads_generator/
├── main.py               ← entry point (CLI)
├── config.py             ← all configuration (queries, scoring, paths)
├── requirements.txt
├── .env.example          ← copy to .env and add your Supabase keys
├── instalar.bat          ← one-click installer for the scraping PC
├── start_worker.bat      ← one-click start for the search engine (worker)
├── src/
│   ├── scraper.py        ← Playwright / Google Maps automation
│   ├── excel_manager.py  ← XLSX persistence & view generation
│   ├── lead_scoring.py   ← web-presence classifier + scoring algorithm
│   ├── remote_config.py  ← applies the config edited from the dashboard
│   ├── worker.py         ← job queue runner (dashboard-triggered searches)
│   ├── db.py             ← optional Supabase sync
│   └── utils.py          ← logging, dedup helpers
├── supabase/
│   ├── schema.sql        ← full schema (leads, blocklist, activity, config)
│   └── 0*.sql            ← incremental migrations for existing databases
├── dashboard/            ← Next.js web dashboard
│   ├── app/
│   │   ├── dashboard/    ← leads table, bulk actions, modals
│   │   ├── scrape/       ← trigger searches + in-app setup guide
│   │   ├── config/       ← edit queries, scoring and thresholds in the browser
│   │   ├── admin/        ← user management (create / delete / reset password)
│   │   ├── api/          ← server routes (admin, worker connection file)
│   │   └── login/
│   └── lib/supabase/     ← client/server/middleware helpers
├── data/                 ← generated (gitignored): xlsx + run snapshots
└── logs/                 ← generated (gitignored): per-run logs
```

> `data/` and `logs/` are generated at runtime and are git-ignored. The master Excel file lives in `data/business_leads.xlsx` and accumulates across runs — never loses previous data.

## Scoring system

The agency sells websites, so the strongest signal is the **absence of one**.

| Signal | Weight | Condition |
|---|---|---|
| **no_website** | 40 | no link at all on the listing — the ideal prospect |
| **only_social** | 28 | the "website" is a Facebook/Instagram page, a link aggregator, or a free auto-generated site |
| **target_industry** | 15 | a trade where a website sells well (dental, restaurant, lawyer…) |
| **reviews_high** | 15 | review count ≥ 100 — established, has budget |
| **reviews_medium** | 10 | review count ≥ 50 |
| **reviews_low** | 5 | review count ≥ 20 |
| **rating_excellent** | 8 | rating ≥ 4.5 stars |
| **rating_good** | 4 | rating ≥ 4.0 stars |
| **has_phone** | 10 | phone number present |

Priority is `high` (score ≥ 60), `medium` (≥ 35), or `low`. **A business that already has its own
site is always `low`**, no matter how big it is — it is not a prospect for a new build.

All weights, thresholds, target industries and the "doesn't count as a real site" domain list are
configurable in `config.py` **and editable live from the dashboard** (`/config` → *Guardar*). Use
*Recalcular leads* to re-score the leads you already have with the new settings.

### Excel output sheets

| Sheet | Description |
|---|---|
| **raw_leads** | All scraped businesses — source of truth, never modified by the scraper |
| **target_leads** | Auto-view: only prospects (no site of their own) |
| **high_priority** | Auto-view: prospects with `high` priority |
| **contacted** | Manual tracking sheet — the scraper never touches this |

Manual notes, colors, and formatting added to `raw_leads` are preserved across runs.

## Deploying to a non-technical team

The end client only ever sees the dashboard. Everything they need is in the app:

1. Deploy the dashboard to Vercel with **Root Directory = `dashboard`** (see `dashboard/DEPLOY.md`).
2. On the scraping PC, download the worker bundle from the dashboard (*+ Buscar* → guide → *Descargar
   programa*), run `instalar.bat` once, drop in the `conexion.env` the guide generates, and launch
   `start_worker.bat`.
3. Add teammates from **Usuarios** inside the dashboard — no Supabase console needed.

Full step-by-step in Spanish: [`INSTALACION_WORKER.md`](INSTALACION_WORKER.md).

The downloadable bundle lives at `dashboard/public/motor-busquedas.zip`. Regenerate it after changing
the Python side:

```bash
python - <<'EOF'
import pathlib, zipfile
files = ["config.py", "main.py", "requirements.txt", "instalar.bat",
         "start_worker.bat", "INSTALACION_WORKER.md"]
with zipfile.ZipFile("dashboard/public/motor-busquedas.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in files + [str(p) for p in pathlib.Path("src").glob("*.py")]:
        z.write(f, f)
    z.writestr("data/.gitkeep", ""); z.writestr("logs/.gitkeep", "")
EOF
```

## License

MIT
