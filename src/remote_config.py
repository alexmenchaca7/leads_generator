"""
Config remota: aplica sobre `config.py` los ajustes que el usuario haya editado
desde el dashboard y que viven en la tabla `app_config` de Supabase.

Diseño:
  - `config.py` es la fuente de los valores POR DEFECTO.
  - Cada fila de `app_config` (key, value jsonb) sobreescribe una sección.
  - Se MUTAN en sitio los objetos de `config` (no se reasignan), para que los
    `from config import SCORING_WEIGHTS, ...` que ya hicieron otros módulos vean
    los nuevos valores sin reimportar.
  - Es tolerante a fallos: si no hay cliente, no hay tabla, o el JSON viene mal,
    se queda con los defaults y no rompe la corrida.

Se llama al inicio de cada corrida (main.py) y de cada job (worker.py).
"""

import logging

import config

logger = logging.getLogger(__name__)

# Claves válidas en app_config (las demás se ignoran).
CONFIG_KEYS = (
    "search_queries",
    "target_industries",
    "social_domains",
    "scoring_weights",
    "priority_thresholds",
    "dropdown_options",
    "scraper_config",
)


def fetch_config(client) -> dict:
    """Devuelve {key: value} de la tabla app_config, o {} si no se puede leer."""
    if client is None:
        return {}
    try:
        res = client.table("app_config").select("key,value").execute()
        return {r["key"]: r["value"] for r in (res.data or []) if r.get("key") in CONFIG_KEYS}
    except Exception as exc:
        logger.warning("No se pudo leer app_config (se usan defaults): %s", exc)
        return {}


def apply_overrides(client) -> bool:
    """Lee app_config y muta `config` en sitio. Devuelve True si aplicó algo."""
    overrides = fetch_config(client)
    if not overrides:
        return False

    applied = []

    # Listas: reasignación en sitio con slice para preservar el objeto importado.
    sq = overrides.get("search_queries")
    if isinstance(sq, list) and sq:
        config.SEARCH_QUERIES[:] = [str(q) for q in sq if str(q).strip()]
        applied.append("search_queries")

    ti = overrides.get("target_industries")
    if isinstance(ti, list) and ti:
        parsed = []
        for item in ti:
            if isinstance(item, dict) and item.get("label"):
                kws = [str(k).strip().lower() for k in (item.get("keywords") or []) if str(k).strip()]
                parsed.append((kws, str(item["label"])))
        if parsed:
            config.TARGET_INDUSTRIES[:] = parsed
            applied.append("target_industries")

    sd = overrides.get("social_domains")
    if isinstance(sd, list) and sd:
        config.SOCIAL_DOMAINS[:] = [str(d).strip().lower() for d in sd if str(d).strip()]
        applied.append("social_domains")

    # Dicts: update en sitio (solo claves conocidas, valores numéricos válidos).
    sw = overrides.get("scoring_weights")
    if isinstance(sw, dict):
        clean = {k: int(v) for k, v in sw.items() if k in config.SCORING_WEIGHTS and _is_num(v)}
        if clean:
            config.SCORING_WEIGHTS.update(clean)
            applied.append("scoring_weights")

    pt = overrides.get("priority_thresholds")
    if isinstance(pt, dict):
        clean = {k: int(v) for k, v in pt.items() if k in config.PRIORITY_THRESHOLDS and _is_num(v)}
        if clean:
            config.PRIORITY_THRESHOLDS.update(clean)
            applied.append("priority_thresholds")

    do = overrides.get("dropdown_options")
    if isinstance(do, dict):
        clean = {
            k: [str(x) for x in v]
            for k, v in do.items()
            if k in config.DROPDOWN_OPTIONS and isinstance(v, list) and v
        }
        if clean:
            config.DROPDOWN_OPTIONS.update(clean)
            applied.append("dropdown_options")

    sc = overrides.get("scraper_config")
    if isinstance(sc, dict):
        clean = {k: v for k, v in sc.items() if k in config.SCRAPER_CONFIG and _is_num(v)}
        if clean:
            config.SCRAPER_CONFIG.update(clean)
            applied.append("scraper_config")

    if applied:
        logger.info("Config remota aplicada desde el dashboard: %s", ", ".join(applied))
    return bool(applied)


def _is_num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)
