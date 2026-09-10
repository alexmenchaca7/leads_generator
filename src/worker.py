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
from datetime import datetime, timezone, timedelta

from config import SCRAPER_CONFIG
from src.utils import setup_logging

logger = logging.getLogger(__name__)

POLL_SECONDS = 4
HEARTBEAT_SECONDS = 15

# Limpieza automática del historial para que las tablas no crezcan sin límite.
PRUNE_EVERY_SECONDS = 3600          # como mucho, una vez por hora
JOBS_RETENTION_DAYS = 60            # búsquedas terminadas/erróneas más viejas que esto se borran
ACTIVITY_RETENTION_DAYS = 180       # historial de cambios más viejo que esto se borra
_last_prune = 0.0


def _prune_old(client):
    """Borra historial viejo (scrape_jobs y activity_log) para no llenar la BD.
    No toca leads ni la configuración. Throttled a una vez por hora."""
    global _last_prune
    now = time.time()
    if now - _last_prune < PRUNE_EVERY_SECONDS:
        return
    _last_prune = now
    try:
        jobs_cut = (datetime.now(timezone.utc) - timedelta(days=JOBS_RETENTION_DAYS)).isoformat()
        client.table("scrape_jobs").delete().lt("created_at", jobs_cut).in_(
            "status", ["done", "error"]
        ).execute()
        act_cut = (datetime.now(timezone.utc) - timedelta(days=ACTIVITY_RETENTION_DAYS)).isoformat()
        client.table("activity_log").delete().lt("created_at", act_cut).execute()
        logger.info("Limpieza: historial > %dd (jobs) / %dd (actividad) eliminado",
                    JOBS_RETENTION_DAYS, ACTIVITY_RETENTION_DAYS)
    except Exception as exc:
        logger.debug("Limpieza de historial falló: %s", exc)


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


def _run_rescore_job(sync, excel, job):
    """Recalcula score/prioridad/presencia web/giro de todos los leads con la
    config actual y los actualiza en Excel y Supabase. Reporta en la cola como
    cualquier otro trabajo."""
    client = sync.client
    job_id = job["id"]
    logger.info("▶ Trabajo %s: recálculo de scores", job_id[:8])
    try:
        updated = excel.rescore_all()
        n = sync.update_scores(updated) if updated else 0

        client.table("scrape_jobs").update({
            "status": "done",
            "new_count": 0,
            "dup_count": 0,
            "message": f"{len(updated)} leads recalculados",
            "finished_at": _now(),
        }).eq("id", job_id).execute()

        try:
            client.table("activity_log").insert({
                "user_email": job.get("requested_by") or "",
                "action": "rescore",
                "business_id": None,
                "business_name": f"{len(updated)} leads recalculados",
                "changes": {"updated": len(updated), "synced": n},
            }).execute()
        except Exception as exc:
            logger.debug("No se pudo registrar en activity_log: %s", exc)

        logger.info("✓ Trabajo %s listo: %d leads recalculados", job_id[:8], len(updated))
    except Exception as exc:
        logger.error("✗ Trabajo %s (recálculo) falló: %s", job_id[:8], exc, exc_info=True)
        client.table("scrape_jobs").update(
            {"status": "error", "message": str(exc)[:300], "finished_at": _now()}
        ).eq("id", job_id).execute()
    finally:
        client.table("worker_status").upsert(
            {"id": 1, "last_seen": _now(), "current_job": None}, on_conflict="id"
        ).execute()


def _run_job(sync, excel, job):
    from src.scraper import GoogleMapsScraper
    from src.remote_config import apply_overrides

    client = sync.client
    job_id = job["id"]
    query = job["query"]

    client.table("worker_status").upsert(
        {"id": 1, "last_seen": _now(), "current_job": job_id}, on_conflict="id"
    ).execute()

    # Tomar la config más reciente editada desde el dashboard antes de trabajar.
    try:
        apply_overrides(client)
    except Exception as exc:
        logger.warning("No se pudo aplicar config remota: %s", exc)

    # Trabajo especial: recalcular scores de todos los leads (no scrapea).
    if (query or "").strip() == "__rescore__":
        _run_rescore_job(sync, excel, job)
        return

    max_results = int(job.get("max_results") or SCRAPER_CONFIG["max_results_per_query"])
    logger.info("▶ Trabajo %s: '%s' (máx %d)", job_id[:8], query, max_results)

    try:
        blocked_ids = sync.fetch_blocked_ids()
        _, known_urls = excel.existing_keys()

        scraper = GoogleMapsScraper(headless=True)  # nunca abre ventana
        scraper.max_results = max_results

        businesses = asyncio.run(
            scraper.scrape_query(query, known_urls=known_urls, blocked_ids=blocked_ids)
        )
        res = excel.save_new_businesses(businesses)
        new_count, dup_count = res["new_count"], res["dup_count"]
        sync.sync_all_from_excel()

        # Negocios omitidos = ya conocidos/vetados (pre-visita) + duplicados al guardar
        skipped_names = [n for n in (scraper.last_skipped_names + res["dup_names"]) if n]
        new_names = [n for n in res["new_names"] if n]

        # Actualiza "última vez visto" de los que ya existían y reaparecieron.
        seen_ids = list({i for i in scraper.last_seen_again_ids if i})
        if seen_ids:
            today = datetime.now(timezone.utc).date().isoformat()
            for i in range(0, len(seen_ids), 200):
                try:
                    client.table("leads").update({"last_seen": today}).in_(
                        "business_id", seen_ids[i : i + 200]
                    ).execute()
                except Exception as exc:
                    logger.debug("No se pudo actualizar last_seen: %s", exc)

        client.table("scrape_jobs").update(
            {
                "status": "done",
                "new_count": new_count,
                "dup_count": dup_count,
                "new_names": new_names,
                "skipped_names": skipped_names,
                "message": f"{new_count} nuevos · {len(skipped_names)} omitidos",
                "finished_at": _now(),
            }
        ).eq("id", job_id).execute()

        # Registra en el historial de cambios que la búsqueda agregó negocios.
        if new_count > 0:
            try:
                client.table("activity_log").insert({
                    "user_email": job.get("requested_by") or "",
                    "action": "scrape",
                    "business_id": None,
                    "business_name": f'{new_count} negocios · "{query}"',
                    "changes": {"new_names": new_names, "query": query},
                }).execute()
            except Exception as exc:
                logger.debug("No se pudo registrar en activity_log: %s", exc)

        logger.info("✓ Trabajo %s listo: %d nuevos, %d omitidos", job_id[:8], new_count, len(skipped_names))

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
    _prune_old(sync.client)  # limpieza inicial del historial viejo
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
        _prune_old(sync.client)  # throttled: como mucho 1 vez/hora cuando está ocioso
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
