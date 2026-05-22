# Google Maps Lead Generator

Sistema de prospectación comercial que detecta negocios **sin página web** en Google Maps.
Ideal para ofrecer servicios de desarrollo web, SEO, branding y marketing digital.

---

## Instalación

```bash
cd C:\Users\alexm\leads_generator

# 1. Crear entorno virtual (recomendado)
python -m venv .venv
.venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Instalar navegador Playwright
playwright install chromium
```

---

## Ejecución

```bash
# Ejecutar scraper con todas las queries configuradas
python main.py

# Modo sin cabeza (sin abrir ventana del navegador)
python main.py --headless

# Solo una query específica
python main.py --query "cafeterías en Guadalajara"

# Limitar resultados por query
python main.py --max-results 20

# También guardar snapshot fechado en data/runs/
python main.py --snapshot

# Reconstruir hojas filtradas sin hacer scraping
python main.py --mode refresh
```

---

## Configuración (`config.py`)

### Agregar nuevas categorías

```python
SEARCH_QUERIES = [
    "restaurantes en Guadalajara Jalisco",
    "cafeterías en Guadalajara Jalisco",   # ← agregar aquí
    "hoteles en Puerto Vallarta Jalisco",  # ← o aquí
]
```

### Ajustar límites

```python
SCRAPER_CONFIG = {
    "max_results_per_query": 60,   # resultados por búsqueda
    "headless": False,             # True = sin ventana
    "scroll_pause_min": 1.5,       # segundos mínimos entre scrolls
    "scroll_pause_max": 3.0,       # segundos máximos
}
```

### Ajustar scoring

```python
SCORING_WEIGHTS = {
    "no_website":          40,   # peso principal
    "rating_excellent":    20,
    "reviews_high":        20,
    "high_value_category": 15,
    "has_phone":            5,
}

PRIORITY_THRESHOLDS = {
    "high":   60,   # score >= 60 → high priority
    "medium": 35,
}
```

---

## Estructura del proyecto

```
leads_generator/
├── main.py               ← punto de entrada
├── config.py             ← toda la configuración
├── requirements.txt
├── src/
│   ├── scraper.py        ← Playwright / Google Maps
│   ├── excel_manager.py  ← persistencia XLSX
│   ├── lead_scoring.py   ← scoring automático
│   └── utils.py          ← logging, dedup helpers
├── data/
│   ├── business_leads.xlsx   ← archivo maestro
│   └── runs/                 ← snapshots fechados
└── logs/                     ← logs por ejecución
```

---

## Archivo XLSX (`data/business_leads.xlsx`)

| Hoja | Descripción |
|------|-------------|
| `raw_leads` | Todos los negocios scrapeados (fuente de verdad) |
| `no_website_leads` | Vista auto-generada: solo sin website |
| `high_priority` | Vista auto-generada: score alto + sin website |
| `contacted` | **Manual**: seguimiento de contactos (el sistema nunca la modifica) |

### Columnas automáticas

| Columna | Descripción |
|---------|-------------|
| `business_id` | Hash único SHA-256 (12 chars) |
| `no_website` | TRUE / FALSE |
| `lead_score` | Puntuación 0-100 |
| `priority` | high / medium / low |
| `website_status` | no_website / has_website |
| `first_seen` | Fecha del primer scrape |
| `last_seen` | Fecha del scrape más reciente |

### Columnas manuales (el sistema nunca las sobreescribe)

`outreach_status`, `contacted`, `follow_up`, `notes`

---

## Flujo incremental

```
1ª ejecución:
  → Crea business_leads.xlsx
  → Scrapea negocios
  → Guarda todos en raw_leads

2ª ejecución (misma semana):
  → Lee IDs y URLs existentes
  → Scrapea negocios
  → Solo agrega los NUEVOS
  → Nunca duplica
  → Nunca borra notas manuales

Ejecución con nueva categoría:
  → python main.py --query "spas en Guadalajara"
  → Solo esa query se ejecuta
  → Los nuevos leads se agregan al mismo archivo maestro
```

---

## Deduplicación

El sistema usa como clave única:
1. **maps_url normalizada** (sin el segmento `/data=...` que cambia por sesión)
2. **Fallback**: `name + address` (cuando no hay URL)

Si un negocio ya existe en el archivo, se omite silenciosamente y se cuenta como duplicado.

---

## Preservación de formato manual

- El sistema **solo agrega filas nuevas** a `raw_leads`. Nunca modifica filas existentes.
- Los colores, notas, comentarios y formato que agregues manualmente en `raw_leads` se preservan.
- La hoja `contacted` nunca es tocada por el sistema.
- Las hojas `no_website_leads` y `high_priority` son vistas auto-generadas — no agregues contenido manual ahí.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `playwright install` falla | Ejecutar como administrador |
| El browser se abre pero no encuentra resultados | Revisar si Google Maps cambió su layout; actualizar selectores en `scraper.py` |
| Muchos duplicados | Normal en ejecuciones repetidas de la misma query |
| Rate limiting / captcha | Aumentar `scroll_pause_min` y `detail_wait_min` en `config.py` |
| XLSX no se abre | Verificar que Excel no tenga el archivo abierto mientras corre el script |
| `No results feed found` | Google puede requerir login; ejecutar con `--headless False` y verificar manualmente |
