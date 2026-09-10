import hashlib
import logging
import re
import sys
from datetime import datetime

from config import LOGS_DIR


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOGS_DIR / f"scrape_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)

    # Force UTF-8 on Windows terminals that default to cp1252
    import io
    stdout_utf8 = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    ch = logging.StreamHandler(stdout_utf8)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    fh = logging.FileHandler(log_file, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)

    return root


def normalize_url(url: str) -> str:
    """
    Strip /data=... and normalize encoding/case so the same business
    always produces the same dedup key regardless of URL encoding differences
    between Playwright sessions.
    """
    from urllib.parse import unquote
    if not url:
        return ""
    if "/data=" in url:
        url = url.split("/data=")[0]
    try:
        url = unquote(url)          # %27 == ' == same business
    except Exception:
        pass
    return url.rstrip("/").lower()  # case-insensitive


def generate_business_id(
    maps_url: str = "",
    name: str = "",
    address: str = "",
) -> str:
    key = normalize_url(maps_url) if maps_url else f"{name.lower().strip()}|{address.lower().strip()}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]


def normalize_phone(raw: str) -> str:
    """Normaliza a '+52' + 10 digitos (Mexico), tolerando las variantes con que
    Google entrega el numero: 10 (nacional), 11 (1+10), 12 (52+10), 13 (521+10).
    Asi todos quedan iguales.
        '+52 33 3613 3523' -> '+523336133523'
        '523336133523'     -> '+523336133523'
        '5213336133523'    -> '+523336133523'
        '3336133523'       -> '+523336133523'
    """
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    d = digits
    if len(d) == 13 and d.startswith("521"):
        d = d[3:]
    elif len(d) == 13 and (d.startswith("044") or d.startswith("045")):
        d = d[3:]
    elif len(d) == 12 and d.startswith("52"):
        d = d[2:]
    elif len(d) == 12 and d.startswith("01"):
        d = d[2:]
    elif len(d) == 11 and d.startswith("1"):
        d = d[1:]
    # NO adivinar recortando: si no quedo en 10, se deja tal cual (con '+')
    # para NO cambiar el numero.
    if len(d) == 10:
        return "+52" + d
    return "+" + digits  # numero no estandar; se puede corregir a mano


def parse_number(text: str) -> float | None:
    """Parse a number like '4.5', '4,5', '1.234' or '1,234' from a string."""
    if not text:
        return None
    text = text.strip()
    # Remove thousands separators and normalise decimal
    cleaned = re.sub(r"[^\d,\.]", "", text)
    if not cleaned:
        return None
    # If there's a comma AND a dot, the one used last is the decimal separator
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        # Could be decimal comma (European) or thousands separator
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None
