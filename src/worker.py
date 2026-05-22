"""
Worker local de scrapeo.

Corre en tu PC y procesa las búsquedas que creas desde el dashboard:
  1. Detecta trabajos "pendientes" en Supabase (cola scrape_jobs).
  2. Ejecuta el scraper SIN abrir navegador (headless).
  3. Guarda en el Excel y sube los resultados a Supabase (respeta vetados y dedup).
  4. Reporta el estado (corriendo → listo / error) que el dashboard ve en vivo.

Mantiene un "heartbeat" para que el dashboard sepa que está conectado.

Uso:
    python -m src.worker          # queda escuchando trabajos (déjalo abierto)
    python -m src.worker --once   # procesa los pendientes y termina

Requiere un .env con SUPABASE_URL y SUPABASE_SERVICE_KEY.
"""

import argparse
import asyncio
import logging
import threading
import time
from datetime import datetime, timezone

from config import SCRAPER_CONFIG
from src.utils import setup_logging

logger = logging.getLogger(__name__)

POLL_SECONDS = 4
HEARTBEAT_SECONDS = 15


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _start_heartbeat(client):
    """Hilo en segundo plano que avisa que el worker sigue vivo."""
    def beat():
        while True:
            try:
                client.table("worker_status").upsert(
                    {"id": 1, "last_seen": _now()}, on_conflict="id"
                ).execute()
            except Exception as exc:
                logger.debug("Heartbeat falló: %s", exc)
            time.sleep(HEARTBEAT_SECONDS)

    threading.Thread(target=beat, daemon=True).start()


def _claim_next_job(client):
    """Toma el siguiente trabajo pendiente (marcándolo 'running' de forma atómica)."""
    res = (
        client.table("scrape_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )
    jobs = res.data or []
    if not jobs:
        return None
    job = jobs[0]
    upd = (
        client.table("scrape_jobs")
        .update({"status": "running", "started_at": _now()})
        .eq("id", job["id"])
        .eq("status", "pending")  # evita que dos workers tomen el mismo
        .execute()
    )
    return job if upd.data else None


def _run_job(sync, excel, job):
    from src.scraper import GoogleMapsScraper

    client = sync.client
    job_id = job["id"]
    query = job["query"]
    max_results = int(job.get("max_results") or SCRAPER_CONFIG["max_results_per_query"])

    logger.info("▶ Trabajo %s: '%s' (máx %d)", job_id[:8], query, max_results)
    client.table("worker_status").upsert(
        {"id": 1, "last_seen": _now(), "current_job": job_id}, on_conflict="id"
    ).execute()

    try:
        blocked_ids = sync.fetch_blocked_ids()
        _, known_urls = excel.existing_keys()

        scraper = GoogleMapsScraper(headless=True)  # nunca abre ventana
        scraper.max_results = max_results

        businesses = asyncio.run(
            scraper.scrape_query(query, known_urls=known_urls, blocked_ids=blocked_ids)
        )
        new_count, dup_count = excel.save_new_businesses(businesses)
        sync.sync_all_from_excel()

        client.table("scrape_jobs").update(
            {
                "status": "done",
                "new_count": new_count,
                "dup_count": dup_count,
                "message": f"{new_count} nuevos · {dup_count} duplicados",
                "finished_at": _now(),
            }
        ).eq("id", job_id).execute()
        logger.info("✓ Trabajo %s listo: %d nuevos, %d duplicados", job_id[:8], new_count, dup_count)

    except Exception as exc:
        logger.error("✗ Trabajo %s falló: %s", job_id[:8], exc, exc_info=True)
        client.table("scrape_jobs").update(
            {"status": "error", "message": str(exc)[:300], "finished_at": _now()}
        ).eq("id", job_id).execute()
    finally:
        client.table("worker_status").upsert(
            {"id": 1, "last_seen": _now(), "current_job": None}, on_conflict="id"
        ).execute()


def main():
    setup_logging()
    p = argparse.ArgumentParser(description="Worker de scrapeo (cola del dashboard)")
    p.add_argument("--once", action="store_true", help="Procesa los pendientes y termina")
    args = p.parse_args()

    from src.db import SupabaseSync
    from src.excel_manager import ExcelManager

    sync = SupabaseSync.from_env()
    if not sync:
        logger.error("Supabase no configurado. Crea un .env con SUPABASE_URL y SUPABASE_SERVICE_KEY.")
        return

    excel = ExcelManager()
    _start_heartbeat(sync.client)
    logger.info("Worker en línea. %s", "Procesando pendientes…" if args.once else "Esperando búsquedas…")

    while True:
        try:
            job = _claim_next_job(sync.client)
        except Exception as exc:
            logger.warning("No se pudo leer la cola: %s", exc)
            job = None

        if job:
            _run_job(sync, excel, job)
            continue  # procesa el siguiente de inmediato

        if args.once:
            logger.info("No hay más trabajos pendientes. Fin.")
            return
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
