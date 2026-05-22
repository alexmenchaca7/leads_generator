"""
Google Maps Lead Generator
Usage:
    python main.py                        # scrape all configured queries
    python main.py --headless             # headless browser
    python main.py --mode scrape          # explicit (default)
    python main.py --mode refresh         # rebuild filtered sheets only
    python main.py --query "cafeterías en Guadalajara"
    python main.py --max-results 30
    python main.py --snapshot             # also save a dated snapshot
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime

from config import SEARCH_QUERIES, SCRAPER_CONFIG, MASTER_FILE
from src.utils import setup_logging

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Google Maps Lead Generator")
    p.add_argument("--headless",     action="store_true",
                   help="Run browser in headless mode")
    p.add_argument("--mode",         choices=["scrape", "refresh"], default="scrape",
                   help="'scrape' collects new data; 'refresh' rebuilds filtered sheets")
    p.add_argument("--query",        type=str,
                   help="Single search query (overrides SEARCH_QUERIES in config.py)")
    p.add_argument("--max-results",  type=int,
                   help="Max results per query (overrides config)")
    p.add_argument("--snapshot",     action="store_true",
                   help="Also save a dated snapshot to data/runs/")
    return p.parse_args()


async def run_scrape(args: argparse.Namespace):
    from src.scraper import GoogleMapsScraper
    from src.excel_manager import ExcelManager

    headless = args.headless or SCRAPER_CONFIG.get("headless", False)
    scraper  = GoogleMapsScraper(headless=headless)
    if args.max_results:
        scraper.max_results = args.max_results

    queries = [args.query] if args.query else SEARCH_QUERIES
    excel   = ExcelManager()
    all_new: list[dict] = []

    # Load URLs already in the master file so we skip them before visiting.
    # Accumulates within this run too, so overlapping queries (e.g. Guadalajara
    # vs Zapopan) don't re-scrape the same business twice.
    from src.utils import normalize_url
    _, known_urls = excel.existing_keys()
    logger.info("Loaded %d known businesses from master file (will be skipped)", len(known_urls))

    # Cargar vetados (borrados desde el dashboard) para no re-scrapearlos.
    blocked_ids: set[str] = set()
    try:
        from src.db import SupabaseSync
        _sync = SupabaseSync.from_env()
        if _sync:
            blocked_ids = _sync.fetch_blocked_ids()
            logger.info("Loaded %d blocked businesses (vetados) — will be skipped", len(blocked_ids))
    except Exception as exc:
        logger.warning("No se pudo cargar la blocklist: %s", exc)

    for query in queries:
        logger.info("")
        logger.info("=" * 60)
        logger.info("QUERY: %s", query)
        logger.info("=" * 60)

        try:
            businesses = await scraper.scrape_query(
                query, known_urls=known_urls, blocked_ids=blocked_ids
            )
        except Exception as exc:
            logger.error("Scrape failed for '%s': %s", query, exc, exc_info=True)
            continue

        if not businesses:
            logger.warning("No businesses returned for '%s'", query)
            continue

        new_count, dup_count = excel.save_new_businesses(businesses)
        all_new.extend(b for b in businesses)

        # Remember everything we just scraped so the next query skips it.
        for b in businesses:
            known_urls.add(normalize_url(b.get("maps_url") or ""))

        logger.info(
            "SAVED → %d new  |  %d duplicates skipped",
            new_count, dup_count,
        )

    if args.snapshot and all_new:
        excel.save_snapshot(all_new)

    # Sincronizar con el dashboard online (Supabase). Opcional: si no hay .env,
    # se omite y el sistema sigue funcionando solo con Excel.
    try:
        from src.db import SupabaseSync
        sync = SupabaseSync.from_env()
        if sync:
            sync.sync_all_from_excel()
        else:
            logger.info("Supabase no configurado (sin .env) — omitiendo sync online")
    except Exception as exc:
        logger.error("Fallo sincronizando con Supabase: %s", exc, exc_info=True)

    # Summary
    no_web = sum(1 for b in all_new if not (b.get("website") or "").strip())
    logger.info("")
    logger.info("──────────────────────────────────────────────────────────")
    logger.info("RUN COMPLETE")
    logger.info("  Total scraped : %d businesses", len(all_new))
    logger.info("  Without website: %d", no_web)
    logger.info("  Master file   : %s", MASTER_FILE)
    logger.info("──────────────────────────────────────────────────────────")


def run_refresh():
    from src.excel_manager import ExcelManager
    if not MASTER_FILE.exists():
        logger.error("Master file not found: %s — run scrape mode first.", MASTER_FILE)
        sys.exit(1)
    ExcelManager().refresh_views()


def main():
    setup_logging()
    args = parse_args()

    logger.info("Google Maps Lead Generator — %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info("Mode: %s | Headless: %s", args.mode, args.headless)

    if args.mode == "scrape":
        asyncio.run(run_scrape(args))
    elif args.mode == "refresh":
        run_refresh()


if __name__ == "__main__":
    main()
