"""
Google Maps scraper using Playwright.

Strategy:
  1. Navigate to maps.google.com/search/{query}
  2. Scroll the left-panel feed to collect place URLs
  3. Visit each place URL individually to extract structured data
  4. Return list of raw business dicts for the caller to persist
"""

import asyncio
import logging
import re
import random
from typing import Optional
from urllib.parse import quote_plus

from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    TimeoutError as PWTimeoutError,
)

from config import SCRAPER_CONFIG
from src.utils import normalize_url, parse_number

logger = logging.getLogger(__name__)

# ── Selector bundles (ordered by reliability) ─────────────────────────────────

_WEBSITE_SELECTORS = [
    'a[data-item-id="authority"]',
    'a[aria-label*="sitio web" i]',
    'a[aria-label*="website" i]',
    'a[href^="http"][data-tooltip*="web" i]',
]

_ADDRESS_SELECTORS = [
    'button[data-item-id="address"]',
    '[data-item-id="address"]',
    'button[aria-label*="Dirección" i]',
    'button[aria-label*="Address" i]',
]

_PHONE_SELECTORS = [
    '[data-item-id*="phone:tel"]',
    'button[aria-label*="Teléfono" i]',
    'button[aria-label*="Phone" i]',
    '[data-tooltip*="Copiar núm" i]',
]

_RATING_RE = re.compile(r"(\d[\.,]\d)\s*(star|estrella|estrellas|stars)", re.I)
_REVIEWS_RE = re.compile(r"([\d\.,]+)\s*(review|reseña|opinión|reseñas|reviews|opiniones)", re.I)
_LAT_LNG_RE = re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)")


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _jitter(lo: float = None, hi: float = None):
    lo = lo if lo is not None else SCRAPER_CONFIG["scroll_pause_min"]
    hi = hi if hi is not None else SCRAPER_CONFIG["scroll_pause_max"]
    await asyncio.sleep(random.uniform(lo, hi))


async def _try_selectors(page: Page, selectors: list[str]) -> Optional[str]:
    """Return inner_text of the first matching selector, or None."""
    for sel in selectors:
        try:
            el = await page.query_selector(sel)
            if el:
                return (await el.inner_text()).strip()
        except Exception:
            pass
    return None


async def _try_selectors_attr(page: Page, selectors: list[str], attr: str) -> Optional[str]:
    for sel in selectors:
        try:
            el = await page.query_selector(sel)
            if el:
                value = await el.get_attribute(attr)
                return value.strip() if value else None
        except Exception:
            pass
    return None


async def _dismiss_popups(page: Page):
    for sel in (
        'button[id="L2AGLb"]',
        'button[aria-label*="Accept all" i]',
        'button[aria-label*="Aceptar todo" i]',
        'button[aria-label*="Acepto" i]',
        'button[jsname="b3VHJd"]',
        'form[action*="consent"] button',
    ):
        try:
            btn = await page.query_selector(sel)
            if btn and await btn.is_visible():
                await btn.click()
                await asyncio.sleep(1.2)
                return
        except Exception:
            pass


# ── Core scraper class ────────────────────────────────────────────────────────

class GoogleMapsScraper:
    def __init__(self, headless: bool | None = None):
        cfg = SCRAPER_CONFIG
        self.headless      = headless if headless is not None else cfg["headless"]
        self.timeout       = cfg["timeout"]
        self.max_results   = cfg["max_results_per_query"]
        self.retries       = cfg["retry_attempts"]
        self.retry_delay   = cfg["retry_delay"]
        self.detail_min    = cfg["detail_wait_min"]
        self.detail_max    = cfg["detail_wait_max"]

    # ── Browser / context factory ─────────────────────────────────────────────

    async def _make_context(self, playwright) -> tuple[Browser, BrowserContext]:
        browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--lang=es-MX",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            locale="es-MX",
            timezone_id="America/Mexico_City",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        # Hide automation fingerprint
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        return browser, context

    # ── Step 1: collect place URLs from search results ────────────────────────

    async def _collect_urls(self, page: Page, query: str) -> list[str]:
        """
        Scroll through the feed and return full place hrefs (including /data=CID).
        The /data= segment is the Google-internal CID that uniquely identifies a
        business — without it, navigating to the place URL shows a blank panel.
        We keep it for navigation but strip it later for deduplication.
        """
        url = f"https://www.google.com/maps/search/{quote_plus(query)}"
        logger.info("Navigating to search: %s", url)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
        except PWTimeoutError:
            logger.warning("Timeout loading search page for '%s'", query)
            return []

        await _dismiss_popups(page)
        await _jitter(2.5, 4.0)

        # Wait for the results feed
        try:
            await page.wait_for_selector('div[role="feed"]', timeout=15_000)
        except PWTimeoutError:
            logger.warning("No results feed found for '%s'", query)
            return []

        # Map: normalized_url -> full_url (keeps the /data= CID for navigation)
        url_map: dict[str, str] = {}
        no_new = 0

        for scroll_n in range(80):
            links = await page.query_selector_all(
                'div[role="feed"] a[href*="/maps/place/"]'
            )
            for link in links:
                try:
                    href = await link.get_attribute("href")
                    if not href:
                        continue
                    if not href.startswith("http"):
                        href = "https://www.google.com" + href
                    norm = normalize_url(href)
                    if norm not in url_map:
                        url_map[norm] = href
                except Exception:
                    pass

            logger.debug("Scroll %d — %d unique places", scroll_n + 1, len(url_map))

            if len(url_map) >= self.max_results:
                logger.info("Max results (%d) reached", self.max_results)
                break

            prev = len(url_map)

            # Scroll the feed all the way to its current bottom. Fixed +700
            # increments often stall before the last item is in view, so Google
            # never receives the signal to stream the next batch. Jumping to
            # scrollHeight reliably triggers lazy-loading of more results.
            await page.evaluate(
                "const f = document.querySelector('div[role=\"feed\"]');"
                "if (f) f.scrollTo(0, f.scrollHeight);"
            )
            await _jitter()

            # Detect end-of-list text → stop immediately (we've seen everything)
            end_reached = False
            try:
                for el in await page.query_selector_all('p[class*="fontBody"], span[class*="fontBody"]'):
                    txt = (await el.inner_text()).lower()
                    if ("final de la lista" in txt or "end of the list" in txt
                            or "llegaste al final" in txt):
                        logger.info("End-of-list marker detected")
                        end_reached = True
                        break
            except Exception:
                pass
            if end_reached:
                break

            if len(url_map) == prev:
                no_new += 1
                # Give Google extra time to stream the next batch before giving up.
                await _jitter(2.0, 3.5)
                if no_new >= 8:
                    logger.info("No new results after %d unchanged scrolls — stopping", no_new)
                    break
            else:
                no_new = 0

        # Return as list of (normalized_key, full_feed_url) tuples
        pairs = list(url_map.items())[: self.max_results]
        logger.info("Collected %d place URLs for '%s'", len(pairs), query)
        return pairs

    # ── Step 2: extract data from a single place page ─────────────────────────

    async def _extract(self, page: Page, url: str, search_query: str, feed_url: str = "") -> Optional[dict]:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=self.timeout)
        except PWTimeoutError:
            logger.warning("Timeout loading place: %s", url[:80])
            return None

        # Wait for the place detail panel to actually render
        try:
            await page.wait_for_selector("h1", timeout=12_000)
        except PWTimeoutError:
            logger.warning("h1 never appeared for: %s", url[:80])
            return None

        await _jitter(self.detail_min, self.detail_max)

        # Use the original feed URL as the stable dedup key.
        # page.url includes @lat,lng which differs from the feed href format,
        # so normalizing both would produce different strings across runs.
        data: dict = {
            "maps_url":     feed_url or page.url,
            "category":     search_query,
            "name":         "",
            "address":      "",
            "phone":        "",
            "website":      "",
            "rating":       None,
            "reviews_count": None,
            "lat":          None,
            "lng":          None,
        }

        # Lat / lng from URL
        m = _LAT_LNG_RE.search(page.url)
        if m:
            data["lat"] = float(m.group(1))
            data["lng"] = float(m.group(2))

        # Name
        try:
            h1 = await page.query_selector("h1")
            if h1:
                data["name"] = (await h1.inner_text()).strip()
        except Exception as exc:
            logger.debug("Name: %s", exc)

        # Website (most important field)
        website = await _try_selectors_attr(page, _WEBSITE_SELECTORS, "href")
        if not website:
            # Some listings show website as inner text of the anchor
            website = await _try_selectors(page, _WEBSITE_SELECTORS)
        data["website"] = (website or "").strip()

        # Address
        address = await _try_selectors(page, _ADDRESS_SELECTORS)
        data["address"] = (address or "").strip()

        # Phone
        phone = await _try_selectors(page, _PHONE_SELECTORS)
        data["phone"] = (phone or "").strip()

        # Rating + reviews — scan all aria-labels
        try:
            spans = await page.query_selector_all("span[aria-label], button[aria-label]")
            for span in spans:
                label = (await span.get_attribute("aria-label")) or ""
                if not label:
                    continue

                if data["rating"] is None:
                    rm = _RATING_RE.search(label)
                    if rm:
                        data["rating"] = parse_number(rm.group(1))

                if data["reviews_count"] is None:
                    rvm = _REVIEWS_RE.search(label)
                    if rvm:
                        n = parse_number(rvm.group(1))
                        data["reviews_count"] = int(n) if n is not None else None
        except Exception as exc:
            logger.debug("Rating/reviews scan: %s", exc)

        # Fallback: try to read rating from the visible text near the name
        if data["rating"] is None:
            try:
                candidates = await page.query_selector_all(
                    'span[aria-hidden="true"]'
                )
                for el in candidates:
                    txt = (await el.inner_text()).strip()
                    n = parse_number(txt)
                    if n and 1.0 <= n <= 5.0:
                        data["rating"] = n
                        break
            except Exception:
                pass

        return data

    # ── Public entry point ────────────────────────────────────────────────────

    async def scrape_query(self, query: str, known_urls: set[str] | None = None) -> list[dict]:
        results: list[dict] = []
        known_urls = known_urls or set()

        async with async_playwright() as pw:
            browser, context = await self._make_context(pw)
            page = await context.new_page()

            try:
                pairs = await self._collect_urls(page, query)
            except Exception as exc:
                logger.error("Failed collecting URLs for '%s': %s", query, exc, exc_info=True)
                await browser.close()
                return results

            # Skip businesses already collected in previous runs / earlier queries
            # so we don't waste time re-visiting place pages we'll discard at save.
            before = len(pairs)
            pairs = [(n, f) for (n, f) in pairs if n not in known_urls]
            skipped = before - len(pairs)
            if skipped:
                logger.info("Skipping %d already-known places (dedup before visit)", skipped)

            for idx, (norm_url, full_url) in enumerate(pairs, 1):
                logger.info("[%d/%d] %s", idx, len(pairs), full_url[:90])

                for attempt in range(1, self.retries + 1):
                    try:
                        data = await self._extract(page, full_url, query, feed_url=full_url)
                        if data and data["name"]:
                            results.append(data)
                            web_label = data["website"] or "NO WEBSITE"
                            logger.info(
                                "  [OK] %s  |  %s  |  rating=%s  reviews=%s",
                                data["name"][:40],
                                web_label[:40],
                                data["rating"],
                                data["reviews_count"],
                            )
                        else:
                            logger.warning("  [SKIP] Empty record, skipping")
                        break
                    except Exception as exc:
                        logger.warning("  Attempt %d/%d failed: %s", attempt, self.retries, exc)
                        if attempt < self.retries:
                            await asyncio.sleep(self.retry_delay)

                await _jitter(1.8, 4.5)

            await browser.close()

        logger.info("Query '%s' → %d businesses scraped", query, len(results))
        return results
