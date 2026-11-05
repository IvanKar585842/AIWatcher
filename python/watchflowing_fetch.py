"""WatchFlowing fetch worker.

Scrapling is the retrieval engine. Strategy "http" uses Fetcher (no browser).
Strategies "dynamic" and "advanced" reuse one StealthySession (Chromium via Patchright).

This process does not solve CAPTCHAs, Cloudflare challenges, logins, or paywalls.
solve_cloudflare stays false. Blocked responses are returned as outcome "blocked".
"""

from __future__ import annotations

import base64
import ipaddress
import json
import re
import sys
import time
from typing import Any
from urllib.parse import urlparse

WATCH_UA = "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)"
# Never enable challenge solving. A challenge is a failed check.
SOLVE_CLOUDFLARE = False
MAX_HTML_CHARS = 1_000_000
MAX_FOLLOW = 3

CHALLENGE_RE = re.compile(
    r"cf-browser-verification|challenge-platform|just a moment\.\.\.|"
    r"attention required|datadome|verify you are human|bot detection|"
    r"security check|cf-challenge|hcaptcha|recaptcha",
    re.I,
)
PRICE_RE = re.compile(
    r"(?:USD|EUR|GBP|\$|€|£)\s*\d{1,7}(?:[.,]\d{2})?|\d{1,7}(?:[.,]\d{2})?\s*(?:USD|EUR|GBP|\$|€|£)",
    re.I,
)
AVAIL_RE = re.compile(
    r"in\s*stock|out\s*of\s*stock|sold\s*out|available\s*now|pre-?order|add\s*to\s*cart|unavailable",
    re.I,
)

_browser = None
_browser_key: tuple[str, str] | None = None
_curl_tls_broken = False


def write(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def host_is_blocked(hostname: str, allow_loopback: bool) -> bool:
    host = (hostname or "").strip().lower().rstrip(".")
    if not host:
        return True
    if host in {"localhost"} or host.endswith(".localhost"):
        return not allow_loopback
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    if ip.is_loopback:
        return not allow_loopback
    return bool(
        ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def url_is_blocked(url: str, allow_loopback: bool) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return True
    if parsed.scheme not in {"http", "https"}:
        return True
    return host_is_blocked(parsed.hostname or "", allow_loopback)


def response_html(page: Any) -> str:
    body = getattr(page, "body", b"") or b""
    if isinstance(body, bytes):
        encoding = getattr(page, "encoding", None) or "utf-8"
        try:
            return body.decode(encoding, errors="replace")
        except LookupError:
            return body.decode("utf-8", errors="replace")
    if isinstance(body, str):
        return body
    html = getattr(page, "html_content", None)
    return str(html or "")


def response_text(page: Any) -> str:
    try:
        return str(page.get_all_text(separator="\n", strip=True))
    except Exception:
        html = response_html(page)
        return re.sub(r"<[^>]+>", " ", html)


def header_map(page: Any) -> dict[str, str]:
    raw = getattr(page, "headers", None) or {}
    try:
        items = dict(raw).items()
    except Exception:
        return {}
    out: dict[str, str] = {}
    for key, value in items:
        out[str(key).lower()] = str(value)
    return out


def is_challenge(status: int, html: str, text: str, headers: dict[str, str]) -> bool:
    if status in {401, 403, 407}:
        return True
    if headers.get("cf-mitigated") or any(k.startswith("cf-chl") for k in headers):
        return True
    sample = f"{text[:2500]}\n{html[:2500]}"
    if CHALLENGE_RE.search(sample) and len(text.strip()) < 1600:
        return True
    return False


def is_dynamic_shell(html: str, text: str) -> bool:
    visible = re.sub(r"\s+", " ", text).strip()
    main = re.search(r"<(main|article)\b[^>]*>([\s\S]*?)</\1>", html, re.I)
    main_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", main.group(2))).strip() if main else ""
    if len(main_text) >= 80:
        return False
    if len(visible) > 500:
        scripted = re.search(r"__NEXT_DATA__|self\.__next_f|data-reactroot|id=[\"'](__next|root|app)[\"']", html, re.I)
        empty_slot = re.search(r"<(main|article|table|ul|tbody)\b[^>]*>\s*</\1>", html, re.I) or re.search(
            r"aria-busy=[\"']true[\"']|class=[\"'][^\"']*skeleton", html, re.I
        )
        return bool(scripted and empty_slot and len(main_text) < 40)
    if re.search(r"enable javascript", visible, re.I) and len(visible) < 700:
        return True
    if re.search(r'id=["\'](__next|root|app|__nuxt|sapper)["\']', html, re.I) and len(visible) < 400:
        return True
    if re.search(r"__NEXT_DATA__|self\.__next_f|data-reactroot", html) and len(visible) < 350:
        return True
    scripts = len(re.findall(r"<script\b", html, re.I))
    empty_main = re.search(r"<(main|article)[^>]*>\s*</\1>", html, re.I)
    if empty_main and scripts >= 2 and len(visible) < 220:
        return True
    return scripts >= 8 and len(visible) < 280


def css_nodes(page: Any, selector: str) -> tuple[list[Any], bool]:
    try:
        found = list(page.css(selector))
    except Exception:
        found = []
    if found:
        return found, False
    try:
        found = list(page.css(selector, adaptive=True))
    except Exception:
        found = []
    return found, bool(found)


def node_text(node: Any) -> str:
    try:
        value = str(node.get_all_text(separator=" ", strip=True))
    except Exception:
        value = str(getattr(node, "text", "") or "")
    return re.sub(r"\s+", " ", value).strip()


def node_html(node: Any) -> str:
    html = getattr(node, "html_content", None)
    if html:
        return str(html)
    return node_text(node)


def parse_price(raw: str) -> float | None:
    match = re.search(r"\d[\d.,]*", raw)
    if not match:
        return None
    token = match.group(0)
    if "," in token and "." in token:
        if token.rfind(",") > token.rfind("."):
            token = token.replace(".", "").replace(",", ".")
        else:
            token = token.replace(",", "")
    elif "," in token and re.search(r",\d{2}$", token):
        token = token.replace(",", ".")
    else:
        token = token.replace(",", "")
    try:
        return float(token)
    except ValueError:
        return None


def currency_of(raw: str) -> str | None:
    if "$" in raw or "USD" in raw.upper():
        return "USD"
    if "€" in raw or "EUR" in raw.upper():
        return "EUR"
    if "£" in raw or "GBP" in raw.upper():
        return "GBP"
    return None


def availability_of(text: str) -> str:
    lower = text.lower()
    if re.search(r"out\s*of\s*stock|sold\s*out|unavailable", lower):
        return "out_of_stock"
    if re.search(r"pre-?order", lower):
        return "preorder"
    if re.search(r"in\s*stock|available|add\s*to\s*cart", lower):
        return "in_stock"
    return "unknown"


def collect_prices(page: Any, text: str) -> list[dict[str, Any]]:
    found: list[str] = []
    for selector in (
        '[itemprop="price"]',
        "[data-price]",
        ".price",
        ".product-price",
        ".sale-price",
        ".current-price",
    ):
        nodes, _ = css_nodes(page, selector)
        for node in nodes[:12]:
            raw = str(getattr(node, "text", "") or "").strip()
            if raw and PRICE_RE.search(raw):
                found.append(re.sub(r"\s+", " ", raw)[:80])
    if not found:
        found.extend(match.group(0) for match in PRICE_RE.finditer(text))
    prices = []
    seen: set[str] = set()
    for raw in found:
        key = raw.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        value = parse_price(key)
        if value is None:
            continue
        prices.append({"raw": key, "value": value, "currency": currency_of(key)})
    return prices[:8]


def collect_items(page: Any) -> tuple[list[dict[str, Any]], bool]:
    selectors = (
        ".product",
        "[data-product]",
        ".job",
        ".job-listing",
        ".listing",
        "article.product",
    )
    items: list[dict[str, Any]] = []
    found_container = False
    for selector in selectors:
        nodes, _ = css_nodes(page, selector)
        if not nodes:
            continue
        found_container = True
        for node in nodes[:40]:
            title = node_text(node)
            if len(title) < 3 or len(title) > 240:
                continue
            if re.search(r"sponsored|advertisement|recommended for you", title, re.I):
                continue
            href = ""
            try:
                links = list(node.css("a"))
                if links:
                    href = str(links[0].attrib.get("href") or "")
            except Exception:
                href = str(node.attrib.get("href") or "")
            price_match = PRICE_RE.search(title)
            items.append(
                {
                    "key": (href or title)[:180],
                    "title": title[:180],
                    "url": href[:400],
                    "price": parse_price(price_match.group(0)) if price_match else None,
                }
            )
        if items:
            break
    deduped = []
    seen: set[str] = set()
    for item in items:
        if item["key"] in seen:
            continue
        seen.add(item["key"])
        deduped.append(item)
    return deduped[:30], found_container


def collect_links(page: Any) -> list[dict[str, str]]:
    links = []
    try:
        nodes = list(page.css("a"))
    except Exception:
        nodes = []
    for node in nodes[:80]:
        href = str(node.attrib.get("href") or "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:")):
            continue
        text = node_text(node)[:120]
        links.append({"href": href[:500], "text": text})
    return links


def collect_images(page: Any) -> list[str]:
    images = []
    try:
        nodes = list(page.css("img"))
    except Exception:
        nodes = []
    for node in nodes[:40]:
        src = str(node.attrib.get("src") or "").strip()
        if src and not src.startswith("data:"):
            images.append(src[:300])
    return images


def meta_content(page: Any, selector: str) -> str:
    nodes, _ = css_nodes(page, selector)
    if not nodes:
        return ""
    return str(nodes[0].attrib.get("content") or nodes[0].text or "").strip()[:300]


def build_structured(page: Any, text: str) -> dict[str, Any]:
    items, listings_found = collect_items(page)
    title_nodes, _ = css_nodes(page, "title")
    title = str(title_nodes[0].text).strip() if title_nodes else ""
    version = None
    version_match = re.search(r"\bv?\d+\.\d+\.\d+(?:[-+][\w.]+)?\b", text)
    if version_match:
        version = version_match.group(0)
    return {
        "title": title[:300],
        "description": meta_content(page, 'meta[name="description"]'),
        "prices": collect_prices(page, text),
        "availability": availability_of(text),
        "items": items,
        "listingsFound": listings_found,
        "links": collect_links(page),
        "images": collect_images(page),
        "version": version,
    }


def extract_for_mode(page: Any, req: dict[str, Any], text: str, html: str) -> tuple[str, str | None]:
    mode = req.get("mode") or "ENTIRE_PAGE"
    selector = (req.get("selector") or "").strip()

    if mode == "CSS_SELECTOR":
        if not selector:
            return "", "CSS selector is required"
        nodes, _adaptive = css_nodes(page, selector)
        if not nodes:
            return "", f"CSS selector not found: {selector}"
        return node_html(nodes[0]), None

    if mode == "XPATH":
        if not selector:
            return "", "XPath is required"
        try:
            nodes = list(page.xpath(selector))
        except Exception:
            nodes = []
        if not nodes:
            try:
                nodes = list(page.xpath(selector, adaptive=True))
            except Exception:
                nodes = []
        if not nodes:
            return "", f"XPath not found: {selector}"
        return node_html(nodes[0]), None

    if mode == "PRICE_DETECTION":
        prices = collect_prices(page, text)
        if prices:
            return "\n".join(p["raw"] for p in prices), None
        return text[:5000], None

    if mode == "KEYWORD_DETECTION":
        keywords = [str(k) for k in (req.get("keywords") or []) if str(k).strip()]
        lower = text.lower()
        found = [kw for kw in keywords if kw.lower() in lower]
        contexts = []
        for kw in found:
            idx = lower.find(kw.lower())
            if idx >= 0:
                contexts.append(text[max(0, idx - 100) : idx + len(kw) + 100])
        return ("\n".join(found) + "\n" + "\n...\n".join(contexts)).strip() or text[:5000], None

    if mode == "TABLE_DETECTION":
        rows = []
        try:
            tables = list(page.css("table"))
        except Exception:
            tables = []
        for index, table in enumerate(tables[:5]):
            lines = []
            try:
                trs = list(table.css("tr"))
            except Exception:
                trs = []
            for tr in trs[:40]:
                cells = []
                try:
                    tds = list(tr.css("th, td"))
                except Exception:
                    tds = []
                for cell in tds:
                    value = re.sub(r"\s+", " ", str(cell.text or "")).strip()
                    if value:
                        cells.append(value)
                if cells:
                    lines.append(" | ".join(cells))
            if lines:
                rows.append(f"Table {index + 1}:\n" + "\n".join(lines))
        return ("\n\n".join(rows) if rows else text[:5000]), None

    if mode == "JOB_LISTINGS":
        items, _found = collect_items(page)
        if items:
            return "\n---\n".join(item["title"] for item in items), None
        return text[:8000], None

    if mode == "PRODUCT_AVAILABILITY":
        signals = AVAIL_RE.findall(text)
        return ("\n".join(dict.fromkeys(signals)) if signals else text[:5000]), None

    if mode in {"DOCUMENTATION_CHANGES", "AI_SMART"}:
        for selector in ("article", "main", '[role="main"]', ".markdown-body", ".docs-content", "#content"):
            nodes, _ = css_nodes(page, selector)
            if nodes and len(str(nodes[0].text or "").strip()) > 80:
                return node_html(nodes[0]), None
        return (html if mode == "AI_SMART" else text[:10000]), None

    if mode == "TEXT_CHANGES":
        return text, None

    if mode in {"VISUAL_CHANGES", "SCREENSHOT_DIFF"}:
        return "[visual-screenshot]", None

    return html, None


def follow_links(page: Any, req: dict[str, Any], allow_loopback: bool) -> str:
    raw_selectors = req.get("followLinkSelectors") or ""
    selectors = [part.strip() for part in str(raw_selectors).split(",") if part.strip()]
    if not selectors:
        return ""
    origin = urlparse(str(getattr(page, "url", "") or req.get("url") or ""))
    hrefs: list[str] = []
    for selector in selectors:
        nodes, _ = css_nodes(page, selector)
        for node in nodes:
            href = str(node.attrib.get("href") or "").strip()
            if not href:
                try:
                    anchors = list(node.css("a"))
                    href = str(anchors[0].attrib.get("href") or "") if anchors else ""
                except Exception:
                    href = ""
            if not href:
                continue
            try:
                absolute = str(page.urljoin(href))
            except Exception:
                absolute = href
            parsed = urlparse(absolute)
            if parsed.netloc and origin.netloc and parsed.netloc != origin.netloc:
                continue
            if url_is_blocked(absolute, allow_loopback):
                continue
            if absolute not in hrefs:
                hrefs.append(absolute)
            if len(hrefs) >= MAX_FOLLOW:
                break
    if not hrefs:
        return ""

    chunks = []
    timeout_s = max(5, int(int(req.get("timeoutMs") or 30000) / 1000))
    for href in hrefs[:MAX_FOLLOW]:
        try:
            followed = http_get(href, timeout_s, allow_loopback, None)
        except Exception as error:
            chunks.append(f"\n<!-- followed {href} failed: {error} -->\n")
            continue
        followed_text = response_text(followed)[:4000]
        chunks.append(f"\n<!-- followed:{href} -->\n{followed_text}\n")
    return "".join(chunks)


def close_browser() -> None:
    global _browser, _browser_key
    session = _browser
    _browser = None
    _browser_key = None
    if session is not None:
        try:
            session.__exit__(None, None, None)
        except Exception:
            pass


def get_browser(proxy: str | None) -> Any:
    global _browser, _browser_key
    key = (proxy or "", "default")
    if _browser is not None and _browser_key != key:
        close_browser()
    if _browser is None:
        from scrapling.fetchers import StealthySession

        kwargs: dict[str, Any] = {
            "headless": True,
            "max_pages": 2,
            "solve_cloudflare": SOLVE_CLOUDFLARE,
            "google_search": False,
            "hide_canvas": False,
            "block_webrtc": bool(proxy),
            "locale": "en-US",
            "useragent": WATCH_UA,
            "retries": 1,
            "retry_delay": 1,
            "extra_flags": ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
        if proxy:
            kwargs["proxy"] = proxy
        session = StealthySession(**kwargs)
        session.__enter__()
        _browser = session
        _browser_key = key
    return _browser


def fingerprint_js() -> str:
    return """() => {
      const size = 48;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];
      const width = Math.max(window.innerWidth || 1280, 1);
      const height = Math.max(window.innerHeight || 720, 1);
      ctx.drawImage(document.documentElement, 0, 0, width, height, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const out = [];
      for (let i = 0; i < data.length; i += 4) {
        out.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
      }
      return out;
    }"""


def make_setup(allow_loopback: bool):
    def setup(page: Any) -> None:
        def handle(route: Any) -> None:
            url = route.request.url
            if url.startswith(("data:", "blob:", "about:")):
                route.continue_()
                return
            if url_is_blocked(url, allow_loopback):
                route.abort()
                return
            route.continue_()

        page.route("**/*", handle)

    return setup


def make_action(capture: dict[str, Any], req: dict[str, Any]):
    def action(page: Any) -> None:
        if req.get("scroll"):
            try:
                depth = int(req.get("scrollDepthPx") or 1200)
                page.evaluate("(d) => window.scrollTo(0, d)", depth)
            except Exception:
                pass
        for selector in req.get("expandSelectors") or []:
            try:
                page.locator(str(selector)).first.click(timeout=1200)
            except Exception:
                pass
        if req.get("captureScreenshot"):
            buf = page.screenshot(type="jpeg", quality=55, full_page=False)
            capture["screenshot"] = base64.b64encode(buf).decode("ascii")
            try:
                capture["fingerprint"] = page.evaluate(fingerprint_js())
            except Exception:
                capture["fingerprint"] = []
        if req.get("readCookies"):
            try:
                capture["cookies"] = page.context.cookies()
            except Exception:
                capture["cookies"] = []

    return action


def finish_page(page: Any, req: dict[str, Any], strategy: str, browser_launched: bool, started: float, capture: dict[str, Any]) -> dict[str, Any]:
    status = int(getattr(page, "status", 0) or 0)
    final_url = str(getattr(page, "url", "") or req.get("url") or "")
    headers = header_map(page)
    html = response_html(page)
    text = response_text(page)
    allow_loopback = bool(req.get("allowLoopback"))

    if url_is_blocked(final_url, allow_loopback):
        return {
            "id": req.get("id"),
            "ok": False,
            "outcome": "failure",
            "status": status,
            "finalUrl": final_url,
            "strategy": strategy,
            "browserLaunched": browser_launched,
            "durationMs": int((time.perf_counter() - started) * 1000),
            "message": "Redirected URL is not allowed",
            "retryable": False,
        }

    if is_challenge(status, html, text, headers):
        return {
            "id": req.get("id"),
            "ok": False,
            "outcome": "blocked",
            "status": status or 403,
            "finalUrl": final_url,
            "strategy": strategy,
            "browserLaunched": browser_launched,
            "durationMs": int((time.perf_counter() - started) * 1000),
            "message": "Anti-bot challenge detected on this public page" if status not in {401, 403, 407} else f"HTTP {status or 403} loading page",
            "retryable": False,
            "dynamicShell": False,
        }

    if status >= 400:
        retryable = status in {408, 425, 429, 500, 502, 503, 504}
        return {
            "id": req.get("id"),
            "ok": False,
            "outcome": "failure",
            "status": status,
            "finalUrl": final_url,
            "strategy": strategy,
            "browserLaunched": browser_launched,
            "durationMs": int((time.perf_counter() - started) * 1000),
            "message": f"HTTP {status} loading page",
            "retryable": retryable,
            "dynamicShell": False,
        }

    raw_html, extract_error = extract_for_mode(page, req, text, html)
    structured = build_structured(page, text)
    shell = is_dynamic_shell(html, text)
    followed = ""
    if extract_error is None and strategy == "http":
        followed = follow_links(page, req, allow_loopback)
    elif extract_error is None and strategy != "http":
        followed = follow_links(page, req, allow_loopback)

    if followed:
        raw_html = f"{raw_html}\n{followed}"
        text = f"{text}\n{followed}"

    if len(raw_html) > MAX_HTML_CHARS:
        raw_html = raw_html[:MAX_HTML_CHARS]

    outcome = "success"
    message = None
    if extract_error:
        outcome = "partial"
        message = extract_error

    screenshot = capture.get("screenshot")
    if req.get("captureScreenshot") and not screenshot:
        outcome = "partial"
        message = message or "Screenshot was not captured"

    return {
        "id": req.get("id"),
        "ok": outcome == "success",
        "outcome": outcome,
        "status": status or 200,
        "finalUrl": final_url,
        "strategy": strategy,
        "browserLaunched": browser_launched,
        "durationMs": int((time.perf_counter() - started) * 1000),
        "rawHtml": raw_html,
        "text": text[:200_000],
        "structured": structured,
        "dynamicShell": shell,
        "message": message,
        "retryable": False,
        "screenshotBase64": screenshot,
        "visualFingerprint": capture.get("fingerprint") or [],
        "cookies": sanitize_cookies(capture.get("cookies")),
    }


def sanitize_cookies(cookies: Any) -> list[dict[str, Any]]:
    if not isinstance(cookies, list):
        return []
    cleaned = []
    for cookie in cookies[:80]:
        if not isinstance(cookie, dict) or not cookie.get("name"):
            continue
        cleaned.append(
            {
                "name": cookie.get("name"),
                "value": cookie.get("value") or "",
                "domain": cookie.get("domain"),
                "path": cookie.get("path") or "/",
                "expires": cookie.get("expires"),
                "httpOnly": bool(cookie.get("httpOnly")),
                "secure": bool(cookie.get("secure", True)),
                "sameSite": cookie.get("sameSite") if cookie.get("sameSite") in {"Strict", "Lax", "None"} else "Lax",
            }
        )
    return cleaned


def curl_transport_failed(error: BaseException) -> bool:
    message = str(error).lower()
    return any(
        token in message
        for token in ("curl: (60)", "curl: (35)", "curl: (56)", "certificate", "handshake", "ngtcp2")
    )


class ParsedHttpPage:
    """Scrapling Selector over a response body when curl_cffi cannot complete TLS."""

    def __init__(self, body: bytes, status: int, url: str, headers: dict[str, str]):
        from scrapling.parser import Selector
        from urllib.parse import urljoin

        self.body = body
        self.status = status
        self.url = url
        self.headers = headers
        self.encoding = "utf-8"
        self._selector = Selector(content=body, url=url)
        self._urljoin = urljoin

    def css(self, *args: Any, **kwargs: Any) -> Any:
        return self._selector.css(*args, **kwargs)

    def xpath(self, *args: Any, **kwargs: Any) -> Any:
        return self._selector.xpath(*args, **kwargs)

    def get_all_text(self, **kwargs: Any) -> Any:
        return self._selector.get_all_text(**kwargs)

    def urljoin(self, href: str) -> str:
        return self._urljoin(self.url, href)


def fetch_stdlib(url: str, timeout_s: float, allow_loopback: bool, cookies: list[dict[str, Any]] | None) -> ParsedHttpPage:
    import urllib.error
    import urllib.request

    class SafeRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
            if url_is_blocked(newurl, allow_loopback):
                raise RuntimeError("Redirected URL is not allowed")
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": WATCH_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.8",
        },
    )
    if cookies:
        pairs = [f"{cookie['name']}={cookie['value']}" for cookie in cookies if cookie.get("name")]
        if pairs:
            request.add_header("Cookie", "; ".join(pairs))
    opener = urllib.request.build_opener(SafeRedirect)
    try:
        with opener.open(request, timeout=timeout_s) as response:
            body = response.read(2_000_000)
            status = int(getattr(response, "status", 200) or 200)
            final = response.geturl()
            headers = {key.lower(): value for key, value in response.headers.items()}
            return ParsedHttpPage(body, status, final, headers)
    except urllib.error.HTTPError as error:
        body = error.read(200_000)
        headers = {key.lower(): value for key, value in error.headers.items()} if error.headers else {}
        return ParsedHttpPage(body, int(error.code), getattr(error, "url", url), headers)


def http_get(url: str, timeout_s: float, allow_loopback: bool, cookies: list[dict[str, Any]] | None, proxy: str | None = None) -> Any:
    global _curl_tls_broken
    if not (url.startswith("https://") and _curl_tls_broken):
        try:
            from scrapling.fetchers import Fetcher

            kwargs: dict[str, Any] = {
                "stealthy_headers": False,
                "impersonate": None,
                "timeout": timeout_s,
                "retries": 1,
                "retry_delay": 1,
                "follow_redirects": "safe",
                "http3": False,
                "headers": {
                    "User-Agent": WATCH_UA,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.8",
                },
            }
            if proxy:
                kwargs["proxy"] = proxy
            if cookies:
                kwargs["cookies"] = {cookie["name"]: cookie["value"] for cookie in cookies if cookie.get("name")}
            return Fetcher.get(url, **kwargs)
        except Exception as error:
            if not curl_transport_failed(error):
                raise
            _curl_tls_broken = True
    return fetch_stdlib(url, timeout_s, allow_loopback, cookies)


def fetch_http(req: dict[str, Any], started: float) -> dict[str, Any]:
    url = str(req["url"])
    timeout_s = max(5, int(int(req.get("timeoutMs") or 30000) / 1000))
    proxy = req.get("proxy") if req.get("strategy") == "advanced" else None
    cookies = req.get("cookies") or []
    page = http_get(url, timeout_s, bool(req.get("allowLoopback")), cookies, proxy if isinstance(proxy, str) else None)
    return finish_page(page, req, "http", False, started, {})


def fetch_browser(req: dict[str, Any], strategy: str, started: float) -> dict[str, Any]:
    url = str(req["url"])
    proxy = req.get("proxy") if strategy == "advanced" else None
    session = get_browser(proxy if isinstance(proxy, str) else None)
    wait_strategy = req.get("waitStrategy") or "stabilize"
    stabilize = int(req.get("stabilizeMs") or 700)
    network_idle = wait_strategy in {"networkidle", "stabilize"}
    wait_ms = stabilize if wait_strategy == "stabilize" else (200 if wait_strategy == "load" else 0)
    if strategy == "advanced":
        wait_ms = max(wait_ms, 1000)
    selector = (req.get("waitForSelector") or "").strip()
    if not selector and req.get("mode") == "CSS_SELECTOR":
        selector = (req.get("selector") or "").strip()
    capture: dict[str, Any] = {}
    expand = [part.strip() for part in str(req.get("expandSelectors") or "").split(",") if part.strip()]
    action_req = {
        "scroll": bool(req.get("scroll")),
        "scrollDepthPx": req.get("scrollDepthPx") or 1200,
        "expandSelectors": expand,
        "captureScreenshot": bool(req.get("captureScreenshot")),
        "readCookies": bool(req.get("cookies")),
    }
    fetch_kwargs: dict[str, Any] = {
        "solve_cloudflare": SOLVE_CLOUDFLARE,
        "google_search": False,
        "timeout": int(req.get("timeoutMs") or 30000),
        "network_idle": network_idle,
        "load_dom": True,
        "wait": wait_ms,
        "disable_resources": not bool(req.get("captureScreenshot")),
        "block_ads": True,
        "extra_headers": {"User-Agent": WATCH_UA, "Accept-Language": "en-US,en;q=0.8"},
        "page_setup": make_setup(bool(req.get("allowLoopback"))),
        "page_action": make_action(capture, action_req),
        "retries": 1,
        "retry_delay": 1,
    }
    if selector:
        fetch_kwargs["wait_selector"] = selector
        fetch_kwargs["wait_selector_state"] = "attached"
    cookies = req.get("cookies") or []
    if cookies:
        fetch_kwargs["cookies"] = cookies
    if proxy and strategy == "advanced":
        fetch_kwargs["proxy"] = proxy
    page = session.fetch(url, **fetch_kwargs)
    return finish_page(page, req, strategy, True, started, capture)


def handle(req: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    url = str(req.get("url") or "")
    allow_loopback = bool(req.get("allowLoopback"))
    if url_is_blocked(url, allow_loopback):
        return {
            "id": req.get("id"),
            "ok": False,
            "outcome": "failure",
            "message": "URL is not allowed",
            "retryable": False,
            "strategy": req.get("strategy") or "http",
            "browserLaunched": False,
            "durationMs": 0,
            "status": 0,
        }
    strategy = req.get("strategy") or "http"
    if strategy == "http":
        return fetch_http(req, started)
    if strategy not in {"dynamic", "advanced"}:
        strategy = "dynamic"
    return fetch_browser(req, strategy, started)


def main() -> None:
    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except json.JSONDecodeError as error:
            write({"ok": False, "outcome": "failure", "message": f"Invalid request: {error}", "retryable": False})
            continue
        command = req.get("cmd") or "fetch"
        if command == "shutdown":
            close_browser()
            write({"id": req.get("id"), "ok": True, "cmd": "shutdown"})
            break
        if command == "close_browser":
            close_browser()
            write({"id": req.get("id"), "ok": True, "cmd": "close_browser"})
            continue
        try:
            write(handle(req))
        except Exception as error:
            close_browser()
            message = str(error) or error.__class__.__name__
            lower = message.lower()
            retryable = any(token in lower for token in ("timeout", "timed out", "connection", "temporarily"))
            outcome = "blocked" if "captcha" in lower or "cloudflare" in lower else "failure"
            write(
                {
                    "id": req.get("id"),
                    "ok": False,
                    "outcome": outcome,
                    "message": message[:500],
                    "retryable": retryable and outcome != "blocked",
                    "strategy": req.get("strategy") or "http",
                    "browserLaunched": req.get("strategy") in {"dynamic", "advanced"},
                    "durationMs": 0,
                    "status": 0,
                }
            )


if __name__ == "__main__":
    try:
        main()
    finally:
        close_browser()
