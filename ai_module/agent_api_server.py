from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from contextlib import suppress
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger("agent_api_server")

# ── Tiktoken token estimator (graceful fallback if not installed) ─────────────
try:
    import tiktoken as _tiktoken
    _ENC = _tiktoken.get_encoding("cl100k_base")
    def _count_tokens(text: str) -> int:
        return len(_ENC.encode(text))
except Exception:
    def _count_tokens(text: str) -> int:  # type: ignore[misc]
        return len(text) // 4

# ── Compaction threshold: tokens at which history is compressed ───────────────
_COMPACT_TOKEN_THRESHOLD: int = int(os.getenv("CONTEXT_COMPACT_THRESHOLD", "100000"))
_COMPACT_KEEP_LAST: int = int(os.getenv("CONTEXT_COMPACT_KEEP_LAST", "6"))
_MAX_FILE_SUMMARIZE_BYTES: int = int(os.getenv("SUMMARIZE_MAX_FILE_BYTES", str(500 * 1024)))

# ── In-memory summary cache  key=(user_id, project_id, rel_path, mtime_ns) ───
_summary_cache: Dict[Tuple[str, str, str, int], Dict[str, Any]] = {}

ROOT_DIR = Path(__file__).resolve().parent
REPO_ROOT = ROOT_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / ".env")
_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if _creds_path and not os.path.isabs(_creds_path):
    _resolved = (REPO_ROOT / _creds_path).resolve()
    if _resolved.is_file():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(_resolved)

os.chdir(ROOT_DIR)


if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from agent import SYSTEM_PROMPT, run_agent  # noqa: E402
from tools import (  # noqa: E402
    _get_vision_llm,
    _png_or_media_data_uri,
    _remember_reference_image,
    _vision_messages,
    compress_image_bytes,
)
from project_workspace import (  # noqa: E402
    ProjectStatus,
    ROOT_DIR as WORKSPACE_ROOT,
    adopt_stray_repo_root_files,
    create_project_zip,
    detect_project_type,
    infer_user_id_from_workdir,
    iso_now,
    resolve_project_dir,
    resolve_project_path,
    get_project_dir,
    sanitize_id,
    workspace,
)

BOOTSTRAP_CACHE_FILE = ROOT_DIR / ".bootstrap_sessions.json"


def _load_bootstrap_cache() -> Dict[str, Dict[str, Any]]:
    if not BOOTSTRAP_CACHE_FILE.is_file():
        return {}
    try:
        data = json.loads(BOOTSTRAP_CACHE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_bootstrap_cache() -> None:
    try:
        BOOTSTRAP_CACHE_FILE.write_text(
            json.dumps(bootstrapped_sessions, indent=2),
            encoding="utf-8",
        )
    except Exception:
        pass


def _apply_bootstrap_to_workspace(data: Dict[str, Any]) -> None:
    user_id = sanitize_id(str(data.get("user_id") or "default"), "default")
    project_id = sanitize_id(
        str(data.get("project_id") or data.get("session_id") or "default"),
        "default",
    )
    workdir = (data.get("working_directory") or "").strip() or None
    if workdir:
        workspace.register_project_dir(user_id, project_id, workdir)

app = FastAPI(title="ai-coder HTTP server", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResetRequest(BaseModel):
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    project_id: Optional[str] = None


class FileSummarizeRequest(BaseModel):
    path: str
    force_refresh: bool = False


class SessionBootstrapRequest(BaseModel):
    session_id: str
    prompt: Optional[str] = None
    development_prompt: Optional[str] = None
    working_directory: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    user_id: Optional[str] = None


class SocketRequest(BaseModel):
    type: str = Field(default="message")
    prompt: Optional[str] = None
    content: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    reference_images: Optional[List[Dict[str, Any]]] = None
    reference_mode: str = "design"
    force: bool = False


class SocketResponse(BaseModel):
    type: str
    session_id: str
    prompt: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None
    timestamp: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None


class SessionMeta:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.user_id = "default"
        self.project_id = session_id


class SessionStore:
    def __init__(self) -> None:
        self._histories: Dict[str, List[Any]] = {}
        self._generated_files: Dict[str, Dict[str, Dict[str, str]]] = {}
        self._session_meta: Dict[str, SessionMeta] = {}

    def get_meta(self, session_id: str) -> SessionMeta:
        if session_id not in self._session_meta:
            self._session_meta[session_id] = SessionMeta(session_id)
        return self._session_meta[session_id]

    def bind_project(self, session_id: str, user_id: str, project_id: str) -> SessionMeta:
        meta = self.get_meta(session_id)
        meta.user_id = sanitize_id(user_id, "default")
        clean_pid = project_id[8:] if project_id.startswith("project-") else project_id
        meta.project_id = sanitize_id(clean_pid, session_id)
        return meta

    def get_history(self, session_id: str) -> List[Any]:
        if session_id not in self._histories:
            from langchain_core.messages import SystemMessage

            self._histories[session_id] = [SystemMessage(content=SYSTEM_PROMPT)]
        return self._histories[session_id]

    def reset(self, session_id: str) -> None:
        self._histories.pop(session_id, None)
        self._generated_files.pop(session_id, None)

    def upsert_generated_file(
        self,
        session_id: str,
        path: str,
        content: str,
        source_tool: str = "",
    ) -> None:
        if session_id not in self._generated_files:
            self._generated_files[session_id] = {}
        self._generated_files[session_id][path] = {
            "path": path,
            "content": content,
            "type": "text",
            "source_tool": source_tool,
        }

    def get_generated_files(self, session_id: str) -> List[Dict[str, str]]:
        files_map = self._generated_files.get(session_id, {})
        return [files_map[k] for k in sorted(files_map.keys())]


session_store = SessionStore()
bootstrapped_sessions: Dict[str, Dict[str, Any]] = _load_bootstrap_cache()


# ─────────────────────────────────────────────────────────────────────────────
# Context helpers
# ─────────────────────────────────────────────────────────────────────────────

def _estimate_history_tokens(session_id: str) -> int:
    """Return estimated token count for the full message history of a session."""
    history = session_store.get_history(session_id)
    total = 0
    for msg in history:
        content = getattr(msg, "content", "") or ""
        if isinstance(content, list):
            # multimodal messages — only count text parts
            content = " ".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
        total += _count_tokens(str(content))
    return total


def _maybe_compact_history(session_id: str) -> bool:
    """Compact history when token usage exceeds the configured threshold.

    Replaces the oldest messages (beyond the last N) with a single compact
    system message summarising them, then keeps the most recent messages intact.

    Returns True when compaction was performed.
    """
    from langchain_core.messages import SystemMessage

    estimated = _estimate_history_tokens(session_id)
    if estimated <= _COMPACT_TOKEN_THRESHOLD:
        return False

    history = session_store.get_history(session_id)
    if len(history) <= _COMPACT_KEEP_LAST + 1:  # +1 for system prompt
        return False

    logger.info(
        "[context] compacting session=%s tokens_before=%d threshold=%d keep_last=%d",
        session_id, estimated, _COMPACT_TOKEN_THRESHOLD, _COMPACT_KEEP_LAST,
    )

    system_msg = history[0]  # always keep original system prompt first
    old_messages = history[1 : len(history) - _COMPACT_KEEP_LAST]
    recent_messages = history[len(history) - _COMPACT_KEEP_LAST :]

    # Build a brief textual summary of what happened in the old messages
    summary_parts: List[str] = []
    for msg in old_messages:
        role = type(msg).__name__.replace("Message", "").lower()
        content = getattr(msg, "content", "") or ""
        if isinstance(content, list):
            content = " ".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
        snippet = str(content)[:300].replace("\n", " ")
        summary_parts.append(f"[{role}]: {snippet}")

    compact_text = (
        "[CONTEXT COMPACTED — earlier conversation summary]\n"
        + "\n".join(summary_parts)
        + "\n[End of compacted context. Continue from here.]"
    )
    compact_msg = SystemMessage(content=compact_text)

    new_history = [system_msg, compact_msg] + recent_messages
    session_store._histories[session_id] = new_history

    tokens_after = _estimate_history_tokens(session_id)
    logger.info(
        "[context] compaction done session=%s tokens_after=%d messages=%d",
        session_id, tokens_after, len(new_history),
    )
    return True

_ERROR_INTENT_KEYWORDS = (
    "error",
    "bug",
    "broken",
    "fix this",
    "fix the",
    "not working",
    "doesn't work",
    "doesnt work",
    "crash",
    "exception",
    "failed",
    "failure",
    "issue",
    "wrong",
    "stack trace",
    "stacktrace",
    "console error",
    "typeerror",
    "syntaxerror",
    "referenceerror",
    "404",
    "500",
    "ui broken",
    "layout broken",
    "misaligned",
    "screenshot of error",
    "error screenshot",
)

_DESIGN_INTENT_KEYWORDS = (
    "mockup",
    "wireframe",
    "figma",
    "design reference",
    "design ref",
    "reference design",
    "reference image",
    "inspiration",
    "look like",
    "style reference",
    "ui design",
    "build this ui",
    "match this design",
    "target design",
)


def _score_intent_keywords(text: str, keywords: tuple[str, ...]) -> int:
    lowered = text.lower()
    return sum(1 for keyword in keywords if keyword in lowered)


def _classify_reference_image_intent(
    *,
    data_uri: str,
    prompt: str = "",
    filename: str = "",
) -> str:
    """Return 'error' or 'design' based on user text and optional vision check."""
    combined = f"{prompt} {filename}".strip()
    error_score = _score_intent_keywords(combined, _ERROR_INTENT_KEYWORDS)
    design_score = _score_intent_keywords(combined, _DESIGN_INTENT_KEYWORDS)

    if error_score > design_score:
        return "error"
    if design_score > error_score:
        return "design"

    if isinstance(data_uri, str) and data_uri.startswith("data:image"):
        try:
            llm = _get_vision_llm()
            question = (
                "Classify this image for a coding assistant.\n"
                "Reply with exactly one word:\n"
                "- error — broken UI, bug screenshot, console/stack trace, failed layout\n"
                "- design — mockup, wireframe, target UI to build, style reference"
            )
            for msg in _vision_messages(data_uri, question):
                resp = llm.invoke([msg])
                text = str(resp.content or "").strip().lower()
                if "error" in text and "design" not in text:
                    return "error"
                if "design" in text:
                    return "design"
                break
        except Exception:
            pass

    return "design"


def _build_reference_image_prompt(prompt: str, saved_refs: List[Dict[str, str]]) -> str:
    if not saved_refs:
        return prompt

    design_refs = [ref for ref in saved_refs if ref.get("reference_mode") != "error"]
    error_refs = [ref for ref in saved_refs if ref.get("reference_mode") == "error"]
    extra = ""

    if design_refs:
        extra += "\n\nReference design image(s) uploaded (also visible in this message):\n"
        for ref in design_refs:
            extra += f"- {ref['path']} (image_ref: {ref.get('image_ref', '')})\n"
        extra += (
            "Use the visible reference for design intent. "
            "For extra detail you may call load_local_reference_image(file_path) or generate_frontend_from_reference(...)."
        )

    if error_refs:
        extra += "\n\nUser uploaded ERROR/BROKEN UI screenshot(s). You can SEE the image in this message.\n"
        for ref in error_refs:
            extra += f"- {ref['path']} (image_ref: {ref.get('image_ref', '')})\n"
        extra += (
            "REQUIRED: call diagnose_ui_screenshot(image_json=<image_ref or path JSON>, context=<user issue>) "
            "to get structured diagnosis, then fix the listed files, then build_and_publish_preview('.')."
        )

    return prompt + extra


def _save_reference_images(
    user_id: str,
    project_id: str,
    images: List[Dict[str, Any]],
    prompt: str = "",
) -> List[Dict[str, str]]:
    saved: List[Dict[str, str]] = []
    if not images:
        return saved

    upload_root = get_project_dir(user_id, project_id) / "reference_images"
    upload_root.mkdir(parents=True, exist_ok=True)

    for idx, item in enumerate(images, start=1):
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or f"reference_{idx}.png")
        media_type = str(item.get("media_type") or "image/png")
        data_uri = item.get("data_uri")
        b64 = item.get("base64")

        if isinstance(data_uri, str) and data_uri.startswith("data:image") and "," in data_uri:
            b64 = data_uri.split(",", 1)[1]

        if not isinstance(b64, str) or not b64.strip():
            continue

        ext = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }.get(media_type, ".png")

        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in name).strip("._")
        if not safe_name:
            safe_name = f"reference_{idx}{ext}"
        if "." not in safe_name:
            safe_name = f"{safe_name}{ext}"

        target = upload_root / safe_name
        if target.exists():
            target = upload_root / f"{target.stem}_{idx}{target.suffix}"

        try:
            raw_bytes = base64.b64decode(b64)
            compressed, save_type = compress_image_bytes(raw_bytes, media_type)
            target.write_bytes(compressed)
        except Exception:
            continue

        rel_path = target.relative_to(get_project_dir(user_id, project_id)).as_posix()
        data_uri = _png_or_media_data_uri(compressed, save_type)
        payload = {
            "data_uri": data_uri,
            "media_type": save_type,
            "path": rel_path,
        }
        image_ref = _remember_reference_image(payload)

        mode = str(item.get("reference_mode") or "").strip().lower()
        if mode not in {"error", "design"}:
            mode = _classify_reference_image_intent(
                data_uri=data_uri,
                prompt=prompt,
                filename=safe_name,
            )

        saved.append({
            "name": safe_name,
            "path": rel_path,
            "absolute_path": str(target),
            "media_type": save_type,
            "image_ref": image_ref,
            "data_uri": data_uri,
            "reference_mode": mode,
            "size_kb": str(round(len(compressed) / 1024, 1)),
        })

    return saved


def _project_context_prompt(user_id: str, project_id: str) -> str:
    project_dir = workspace.project_dir_for(user_id, project_id)
    return (
        f"PROJECT WORKSPACE (mandatory — read before any write tool):\n"
        f"- user_id: {user_id}\n"
        f"- project_id: {project_id}\n"
        f"- YOUR ONLY WORKSPACE: {project_dir}\n"
        f"- The process chdir's into this folder. ALL tools must use paths relative to it only.\n"
        f"- CORRECT: src/App.jsx, package.json, index.html, reference_images/mockup.png\n"
        f"- WRONG: ../src/App.jsx or any path outside {project_dir}\n"
        f"- create_file, rewrite_file, run_shell_command, validate_* — scoped to this folder only.\n"
        f"- For a new Vite/React app create package.json and src/ HERE (not elsewhere).\n"
        f"- validate_frontend_project(project_directory=\".\") when package.json is in cwd.\n"
        f"- FINAL STEP: build_and_publish_preview(project_directory=\".\") before task complete.\n"
        f"- For Vite/React set base: './' in vite.config.js so preview assets load correctly.\n\n"
    )


async def _schedule_preview_build(
    emit,
    user_id: str,
    project_id: str,
    session_id: str,
    force: bool = False,
) -> None:
    meta = workspace.load_meta(user_id, project_id)
    if meta.agent_preview_published and meta.status == ProjectStatus.READY and not force:
        emit({
            "type": "preview_ready",
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id,
            "preview_url": meta.preview_url,
            "project_type": meta.project_type,
            "status": meta.status.value,
            "timestamp": iso_now(),
        })
        return

    project_dir = get_project_dir(user_id, project_id)
    if detect_project_type(project_dir) == "unknown" and not force:
        emit({
            "type": "preview_skipped",
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id,
            "reason": "No package.json or index.html yet — preview runs after the agent creates frontend files.",
            "timestamp": iso_now(),
        })
        return

    emit({
        "type": "preview_building",
        "session_id": session_id,
        "user_id": user_id,
        "project_id": project_id,
        "timestamp": iso_now(),
    })
    try:
        meta = await workspace.run_preview_build(user_id, project_id, force=force)
        screenshot_path = ""
        if meta.status != ProjectStatus.READY:
            ok, _, shot = await asyncio.to_thread(
                workspace.capture_preview_screenshot_sync, user_id, project_id
            )
            if ok and shot:
                screenshot_path = shot.relative_to(get_project_dir(user_id, project_id)).as_posix()
        emit({
            "type": "preview_ready" if meta.status == ProjectStatus.READY else "preview_failed",
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id,
            "preview_url": meta.preview_url,
            "project_type": meta.project_type,
            "status": meta.status.value,
            "error": meta.preview_error,
            "debug_screenshot": screenshot_path,
            "timestamp": iso_now(),
        })
        tree = workspace.get_file_tree(user_id, project_id)
        emit({
            "type": "file_tree",
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id,
            "tree": tree["tree"],
            "files": tree["files"],
            "preview_url": meta.preview_url,
            "status": meta.status.value,
            "timestamp": iso_now(),
        })
    except Exception as exc:
        emit({
            "type": "preview_failed",
            "session_id": session_id,
            "user_id": user_id,
            "project_id": project_id,
            "error": str(exc),
            "timestamp": iso_now(),
        })


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai-coder HTTP server",
        "timestamp": iso_now(),
    }


@app.get("/")
async def root() -> FileResponse:
    ui = ROOT_DIR / "agent_frontend.html"
    if ui.is_file():
        return FileResponse(ui)
    return FileResponse(__file__)  # pragma: no cover


@app.get("/workspace")
async def workspace_ui() -> FileResponse:
    return FileResponse(ROOT_DIR / "agent_frontend.html")


@app.post("/api/session/bootstrap")
async def bootstrap_session(request: SessionBootstrapRequest) -> Dict[str, Any]:
    session_id = request.session_id.strip()
    prompt = (request.prompt or request.development_prompt or "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    workdir = (request.working_directory or "").strip() or None
    project_id = sanitize_id(request.project_id or session_id, session_id)
    if project_id.startswith("project-"):
        project_id = project_id[8:]
    user_id = sanitize_id(
        request.user_id or (infer_user_id_from_workdir(workdir) if workdir else "default"),
        "default",
    )
    session_store.bind_project(session_id, user_id, project_id)
    if workdir:
        workspace.register_project_dir(user_id, project_id, workdir)

    bootstrapped_sessions[session_id] = {
        "session_id": session_id,
        "prompt": prompt,
        "development_prompt": prompt,
        "working_directory": workdir or "",
        "project_id": project_id,
        "project_name": request.project_name or "",
        "user_id": user_id,
        "prompt_chars": len(prompt),
        "timestamp": iso_now(),
    }
    _save_bootstrap_cache()
    return {
        "success": True,
        "session_id": session_id,
        "prompt_chars": len(prompt),
    }


@app.get("/api/session/{session_id}")
async def get_bootstrapped_session(session_id: str) -> Dict[str, Any]:
    data = bootstrapped_sessions.get(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Session prompt not found")
    return data


@app.get("/api/session/{session_id}/bootstrap")
async def get_bootstrapped_session_alias(session_id: str) -> Dict[str, Any]:
    return await get_bootstrapped_session(session_id)


@app.get("/api/projects/{user_id}/{project_id}/files/tree")
async def api_file_tree(user_id: str, project_id: str) -> Dict[str, Any]:
    return workspace.get_file_tree(user_id, project_id)


@app.get("/api/projects/{user_id}/{project_id}/chat")
async def api_chat_history(user_id: str, project_id: str) -> Dict[str, Any]:
    return {
        "user_id": sanitize_id(user_id),
        "project_id": sanitize_id(project_id),
        "messages": workspace.load_chat(user_id, project_id),
    }


@app.put("/api/projects/{user_id}/{project_id}/chat")
async def api_save_chat(user_id: str, project_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    messages = payload.get("messages") if isinstance(payload, dict) else []
    if not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="messages must be a list")
    workspace.save_chat(user_id, project_id, messages)
    return {
        "success": True,
        "user_id": sanitize_id(user_id),
        "project_id": sanitize_id(project_id),
        "count": len(messages),
    }


@app.get("/api/projects/{user_id}/{project_id}/file")
async def api_get_file(user_id: str, project_id: str, path: str) -> Dict[str, Any]:
    try:
        return workspace.read_file(user_id, project_id, path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/projects/{user_id}/{project_id}/file/summarize")
async def api_summarize_file(
    user_id: str,
    project_id: str,
    request: FileSummarizeRequest,
) -> Dict[str, Any]:
    """Generate (or return cached) a structural AI summary for a project file.

    Uses Gemini 2.5 Flash.  Responses are cached in-memory by (user, project,
    path, mtime) so repeated calls are free until the file changes.
    """
    uid = sanitize_id(user_id, "default")
    pid = sanitize_id(project_id, user_id)
    rel_path = request.path.strip().lstrip("/")

    # Resolve the absolute path safely inside the project workspace
    try:
        file_data = workspace.read_file(uid, pid, rel_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    content: str = file_data.get("content", "")
    abs_path_str: str = file_data.get("absolute_path", "")

    # Guard against enormous files
    if len(content.encode("utf-8")) > _MAX_FILE_SUMMARIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large to summarize (max {_MAX_FILE_SUMMARIZE_BYTES // 1024} KB).",
        )

    # Build cache key from mtime so edits always invalidate the cache
    mtime_ns: int = 0
    if abs_path_str:
        try:
            mtime_ns = Path(abs_path_str).stat().st_mtime_ns
        except OSError:
            pass

    cache_key = (uid, pid, rel_path, mtime_ns)
    if not request.force_refresh and cache_key in _summary_cache:
        cached = _summary_cache[cache_key]
        return {
            **cached,
            "cached": True,
        }

    # --- Call Gemini 2.5 Flash to summarize ---
    summarization_prompt = (
        "You are a code analyst. Produce a STRUCTURAL SUMMARY of the file below.\n"
        "Include:\n"
        "  - Language and file purpose (one sentence)\n"
        "  - All function / class / React component names with a one-line description each\n"
        "  - All exported symbols\n"
        "  - CSS custom properties / design tokens (if any)\n"
        "  - Key external dependencies imported\n"
        "Be concise — target ~400 tokens+. Do NOT reproduce the full source code.\n\n.It should be detailed one"
        f"File: {rel_path}\n"
        "---\n"
        f"{content}"
    )

    summary_text: str
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        import google.auth
        from google.auth.transport.requests import Request as GAuthRequest
        from text_llm import resolve_credentials_path

        resolve_credentials_path()
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        creds.refresh(GAuthRequest())

        flash_llm = ChatGoogleGenerativeAI(
            model=os.getenv("AI_SUMMARY_MODEL", "gemini-2.5-flash"),
            credentials=creds,
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "joblynk-489820"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "global"),
            vertexai=True,
        )
        result = await asyncio.to_thread(flash_llm.invoke, summarization_prompt)
        summary_text = str(result.content or "").strip()
    except Exception as exc:
        logger.warning("[summarize] LLM call failed for %s/%s/%s: %s", uid, pid, rel_path, exc)
        raise HTTPException(
            status_code=502,
            detail=f"Summarization LLM unavailable: {exc}",
        )

    tokens_estimated = _count_tokens(summary_text)
    entry: Dict[str, Any] = {
        "file_path": rel_path,
        "summary": summary_text,
        "tokens_estimated": tokens_estimated,
        "cached": False,
    }
    _summary_cache[cache_key] = entry

    logger.info(
        "[summarize] generated summary for %s/%s/%s tokens=%d",
        uid, pid, rel_path, tokens_estimated,
    )
    return entry


@app.get("/api/projects/{user_id}/{project_id}/context/tokens")
async def api_context_tokens(user_id: str, project_id: str, session_id: str) -> Dict[str, Any]:
    """Return current estimated token count for a session's history."""
    estimated = _estimate_history_tokens(session_id)
    return {
        "session_id": session_id,
        "tokens_estimated": estimated,
        "threshold": _COMPACT_TOKEN_THRESHOLD,
        "pct_used": round(estimated / _COMPACT_TOKEN_THRESHOLD * 100, 1),
        "compact_recommended": estimated > _COMPACT_TOKEN_THRESHOLD,
    }


@app.get("/api/projects/{user_id}/{project_id}/preview")
async def api_preview_status(user_id: str, project_id: str) -> Dict[str, Any]:
    meta = workspace.load_meta(user_id, project_id)
    payload = meta.to_dict()
    payload["preview_url"] = workspace.rewrite_preview_url(
        payload.get("preview_url", ""), user_id, project_id
    )
    if workspace.get_preview_serve_dir(user_id, project_id) and meta.status != ProjectStatus.READY:
        payload["can_preview"] = True
    elif meta.status == ProjectStatus.READY:
        payload["can_preview"] = True
    else:
        payload["can_preview"] = bool(workspace.get_preview_serve_dir(user_id, project_id))
    return payload


@app.post("/api/projects/{user_id}/{project_id}/preview/rebuild")
async def api_rebuild_preview(user_id: str, project_id: str, force: bool = True) -> Dict[str, Any]:
    meta = await workspace.run_preview_build(user_id, project_id, force=force)
    payload = meta.to_dict()
    payload["preview_url"] = workspace.rewrite_preview_url(
        payload.get("preview_url", ""), user_id, project_id
    )
    return payload


@app.get("/api/projects/{user_id}/{project_id}/download")
async def api_download_project(user_id: str, project_id: str) -> Response:
    project_dir = workspace.project_dir_for(user_id, project_id)
    if not any(project_dir.rglob("*")):
        raise HTTPException(status_code=404, detail="Project is empty")
    payload = create_project_zip(project_dir)
    filename = f"{sanitize_id(project_id)}.zip"
    return Response(
        content=payload,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/preview/{user_id}/{project_id}")
async def serve_preview_root(user_id: str, project_id: str) -> RedirectResponse:
    return RedirectResponse(url=f"/preview/{sanitize_id(user_id)}/{sanitize_id(project_id)}/", status_code=307)


@app.get("/preview/{user_id}/{project_id}/{file_path:path}")
async def serve_preview_file(user_id: str, project_id: str, file_path: str = "") -> Response:
    serve_dir = workspace.get_preview_serve_dir(user_id, project_id)
    if serve_dir is None:
        raise HTTPException(status_code=404, detail="Preview not ready")

    if not file_path or file_path.endswith("/"):
        file_path = "index.html"

    try:
        target = resolve_project_path(file_path, serve_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Invalid path")

    if target.is_dir():
        target = target / "index.html"

    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    media_types = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }
    media_type = media_types.get(target.suffix.lower(), "application/octet-stream")
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return FileResponse(target, media_type=media_type, headers=headers)


@app.websocket("/ws/chat")
async def chat_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    qp = websocket.query_params
    session_id = qp.get("session") or str(uuid.uuid4())
    user_id = qp.get("userId") or qp.get("user_id") or "default"
    project_id = qp.get("projectId") or qp.get("project_id") or session_id
    project_name = qp.get("projectName") or qp.get("project_name") or ""

    boot = bootstrapped_sessions.get(session_id)
    if boot:
        user_id = boot.get("user_id") or user_id
        project_id = boot.get("project_id") or project_id
        _apply_bootstrap_to_workspace(boot)

    sm = session_store.bind_project(session_id, user_id, project_id)
    workdir = (boot or {}).get("working_directory") if boot else None
    if workdir:
        workspace.register_project_dir(sm.user_id, sm.project_id, workdir)

    print(
        f"[ws] connected session={session_id} project={sm.user_id}/{sm.project_id} "
        f"workdir={workdir or 'generated'}"
    )
    loop = asyncio.get_running_loop()
    event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
    stop_event = threading.Event()
    current_run_task: Optional[asyncio.Task[Any]] = None
    preview_task: Optional[asyncio.Task[Any]] = None

    async def sender_loop() -> None:
        try:
            while True:
                event = await event_queue.get()
                if event.get("type") == "__close__":
                    return
                if event.get("type") == "generated_file":
                    path = event.get("path", "")
                    content = str(event.get("content", ""))
                    uid = event.get("user_id", sm.user_id)
                    pid = event.get("project_id", sm.project_id)
                    if isinstance(path, str) and path and content:
                        synced = workspace.sync_file(uid, pid, path, content, str(event.get("source_tool", "")))
                        if synced:
                            session_store.upsert_generated_file(
                                session_id,
                                synced["path"],
                                synced["content"],
                                synced.get("source_tool", ""),
                            )
                            event["path"] = synced["path"]
                            event["in_project"] = True
                            print(f"[ws] generated_file {uid}/{pid} path={synced['path']}")
                        else:
                            event["in_project"] = False
                print(f"[ws] -> session={session_id} event={event.get('type')}")
                try:
                    await websocket.send_text(json.dumps(event))
                except Exception as send_exc:
                    print(f"[ws] send failed session={session_id}: {send_exc}")
                    return
        except WebSocketDisconnect:
            return

    sender_task = asyncio.create_task(sender_loop())

    meta = workspace.load_meta(sm.user_id, sm.project_id)
    estimated_tokens = _estimate_history_tokens(session_id)
    emit_ready = {
        "type": "workspace_ready",
        "session_id": session_id,
        "user_id": sm.user_id,
        "project_id": sm.project_id,
        "project_name": boot.get("project_name") if boot else project_name,
        "preview_url": workspace.rewrite_preview_url(meta.preview_url, sm.user_id, sm.project_id),
        "status": meta.status.value,
        "project_type": meta.project_type,
        "tokens_estimated": estimated_tokens,
        "timestamp": iso_now(),
    }
    loop.call_soon_threadsafe(event_queue.put_nowait, emit_ready)

    def emit(event: Dict[str, Any]) -> None:
        event.setdefault("user_id", sm.user_id)
        event.setdefault("project_id", sm.project_id)
        loop.call_soon_threadsafe(event_queue.put_nowait, event)

    def start_run(
        prompt: str,
        run_session_id: str,
        user_id: str,
        project_id: str,
        image_attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        nonlocal current_run_task, preview_task
        stop_event.clear()
        project_dir = str(workspace.project_dir_for(user_id, project_id))
        full_prompt = _project_context_prompt(user_id, project_id) + prompt
        history = session_store.get_history(run_session_id)

        def worker() -> None:
            previous_env = {
                "CODER_BUDDY_PROJECT_ROOT": os.environ.get("CODER_BUDDY_PROJECT_ROOT"),
                "CODER_BUDDY_USER_ID": os.environ.get("CODER_BUDDY_USER_ID"),
                "CODER_BUDDY_PROJECT_ID": os.environ.get("CODER_BUDDY_PROJECT_ID"),
            }
            os.environ["CODER_BUDDY_PROJECT_ROOT"] = project_dir
            os.environ["CODER_BUDDY_USER_ID"] = user_id
            os.environ["CODER_BUDDY_PROJECT_ID"] = project_id
            try:
                output = run_agent(
                    full_prompt,
                    history,
                    event_sink=emit,
                    stop_check=stop_event.is_set,
                    project_root=project_dir,
                    image_attachments=image_attachments,
                )
                moved = adopt_stray_repo_root_files(
                    Path(project_dir),
                    WORKSPACE_ROOT,
                )
                if moved:
                    emit({
                        "type": "agent_log",
                        "message": f"Moved into project folder: {', '.join(moved)}",
                        "session_id": run_session_id,
                        "timestamp": iso_now(),
                    })
                tree = workspace.get_file_tree(user_id, project_id)
                emit({
                    "type": "file_tree",
                    "session_id": run_session_id,
                    "user_id": user_id,
                    "project_id": project_id,
                    "tree": tree["tree"],
                    "files": tree["files"],
                    "timestamp": iso_now(),
                })
                emit(
                    {
                        "type": "response",
                        "session_id": run_session_id,
                        "user_id": user_id,
                        "project_id": project_id,
                        "prompt": prompt,
                        "output": output,
                        "timestamp": iso_now(),
                    }
                )
            except Exception as exc:  # pragma: no cover
                emit(
                    {
                        "type": "error",
                        "session_id": run_session_id,
                        "user_id": user_id,
                        "project_id": project_id,
                        "error": str(exc),
                        "timestamp": iso_now(),
                    }
                )
            finally:
                for key, value in previous_env.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
                workspace.end_generation(user_id, project_id)
                # ── Tiered context: compact history if token budget exceeded ──
                compacted = _maybe_compact_history(run_session_id)
                tokens_now = _estimate_history_tokens(run_session_id)
                emit(
                    {
                        "type": "run_complete",
                        "session_id": run_session_id,
                        "user_id": user_id,
                        "project_id": project_id,
                        "tokens_estimated": tokens_now,
                        "context_compacted": compacted,
                        "timestamp": iso_now(),
                    }
                )
                if compacted:
                    emit(
                        {
                            "type": "context_compacted",
                            "session_id": run_session_id,
                            "user_id": user_id,
                            "project_id": project_id,
                            "tokens_after": tokens_now,
                            "threshold": _COMPACT_TOKEN_THRESHOLD,
                            "timestamp": iso_now(),
                        }
                    )

        current_run_task = asyncio.create_task(asyncio.to_thread(worker))

        def on_run_done(task: asyncio.Task[Any]) -> None:
            nonlocal preview_task
            with suppress(asyncio.CancelledError, Exception):
                task.result()
            meta = workspace.load_meta(user_id, project_id)
            if meta.agent_preview_published and meta.status == ProjectStatus.READY:
                return
            project_dir = get_project_dir(user_id, project_id)
            if detect_project_type(project_dir) == "unknown":
                emit({
                    "type": "preview_skipped",
                    "session_id": run_session_id,
                    "user_id": user_id,
                    "project_id": project_id,
                    "reason": "No frontend scaffold yet — ask the agent to create the app, then preview will build automatically.",
                    "timestamp": iso_now(),
                })
                return
            preview_task = asyncio.create_task(
                _schedule_preview_build(emit, user_id, project_id, run_session_id)
            )

        current_run_task.add_done_callback(
            lambda t: loop.call_soon_threadsafe(on_run_done, t)
        )

    try:
        while True:
            raw_message = await websocket.receive_text()
            print(f"[ws] <- session={session_id} raw={raw_message[:300]}")

            try:
                payload = SocketRequest.model_validate_json(raw_message)
            except Exception:
                await websocket.send_text(
                    SocketResponse(
                        type="error",
                        session_id=session_id,
                        error="Invalid JSON payload.",
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            if payload.user_id or payload.project_id:
                sm = session_store.bind_project(
                    session_id,
                    payload.user_id or sm.user_id,
                    payload.project_id or sm.project_id,
                )

            if payload.type == "reset":
                stop_event.set()
                target_session_id = payload.session_id or session_id
                session_store.reset(target_session_id)
                session_id = target_session_id
                workspace.end_generation(sm.user_id, sm.project_id)
                print(f"[ws] reset session={session_id}")
                await websocket.send_text(
                    SocketResponse(
                        type="reset",
                        session_id=session_id,
                        user_id=sm.user_id,
                        project_id=sm.project_id,
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            if payload.type == "stop":
                stop_event.set()
                workspace.end_generation(sm.user_id, sm.project_id)
                await websocket.send_text(
                    SocketResponse(
                        type="stopping",
                        session_id=payload.session_id or session_id,
                        user_id=sm.user_id,
                        project_id=sm.project_id,
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            if payload.type == "list_files":
                tree = await asyncio.to_thread(
                    workspace.get_file_tree, sm.user_id, sm.project_id
                )
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "file_tree",
                            "session_id": session_id,
                            "user_id": sm.user_id,
                            "project_id": sm.project_id,
                            "tree": tree["tree"],
                            "files": tree["files"],
                            "preview_url": tree.get("preview_url", ""),
                            "status": tree.get("status", "idle"),
                            "timestamp": iso_now(),
                        }
                    )
                )
                continue

            if payload.type == "build_preview":
                if preview_task and not preview_task.done():
                    await websocket.send_text(
                        json.dumps({
                            "type": "error",
                            "error": "Preview build already in progress.",
                            "timestamp": iso_now(),
                        })
                    )
                    continue
                preview_task = asyncio.create_task(
                    _schedule_preview_build(
                        emit, sm.user_id, sm.project_id, session_id, force=payload.force
                    )
                )
                continue

            prompt = (payload.prompt or payload.content or "").strip()
            if not prompt:
                await websocket.send_text(
                    SocketResponse(
                        type="error",
                        session_id=payload.session_id or session_id,
                        error="prompt is required",
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            session_id = payload.session_id or session_id
            sm = session_store.bind_project(
                session_id,
                payload.user_id or sm.user_id,
                payload.project_id or sm.project_id,
            )

            uploaded_refs = _save_reference_images(
                sm.user_id,
                sm.project_id,
                payload.reference_images or [],
                prompt=prompt,
            )
            image_attachments: List[Dict[str, Any]] = []
            if uploaded_refs:
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "reference_images_saved",
                            "session_id": session_id,
                            "user_id": sm.user_id,
                            "project_id": sm.project_id,
                            "images": [
                                {
                                    "name": ref["name"],
                                    "path": ref["path"],
                                    "image_ref": ref.get("image_ref", ""),
                                    "reference_mode": ref.get("reference_mode", "design"),
                                }
                                for ref in uploaded_refs
                            ],
                            "timestamp": iso_now(),
                        }
                    )
                )

                image_attachments = [
                    {"data_uri": ref["data_uri"], "name": ref["name"], "image_ref": ref.get("image_ref", "")}
                    for ref in uploaded_refs
                    if ref.get("data_uri")
                ]
                prompt = _build_reference_image_prompt(prompt, uploaded_refs)

            if current_run_task is not None and not current_run_task.done():
                await websocket.send_text(
                    SocketResponse(
                        type="error",
                        session_id=session_id,
                        error="An agent run is already in progress for this connection. Stop it first.",
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            ok, err = workspace.begin_generation(sm.user_id, sm.project_id)
            if not ok:
                await websocket.send_text(
                    SocketResponse(
                        type="error",
                        session_id=session_id,
                        error=err,
                        user_id=sm.user_id,
                        project_id=sm.project_id,
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            await websocket.send_text(
                SocketResponse(
                    type="ack",
                    session_id=session_id,
                    user_id=sm.user_id,
                    project_id=sm.project_id,
                    prompt=prompt,
                    timestamp=iso_now(),
                ).model_dump_json()
            )

            start_run(prompt, session_id, sm.user_id, sm.project_id, image_attachments=image_attachments)
    except WebSocketDisconnect:
        stop_event.set()
        print(f"[ws] disconnected session={session_id}")
        return
    except Exception as exc:
        stop_event.set()
        print(f"[ws] error session={session_id}: {exc}")
        await websocket.send_text(
            SocketResponse(
                type="error",
                session_id=session_id,
                error=str(exc),
                timestamp=iso_now(),
            ).model_dump_json()
        )
    finally:
        stop_event.set()
        emit({"type": "__close__"})
        sender_task.cancel()
        with suppress(asyncio.CancelledError):
            await sender_task


@app.post("/api/reset")
async def reset_session(request: ResetRequest) -> Dict[str, Any]:
    session_id = request.session_id or str(uuid.uuid4())
    session_store.reset(session_id)
    return {
        "status": "reset",
        "session_id": session_id,
        "timestamp": iso_now(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("agent_api_server:app", host="0.0.0.0", port=8001, reload=True)
