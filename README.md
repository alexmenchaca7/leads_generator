# Google Maps Lead Generator

> **Full-stack prospecting tool** that scrapes Google Maps to find local businesses **without a website** — the ideal cold-lead list for web agencies, freelancers, and digital marketing services.

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![Playwright](https://img.shields.io/badge/Playwright-async-green?logo=playwright)](https://playwright.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase)](https://supabase.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)

## What it does

- Scrapes Google Maps results for any city + niche query and extracts name, category, phone, website, rating, reviews, and GPS coordinates.
- **Scores each lead 0–100** based on configurable signals: no website, rating, review count, business category, phone presence.
- **Deduplicates automatically** across runs — uses normalized Maps URL + name/address fallback; never adds the same business twice.
- Writes a master **Excel file** with multiple auto-generated filtered views (`no_website_leads`, `high_priority`) and a manual `contacted` sheet the scraper never overwrites.
- **Optionally syncs to Supabase** after each run so the web dashboard reflects changes in real time.
- Ships a **Next.js dashboard** with real-time leads table, bulk actions, search history, and mobile-first responsive UI.

## How it works

```
$ python main.py --query "restaurants in Austin Texas"

Scraper: [Playwright opens Google Maps, scrolls results]
         → 60 businesses extracted

         [Lead scorer evaluates each business]
         → restaurant · 4.8★ · 240 reviews · no website  →  score 75  (high)
         → gym        · 3.2★ ·  12 reviews · has website  →  score  5  (low)
         → dentist    · 4.5★ ·  80 reviews · no website  →  score 60  (high)

         [ExcelManager deduplicates and writes]
         → 47 new businesses added to raw_leads
         → 13 duplicates skipped (already in master file)
         → no_website_leads and high_priority views rebuilt

         [Optional: Supabase sync]
         → 47 leads pushed to cloud DB
         → dashboard reflects changes instantly

Run complete: 47 new · 13 skipped · 38 without website
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
```

To run the dashboard locally:

```bash
cd dashboard
cp .env.local.example .env.local   # fill in Supabase anon key
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
| Auth | Supabase Auth (magic link / email) |
| Deploy | Vercel (zero-config) |

## Project structure

```
leads_generator/
├── main.py               ← entry point (CLI)
├── config.py             ← all configuration (queries, scoring, paths)
├── requirements.txt
├── .env.example          ← copy to .env and add your Supabase keys
├── src/
│   ├── scraper.py        ← Playwright / Google Maps automation
│   ├── excel_manager.py  ← XLSX persistence & view generation
│   ├── lead_scoring.py   ← scoring algorithm
│   ├── db.py             ← optional Supabase sync
│   └── utils.py          ← logging, dedup helpers
├── supabase/
│   └── schema.sql        ← database schema (leads, blocklist, activity)
├── dashboard/            ← Next.js web dashboard
│   ├── app/
│   │   ├── dashboard/    ← leads table, bulk actions, modals
│   │   ├── scrape/       ← trigger scraper runs from the browser
│   │   └── login/
│   └── lib/supabase/     ← client/server/middleware helpers
├── data/                 ← generated (gitignored): xlsx + run snapshots
└── logs/                 ← generated (gitignored): per-run logs
```

> `data/` and `logs/` are generated at runtime and are git-ignored. The master Excel file lives in `data/business_leads.xlsx` and accumulates across runs — never loses previous data.

## Scoring system

| Signal | Weight | Condition |
|---|---|---|
| **no_website** | 40 | business has no website |
| **rating_excellent** | 20 | rating ≥ 4.5 stars |
| **reviews_high** | 20 | review count ≥ 100 |
| **high_value_category** | 15 | restaurant, gym, clinic, etc. |
| **has_phone** | 5 | phone number present |

Priority is assigned as `high` (score ≥ 60), `medium` (≥ 35), or `low`. All thresholds are configurable in `config.py`.

### Excel output sheets

| Sheet | Description |
|---|---|
| **raw_leads** | All scraped businesses — source of truth, never modified by the scraper |
| **no_website_leads** | Auto-view: only businesses without a website |
| **high_priority** | Auto-view: score ≥ 60 + no website |
| **contacted** | Manual tracking sheet — the scraper never touches this |

Manual notes, colors, and formatting added to `raw_leads` are preserved across runs.

## License

MIT
