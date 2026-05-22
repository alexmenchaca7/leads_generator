from pathlib import Path

BASE_DIR = Path(__file__).parent

# ── Search queries ────────────────────────────────────────────────────────────
SEARCH_QUERIES = [
    "seguridad privada en Guadalajara",
    "seguridad privada Zapopan",
    "guardias de seguridad Guadalajara"
]

# ── Scraper ───────────────────────────────────────────────────────────────────
SCRAPER_CONFIG = {
    "headless": False,
    "timeout": 30_000,
    "max_results_per_query": 60,
    "scroll_pause_min": 1.5,
    "scroll_pause_max": 3.0,
    "detail_wait_min": 2.0,
    "detail_wait_max": 4.0,
    "retry_attempts": 3,
    "retry_delay": 3.0,
}

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA_DIR   = BASE_DIR / "data"
RUNS_DIR   = DATA_DIR / "runs"
LOGS_DIR   = BASE_DIR / "logs"
MASTER_FILE = DATA_DIR / "business_leads.xlsx"

# ── Scoring ───────────────────────────────────────────────────────────────────
HIGH_VALUE_CATEGORIES = [
    "restaurante", "gym", "gimnasio", "dentista", "médico", "doctor",
    "abogado", "contador", "hotel", "spa", "barbería", "estética",
    "clínica", "veterinaria", "taller", "agencia", "tienda", "salón",
]

SCORING_WEIGHTS = {
    "no_website":          40,
    "rating_excellent":    20,   # >= 4.5
    "rating_good":         10,   # >= 4.0
    "reviews_high":        20,   # >= 100
    "reviews_medium":      10,   # >= 50
    "high_value_category": 15,
    "has_phone":            5,
}

PRIORITY_THRESHOLDS = {
    "high":   60,
    "medium": 35,
}

# ── Excel dropdown options (data validation) ────────────────────────────────────
# Listas desplegables que aparecen en las columnas manuales del Excel.
# Edita los valores aquí y se aplicarán en el próximo guardado o `--mode refresh`.
DROPDOWN_OPTIONS = {
    # raw_leads
    "outreach_status": ["pendiente", "contactado", "no contestó",
                        "interesado", "no interesado", "cliente"],
    "contacted":       ["sí", "no"],
    # contacted
    "deal_status":     ["prospecto", "negociando", "ganado", "perdido"],
}
