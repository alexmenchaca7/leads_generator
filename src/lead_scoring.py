"""
Clasificación y puntuación de leads para una agencia de desarrollo web.

La señal principal es la PRESENCIA WEB: el mejor prospecto es el negocio que no
tiene sitio propio. La industria segmenta y da puntos extra (hay giros donde un
sitio se vende más fácil), pero no decide si es prospecto.

Todo sale de `config.py`, que el dashboard puede sobreescribir en tiempo real
vía `src/remote_config.py`. Por eso los valores se leen del módulo `config` en
cada llamada en vez de importarlos por nombre: así los cambios del dashboard
aplican sin reimportar.
"""

from urllib.parse import urlparse

import config


def classify_web(business: dict) -> tuple[str, bool]:
    """Clasifica la presencia web del negocio.

    Devuelve (web_status, is_target):
      - "sin_web"    → no hay link: prospecto ideal.
      - "solo_redes" → el link es Facebook/Instagram/página gratis/directorio;
                       no es un sitio propio, así que sigue siendo prospecto.
      - "con_web"    → sitio propio: no es prospecto para vender un sitio nuevo.
    """
    site = (business.get("website") or "").strip()
    if not site:
        return config.WEB_SIN, True

    # El campo puede venir sin esquema ("miweb.com/algo"); urlparse necesita uno
    # para poblar netloc, así que se lo agregamos antes de partirlo.
    raw = site if "//" in site else f"//{site}"
    parsed = urlparse(raw)
    haystack = f"{parsed.netloc}{parsed.path}".lower().lstrip("www.")

    for domain in config.SOCIAL_DOMAINS:
        if domain.lower() in haystack:
            return config.WEB_REDES, True

    return config.WEB_PROPIO, False


def classify_industry(business: dict) -> str:
    """Etiqueta el giro del negocio.

    Recorre TARGET_INDUSTRIES y devuelve la primera etiqueta cuyas palabras
    clave aparezcan en la categoría (= la query con la que se scrapeó) o en el
    nombre. Devuelve "" si no cae en ninguna.
    """
    haystack = f"{business.get('category') or ''} {business.get('name') or ''}".lower()
    for keywords, label in config.TARGET_INDUSTRIES:
        if any(kw in haystack for kw in keywords):
            return label
    return ""


def calculate_score(business: dict) -> dict:
    """Puntúa el negocio como prospecto de la agencia (0–100 aprox.)."""
    weights = config.SCORING_WEIGHTS
    score = 0

    # 1) Presencia web — la señal principal. Los tramos no se acumulan.
    web_status, is_target = classify_web(business)
    if web_status == config.WEB_SIN:
        score += weights["no_website"]
    elif web_status == config.WEB_REDES:
        score += weights["only_social"]

    # 2) Giro: hay industrias donde un sitio web se vende mucho mejor.
    industry = classify_industry(business)
    if industry:
        score += weights["target_industry"]

    # 3) Tamaño / tracción: reseñas como proxy de que el negocio está vivo y
    #    tiene clientes (= tiene con qué pagar un sitio).
    reviews = business.get("reviews_count") or 0
    if reviews >= 100:
        score += weights["reviews_high"]
    elif reviews >= 50:
        score += weights["reviews_medium"]
    elif reviews >= 20:
        score += weights["reviews_low"]

    # 4) Reputación: negocio bien valorado, vale la pena invertirle.
    rating = business.get("rating") or 0
    if rating >= 4.5:
        score += weights["rating_excellent"]
    elif rating >= 4.0:
        score += weights["rating_good"]

    # 5) Contactable.
    if business.get("phone"):
        score += weights["has_phone"]

    # Un negocio que YA tiene sitio propio no es prospecto para vender un sitio
    # nuevo, por más grande que sea: se manda a prioridad baja.
    if not is_target:
        priority = "low"
    elif score >= config.PRIORITY_THRESHOLDS["high"]:
        priority = "high"
    elif score >= config.PRIORITY_THRESHOLDS["medium"]:
        priority = "medium"
    else:
        priority = "low"

    return {
        "lead_score": score,
        "priority": priority,
        "is_target": is_target,
        "web_status": web_status,
        "industry": industry,
    }
