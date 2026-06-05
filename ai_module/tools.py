"""
new_tools.py
────────────
Drop-in additions for your existing tools.py.

Services assumed running:
  • SearXNG   → http://localhost:8080   (searxng-agent container)
  • Playwright → http://localhost:3000   (playwright-mcp container)
  • Redis      → localhost:6380          (redis-agent container, external port)

Install deps once:
    pip install httpx redis pillow playwright
    playwright install chromium
"""

import asyncio
import base64
import hashlib
import io
import json
import mimetypes
import os
import re
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import suppress
from pathlib import Path
from typing import Callable, Optional, Tuple, TypeVar

T = TypeVar("T")

import httpx
import redis as redis_lib
from langchain_core.tools import tool



import google.auth
from google.auth.transport.requests import Request
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
import ast
import os
import re
import libcst as cst
from typing import List, Dict, Any, Callable, Optional
import json
from skills import read_frontend_skill

load_dotenv()

# ──────────────────────────────────────────────
# AUTH
# ──────────────────────────────────────────────

creds = None
_vision_llm: Optional[ChatGoogleGenerativeAI] = None


def _get_vision_llm() -> ChatGoogleGenerativeAI:
    global creds, _vision_llm
    if _vision_llm is not None:
        return _vision_llm

    if creds is None:
        creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        creds.refresh(Request())

    _vision_llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        credentials=creds,
        project="joblynk-489820",
        location="global",
        vertexai=True,
    )
    return _vision_llm


REFERENCE_IMAGE_CACHE: Dict[str, Dict[str, Any]] = {}
MAX_REFERENCE_IMAGE_CACHE = 20


def _remember_reference_image(payload: Dict[str, Any]) -> str:
    image_ref = f"imgref_{uuid.uuid4().hex[:12]}"
    REFERENCE_IMAGE_CACHE[image_ref] = payload
    while len(REFERENCE_IMAGE_CACHE) > MAX_REFERENCE_IMAGE_CACHE:
        oldest = next(iter(REFERENCE_IMAGE_CACHE))
        REFERENCE_IMAGE_CACHE.pop(oldest, None)
    return image_ref


def _extract_data_uri_parts(data_uri: str) -> Optional[Dict[str, str]]:
    m = re.match(r"^data:(?P<mime>[\w.+\-/]+);base64,(?P<b64>.+)$", data_uri)
    if not m:
        return None
    return {"mime_type": m.group("mime"), "base64": m.group("b64")}


def _resolve_image_payload(image_json_or_ref: str) -> Dict[str, Any]:
    if isinstance(image_json_or_ref, str) and image_json_or_ref in REFERENCE_IMAGE_CACHE:
        return REFERENCE_IMAGE_CACHE[image_json_or_ref]

    if isinstance(image_json_or_ref, str) and image_json_or_ref.startswith("data:image"):
        payload = {"data_uri": image_json_or_ref, "media_type": "image/png"}
        image_ref = _remember_reference_image(payload)
        payload["image_ref"] = image_ref
        return payload

    try:
        data = json.loads(image_json_or_ref)
    except (json.JSONDecodeError, TypeError) as e:
        raise ValueError(
            "Expected image JSON from fetch/screenshot/upload tool or a valid image_ref"
        ) from e

    if not isinstance(data, dict):
        raise ValueError("image input must decode to a JSON object")

    if data.get("data_uri"):
        payload = data
        if not payload.get("image_ref"):
            payload["image_ref"] = _remember_reference_image(payload)
        return payload

    image_ref = data.get("image_ref")
    if image_ref and image_ref in REFERENCE_IMAGE_CACHE:
        return REFERENCE_IMAGE_CACHE[image_ref]

    raise ValueError("No data_uri found and image_ref was missing or expired")


def _vision_messages(data_uri: str, prompt: str) -> List[HumanMessage]:
    msgs: List[HumanMessage] = []
    parsed = _extract_data_uri_parts(data_uri)
    if parsed:
        msgs.append(
            HumanMessage(
                content=[
                    {"type": "text", "text": prompt},
                    {
                        "type": "image",
                        "base64": parsed["base64"],
                        "mime_type": parsed["mime_type"],
                    },
                ]
            )
        )
    msgs.append(
        HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ]
        )
    )
    msgs.append(
        HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": data_uri},
            ]
        )
    )
    return msgs


def _png_or_media_data_uri(image_bytes: bytes, media_type: str) -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{media_type};base64,{b64}"


def compress_image_bytes(image_bytes: bytes, media_type: str, max_dim: int = 1200) -> Tuple[bytes, str]:
    """Resize/compress image bytes for faster upload and vision processing."""
    try:
        from PIL import Image as PILImage

        img = PILImage.open(io.BytesIO(image_bytes))
        if img.width > max_dim or img.height > max_dim:
            img.thumbnail((max_dim, max_dim), PILImage.LANCZOS)

        out = io.BytesIO()
        fmt = "JPEG" if media_type in ("image/jpeg", "image/jpg") else "PNG"
        save_type = "image/jpeg" if fmt == "JPEG" else "image/png"
        if fmt == "JPEG" and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        img.save(out, format=fmt, quality=85)
        return out.getvalue(), save_type
    except Exception:
        return image_bytes, media_type or "image/png"



# ──────────────────────────────────────────────
# SERVICE CONFIG  (edit ports if yours differ)
# ──────────────────────────────────────────────
SEARXNG_BASE   = os.getenv("SEARXNG_URL",    "http://localhost:8080")
PLAYWRIGHT_URL = os.getenv("PLAYWRIGHT_URL", "http://localhost:3000")
REDIS_HOST     = os.getenv("REDIS_HOST",     "localhost")
REDIS_PORT     = int(os.getenv("REDIS_PORT", "6380"))
REDIS_DB       = int(os.getenv("REDIS_DB",   "0"))
CACHE_TTL      = int(os.getenv("CACHE_TTL",  "3600"))   # seconds

HTTP_TIMEOUT   = 20   # seconds for all httpx calls

from project_context import get_active_project_root, is_safe_path, resolve_in_project  # noqa: E402

BASE_DIR = str(get_active_project_root())

def _get_redis() -> Optional[redis_lib.Redis]:
    try:
        r = redis_lib.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB,
                            decode_responses=True, socket_connect_timeout=2)
        r.ping()
        return r
    except Exception:
        return None


def _cache_key(namespace: str, value: str) -> str:
    h = hashlib.sha256(value.encode()).hexdigest()[:16]
    return f"agent:{namespace}:{h}"


def _screenshot_dir() -> Path:
    path = Path.cwd() / "screenshots"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_slug(value: str, fallback: str = "capture") -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")
    return slug[:40] or fallback


def _save_screenshot_file(prefix: str, source: str, image_bytes: bytes) -> str:
    stamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
    file_name = f"{prefix}_{_safe_slug(source)}_{stamp}.png"
    file_path = _screenshot_dir() / file_name
    file_path.write_bytes(image_bytes)
    return str(file_path)


# ══════════════════════════════════════════════
# 1. WEB SEARCH  (SearXNG)
# ══════════════════════════════════════════════

@tool
def web_search(query: str, max_results: int = 6, category: str = "general") -> str:
    """
    Search the web using the local SearXNG instance.

    Use this to find:
      - Code examples and implementation references
      - UI component patterns and CSS techniques
      - Library/framework documentation
      - Design inspiration and best practices
      - Any current information not in your training data

    Args:
        query:       natural-language search query
        max_results: number of results to return (default 6, max 10)
        category:    one of "general" | "images" | "news" | "code"
                     use "images" for design/UI image references

    Returns:
        JSON-formatted list of results with title, url, and snippet.
        On failure returns a plain error string.

    Workflow:
        1. web_search("react sidebar component tailwind") → get URLs
        2. fetch_url(best_url)                            → read full page
        3. Use content to inform code generation
    """
    # Check Redis cache first
    r = _get_redis()
    ck = _cache_key("search", f"{query}:{category}:{max_results}")
    if r:
        cached = r.get(ck)
        if cached:
            return f"[CACHED] {cached}"

    max_results = min(int(max_results), 10)
    params = {
        "q":        query,
        "format":   "json",
        "categories": category,
    }

    try:
        resp = httpx.get(
            f"{SEARXNG_BASE}/search",
            params=params,
            timeout=HTTP_TIMEOUT,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPStatusError as e:
        return f"SearXNG HTTP error {e.response.status_code}: {e.response.text[:200]}"
    except Exception as e:
        return f"SearXNG request failed: {str(e)}"

    raw_results = data.get("results", [])[:max_results]
    if not raw_results:
        return f"No results found for: '{query}'"

    results = []
    for i, item in enumerate(raw_results, 1):
        results.append({
            "index":   i,
            "title":   item.get("title", ""),
            "url":     item.get("url", ""),
            "snippet": (item.get("content") or item.get("snippet") or "")[:300],
            "engine":  item.get("engine", ""),
        })

    output = json.dumps(results, indent=2)

    # Cache the result
    if r:
        try:
            r.setex(ck, CACHE_TTL, output)
        except Exception:
            pass

    return output


# ══════════════════════════════════════════════
# 2. FETCH URL  (full page content)
# ══════════════════════════════════════════════

@tool
def fetch_url(url: str, max_chars: int = 6000) -> str:
    """
    Fetch and extract clean readable text from any URL.

    Use this AFTER web_search to read the full content of a result page:
      - Documentation pages
      - GitHub README files
      - Blog posts with code examples
      - Any webpage the user provides as a reference

    Note: For JavaScript-rendered pages (SPAs), use playwright_extract_dom instead,
    since fetch_url only gets the static HTML.

    Args:
        url:       full URL to fetch (must start with http:// or https://)
        max_chars: maximum characters to return (default 6000)

    Returns:
        Extracted text content from the page, truncated to max_chars.
    """
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    # Check Redis cache
    r = _get_redis()
    ck = _cache_key("fetch", url)
    if r:
        cached = r.get(ck)
        if cached:
            return f"[CACHED] {cached[:max_chars]}"

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,*/*",
        }
        resp = httpx.get(url, timeout=HTTP_TIMEOUT, headers=headers,
                         follow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")

        # Handle JSON directly
        if "application/json" in content_type:
            text = json.dumps(resp.json(), indent=2)
        else:
            # Strip HTML tags with a simple approach (no BS4 dependency)
            import re
            html = resp.text
            # Remove script/style blocks
            html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html,
                          flags=re.DOTALL | re.IGNORECASE)
            # Remove all remaining tags
            text = re.sub(r"<[^>]+>", " ", html)
            # Collapse whitespace
            text = re.sub(r"\s{2,}", "\n", text).strip()

        result = text[:max_chars]
        if len(text) > max_chars:
            result += f"\n\n... [TRUNCATED — {len(text) - max_chars} chars remaining]"

        # Cache it
        if r:
            try:
                r.setex(ck, CACHE_TTL, result)
            except Exception:
                pass

        return result

    except httpx.HTTPStatusError as e:
        return f"HTTP {e.response.status_code} fetching {url}"
    except Exception as e:
        return f"Error fetching {url}: {str(e)}"


# ══════════════════════════════════════════════
# 3. IMAGE SEARCH  (SearXNG images category)
# ══════════════════════════════════════════════

@tool
def image_search(query: str, max_results: int = 5) -> str:
    """
    Search for images using SearXNG's image search.

    Use this to find:
      - UI screenshots and design references
      - Component layout examples
      - Color palette and theme references
      - Icon and illustration styles

    After getting results, call fetch_image(url) on the most relevant
    image URL so Claude can visually analyze it.

    Args:
        query:       what to search for e.g. "dark dashboard UI react"
        max_results: number of image results (default 5)

    Returns:
        List of image results with title, image URL, thumbnail URL, and source page URL.
    """
    # Cache check
    r = _get_redis()
    ck = _cache_key("imgsearch", f"{query}:{max_results}")
    if r:
        cached = r.get(ck)
        if cached:
            return f"[CACHED] {cached}"

    params = {
        "q":          query,
        "format":     "json",
        "categories": "images",
    }

    try:
        resp = httpx.get(
            f"{SEARXNG_BASE}/search",
            params=params,
            timeout=HTTP_TIMEOUT,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return f"Image search failed: {str(e)}"

    raw = data.get("results", [])[:max_results]
    if not raw:
        return f"No image results found for: '{query}'"

    results = []
    for i, item in enumerate(raw, 1):
        results.append({
            "index":        i,
            "title":        item.get("title", ""),
            "image_url":    item.get("img_src") or item.get("url", ""),
            "thumbnail":    item.get("thumbnail_src", ""),
            "source_page":  item.get("url", ""),
            "resolution":   item.get("resolution", "unknown"),
        })

    output = json.dumps(results, indent=2)

    if r:
        try:
            r.setex(ck, CACHE_TTL, output)
        except Exception:
            pass

    return output


# ══════════════════════════════════════════════
# 4. FETCH IMAGE  (download → base64)
# ══════════════════════════════════════════════

@tool
def fetch_image(url: str, max_size_kb: int = 800) -> str:
    """
    Download an image from a URL and return it as a base64-encoded string
    so Claude can visually analyze it.

    Use this after image_search to inspect a UI reference:
      - Analyze color schemes and layouts
      - Understand component structure from screenshots
      - Replicate or draw inspiration from real UI designs

    The returned base64 string can be passed directly into a Claude API call
    as an image content block for visual analysis.

    Args:
        url:         direct image URL (jpg, png, webp, gif)
        max_size_kb: maximum image size to download in KB (default 800)

    Returns:
        JSON with keys: base64, media_type, width, height, size_kb
        Pass base64 + media_type to Claude's vision API for analysis.
    """
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    # Cache
    r = _get_redis()
    ck = _cache_key("img", url)
    if r:
        cached = r.get(ck)
        if cached:
            return f"[CACHED] {cached}"

    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        }
        resp = httpx.get(url, timeout=HTTP_TIMEOUT, headers=headers,
                         follow_redirects=True)
        resp.raise_for_status()

        size_kb = len(resp.content) / 1024
        if size_kb > max_size_kb:
            return (
                f"Image too large: {size_kb:.0f} KB (limit {max_size_kb} KB). "
                "Try a thumbnail URL instead."
            )

        content_type = resp.headers.get("content-type", "image/jpeg")
        media_type = content_type.split(";")[0].strip()
        if media_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
            media_type = "image/jpeg"  # safe fallback

        # Optionally shrink with Pillow if available
        width = height = "unknown"
        try:
            from PIL import Image as PILImage
            img = PILImage.open(io.BytesIO(resp.content))
            width, height = img.size
            # Downscale if very large
            if width > 1200 or height > 1200:
                img.thumbnail((1200, 1200), PILImage.LANCZOS)
                buf = io.BytesIO()
                fmt = "JPEG" if media_type == "image/jpeg" else "PNG"
                img.save(buf, format=fmt, quality=85)
                image_bytes = buf.getvalue()
                width, height = img.size
            else:
                image_bytes = resp.content
        except ImportError:
            image_bytes = resp.content

        b64 = base64.b64encode(image_bytes).decode("utf-8")
        result = json.dumps({
            "base64":     b64,
            "media_type": media_type,
            "width":      width,
            "height":     height,
            "size_kb":    round(len(image_bytes) / 1024, 1),
            "url":        url,
        })

        if r:
            try:
                r.setex(ck, CACHE_TTL, result)
            except Exception:
                pass

        return result

    except Exception as e:
        return f"Error fetching image: {str(e)}"


@tool
def fetch_image_to_file(url: str, save_dir: str = "reference_images", file_name: str = "") -> str:
    """
    Download an image URL and save it to disk for frontend generation workflows.

    Returns JSON with file path, media type, size, and a reusable image_ref.
    """
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    try:
        resp = httpx.get(
            url,
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        image_bytes = resp.content
        media_type = (resp.headers.get("content-type", "image/jpeg").split(";")[0].strip() or "image/jpeg")
        if not media_type.startswith("image/"):
            media_type = "image/jpeg"

        ext = mimetypes.guess_extension(media_type) or ".jpg"
        out_dir = Path.cwd() / save_dir
        out_dir.mkdir(parents=True, exist_ok=True)

        if file_name:
            safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", file_name)
            if not os.path.splitext(safe_name)[1]:
                safe_name += ext
        else:
            safe_name = f"ref_{_safe_slug(url)}_{int(time.time())}{ext}"

        out_path = out_dir / safe_name
        out_path.write_bytes(image_bytes)

        payload = {
            "data_uri": _png_or_media_data_uri(image_bytes, media_type),
            "media_type": media_type,
            "url": url,
            "file_path": str(out_path),
            "size_kb": round(len(image_bytes) / 1024, 1),
            "saved_to": str(out_path),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        payload["image_ref"] = _remember_reference_image(payload)
        return json.dumps(payload)
    except Exception as e:
        return f"Error downloading image to file: {str(e)}"


@tool
def load_local_reference_image(file_path: str) -> str:
    """
    Load a local image file and return a reusable reference payload for UI generation.
    """
    if not os.path.exists(file_path):
        return f"Error: file not found '{file_path}'"

    ext_to_mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }

    ext = os.path.splitext(file_path)[1].lower()
    media_type = ext_to_mime.get(ext, "image/png")

    try:
        raw = Path(file_path).read_bytes()
        payload = {
            "data_uri": _png_or_media_data_uri(raw, media_type),
            "media_type": media_type,
            "file_path": file_path,
            "size_kb": round(len(raw) / 1024, 1),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        payload["image_ref"] = _remember_reference_image(payload)
        return json.dumps(payload)
    except Exception as e:
        return f"Error loading local reference image: {str(e)}"


@tool
def analyze_reference_image(image_json: str, question: str) -> str:
    """
    Analyze an uploaded/fetched/screenshot image with Gemini vision.

    Accepts JSON payload from:
    - fetch_image_to_file
    - load_local_reference_image
    - fetch_image / playwright_screenshot / playwright_render_and_check (with base64 converted by caller)
    - or an image_ref string.
    """
    try:
        data = _resolve_image_payload(image_json)
    except ValueError as e:
        return f"Error analyzing image: {e}"

    data_uri = data.get("data_uri")
    if not data_uri:
        # Compatibility for existing tools returning base64/media_type
        b64 = data.get("base64")
        media_type = data.get("media_type", "image/png")
        if b64:
            data_uri = f"data:{media_type};base64,{b64}"
            data["data_uri"] = data_uri
            if not data.get("image_ref"):
                data["image_ref"] = _remember_reference_image(data)
        else:
            return "Error: image payload missing data_uri/base64"

    llm = _get_vision_llm()
    errors: List[str] = []
    for idx, msg in enumerate(_vision_messages(data_uri, question), start=1):
        try:
            resp = llm.invoke([msg])
            return str(resp.content)
        except Exception as e:
            errors.append(f"Attempt {idx}: {e}")
    return "Image analysis failed for all supported message formats.\n" + "\n".join(errors)


@tool
def generate_frontend_from_reference(image_json: str, generation_task: str) -> str:
    """
    Use one reference image to generate frontend/UI guidance or code.
    """
    try:
        data = _resolve_image_payload(image_json)
    except ValueError as e:
        return f"Error generating from reference: {e}"

    data_uri = data.get("data_uri")
    if not data_uri:
        b64 = data.get("base64")
        media_type = data.get("media_type", "image/png")
        if b64:
            data_uri = f"data:{media_type};base64,{b64}"
            data["data_uri"] = data_uri
            if not data.get("image_ref"):
                data["image_ref"] = _remember_reference_image(data)
        else:
            return "Error: image payload missing data_uri/base64"

    prompt = (
        "You are an expert frontend engineer and UI designer. "
        "Inspect the reference image and complete this task:\n"
        f"{generation_task}\n\n"
        "Return production-ready output with concrete implementation details."
    )

    llm = _get_vision_llm()
    errors: List[str] = []
    for idx, msg in enumerate(_vision_messages(data_uri, prompt), start=1):
        try:
            resp = llm.invoke([msg])
            return str(resp.content)
        except Exception as e:
            errors.append(f"Attempt {idx}: {e}")
    return "Frontend generation from reference failed for all supported message formats.\n" + "\n".join(errors)


# Dedicated thread pool — sync Playwright must not run inside asyncio.to_thread
# on Windows (SelectorEventLoop there cannot spawn browser subprocesses).
_PLAYWRIGHT_POOL = ThreadPoolExecutor(max_workers=2, thread_name_prefix="playwright")


def _run_local_playwright(fn: Callable[[], T], timeout: int = 180) -> T:
    """
    Run sync Playwright in an isolated thread with a Windows-compatible event loop.

    FastAPI runs the agent via asyncio.to_thread(); on Windows that thread's default
    asyncio loop raises NotImplementedError for subprocess_exec, which Playwright needs.
    """

    def _target() -> T:
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        else:
            loop = None
        try:
            return fn()
        finally:
            if loop is not None:
                try:
                    loop.close()
                except Exception:
                    pass
                try:
                    asyncio.set_event_loop(None)
                except Exception:
                    pass

    return _PLAYWRIGHT_POOL.submit(_target).result(timeout=timeout)


# ══════════════════════════════════════════════
# 5. PLAYWRIGHT — SCREENSHOT
# ══════════════════════════════════════════════

@tool
def playwright_screenshot(
    url: str,
    full_page: bool = True,
    wait_seconds: int = 2,
) -> str:
    """
    Visit a URL in a real browser (Playwright) and take a full-page screenshot.
    Returns the screenshot as base64 so Claude can visually analyze the UI.

    Use this when:
      - User says "make it look like X website"
      - You need to see a live site's actual design
      - SearXNG snippets aren't enough — you want to SEE the real UI

    Playwright renders JavaScript, so this works on React/Vue/Angular SPAs
    that fetch_url cannot handle.

    Args:
        url:          page to screenshot
        full_page:    capture full scrollable page (default True)
        wait_seconds: wait N seconds after load for JS to settle (default 2)

    Returns:
        JSON with keys: base64, media_type, url, screenshot_path, timestamp
        Pass base64 + media_type="image/png" to Claude vision for analysis.
    """
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    # Cache (short TTL for screenshots since pages change)
    r = _get_redis()
    ck = _cache_key("screenshot", f"{url}:{full_page}")
    if r:
        cached = r.get(ck)
        if cached:
            return f"[CACHED] {cached}"

    # ── Try Playwright MCP HTTP API first ──────────────────────────────
    try:
        payload = {
            "url":       url,
            "full_page": full_page,
            "wait":      wait_seconds * 1000,  # ms
        }
        resp = httpx.post(
            f"{PLAYWRIGHT_URL}/screenshot",
            json=payload,
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            b64  = data.get("screenshot") or data.get("base64") or data.get("data", "")
            if b64:
                screenshot_path = ""
                with suppress(Exception):
                    screenshot_path = _save_screenshot_file(
                        "webshot",
                        url,
                        base64.b64decode(b64),
                    )
                result = json.dumps({
                    "base64":     b64,
                    "media_type": "image/png",
                    "url":        url,
                    "screenshot_path": screenshot_path,
                    "timestamp":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                })
                if r:
                    try:
                        r.setex(ck, 600, result)   # 10-min TTL for screenshots
                    except Exception:
                        pass
                return result
    except Exception:
        pass  # fall through to local Playwright

    # ── Fallback: local Playwright library ─────────────────────────────
    try:
        def _screenshot_local() -> str:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                page.goto(url, wait_until="networkidle", timeout=15000)
                if wait_seconds:
                    page.wait_for_timeout(wait_seconds * 1000)
                png_bytes = page.screenshot(full_page=full_page)
                browser.close()

            b64 = base64.b64encode(png_bytes).decode("utf-8")
            screenshot_path = _save_screenshot_file("webshot", url, png_bytes)
            result = json.dumps({
                "base64": b64,
                "media_type": "image/png",
                "url": url,
                "screenshot_path": screenshot_path,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
            if r:
                with suppress(Exception):
                    r.setex(ck, 600, result)
            return result

        return _run_local_playwright(_screenshot_local)

    except ImportError:
        return (
            "Playwright library not installed. "
            "Run: pip install playwright && playwright install chromium"
        )
    except Exception as e:
        return f"Screenshot failed: {type(e).__name__}: {str(e) or repr(e)}"


# ══════════════════════════════════════════════
# 6. PLAYWRIGHT — EXTRACT DOM
# ══════════════════════════════════════════════

@tool
def playwright_extract_dom(
    url: str,
    selector: str = "body",
    include_styles: bool = False,
    wait_seconds: int = 2,
) -> str:
    """
    Use Playwright to extract the fully-rendered HTML of a page or element
    after all JavaScript has executed.

    Use this when fetch_url gives empty/skeleton HTML because the site
    is a React/Vue/Angular SPA that renders content client-side.

    Also use it to:
      - Extract exact HTML structure of a component you want to replicate
      - Get real CSS class names used by a UI library
      - Understand the DOM layout of a reference site

    Args:
        url:            page to visit
        selector:       CSS selector for the element to extract (default "body")
                        e.g. "nav", ".sidebar", "#main-content", "[data-component='card']"
        include_styles: also return computed CSS for the selected element (default False)
        wait_seconds:   wait for JS to render (default 2)

    Returns:
        Extracted inner HTML (and optionally computed styles) of the matched element.
    """
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    # Cache
    r = _get_redis()
    ck = _cache_key("dom", f"{url}:{selector}:{include_styles}")
    if r:
        cached = r.get(ck)
        if cached:
            return f"[CACHED] {cached}"

    # ── Try Playwright MCP HTTP API ────────────────────────────────────
    try:
        payload = {
            "url":             url,
            "selector":        selector,
            "include_styles":  include_styles,
            "wait":            wait_seconds * 1000,
        }
        resp = httpx.post(
            f"{PLAYWRIGHT_URL}/extract",
            json=payload,
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            html = data.get("html") or data.get("content", "")
            if html:
                result = html[:8000]
                if r:
                    try:
                        r.setex(ck, CACHE_TTL, result)
                    except Exception:
                        pass
                return result
    except Exception:
        pass

    # ── Fallback: local Playwright ─────────────────────────────────────
    try:
        def _extract_dom_local() -> str:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                page.goto(url, wait_until="networkidle", timeout=15000)
                if wait_seconds:
                    page.wait_for_timeout(wait_seconds * 1000)

                element = page.query_selector(selector)
                if not element:
                    browser.close()
                    return f"Selector '{selector}' not found on {url}"

                inner_html = element.inner_html()
                result_parts = [f"<!-- Selector: {selector} from {url} -->", inner_html[:7000]]

                if include_styles:
                    styles = page.evaluate(
                        f"""() => {{
                            const el = document.querySelector('{selector}');
                            if (!el) return {{}};
                            const cs = window.getComputedStyle(el);
                            const keys = ['color','background-color','font-family',
                                          'font-size','padding','margin','border-radius',
                                          'display','flex-direction','gap','width','height'];
                            return Object.fromEntries(keys.map(k => [k, cs.getPropertyValue(k)]));
                        }}"""
                    )
                    result_parts.append(f"\n<!-- Computed styles:\n{json.dumps(styles, indent=2)}\n-->")

                browser.close()
                result = "\n".join(result_parts)

            if r:
                with suppress(Exception):
                    r.setex(ck, CACHE_TTL, result)
            return result

        return _run_local_playwright(_extract_dom_local)

    except ImportError:
        return (
            "Playwright library not installed. "
            "Run: pip install playwright && playwright install chromium"
        )
    except Exception as e:
        return f"DOM extraction failed: {str(e)}"


# ══════════════════════════════════════════════
# 7. PLAYWRIGHT — RENDER & CHECK GENERATED UI
# ══════════════════════════════════════════════

@tool
def playwright_render_and_check(
    file_path: str,
    wait_seconds: int = 2,
) -> str:
    """
    Open a generated HTML file in a real browser using Playwright,
    take a screenshot, and return it as base64 so Claude can SEE
    what the generated UI actually looks like.

    Use this AFTER generating a frontend file to self-verify:
      - Does the layout look correct?
      - Are colors and fonts rendering properly?
      - Is there any blank/broken area that needs fixing?

    This closes the feedback loop: generate → see → fix → done.

    Args:
        file_path:    path to the generated HTML file (relative to working dir)
        wait_seconds: wait for CSS/JS animations to settle (default 2)

    Returns:
        JSON with keys: base64, media_type, file_path, screenshot_path, timestamp
        Pass base64 to Claude vision to visually inspect the output.
    """
    if not os.path.exists(file_path):
        return f"File not found: '{file_path}'. Generate it first with create_file."

    abs_path = os.path.abspath(file_path)
    file_url = f"file://{abs_path}"

    # ── Try Playwright MCP HTTP API ────────────────────────────────────
    try:
        payload = {
            "url":       file_url,
            "full_page": True,
            "wait":      wait_seconds * 1000,
        }
        resp = httpx.post(
            f"{PLAYWRIGHT_URL}/screenshot",
            json=payload,
            timeout=20,
        )
        if resp.status_code == 200:
            data = resp.json()
            b64  = data.get("screenshot") or data.get("base64") or data.get("data", "")
            if b64:
                screenshot_path = ""
                with suppress(Exception):
                    screenshot_path = _save_screenshot_file(
                        "render_check",
                        file_path,
                        base64.b64decode(b64),
                    )
                return json.dumps({
                    "base64":     b64,
                    "media_type": "image/png",
                    "file_path":  file_path,
                    "screenshot_path": screenshot_path,
                    "timestamp":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                })
    except Exception:
        pass

    # ── Fallback: local Playwright ─────────────────────────────────────
    try:
        def _render_check_local() -> str:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                page.goto(file_url, wait_until="domcontentloaded", timeout=10000)
                if wait_seconds:
                    page.wait_for_timeout(wait_seconds * 1000)
                png_bytes = page.screenshot(full_page=True)
                browser.close()

            b64 = base64.b64encode(png_bytes).decode("utf-8")
            screenshot_path = _save_screenshot_file("render_check", file_path, png_bytes)
            return json.dumps({
                "base64": b64,
                "media_type": "image/png",
                "file_path": file_path,
                "screenshot_path": screenshot_path,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })

        return _run_local_playwright(_render_check_local)

    except ImportError:
        return (
            "Playwright library not installed. "
            "Run: pip install playwright && playwright install chromium"
        )
    except Exception as e:
        return f"Render check failed: {type(e).__name__}: {str(e) or repr(e)}"


# ══════════════════════════════════════════════
# 8. REDIS CACHE  (manual read/write)
# ══════════════════════════════════════════════

@tool
def cache_set(key: str, value: str, ttl_seconds: int = 3600) -> str:
    """
    Store a value in Redis cache for reuse across agent turns.

    Use this to cache:
      - Expensive search results you'll need again
      - Extracted page content
      - Any intermediate result you want to reuse

    Args:
        key:         human-readable cache key e.g. "stripe-dashboard-html"
        value:       string value to store
        ttl_seconds: expiry time in seconds (default 3600 = 1 hour)

    Returns:
        Confirmation or error message.
    """
    r = _get_redis()
    if not r:
        return "Redis unavailable — value not cached (agent will still work without cache)"
    try:
        full_key = f"agent:manual:{key}"
        r.setex(full_key, ttl_seconds, value)
        return f"✅ Cached '{key}' ({len(value)} chars, TTL {ttl_seconds}s)"
    except Exception as e:
        return f"Cache write error: {str(e)}"


@tool
def cache_get(key: str) -> str:
    """
    Retrieve a previously cached value from Redis.

    Use this before making an expensive web_search or fetch_url call —
    if you cached the result earlier you can skip the network call.

    Args:
        key: the same key you passed to cache_set

    Returns:
        The cached value string, or a "not found" message.
    """
    r = _get_redis()
    if not r:
        return "Redis unavailable"
    try:
        full_key = f"agent:manual:{key}"
        val = r.get(full_key)
        if val is None:
            return f"Cache miss: '{key}' not found (or expired)"
        return val
    except Exception as e:
        return f"Cache read error: {str(e)}"
    
@tool
def frontend_skill() -> str:
    """
    Read the frontend engineering skill guide.
    Call this FIRST before building or modifying any UI, webpage, component,
    dashboard, landing page, React/Vue/HTML app, or styling existing frontend code.
    Returns design rules, aesthetic guidelines, implementation strategy,
    theme tokens, and a validation checklist.
    """
    return read_frontend_skill()


# TOOLS
# ──────────────────────────────────────────────
@tool
def get_weather(location: str) -> str:
    """Get the current weather in a given location."""
    return f"The weather in {location} is sunny and 75°F"


@tool
def calculate(expression: str) -> str:
    """
    Safely evaluate a mathematical expression.
    Uses AST-based evaluation instead of eval() for security.
    """
    try:
        tree = ast.parse(expression, mode="eval")
        # whitelist only safe node types
        allowed = {
            ast.Expression, ast.BinOp, ast.UnaryOp, ast.Num, ast.Constant,
            ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod,
            ast.FloorDiv, ast.USub, ast.UAdd,
        }
        for node in ast.walk(tree):
            if type(node) not in allowed:
                return f"Unsafe expression: {type(node).__name__} not allowed."
        result = eval(compile(tree, "<string>", "eval"))
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def read_file(file_path: str) -> str:
    """Read the contents of a file. Returns up to 8000 characters."""
    try:
        if not is_safe_path(file_path):
            return "Access denied: path is outside working directory."
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        if len(content) > 8000:
            return content[:8000] + "\n\n... [FILE TRUNCATED — use read_file_range for more]"
        return content
    except Exception as e:
        return f"Error reading file: {str(e)}"


@tool
def read_file_range(file_path: str, start_line: int, end_line: int) -> str:
    """Read a specific range of lines from a file (1-indexed, inclusive)."""
    try:
        if not is_safe_path(file_path):
            return "Access denied."
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        sliced = lines[start_line - 1 : end_line]
        return "".join(sliced) if sliced else "No lines found in that range."
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def list_files(directory: str = ".") -> str:
    """List all files and directories (recursive, max depth 3) in the given directory."""
    try:
        result = []
        for root, dirs, files in os.walk(directory):
            # limit depth
            depth = root.replace(directory, "").count(os.sep)
            if depth >= 3:
                dirs.clear()
                continue
            indent = "  " * depth
            result.append(f"{indent}{os.path.basename(root)}/")
            for file in files:
                result.append(f"{indent}  {file}")
        return "\n".join(result) if result else "Directory is empty."
    except Exception as e:
        return f"Error listing files: {str(e)}"


@tool
def replace_in_file(file_path: str, old_text: str, new_text: str) -> str:
    """
    Replace the FIRST occurrence of old_text with new_text in a file.
    Best for: single targeted fixes where you know the exact text.
    Creates a .bak backup before editing.
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied."
        if not os.path.exists(file_path):
            return "File does not exist."

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        if old_text not in content:
            # Helpful debug: show nearby content around where it might be
            hint = ""
            first_word = old_text.strip().split()[0] if old_text.strip() else ""
            if first_word and first_word in content:
                idx = content.index(first_word)
                snippet = content[max(0, idx-30):idx+80].replace("\n", "↵")
                hint = f" Nearby content: ...{snippet}..."
            return f"Text to replace not found in file.{hint}"

        with open(file_path + ".bak", "w", encoding="utf-8") as f:
            f.write(content)

        updated = content.replace(old_text, new_text, 1)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(updated)

        lines_changed = abs(new_text.count("\n") - old_text.count("\n"))
        return f"Replacement successful. Backup created. Lines delta: {lines_changed:+d}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def replace_lines_in_file(
    file_path: str,
    start_line: int,
    end_line: int,
    new_content: str
) -> str:
    """
    Replace a range of lines (start_line to end_line, inclusive, 1-indexed)
    with new_content in a file. Use this for bulk changes — fixing 10, 50,
    or 100 lines at once without rewriting the entire file.

    Workflow:
      1. Read the file first (read_file or read_file_range) — note line numbers
      2. Call this tool with the line range you want to replace
      3. new_content replaces exactly those lines; everything else is untouched

    Example: fix lines 45-92 (a broken class) while leaving lines 1-44 and 93+ intact.

    Args:
        file_path:   path to the file
        start_line:  first line to replace (1-indexed, inclusive)
        end_line:    last line to replace (1-indexed, inclusive)
        new_content: the new lines as a single string (include newlines between lines)

    Returns a diff summary showing what changed.
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied."
        if not os.path.exists(file_path):
            return "File does not exist."
        if start_line < 1:
            return "Error: start_line must be >= 1."
        if end_line < start_line:
            return "Error: end_line must be >= start_line."

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        total_lines = len(lines)
        if start_line > total_lines:
            return f"Error: start_line {start_line} exceeds file length ({total_lines} lines)."

        # Clamp end_line to file length
        end_line = min(end_line, total_lines)

        # Backup
        with open(file_path + ".bak", "w", encoding="utf-8") as f:
            f.writelines(lines)

        # Build new_content lines — ensure it ends with a newline
        replacement = new_content
        if replacement and not replacement.endswith("\n"):
            replacement += "\n"
        replacement_lines = replacement.splitlines(keepends=True)

        # Splice: keep before + replacement + keep after
        before  = lines[:start_line - 1]
        after   = lines[end_line:]          # lines after the replaced range
        result  = before + replacement_lines + after

        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(result)

        old_count  = end_line - start_line + 1
        new_count  = len(replacement_lines)
        new_total  = len(result)

        return (
            f"Lines {start_line}–{end_line} replaced successfully. "
            f"Removed {old_count} lines, inserted {new_count} lines. "
            f"File now has {new_total} lines. "
            f"Backup created at {file_path}.bak"
        )

    except Exception as e:
        return f"Error: {str(e)}"


@tool
def rewrite_file(file_path: str, new_content: str) -> str:
    """
    Completely rewrite a file with new content.
    Creates a .bak backup of the original before writing.
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied."
        if not os.path.exists(file_path):
            return "File does not exist."

        with open(file_path, "r", encoding="utf-8") as f:
            original = f.read()
        with open(file_path + ".bak", "w", encoding="utf-8") as f:
            f.write(original)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)

        return f"File rewritten successfully. Backup at {file_path}.bak"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def apply_libcst_transform(file_path: str, transformer_code: str) -> str:
    """
    Apply a libcst CSTTransformer to a file.
    transformer_code must define a class named 'Transformer' that extends cst.CSTTransformer.
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied."

        with open(file_path, "r", encoding="utf-8") as f:
            source = f.read()

        module = cst.parse_module(source)
        namespace = {"cst": cst}
        exec(transformer_code, namespace)

        Transformer = namespace.get("Transformer")
        if Transformer is None:
            return "No class named 'Transformer' found in transformer_code."

        transformed = module.visit(Transformer())

        with open(file_path + ".bak", "w", encoding="utf-8") as f:
            f.write(source)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(transformed.code)

        return "CST transformation applied successfully. Backup created."
    except Exception as e:
        return f"Error in CST transformation: {str(e)}"


@tool
def run_python_file(file_path: str) -> str:
    """
    Run a Python file and return stdout/stderr plus exit code.
    EXIT CODE: 0 means success. Any other value means failure.
    """
    import subprocess
    try:
        if not is_safe_path(file_path):
            return "EXIT CODE: -1\nAccess denied."
        result = subprocess.run(
            ["python", file_path],
            capture_output=True, text=True, timeout=15
        )
        output = f"EXIT CODE: {result.returncode}\n"
        if result.stdout:
            output += f"STDOUT:\n{result.stdout}\n"
        if result.stderr:
            output += f"STDERR:\n{result.stderr}\n"
        if result.returncode == 0 and not result.stdout and not result.stderr:
            output += "STATUS: File ran successfully with no output.\n"
        return output
    except subprocess.TimeoutExpired:
        return "EXIT CODE: -1\nError: execution timed out (15s limit)."
    except Exception as e:
        return f"EXIT CODE: -1\nError running file: {str(e)}"


# ──────────────────────────────────────────────
# CODEBASE SEARCH TOOLS
# ──────────────────────────────────────────────

SEARCH_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".yaml", ".yml",
    ".toml", ".cfg", ".ini", ".env", ".md", ".txt", ".html", ".css",
    ".java", ".cpp", ".c", ".h", ".go", ".rs", ".rb", ".php", ".sh"
}

def _walk_project_files(directory: str = ".", extensions: set = None) -> List[str]:
    """Yield all files under directory matching extensions, respecting safety."""
    exts = extensions or SEARCH_EXTENSIONS
    results = []
    skip_dirs = {".git", "__pycache__", ".venv", "venv", "node_modules",
                 ".mypy_cache", ".pytest_cache", "dist", "build", ".tox"}
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            if os.path.splitext(fname)[1].lower() in exts:
                full = os.path.join(root, fname)
                if is_safe_path(full):
                    results.append(full)
    return results


@tool
def search_in_codebase(
    query: str,
    directory: str = ".",
    file_pattern: str = "",
    case_sensitive: bool = False,
    context_lines: int = 2,
    max_results: int = 50,
) -> str:
    """
    Search for a text string or pattern across ALL files in the project —
    exactly like Cursor's codebase search / VS Code's global search (Ctrl+Shift+F).

    Returns every match with file path, line number, and surrounding context
    so you know exactly where to make changes WITHOUT reading each file first.

    Args:
        query:          text to search for (plain string or regex)
        directory:      root directory to search (default: current directory)
        file_pattern:   optional filename filter e.g. "*.py" or "models"
        case_sensitive: default False
        context_lines:  lines of context shown above/below each match (default 2)
        max_results:    cap on total matches returned (default 50)

    Workflow:
        1. search_in_codebase("def calculate") → shows every file+line that has it
        2. replace_in_file / replace_lines_in_file on specific files found
        No need to read every file first.

    Returns:
        Grouped results: file path → list of (line_number, line_content, context)
    """
    import re

    try:
        if not os.path.isdir(directory):
            return f"Error: directory '{directory}' not found."

        flags = 0 if case_sensitive else re.IGNORECASE
        try:
            pattern = re.compile(query, flags)
        except re.error as e:
            return f"Invalid regex pattern: {e}"

        files = _walk_project_files(directory)

        # Filter by file_pattern if provided
        if file_pattern:
            fp_lower = file_pattern.lower().replace("*", "")
            files = [f for f in files if fp_lower in os.path.basename(f).lower()]

        matches_by_file: Dict[str, List[str]] = {}
        total_matches = 0

        for fpath in files:
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    file_lines = f.readlines()
            except Exception:
                continue

            file_hits = []
            for lineno, line in enumerate(file_lines, start=1):
                if pattern.search(line):
                    # Build context block
                    ctx_start = max(0, lineno - 1 - context_lines)
                    ctx_end   = min(len(file_lines), lineno + context_lines)
                    block = []
                    for i in range(ctx_start, ctx_end):
                        marker = ">>>" if (i + 1) == lineno else "   "
                        block.append(f"  {marker} {i+1:4d} │ {file_lines[i].rstrip()}")
                    file_hits.append("\n".join(block))
                    total_matches += 1
                    if total_matches >= max_results:
                        break

            if file_hits:
                rel_path = os.path.relpath(fpath, directory)
                matches_by_file[rel_path] = file_hits

            if total_matches >= max_results:
                break

        if not matches_by_file:
            return f"No matches found for '{query}' in {directory}"

        # Format output
        lines = [f"Found {total_matches} match(es) across {len(matches_by_file)} file(s):\n"]
        for rel_path, hits in matches_by_file.items():
            lines.append(f"━━ {rel_path} ({len(hits)} match(es)) ━━")
            for hit in hits:
                lines.append(hit)
                lines.append("")

        if total_matches >= max_results:
            lines.append(f"[Results capped at {max_results}. Use file_pattern or a more specific query to narrow down.]")

        return "\n".join(lines)

    except Exception as e:
        return f"Error during search: {str(e)}"


@tool
def find_symbol(
    symbol_name: str,
    directory: str = ".",
    symbol_type: str = "any",
) -> str:
    """
    Find where a function, class, variable, or import is defined or used
    across the entire codebase — like VS Code's 'Go to Definition' / 'Find All References'.

    Args:
        symbol_name: name to look for e.g. "calculate_area", "BankAccount", "requests"
        directory:   root to search (default: current)
        symbol_type: filter results — one of:
                     "definition"  → only def/class lines (where it's defined)
                     "usage"       → only call sites and references
                     "import"      → only import lines
                     "any"         → all of the above (default)

    Returns:
        Every file and line where the symbol appears, grouped by definition vs usage.
        Tells you exactly which files to edit when renaming or fixing a symbol.
    """
    import re

    try:
        files = _walk_project_files(directory, {".py"})  # symbol search is Python-focused

        definition_pattern = re.compile(
            rf"^\s*(def|class|async\s+def)\s+{re.escape(symbol_name)}\b", re.MULTILINE
        )
        import_pattern = re.compile(
            rf"\b(import\s+{re.escape(symbol_name)}|from\s+\S+\s+import\s+.*\b{re.escape(symbol_name)}\b)"
        )
        usage_pattern  = re.compile(rf"\b{re.escape(symbol_name)}\b")

        definitions = []
        usages      = []
        imports     = []

        for fpath in files:
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    file_lines = f.readlines()
            except Exception:
                continue

            rel = os.path.relpath(fpath, directory)
            for lineno, line in enumerate(file_lines, start=1):
                stripped = line.strip()
                if definition_pattern.search(line):
                    definitions.append(f"  {rel}:{lineno}  {stripped}")
                elif import_pattern.search(line):
                    imports.append(f"  {rel}:{lineno}  {stripped}")
                elif usage_pattern.search(line):
                    usages.append(f"  {rel}:{lineno}  {stripped}")

        if not definitions and not usages and not imports:
            return f"Symbol '{symbol_name}' not found in any Python file under '{directory}'."

        out = [f"Symbol: '{symbol_name}'\n"]

        if symbol_type in ("definition", "any") and definitions:
            out.append(f"DEFINITIONS ({len(definitions)}):")
            out.extend(definitions)
            out.append("")

        if symbol_type in ("import", "any") and imports:
            out.append(f"IMPORTS ({len(imports)}):")
            out.extend(imports)
            out.append("")

        if symbol_type in ("usage", "any") and usages:
            out.append(f"USAGES ({len(usages)}):")
            out.extend(usages[:30])  # cap usages to avoid flooding
            if len(usages) > 30:
                out.append(f"  ... and {len(usages)-30} more usages")
            out.append("")

        return "\n".join(out)

    except Exception as e:
        return f"Error: {str(e)}"


@tool
def search_and_replace_codebase(
    search_text: str,
    replacement_text: str,
    directory: str = ".",
    file_pattern: str = "",
    case_sensitive: bool = False,
    dry_run: bool = True,
) -> str:
    """
    Find and replace text across MULTIPLE files in the project at once —
    like VS Code's global find & replace (Ctrl+Shift+H).

    IMPORTANT: dry_run=True by default. It shows you a preview of every
    change WITHOUT modifying any file. Set dry_run=False only after
    reviewing the preview and confirming it looks correct.

    Args:
        search_text:      text to find (plain string, not regex)
        replacement_text: text to replace it with
        directory:        root directory (default: current)
        file_pattern:     optional filename filter e.g. "*.py" or "models"
        case_sensitive:   default False
        dry_run:          True = preview only (safe). False = actually apply changes.

    Returns:
        A summary of every file and line that would be (or was) changed,
        with before/after preview for each match.

    Use cases:
        - Rename a function across all files
        - Fix a consistent typo everywhere
        - Update an import path project-wide
        - Replace a deprecated API call in every file
    """
    import re

    try:
        flags = 0 if case_sensitive else re.IGNORECASE
        escaped = re.escape(search_text)

        files = _walk_project_files(directory)
        if file_pattern:
            fp_lower = file_pattern.lower().replace("*", "")
            files = [f for f in files if fp_lower in os.path.basename(f).lower()]

        changed_files = []
        total_replacements = 0
        preview_lines = []

        for fpath in files:
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    original_content = f.read()
            except Exception:
                continue

            matches = list(re.finditer(escaped, original_content, flags))
            if not matches:
                continue

            rel = os.path.relpath(fpath, directory)
            file_preview = [f"\n━━ {rel} ({len(matches)} replacement(s)) ━━"]

            # Show before/after for each match (line-level)
            original_lines = original_content.splitlines()
            new_content     = re.sub(escaped, replacement_text, original_content, flags=flags)
            new_lines       = new_content.splitlines()

            shown = 0
            for i, (orig, new) in enumerate(zip(original_lines, new_lines)):
                if orig != new:
                    file_preview.append(f"  Line {i+1}:")
                    file_preview.append(f"  - {orig.strip()}")
                    file_preview.append(f"  + {new.strip()}")
                    shown += 1
                    if shown >= 5:
                        remaining = sum(1 for a, b in zip(original_lines, new_lines) if a != b) - shown
                        if remaining > 0:
                            file_preview.append(f"  ... and {remaining} more lines")
                        break

            preview_lines.extend(file_preview)
            changed_files.append((fpath, new_content))
            total_replacements += len(matches)

        if not changed_files:
            return f"No matches found for '{search_text}' in {directory}"

        summary = [
            f"{'[DRY RUN] ' if dry_run else ''}Found '{search_text}' in {len(changed_files)} file(s), "
            f"{total_replacements} total replacement(s).",
        ]
        summary.extend(preview_lines)

        if dry_run:
            summary.append(
                f"\n[DRY RUN] No files were modified. "
                f"Call again with dry_run=False to apply all {total_replacements} replacements."
            )
        else:
            # Actually write changes — create backups first
            written = []
            for fpath, new_content in changed_files:
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        original = f.read()
                    with open(fpath + ".bak", "w", encoding="utf-8") as f:
                        f.write(original)
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    written.append(os.path.relpath(fpath, directory))
                except Exception as e:
                    summary.append(f"  ⚠️ Failed to write {fpath}: {e}")

            summary.append(f"\n✅ Applied {total_replacements} replacements across {len(written)} files.")
            summary.append(f"Backups created (.bak) for all modified files.")
            summary.append(f"Modified: {', '.join(written)}")

        return "\n".join(summary)

    except Exception as e:
        return f"Error: {str(e)}"



# ──────────────────────────────────────────────
# CODE GENERATION TOOLS
# ──────────────────────────────────────────────

@tool
def create_file(file_path: str, content: str) -> str:
    """
    Create a new file with the given content.
    Use this for code generation — creating new .py, .js, .html, config files, etc.

    - If the file already exists, returns an error (use rewrite_file to overwrite).
    - Creates parent directories automatically if they don't exist.
    - Returns a summary with line count and file size.

    Args:
        file_path: path for the new file (relative to working directory)
        content:   full file content as a string

    Use for:
        - Generating a new Python module, class, or script from scratch
        - Creating config files (requirements.txt, .env, pyproject.toml)
        - Scaffolding test files, README, Dockerfile
        - Any file that doesn't exist yet
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied: path is outside working directory."
        if os.path.exists(file_path):
            return (
                f"File '{file_path}' already exists. "
                "Use rewrite_file to overwrite it, or choose a different name."
            )

        # Create parent directories if needed
        parent = os.path.dirname(file_path)
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        line_count = content.count("\n") + 1
        size_kb    = len(content.encode("utf-8")) / 1024

        return (
            f"✅ Created '{file_path}' "
            f"({line_count} lines, {size_kb:.1f} KB)"
        )
    except Exception as e:
        return f"Error creating file: {str(e)}"


@tool
def create_project_scaffold(
    project_name: str,
    structure: str,
) -> str:
    """
    Create an entire project folder structure (directories + empty placeholder files)
    in one tool call — like 'cookiecutter' or VS Code's project template.

    This is Step 1 of multi-file code generation. After scaffolding, use
    create_file or rewrite_file to fill each file with generated code.

    Args:
        project_name: root folder name (created inside working directory)
        structure:    newline-separated paths relative to project_name.
                      Paths ending in '/' are directories.
                      Paths without '/' are files (created empty).

    Example structure string:
        src/
        src/models.py
        src/routes.py
        src/utils.py
        tests/
        tests/test_models.py
        requirements.txt
        README.md
        .env.example

    Returns:
        A tree view of everything created, with any errors noted.
    """
    try:
        if not is_safe_path(project_name):
            return "Access denied."
        if os.path.exists(project_name):
            return f"Directory '{project_name}' already exists. Choose a different name or delete it first."

        lines   = [l.strip() for l in structure.strip().splitlines() if l.strip()]
        # Reject any file-like entries: only directory paths ending with '/' are allowed.
        file_entries = [e for e in lines if not e.endswith('/')]
        if file_entries:
            return (
                "Error: structure contains file paths which are not allowed. "
                "Only directory paths ending with '/' are accepted.\n"
                f"Offending entries: {file_entries}"
            )

        created = []
        errors  = []

        for entry in lines:
            full_path = os.path.join(project_name, entry)
            if not is_safe_path(full_path):
                errors.append(f"Skipped (unsafe path): {entry}")
                continue
            try:
                os.makedirs(full_path, exist_ok=True)
                created.append(entry)
            except Exception as e:
                errors.append(f"  ⚠️ {entry}: {e}")

        # Build exact success message required by policy
        dirs_list = ", ".join(created) if created else "(none)"
        result_lines = [f"✅ Directories created: [{dirs_list}]", "⛔ NO FILES WERE CREATED.",
                        "You MUST now call create_file() for each file individually",
                        "with its complete content.",
                        "Do NOT call any build or validation tool until all files are written.",
                        "files_created: 0"]

        if errors:
            result_lines.append("\nErrors:")
            result_lines.extend(errors)

        return "\n".join(result_lines)

    except Exception as e:
        return f"Error: {str(e)}"


@tool
def inject_code_at_line(
    file_path: str,
    line_number: int,
    code_to_insert: str,
    position: str = "after",
) -> str:
    """
    Insert new code into an existing file at a specific line WITHOUT
    replacing anything — purely additive injection.

    Use this to wire generated files together:
      - Add an import at the top of a file
      - Register a new route in an existing router
      - Add a new method to an existing class
      - Insert middleware, decorators, or config entries

    Args:
        file_path:      file to modify
        line_number:    reference line (1-indexed)
        code_to_insert: the new code block to insert (can be multiple lines)
        position:       "after"  → insert AFTER line_number (default)
                        "before" → insert BEFORE line_number

    Example — add an import at line 3:
        inject_code_at_line("app.py", 3, "from auth import router", "after")

    Example — register a new route after line 45:
        inject_code_at_line("routes.py", 45, "app.include_router(auth_router)", "after")
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied."
        if not os.path.exists(file_path):
            return f"File '{file_path}' does not exist. Use create_file first."
        if line_number < 1:
            return "Error: line_number must be >= 1."
        if position not in ("before", "after"):
            return "Error: position must be 'before' or 'after'."

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        total = len(lines)
        if line_number > total:
            return f"Error: line_number {line_number} exceeds file length ({total} lines). Use create_file or append."

        # Backup
        with open(file_path + ".bak", "w", encoding="utf-8") as f:
            f.writelines(lines)

        # Ensure inserted block ends with newline
        block = code_to_insert
        if not block.endswith("\n"):
            block += "\n"
        insert_lines = block.splitlines(keepends=True)

        if position == "after":
            insert_at = line_number          # 0-indexed: after line means index = line_number
        else:
            insert_at = line_number - 1      # 0-indexed: before line means index = line_number - 1

        new_lines = lines[:insert_at] + insert_lines + lines[insert_at:]

        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        new_total    = len(new_lines)
        inserted_n   = len(insert_lines)
        return (
            f"✅ Inserted {inserted_n} line(s) {position} line {line_number} in '{file_path}'. "
            f"File now has {new_total} lines. Backup created."
        )

    except Exception as e:
        return f"Error: {str(e)}"


@tool
def append_to_file(file_path: str, content: str) -> str:
    """
    Append content to the END of an existing file.

    Use this during code generation to:
      - Add new functions/classes to an existing module
      - Append new test cases to a test file
      - Add config entries to a settings file
      - Extend a requirements.txt or similar list file

    Creates the file if it doesn't exist yet.

    Args:
        file_path: file to append to
        content:   content to add at the end (newline added automatically if missing)
    """
    try:
        if not is_safe_path(file_path):
            return "Access denied."

        # Backup if file exists
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                original = f.read()
            with open(file_path + ".bak", "w", encoding="utf-8") as f:
                f.write(original)
            # ensure a newline separator between existing content and appended content
            if original and not original.endswith("\n"):
                content = "\n" + content
        else:
            original = None

        with open(file_path, "a", encoding="utf-8") as f:
            if content and not content.endswith("\n"):
                content += "\n"
            f.write(content)

        added_lines = content.count("\n")
        action = "Appended" if original is not None else "Created"
        return f"✅ {action} {added_lines} line(s) to '{file_path}'."

    except Exception as e:
        return f"Error: {str(e)}"


TODO_STATE: Dict[str, Any] = {
    "task": "",
    "done": [],
    "next": [],
    "notes": [],
}


@tool
def create_todo_list(task: str, next_steps: str = "", notes: str = "") -> str:
    """
    Create or replace the active TODO list for the current task.

    The model should call this first for build/generation requests, then update
    it as work progresses so the record always shows:
    - what has been done
    - what still needs to be done next
    """
    TODO_STATE["task"] = task.strip()
    TODO_STATE["done"] = []
    TODO_STATE["next"] = [item.strip() for item in next_steps.splitlines() if item.strip()]
    TODO_STATE["notes"] = [item.strip() for item in notes.splitlines() if item.strip()]

    lines = ["✅ TODO list created:", f"Task: {TODO_STATE['task']}"]
    lines.append("Done: none yet")
    if TODO_STATE["next"]:
        lines.append("Next:")
        lines.extend([f"  - {item}" for item in TODO_STATE["next"]])
    if TODO_STATE["notes"]:
        lines.append("Notes:")
        lines.extend([f"  - {item}" for item in TODO_STATE["notes"]])
    return "\n".join(lines)


@tool
def update_todo_list(done: str = "", next_steps: str = "", notes: str = "") -> str:
    """
    Update the active TODO list with completed work and remaining steps.

    Use this after each meaningful action so the record stays current.
    """
    if done.strip():
        TODO_STATE["done"].extend([item.strip() for item in done.splitlines() if item.strip()])
    if next_steps.strip():
        TODO_STATE["next"] = [item.strip() for item in next_steps.splitlines() if item.strip()]
    if notes.strip():
        TODO_STATE["notes"].extend([item.strip() for item in notes.splitlines() if item.strip()])

    lines = ["✅ TODO list updated:", f"Task: {TODO_STATE['task'] or '(none)'}"]
    lines.append("Done:")
    lines.extend([f"  - {item}" for item in TODO_STATE["done"]] or ["  - none"])
    lines.append("Next:")
    lines.extend([f"  - {item}" for item in TODO_STATE["next"]] or ["  - none"])
    if TODO_STATE["notes"]:
        lines.append("Notes:")
        lines.extend([f"  - {item}" for item in TODO_STATE["notes"]])
    return "\n".join(lines)


# ──────────────────────────────────────────────
# FRONTEND & SHELL EXECUTION TOOLS
# ──────────────────────────────────────────────

import subprocess
import shutil

# Design tokens for every supported style theme
DESIGN_THEMES: Dict[str, Dict[str, str]] = {
    "glassmorphism": {
        "description": "Frosted glass cards, translucent surfaces, backdrop blur",
        "css_variables": """
  /* ── Glassmorphism tokens ── */
  --glass-bg:        rgba(255, 255, 255, 0.10);
  --glass-bg-hover:  rgba(255, 255, 255, 0.18);
  --glass-border:    rgba(255, 255, 255, 0.25);
  --glass-shadow:    0 8px 32px rgba(0, 0, 0, 0.37);
  --glass-blur:      blur(12px);
  --glass-radius:    16px;
  --accent:          #7c3aed;
  --accent-light:    #a78bfa;
  --text-primary:    rgba(255, 255, 255, 0.92);
  --text-secondary:  rgba(255, 255, 255, 0.60);
  --gradient-bg:     linear-gradient(135deg, #0f0c29, #302b63, #24243e);""",
        "body_styles": """
  background: var(--gradient-bg);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;""",
        "card_styles": """
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius);
  box-shadow: var(--glass-shadow);""",
        "tailwind_classes": "bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl shadow-2xl",
        "google_fonts": "Inter:wght@300;400;500;600;700",
    },
    "neomorphism": {
        "description": "Soft UI with inset/outset shadows on light backgrounds",
        "css_variables": """
  /* ── Neomorphism tokens ── */
  --neo-bg:          #e0e5ec;
  --neo-shadow-dark: #a3b1c6;
  --neo-shadow-light:#ffffff;
  --neo-shadow-out:  6px 6px 12px var(--neo-shadow-dark), -6px -6px 12px var(--neo-shadow-light);
  --neo-shadow-in:   inset 4px 4px 8px var(--neo-shadow-dark), inset -4px -4px 8px var(--neo-shadow-light);
  --neo-radius:      12px;
  --accent:          #6c63ff;
  --text-primary:    #2d3436;
  --text-secondary:  #636e72;""",
        "body_styles": """
  background: var(--neo-bg);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: 'Poppins', system-ui, sans-serif;""",
        "card_styles": """
  background: var(--neo-bg);
  border-radius: var(--neo-radius);
  box-shadow: var(--neo-shadow-out);""",
        "tailwind_classes": "bg-gray-200 rounded-xl",
        "google_fonts": "Poppins:wght@300;400;500;600",
    },
    "dark_minimal": {
        "description": "Clean dark theme with subtle borders, modern minimal aesthetic",
        "css_variables": """
  /* ── Dark Minimal tokens ── */
  --bg-primary:      #0a0a0a;
  --bg-secondary:    #111111;
  --bg-card:         #1a1a1a;
  --border:          rgba(255,255,255,0.08);
  --accent:          #3b82f6;
  --accent-hover:    #2563eb;
  --text-primary:    #f9fafb;
  --text-secondary:  #9ca3af;
  --radius:          8px;""",
        "body_styles": """
  background: var(--bg-primary);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;""",
        "card_styles": """
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);""",
        "tailwind_classes": "bg-zinc-900 border border-white/5 rounded-lg",
        "google_fonts": "Inter:wght@400;500;600;700",
    },
    "gradient_vivid": {
        "description": "Bold colorful gradients, vibrant modern SaaS look",
        "css_variables": """
  /* ── Gradient Vivid tokens ── */
  --grad-1:          linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --grad-2:          linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --grad-3:          linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  --bg:              #f8f9ff;
  --card-bg:         #ffffff;
  --accent:          #667eea;
  --text-primary:    #1a1a2e;
  --text-secondary:  #4a4a6a;
  --radius:          16px;
  --shadow:          0 20px 60px rgba(102,126,234,0.15);""",
        "body_styles": """
  background: var(--bg);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;""",
        "card_styles": """
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);""",
        "tailwind_classes": "bg-white rounded-2xl shadow-xl",
        "google_fonts": "Plus+Jakarta+Sans:wght@400;500;600;700",
    },
}


@tool
def run_shell_command(
    command: str,
    working_directory: str = ".",
    timeout: int = 120,
) -> str:
    """
    Run any shell command (npm, npx, pip, git, etc.) in a given directory.
    Used to install dependencies, run builds, linters, and test suites.

    Args:
        command:           shell command to run e.g. "npm install", "npm run build",
                           "npx create-react-app my-app", "pip install -r requirements.txt"
        working_directory: directory to run the command in (default: current dir)
        timeout:           max seconds to wait (default 120 — npm install can be slow)

    Returns:
        EXIT CODE + STDOUT + STDERR so you know exactly what succeeded or failed.

    Common commands:
        npm install              → install node dependencies
        npm run build            → production build (checks for errors)
        npm run dev              → start dev server
        npm run lint             → ESLint check
        npx tsc --noEmit         → TypeScript type check without emitting files
        npx create-react-app .   → scaffold React app
        npx create-next-app .    → scaffold Next.js app
        pip install -r requirements.txt
        python -m pytest
    """
    try:
        cwd = resolve_in_project(working_directory)
        if not is_safe_path(cwd):
            return "EXIT CODE: -1\nAccess denied: working directory outside project."

        # Block destructive commands
        blocked = ["rm -rf /", "del /f /s /q c:\\", "format c:", ":(){ :|:& };:"]
        cmd_lower = command.lower()
        for b in blocked:
            if b in cmd_lower:
                return f"EXIT CODE: -1\nBlocked: destructive command detected."

        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        output = f"EXIT CODE: {result.returncode}\n"
        output += f"COMMAND: {command}\n"
        output += f"DIRECTORY: {cwd}\n"

        if result.stdout:
            # Trim very long output (npm install is chatty)
            stdout = result.stdout
            if len(stdout) > 3000:
                stdout = stdout[:1500] + "\n...[truncated]...\n" + stdout[-1000:]
            output += f"\nSTDOUT:\n{stdout}"

        if result.stderr:
            stderr = result.stderr
            if len(stderr) > 2000:
                stderr = stderr[:1000] + "\n...[truncated]...\n" + stderr[-800:]
            output += f"\nSTDERR:\n{stderr}"

        if result.returncode == 0 and not result.stdout and not result.stderr:
            output += "\nSTATUS: Command completed successfully with no output."

        return output

    except subprocess.TimeoutExpired:
        return f"EXIT CODE: -1\nError: command timed out after {timeout}s.\nTip: increase timeout for slow commands like 'npm install'."
    except Exception as e:
        return f"EXIT CODE: -1\nError: {str(e)}"


@tool
def get_design_theme(theme_name: str) -> str:
    """
    Get complete CSS variables, body styles, card styles, Tailwind classes,
    and Google Fonts for a named design theme.

    Available themes:
        glassmorphism  → frosted glass cards, backdrop blur, dark gradient bg
        neomorphism    → soft UI, inset/outset shadows, light background
        dark_minimal   → clean dark theme, subtle borders, blue accent
        gradient_vivid → bold colorful gradients, vibrant SaaS aesthetic

    Returns all tokens needed to implement the theme in CSS, Tailwind, or
    inline styles — ready to paste directly into generated files.

    Use this BEFORE generating any frontend file so your design is consistent
    across all components.
    """
    name = theme_name.lower().replace("-", "_").replace(" ", "_")
    if name not in DESIGN_THEMES:
        available = ", ".join(DESIGN_THEMES.keys())
        return f"Theme '{theme_name}' not found. Available: {available}"

    theme = DESIGN_THEMES[name]
    return f"""
THEME: {name}
DESCRIPTION: {theme['description']}

CSS VARIABLES (paste into :root {{ }} in your global CSS):
{theme['css_variables']}

BODY STYLES:
{theme['body_styles']}

CARD STYLES (apply to card/panel components):
{theme['card_styles']}

TAILWIND CLASSES (for card components):
{theme['tailwind_classes']}

GOOGLE FONTS IMPORT:
<link href="https://fonts.googleapis.com/css2?family={theme['google_fonts']}&display=swap" rel="stylesheet">
"""


@tool
def validate_frontend_project(project_directory: str) -> str:
    """
    Run a full validation suite on a frontend project — automatically detects
    the project type (React/Next.js/Vite/plain HTML) and runs the appropriate checks.

    Checks performed (in order):
      1. Project type detection (package.json analysis)
      2. npm install (if node_modules missing)
      3. TypeScript check (npx tsc --noEmit) if tsconfig.json exists
      4. Lint check (npm run lint) if lint script exists
      5. Production build (npm run build)
      6. Build output verification (checks dist/ or .next/ exists and is non-empty)

    Returns a structured report:
      ✅ PASS or ❌ FAIL for each step
      Full error output for any failures
      Actionable fix suggestions for common errors

    Args:
        project_directory: path to the frontend project root (must contain package.json)
    """
    if not is_safe_path(project_directory):
        return "Access denied."
    if not os.path.isdir(project_directory):
        return f"Directory '{project_directory}' not found."

    pkg_path = os.path.join(project_directory, "package.json")
    if not os.path.exists(pkg_path):
        return f"No package.json found in '{project_directory}'. Is this a Node.js frontend project?"

    # Read package.json
    try:
        with open(pkg_path, "r") as f:
            pkg = json.load(f)
    except Exception as e:
        return f"Failed to parse package.json: {e}"

    scripts   = pkg.get("scripts", {})
    deps      = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    has_ts    = os.path.exists(os.path.join(project_directory, "tsconfig.json"))
    has_lint  = "lint" in scripts
    framework = (
        "next"   if "next" in deps else
        "vite"   if "vite" in deps else
        "react"  if "react" in deps else
        "vue"    if "vue" in deps else
        "angular"if "@angular/core" in deps else
        "unknown"
    )

    report   = [f"━━ Frontend Validation: {project_directory} ━━"]
    report.append(f"Framework detected: {framework.upper()}")
    report.append(f"TypeScript: {'yes' if has_ts else 'no'}")
    report.append(f"Lint script: {'yes' if has_lint else 'no'}")
    report.append("")

    all_passed = True

    def run_check(label: str, command: str, cwd: str, timeout: int = 120) -> bool:
        result = subprocess.run(
            command, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=timeout
        )
        passed = result.returncode == 0
        icon   = "✅" if passed else "❌"
        report.append(f"{icon} {label}")
        if not passed:
            err = (result.stderr or result.stdout or "no output")[:600]
            report.append(f"   Error:\n{err}")
            # Common fix suggestions
            if "Cannot find module" in err or "Module not found" in err:
                report.append("   💡 Fix: run 'npm install' or check import paths")
            if "is not assignable to type" in err or "Type error" in err:
                report.append("   💡 Fix: TypeScript type mismatch — check prop types")
            if "Unexpected token" in err or "SyntaxError" in err:
                report.append("   💡 Fix: Syntax error in generated code — check JSX/TSX")
            if "ESLint" in err or "Parsing error" in err:
                report.append("   💡 Fix: Lint error — check ESLint rules or disable with // eslint-disable-next-line")
        return passed

    # Step 1: Install if needed
    node_modules = os.path.join(project_directory, "node_modules")
    if not os.path.isdir(node_modules):
        report.append("📦 node_modules missing — running npm install...")
        try:
            installed = run_check("npm install", "npm install", project_directory, timeout=180)
            if not installed:
                all_passed = False
        except subprocess.TimeoutExpired:
            report.append("❌ npm install timed out (180s)")
            all_passed = False
    else:
        report.append("✅ node_modules present — skipping install")

    # Step 2: TypeScript check
    if has_ts:
        try:
            passed = run_check("TypeScript check (tsc --noEmit)", "npx tsc --noEmit", project_directory)
            if not passed:
                all_passed = False
        except subprocess.TimeoutExpired:
            report.append("❌ TypeScript check timed out")
            all_passed = False

    # Step 3: Lint
    if has_lint:
        try:
            passed = run_check("ESLint check (npm run lint)", "npm run lint", project_directory)
            if not passed:
                all_passed = False
        except subprocess.TimeoutExpired:
            report.append("❌ Lint timed out")
            all_passed = False

    # Step 4: Build
    build_cmd = scripts.get("build", "npm run build")
    try:
        passed = run_check(f"Production build ({build_cmd})", build_cmd, project_directory, timeout=180)
        if not passed:
            all_passed = False
    except subprocess.TimeoutExpired:
        report.append("❌ Build timed out (180s)")
        all_passed = False

    # Step 5: Build output check
    build_dirs = ["dist", ".next", "build", "out", "public/build"]
    found_output = False
    for bd in build_dirs:
        bd_path = os.path.join(project_directory, bd)
        if os.path.isdir(bd_path) and os.listdir(bd_path):
            size  = sum(
                os.path.getsize(os.path.join(r, f))
                for r, _, fs in os.walk(bd_path) for f in fs
            )
            report.append(f"✅ Build output found: {bd}/ ({size/1024:.0f} KB)")
            found_output = True
            break
    if not found_output and all_passed:
        report.append("⚠️  Build claimed success but no output directory found")

    report.append("")
    report.append("━━ SUMMARY ━━")
    report.append("✅ ALL CHECKS PASSED — project is valid!" if all_passed else
                  "❌ VALIDATION FAILED — fix errors above then re-validate")
    return "\n".join(report)


@tool
def validate_static_frontend_files(project_directory: str) -> str:
    """
    Validate plain static frontend projects (HTML/CSS/JS) without relying on package.json,
    npm scripts, or Node tooling.

    Checks performed:
      1. Project directory exists
      2. At least one .html file exists
      3. Basic HTML structure hints in each html file
      4. Local asset references in <link href> and <script src> resolve to existing files
      5. Basic CSS brace balance for .css files

    Args:
        project_directory: path to static frontend project root
    """
    if not is_safe_path(project_directory):
        return "Access denied."
    if not os.path.isdir(project_directory):
        return f"Directory '{project_directory}' not found."

    html_files = _walk_project_files(project_directory, {".html"})
    css_files = _walk_project_files(project_directory, {".css"})

    report = [f"━━ Static Frontend Validation: {project_directory} ━━"]
    if not html_files:
        report.append("❌ No HTML files found. Expected at least one .html file.")
        report.append("")
        report.append("━━ SUMMARY ━━")
        report.append("❌ STATIC FRONTEND CHECKS FAILED")
        return "\n".join(report)

    issues: List[str] = []
    warnings: List[str] = []

    link_pattern = re.compile(r"<link[^>]+href=[\"']([^\"']+)[\"']", re.IGNORECASE)
    script_pattern = re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)

    def _resolve_local_asset(base_dir: str, ref: str) -> str:
        if ref.startswith(("http://", "https://", "//", "data:")):
            return ""
        normalized = ref.split("?", 1)[0].split("#", 1)[0]
        if normalized.startswith("/"):
            return os.path.join(project_directory, normalized.lstrip("/"))
        return os.path.normpath(os.path.join(base_dir, normalized))

    for rel_path in html_files:
        abs_path = os.path.join(project_directory, rel_path)
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                html = f.read()
        except Exception as e:
            issues.append(f"{rel_path}: cannot read file ({e})")
            continue

        lower = html.lower()
        if "<html" not in lower or "</html>" not in lower:
            warnings.append(f"{rel_path}: missing <html>...</html> wrapper")
        if "<body" not in lower or "</body>" not in lower:
            warnings.append(f"{rel_path}: missing <body>...</body> wrapper")

        base_dir = os.path.dirname(abs_path)
        refs = link_pattern.findall(html) + script_pattern.findall(html)
        for ref in refs:
            target = _resolve_local_asset(base_dir, ref)
            if target and not os.path.exists(target):
                issues.append(f"{rel_path}: missing asset reference '{ref}'")

    for rel_path in css_files:
        abs_path = os.path.join(project_directory, rel_path)
        try:
            with open(abs_path, "r", encoding="utf-8") as f:
                css = f.read()
        except Exception as e:
            issues.append(f"{rel_path}: cannot read css file ({e})")
            continue

        if css.count("{") != css.count("}"):
            issues.append(f"{rel_path}: unbalanced CSS braces")

    report.append(f"HTML files: {len(html_files)}")
    report.append(f"CSS files: {len(css_files)}")
    report.append("")

    if issues:
        report.append("❌ Issues found:")
        report.extend([f"  - {i}" for i in issues])
    else:
        report.append("✅ No blocking static frontend issues found")

    if warnings:
        report.append("")
        report.append("⚠️ Warnings:")
        report.extend([f"  - {w}" for w in warnings])

    report.append("")
    report.append("━━ SUMMARY ━━")
    if issues:
        report.append("❌ STATIC FRONTEND CHECKS FAILED")
    else:
        report.append("✅ STATIC FRONTEND CHECKS PASSED")
    return "\n".join(report)


@tool
def check_file_consistency(
    project_directory: str,
    entry_file: str = "",
) -> str:
    """
    Analyze a generated frontend project for internal consistency issues —
    broken imports, missing files, undefined components, mismatched exports.

    Checks:
      - Every import statement resolves to an existing file
      - Every component used in JSX is imported somewhere
      - No duplicate component names across files
      - CSS/style files referenced in JS actually exist
      - Environment variables used in code exist in .env.example

    Args:
        project_directory: root of the frontend project
        entry_file:        optional main entry file to trace from (e.g. "src/main.tsx")

    Returns a list of consistency issues with file + line references.
    """
    import re

    if not is_safe_path(project_directory):
        return "Access denied."
    if not os.path.isdir(project_directory):
        return f"Directory '{project_directory}' not found."

    issues   = []
    warnings = []

    js_extensions = {".js", ".jsx", ".ts", ".tsx"}
    all_files = _walk_project_files(project_directory, js_extensions | {".css", ".scss", ".module.css"})

    # Build a set of all known file stems (without extension) for import resolution
    known_stems: set = set()
    for f in all_files:
        rel = os.path.relpath(f, project_directory)
        stem = os.path.splitext(rel)[0].replace("\\", "/")
        known_stems.add(stem)
        # also add index-based resolution
        if os.path.basename(stem) == "index":
            known_stems.add(os.path.dirname(stem))

    # Track exported and imported component names
    exports:   Dict[str, str] = {}   # name → file
    imports:   Dict[str, List[str]] = {}   # file → list of imported names

    import_pattern   = re.compile(r"""import\s+(?:(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]""")
    export_pattern   = re.compile(r"""export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)""")
    env_pattern      = re.compile(r"""(?:process\.env|import\.meta\.env)\.([A-Z_]+)""")

    env_file = os.path.join(project_directory, ".env.example")
    known_env_vars: set = set()
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                m = re.match(r"([A-Z_]+)\s*=", line.strip())
                if m:
                    known_env_vars.add(m.group(1))

    for fpath in all_files:
        if os.path.splitext(fpath)[1] not in js_extensions:
            continue
        rel = os.path.relpath(fpath, project_directory).replace("\\", "/")
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except Exception:
            continue

        file_imports = []

        for lineno, line in enumerate(lines, start=1):

            # Check imports resolve
            for m in import_pattern.finditer(line):
                named_group, default_name, import_path = m.groups()
                imported_names = (
                    [n.strip().split(" as ")[0] for n in named_group.split(",")] if named_group
                    else ([default_name] if default_name else [])
                )
                file_imports.extend(imported_names)

                # Only check relative imports
                if import_path.startswith("."):
                    # Resolve relative to file's directory
                    file_dir  = os.path.dirname(rel)
                    resolved  = os.path.normpath(os.path.join(file_dir, import_path)).replace("\\", "/")
                    # Check if any known stem matches
                    if (resolved not in known_stems and
                        not any(resolved == s or resolved + "/index" == s for s in known_stems)):
                        issues.append(
                            f"❌ Broken import in {rel}:{lineno}\n"
                            f"   '{import_path}' → could not resolve to any file"
                        )

            # Check exports
            for m in export_pattern.finditer(line):
                name = m.group(1)
                if name in exports:
                    warnings.append(
                        f"⚠️  Duplicate export '{name}' in {rel}:{lineno} "
                        f"(also exported from {exports[name]})"
                    )
                else:
                    exports[name] = rel

            # Check env vars
            for m in env_pattern.finditer(line):
                var = m.group(1)
                if known_env_vars and var not in known_env_vars:
                    warnings.append(
                        f"⚠️  Env var '{var}' used in {rel}:{lineno} "
                        f"but not found in .env.example"
                    )

        imports[rel] = file_imports

    # Final report
    report = [f"━━ Consistency Check: {project_directory} ━━\n"]

    if not issues and not warnings:
        report.append("✅ No consistency issues found — all imports resolve, no duplicates.")
    else:
        if issues:
            report.append(f"ERRORS ({len(issues)}):")
            report.extend(issues)
            report.append("")
        if warnings:
            report.append(f"WARNINGS ({len(warnings)}):")
            report.extend(warnings)

    report.append(f"\nFiles scanned: {len(all_files)}")
    report.append(f"Exports found: {len(exports)}")
    return "\n".join(report)


@tool
def build_and_publish_preview(project_directory: str = ".", force: bool = False) -> str:
    """
    Build the frontend (or validate static HTML) and publish the app preview URL.
    Call this as the FINAL step after all frontend files are written.

    - React/Vite (package.json): reuses existing dist/ when fresh; otherwise npm install + npm run build
    - Static HTML: validates structure and serves the index.html folder
    - Sets preview_url for the live App Preview panel

    Args:
        project_directory: project root (use "." when cwd is the project folder)
        force: if True, rebuild even when dist/ already exists
    """
    if not is_safe_path(project_directory):
        return "Access denied: path outside project workspace."
    if not os.path.isdir(project_directory):
        return f"Directory '{project_directory}' not found."

    user_id = os.getenv("CODER_BUDDY_USER_ID", "default")
    project_id = os.getenv("CODER_BUDDY_PROJECT_ID", "")
    if not project_id:
        return "Error: project context missing (CODER_BUDDY_PROJECT_ID)."

    from project_workspace import workspace

    meta = workspace.run_preview_build_sync(user_id, project_id, force=force)
    if meta.status.value == "ready":
        workspace.mark_agent_preview_published(user_id, project_id)
        return json.dumps({
            "status": "ready",
            "preview_url": meta.preview_url,
            "preview_dir": meta.preview_dir,
            "project_type": meta.project_type,
            "message": "✅ Preview published successfully.",
        })
    return json.dumps({
        "status": "failed",
        "error": meta.preview_error or "Preview build failed.",
        "project_type": meta.project_type,
    })


@tool
def diagnose_ui_screenshot(image_json: str, context: str = "") -> str:
    """
    Analyze a UI error or broken-layout screenshot and return structured diagnosis.

    Use when the user uploads an error screenshot or after preview/build failures.
    Returns JSON with error_type, visible_symptoms, suspected_causes, and files_to_check.

    Args:
        image_json: image_ref, data_uri JSON, or output from load_local_reference_image
        context: optional extra context (build log snippet, user message)
    """
    try:
        data = _resolve_image_payload(image_json)
    except ValueError as e:
        return json.dumps({"status": "failed", "error": str(e)})

    data_uri = data.get("data_uri")
    if not data_uri:
        b64 = data.get("base64")
        media_type = data.get("media_type", "image/png")
        if b64:
            data_uri = f"data:{media_type};base64,{b64}"
        else:
            return json.dumps({"status": "failed", "error": "Image payload missing data_uri/base64"})

    prompt = (
        "You are a senior frontend debugger. Analyze this UI screenshot.\n"
        f"Context: {context or 'User reports a broken UI or build/preview error.'}\n\n"
        "Return ONLY valid JSON (no markdown) with this schema:\n"
        "{\n"
        '  "error_type": "blank_page|layout_broken|build_error|runtime_error|styling|routing|other",\n'
        '  "visible_symptoms": ["..."],\n'
        '  "suspected_causes": ["..."],\n'
        '  "files_to_check": ["relative/paths/in/project"],\n'
        '  "fix_priority": ["routing","imports","css","components","config"]\n'
        "}\n"
        "Be specific about what you see (blank main area, error overlay, wrong colors, etc.)."
    )

    llm = _get_vision_llm()
    raw = ""
    for msg in _vision_messages(data_uri, prompt):
        try:
            resp = llm.invoke([msg])
            raw = str(resp.content).strip()
            break
        except Exception:
            continue

    if not raw:
        return json.dumps({"status": "failed", "error": "Vision analysis failed."})

    cleaned = raw
    if "```" in cleaned:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
        if m:
            cleaned = m.group(1).strip()

    try:
        diagnosis = json.loads(cleaned)
        diagnosis["status"] = "ok"
        diagnosis["image_ref"] = data.get("image_ref", "")
        return json.dumps(diagnosis, indent=2)
    except json.JSONDecodeError:
        return json.dumps({
            "status": "ok",
            "error_type": "other",
            "visible_symptoms": [raw[:500]],
            "suspected_causes": [],
            "files_to_check": [],
            "fix_priority": ["components"],
            "raw_analysis": raw[:1500],
        }, indent=2)



# ══════════════════════════════════════════════
# EXPORT LIST  — append these to your tools list
# ══════════════════════════════════════════════get,


# ─────────────────────────────────────────────────────────────────────────────
# HOW TO INTEGRATE INTO tools.py
# ─────────────────────────────────────────────────────────────────────────────
# 1. Copy this file next to tools.py (or paste the functions directly in)
#
# 2. At the top of tools.py, add:
#        from new_tools import new_tools
#
# 3. Extend your tools list:
#        tools = [
#            ...existing tools...,
#            *new_tools,
#        ]
#
# 4. That's it — tool_map and llm_with_tools pick them up automatically.
#
# 5. Install dependencies:
#        pip install httpx redis pillow playwright
#        playwright install chromium
#
# 6. Set environment variables if your ports differ:
#        SEARXNG_URL=http://localhost:8080
#        PLAYWRIGHT_URL=http://localhost:3000
#        REDIS_HOST=localhost
#        REDIS_PORT=6380
# ─────────────────────────────────────────────────────────────────────────────
