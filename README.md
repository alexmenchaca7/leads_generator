# Google Maps Lead Generator

A full-stack prospecting tool that scrapes Google Maps to find local businesses **without a website** — the ideal cold-lead list for web agencies, freelancers, and digital marketing services.

Built with Python + Playwright for the scraper and Next.js + Supabase for the real-time web dashboard.

---

## Features

- **Smart scraper** — Playwright-based automation that extracts name, category, phone, website, rating, reviews, and GPS coordinates from Google Maps results
- **Lead scoring** — configurable weighted algorithm that ranks leads by conversion potential (no website = high score, strong reviews = bonus, etc.)
- **Incremental runs** — deduplication by normalized URL + name/address fallback; never re-scrapes the same business twice
- **Excel output** — master `.xlsx` with multiple auto-generated filtered views (`no_website_leads`, `high_priority`) and a manual `contacted` sheet the scraper never overwrites
- **Cloud dashboard** — Next.js web app backed by Supabase: real-time table, bulk actions, search history, and mobile-first responsive UI
- **Optional sync** — push leads from Excel to Supabase after each run; the dashboard reflects changes instantly

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Scraper | Python 3.12, Playwright (async) |
| Persistence | openpyxl / pandas (.xlsx) |
| Cloud DB | Supabase (PostgreSQL + Realtime) |
| Dashboard | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Auth | Supabase Auth (magic link / email) |
| Deploy | Vercel (dashboard) |

---

## Architecture

```
┌─────────────────────────────────┐
│  CLI Scraper  (Python)          │
│  main.py → src/scraper.py       │
│      ↓ Playwright / Google Maps │
│  src/excel_manager.py           │
│      ↓ business_leads.xlsx      │
│  src/db.py  ──→  Supabase DB   │
└─────────────────────────────────┘
              ↕ REST / Realtime
┌─────────────────────────────────┐
│  Web Dashboard  (Next.js)       │
│  dashboard/app/dashboard/       │
│  Supabase Auth + RLS            │
└─────────────────────────────────┘
```

---

## Project Structure

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
│   │   ├── dashboard/    ← main leads table, bulk actions, modals
│   │   ├── scrape/       ← trigger scraper runs from the browser
│   │   └── login/
│   └── lib/supabase/     ← client/server/middleware helpers
├── data/                 ← generated (gitignored): xlsx + run snapshots
└── logs/                 ← generated (gitignored): per-run logs
```

---

## Quick Start

### 1. Install dependencies

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
playwright install chromium
```

### 2. Configure your search

Edit `config.py` and set the queries for your target city/niche:

```python
SEARCH_QUERIES = [
    "restaurants in Austin Texas",
    "gyms in Austin Texas",
    "dental clinics in Austin Texas",
]
```

### 3. Run the scraper

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

### 4. Open the Excel

The master file is written to `data/business_leads.xlsx`:

| Sheet | Description |
|-------|-------------|
| `raw_leads` | All scraped businesses (source of truth) |
| `no_website_leads` | Auto-view: only businesses without a website |
| `high_priority` | Auto-view: high score + no website |
| `contacted` | Manual tracking — the scraper never touches this sheet |

---

## Configuration (`config.py`)

### Scoring weights

```python
SCORING_WEIGHTS = {
    "no_website":          40,   # main signal
    "rating_excellent":    20,   # >= 4.5 stars
    "reviews_high":        20,   # >= 100 reviews
    "high_value_category": 15,   # restaurants, gyms, clinics, etc.
    "has_phone":            5,
}

PRIORITY_THRESHOLDS = {
    "high":   60,   # score >= 60 → high priority
    "medium": 35,
}
```

### Scraper behavior

```python
SCRAPER_CONFIG = {
    "max_results_per_query": 60,
    "headless": False,
    "scroll_pause_min": 1.5,   # seconds between scrolls (anti-bot)
    "scroll_pause_max": 3.0,
    "retry_attempts": 3,
}
```

---

## Dashboard Setup (optional)

The web dashboard requires a free [Supabase](https://supabase.com) project.

```bash
cd dashboard
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev   # http://localhost:3000
```

Apply the database schema from `supabase/schema.sql` in the Supabase SQL editor.

For cloud sync from the scraper, copy `.env.example` to `.env` at the project root and add your `SUPABASE_SERVICE_KEY`.

---

## How Deduplication Works

Each business gets a stable `business_id` (SHA-256 of its normalized Maps URL, or name + address as fallback). On every run the scraper:

1. Reads all existing IDs and URLs from the master Excel
2. Skips any business already present
3. Only appends genuinely new rows

Manual notes, colors, and formatting in `raw_leads` are never overwritten.

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `playwright install` fails | Run terminal as administrator |
| Browser opens but finds no results | Google Maps may have changed its layout — update selectors in `src/scraper.py` |
| Many duplicates | Normal for repeated runs of the same query |
| Rate limiting / CAPTCHA | Increase `scroll_pause_min` and `detail_wait_min` in `config.py` |
| XLSX won't open | Close the file in Excel before running the scraper |
| `No results feed found` | Google may require login — run without `--headless` and verify manually |

---

## License

MIT — free to use, modify, and deploy for your own projects.
