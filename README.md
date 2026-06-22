# Google Maps Lead Generator

A full-stack prospecting tool that scrapes Google Maps to find local businesses **without a website** — the ideal cold-lead list for web agencies, freelancers, and digital marketing services.

> Built with Python + Playwright for scraping and Next.js + Supabase for the real-time web dashboard.

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

**Scraper (Python)**

| Tool | Role |
|------|------|
| Python 3.12 + Playwright (async) | Browser automation, Google Maps scraping |
| pandas + openpyxl | XLSX persistence and filtered view generation |
| Supabase Python SDK | Optional cloud sync after each run |

**Dashboard (Next.js)**

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (magic link / email) |
| Deploy | Vercel (zero-config) |

---

## Architecture

```
Input: search queries (city + niche)
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  CLI Scraper  (Python)                               │
│  main.py                                             │
│  ├── src/scraper.py  ← Playwright / Google Maps      │
│  │       extracts: name · category · phone ·         │
│  │                 website · rating · reviews · GPS   │
│  ├── src/lead_scoring.py  ← scores 0–100            │
│  │       signals: no_website · rating · reviews ·    │
│  │                category · phone                    │
│  ├── src/excel_manager.py  ← XLSX persistence        │
│  │       sheets: raw_leads · no_website_leads ·      │
│  │               high_priority · contacted            │
│  └── src/db.py  ← optional Supabase push            │
└──────────────────────────────────────────────────────┘
                    │ REST API
                    ▼
┌──────────────────────────────────────────────────────┐
│  Web Dashboard  (Next.js + Supabase)                 │
│  dashboard/app/dashboard/                            │
│  ├── Real-time leads table (Supabase Realtime)       │
│  ├── Bulk actions · search history · modals          │
│  └── Supabase Auth + RLS (row-level security)        │
└──────────────────────────────────────────────────────┘
```

> Supabase sync is **optional** — the scraper works fully standalone with Excel only. Add credentials in `.env` to enable the dashboard.

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

## How It Works

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

### Scoring weights

| Signal | Weight | Condition |
|--------|--------|-----------|
| `no_website` | 40 | business has no website |
| `rating_excellent` | 20 | rating ≥ 4.5 |
| `reviews_high` | 20 | reviews ≥ 100 |
| `high_value_category` | 15 | restaurant, gym, clinic, etc. |
| `has_phone` | 5 | phone number present |

Priority is assigned as `high` (score ≥ 60), `medium` (≥ 35), or `low`. All thresholds are configurable in `config.py`.

### Estimated output per run

| Query type | Businesses scraped | High-priority leads |
|------------|-------------------|---------------------|
| City + niche (e.g. "restaurants in Austin") | 40–60 | 10–25 |
| Broader area (e.g. "restaurants Texas") | 50–60 | 15–30 |
| Full site (multiple queries) | 200–400 | 60–120 |

Results accumulate across runs — each new execution only adds businesses not already in the master file.

---

## Configuration (`config.py`)

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

### Scoring weights

```python
SCORING_WEIGHTS = {
    "no_website":          40,
    "rating_excellent":    20,   # >= 4.5 stars
    "reviews_high":        20,   # >= 100 reviews
    "high_value_category": 15,
    "has_phone":            5,
}

PRIORITY_THRESHOLDS = {
    "high":   60,
    "medium": 35,
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

> The dashboard is entirely optional. Every feature of the scraper works without it using the Excel file alone.

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
