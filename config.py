from pathlib import Path

BASE_DIR = Path(__file__).parent

# ── Search queries ────────────────────────────────────────────────────────────
# Giros que VENDEN MEJOR un sitio web (clientes potenciales de la agencia) ×
# municipios de la ZMG. El scraper guarda la query como "category", así que cada
# query alimenta también la clasificación de industria (ver TARGET_INDUSTRIES).
SEARCH_QUERIES = [
    # Salud y estética — cita en línea, ticket alto
    "dentista en Guadalajara",
    "clínica dental en Zapopan",
    "consultorio médico en Guadalajara",
    "veterinaria en Zapopan",
    "spa en Guadalajara",
    "estética en Tlaquepaque",
    "barbería en Guadalajara",
    # Servicios profesionales — venden confianza, necesitan presencia
    "despacho de abogados en Guadalajara",
    "contador público en Zapopan",
    "agencia de seguros en Guadalajara",
    "inmobiliaria en Zapopan",
    # Comida y hospedaje — menú y reservas en línea
    "restaurante en Guadalajara",
    "cafetería en Zapopan",
    "hotel en Tlaquepaque",
    "salón de eventos en Guadalajara",
    # Fitness
    "gimnasio en Guadalajara",
    "estudio de yoga en Zapopan",
    # Comercio y talleres
    "mueblería en Guadalajara",
    "boutique de ropa en Zapopan",
    "taller mecánico en Tonalá",
]

# Municipios de la Zona Metropolitana de Guadalajara (referencia para ampliar queries).
ZMG_MUNICIPIOS = [
    "Guadalajara", "Zapopan", "Tlaquepaque", "Tonalá", "Tlajomulco", "El Salto",
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

# ── Presencia web ─────────────────────────────────────────────────────────────
# LA señal del negocio: la agencia vende sitios web, así que el mejor prospecto
# es el que NO tiene sitio propio. Google Maps deja poner cualquier link en el
# campo "sitio web", y muchos negocios ponen ahí su Facebook o la página gratis
# que Google les generó. Eso NO es un sitio propio: siguen siendo prospecto, y
# suelen ser los más fáciles de cerrar (ya entendieron que necesitan estar en
# línea, solo que lo resolvieron a medias).
#
# Si el "sitio web" contiene alguna de estas cadenas, se clasifica como
# "solo_redes" en vez de "con_web". Editable desde el dashboard (/config).
SOCIAL_DOMAINS = [
    # Redes sociales
    "facebook.com", "fb.com", "fb.me", "instagram.com", "tiktok.com",
    "twitter.com", "youtube.com", "linkedin.com", "pinterest.com",
    # Mensajería / agregadores de links
    "wa.me", "whatsapp.com", "linktr.ee", "linktree", "beacons.ai",
    "bio.link", "campsite.bio", "msng.link",
    # Sitios gratuitos autogenerados (Google Business, constructores gratis)
    "business.site", "negocio.site", "sites.google.com", "google.com/maps",
    "wixsite.com", "blogspot.com", "wordpress.com", "weebly.com",
    "jimdosite.com", "godaddysites.com", "mystrikingly.com", "carrd.co",
    # Marketplaces / directorios (no es el sitio del negocio)
    "mercadolibre.com", "amazon.com", "doctoralia.com", "ubereats.com",
    "rappi.com", "didifood", "booking.com", "airbnb.com", "tripadvisor",
]

# Etiquetas de presencia web (valores de la columna `web_status`)
WEB_SIN    = "sin_web"      # no hay nada: el mejor prospecto
WEB_REDES  = "solo_redes"   # solo Facebook/Instagram/página gratis: buen prospecto
WEB_PROPIO = "con_web"      # sitio propio: no es prospecto (a lo mucho, rediseño)

# ── Clasificación de industria ───────────────────────────────────────────────
# Segmenta el negocio por giro. NO decide si es prospecto (eso lo decide la
# presencia web), pero sí suma puntos: hay giros donde un sitio web vale mucho
# más (citas, menú, catálogo, reservas) y por lo tanto se venden más fácil.
# Cada entrada es (palabras_clave, etiqueta). Se recorre en orden y gana la
# primera etiqueta que aparezca en el nombre o la categoría (= la query).
TARGET_INDUSTRIES = [
    (["dentist", "dental", "ortodon", "endodon"],                 "Dental"),
    (["médic", "medic", "consultorio", "clínic", "clinic",
      "doctor", "pediatr", "dermatól", "dermatolog",
      "nutriólog", "nutriolog", "psicólog", "psicolog"],          "Salud / Consultorio"),
    (["veterinar", "mascota"],                                    "Veterinaria"),
    (["spa", "estétic", "estetic", "belleza", "uñas",
      "barber", "peluquer"],                                      "Belleza / Spa"),
    (["abogad", "jurídic", "juridic", "notar", "legal"],          "Abogados"),
    (["contad", "contabil", "fiscal"],                            "Contadores"),
    (["seguro", "asegurad", "afianzad"],                          "Seguros"),
    (["inmobiliar", "bienes raíces", "bienes raices"],            "Inmobiliaria"),
    (["restaurant", "taquer", "marisquer", "cocina", "comida",
      "pizzer", "sushi"],                                         "Restaurante"),
    (["cafeter", "café", "coffee", "reposter", "panader"],        "Cafetería / Panadería"),
    (["hotel", "hostal", "motel", "posada"],                      "Hotel"),
    (["salón de eventos", "salon de eventos", "banquete",
      "eventos", "boda"],                                         "Eventos"),
    (["gimnasio", "gym", "crossfit", "yoga", "pilates"],          "Gimnasio / Fitness"),
    (["escuela", "colegio", "academia", "instituto",
      "capacitac", "curso"],                                      "Educación"),
    (["mueble", "mueblería", "muebleria", "decorac"],             "Muebles / Decoración"),
    (["boutique", "ropa", "tienda", "zapater", "joyer"],          "Comercio / Retail"),
    (["taller", "automotriz", "mecánic", "mecanic", "hojalat",
      "refaccion", "llanter"],                                    "Automotriz"),
    (["arquitect", "constructora", "construc", "remodelac"],      "Arquitectura / Construcción"),
    (["fotograf", "publicidad", "marketing", "impren",
      "rotulac"],                                                 "Creativos / Publicidad"),
]

# ── Scoring ───────────────────────────────────────────────────────────────────
# Para una agencia de desarrollo web el mejor lead es un negocio que:
#   1. NO tiene sitio propio (o solo tiene redes)  ← la señal principal
#   2. Es de un giro donde un sitio web vende (citas, menú, catálogo)
#   3. Está vivo y le va bien (reseñas + rating) → tiene con qué pagar
#   4. Se puede contactar (teléfono)
# Los tramos de un mismo bloque NO se acumulan (solo aplica el más alto).
SCORING_WEIGHTS = {
    "no_website":       40,   # sin nada en internet: prospecto ideal
    "only_social":      28,   # solo Facebook/Instagram/página gratis
    "target_industry":  15,   # giro donde un sitio web se vende bien
    "reviews_high":     15,   # >= 100 reseñas → negocio consolidado
    "reviews_medium":   10,   # >= 50
    "reviews_low":       5,   # >= 20
    "rating_excellent":  8,   # >= 4.5 → negocio bien valorado
    "rating_good":       4,   # >= 4.0
    "has_phone":        10,   # contactable
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
