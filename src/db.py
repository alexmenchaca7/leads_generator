"""
Supabase sync — empuja los leads del Excel maestro a la base de datos en la nube
para que el dashboard online los muestre.

Diseño:
  - Usa la SERVICE ROLE key (ignora RLS) para escribir desde el scraper local.
  - `upsert ... on conflict do nothing`: inserta leads NUEVOS y NO toca los que
    ya existen, así nunca pisa las ediciones manuales que tú o tu socio hagan
    desde el dashboard.
  - Es opcional: si no hay credenciales en .env, el scraper sigue trabajando
    solo con Excel.

Uso directo (migración inicial de todo el Excel a Supabase):
    python -m src.db --migrate
"""

import logging
import os
from pathlib import Path
from typing import Optional

import pandas as pd

from config import MASTER_FILE

logger = logging.getLogger(__name__)

# Columnas que viajan a Supabase (deben existir en la tabla `leads`)
_LEAD_COLUMNS = [
    "business_id", "name", "category", "address", "phone", "website",
    "rating", "reviews_count", "lat", "lng", "maps_url", "no_website",
    "lead_score", "priority", "website_status", "first_seen", "last_seen",
    "outreach_status", "contacted", "follow_up", "notes",
]

_NUMERIC_FLOAT = {"rating", "lat", "lng"}
_NUMERIC_INT   = {"reviews_count", "lead_score"}
_DATE_COLS     = {"first_seen", "last_seen", "follow_up"}
_MANUAL_DEFAULTS = {"outreach_status": "pendiente", "contacted": "no", "notes": ""}


def _load_env():
    """Carga variables desde .env si python-dotenv está disponible."""
    try:
        from dotenv import load_dotenv
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    except Exception:
        pass  # opcional; también funciona con variables de entorno del sistema


def _clean_value(col: str, value):
    """Convierte celdas de Excel a tipos válidos para Postgres."""
    # Vacíos → None (o default para campos manuales)
    if value is None or (isinstance(value, float) and pd.isna(value)) or \
       (isinstance(value, str) and value.strip() == ""):
        if col in _MANUAL_DEFAULTS:
            return _MANUAL_DEFAULTS[col]
        return None

    if col in _NUMERIC_FLOAT:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    if col in _NUMERIC_INT:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None
    if col == "no_website":
        return bool(value) if not isinstance(value, str) else value.strip().lower() in ("true", "1", "sí", "si")
    if col in _DATE_COLS:
        return str(value)[:10]  # YYYY-MM-DD
    return str(value).strip()


class SupabaseSync:
    def __init__(self, url: str, service_key: str):
        from supabase import create_client
        self.client = create_client(url, service_key)

    @classmethod
    def from_env(cls) -> Optional["SupabaseSync"]:
        """Devuelve una instancia si hay credenciales; si no, None."""
        _load_env()
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            return None
        try:
            return cls(url, key)
        except ImportError:
            logger.warning("Falta el paquete 'supabase'. Instala: pip install supabase")
            return None
        except Exception as exc:
            logger.warning("No se pudo conectar a Supabase: %s", exc)
            return None

    def fetch_blocked_ids(self) -> set[str]:
        """Devuelve los business_id vetados (borrados a propósito desde el dashboard)."""
        try:
            res = self.client.table("blocklist").select("business_id").execute()
            return {r["business_id"] for r in (res.data or [])}
        except Exception as exc:
            logger.warning("No se pudo leer la blocklist: %s", exc)
            return set()

    def push_leads(self, rows: list[dict]) -> int:
        """Inserta leads nuevos (ignora los que ya existen). Devuelve cuántos envió."""
        if not rows:
            return 0
        # on_conflict=business_id + ignore_duplicates → INSERT ... ON CONFLICT DO NOTHING
        self.client.table("leads").upsert(
            rows, on_conflict="business_id", ignore_duplicates=True
        ).execute()
        return len(rows)

    def sync_all_from_excel(self) -> int:
        """Lee el Excel maestro y sube todos los leads (los nuevos se insertan,
        los existentes quedan intactos). Devuelve cuántos renglones procesó."""
        if not MASTER_FILE.exists():
            logger.warning("No existe el Excel maestro: %s", MASTER_FILE)
            return 0

        df = pd.read_excel(str(MASTER_FILE), sheet_name="raw_leads")
        df = df[df["business_id"].notna() & (df["business_id"].astype(str).str.strip() != "")]

        blocked = self.fetch_blocked_ids()

        rows = []
        skipped_blocked = 0
        for _, r in df.iterrows():
            row = {col: _clean_value(col, r.get(col)) for col in _LEAD_COLUMNS}
            if row["business_id"] in blocked:
                skipped_blocked += 1
                continue
            rows.append(row)

        # Subir en lotes para no exceder límites de payload
        total = 0
        for i in range(0, len(rows), 500):
            total += self.push_leads(rows[i:i + 500])
        logger.info(
            "Supabase: %d leads sincronizados desde Excel (%d vetados omitidos)",
            total, skipped_blocked,
        )
        return total


def _cli():
    import argparse
    from src.utils import setup_logging
    setup_logging()
    p = argparse.ArgumentParser(description="Sincronizar leads con Supabase")
    p.add_argument("--migrate", action="store_true",
                   help="Sube todo el Excel maestro a Supabase (migración inicial)")
    args = p.parse_args()

    sync = SupabaseSync.from_env()
    if not sync:
        logger.error("Supabase no configurado. Crea un .env con SUPABASE_URL y SUPABASE_SERVICE_KEY.")
        return
    if args.migrate:
        sync.sync_all_from_excel()
    else:
        logger.info("Nada que hacer. Usa --migrate para subir el Excel completo.")


if __name__ == "__main__":
    _cli()
