"""Bridge Django project flows to the ai_module package."""

from __future__ import annotations

import logging
import os
import sys
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx

from apps.projects.new_project import BriefAnalysis, analyze_project_brief, compile_project_brief

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def ai_credentials_configured() -> bool:
    creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if creds:
        path = Path(creds)
        if not path.is_absolute():
            path = (_REPO_ROOT / path).resolve()
        if path.is_file():
            return True
    default = _REPO_ROOT / "ai_module" / "credentials" / "google-service-account.json"
    legacy = _REPO_ROOT / "ai_module" / "joblynk-489820-af7502e8d6cf (1).json"
    return default.is_file() or legacy.is_file()


def review_brief_with_ai(
    *,
    name: str,
    description: str,
    document_text: str | None = None,
    repository_url: str | None = None,
    session_answers: list[dict] | None = None,
) -> tuple[BriefAnalysis, str, str] | None:
    """Returns (analysis, refined_brief, source='ai') or None to use heuristic fallback."""
    if not ai_credentials_configured():
        logger.warning("[brief-review] skipped — Google credentials not configured")
        return None

    doc_chars = len((document_text or "").strip())
    logger.info(
        "[brief-review] AI call name=%r desc_chars=%s doc_chars=%s repo=%s",
        name,
        len(description),
        doc_chars,
        bool(repository_url),
    )

    try:
        from ai_module.brief_service import review_project_brief

        result = review_project_brief(
            name=name,
            description=description,
            document_text=document_text,
            repository_url=repository_url,
            session_answers=session_answers,
        )
        analysis = BriefAnalysis(
            needs_session=result.needs_session,
            missing_sections=result.missing_sections,
            questions=result.questions,
            word_count=result.word_count,
            read_time_minutes=result.read_time_minutes,
        )
        logger.info(
            "[brief-review] AI success needs_session=%s questions=%s",
            analysis.needs_session,
            analysis.questions,
        )
        return analysis, result.refined_brief, "ai"
    except Exception as exc:  # pragma: no cover - external AI dependency
        logger.warning("[brief-review] AI failed, using heuristic fallback: %s", exc, exc_info=True)
        return None


def bootstrap_agent_session(
    *,
    session_id: str,
    prompt: str,
    working_directory: str | None = None,
    project_id: str | None = None,
    project_name: str | None = None,
) -> dict[str, Any]:
    """Store prompt on the agent server (fixes localhost:3000 vs :8001 sessionStorage isolation)."""
    url = f"{agent_api_base_url()}/api/session/bootstrap"
    resolved_workdir = resolve_project_working_directory(working_directory)
    payload = {
        "session_id": session_id,
        "prompt": prompt,
        "working_directory": resolved_workdir,
        "project_id": project_id,
        "project_name": project_name,
    }
    prompt_chars = len(prompt)
    logger.info(
        "[agent-bootstrap] POST %s session=%s prompt_chars=%s workdir=%s",
        url,
        session_id,
        prompt_chars,
        working_directory,
    )
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            logger.info("[agent-bootstrap] OK session=%s stored_chars=%s", session_id, data.get("prompt_chars"))
            return data
    except Exception as exc:
        logger.error("[agent-bootstrap] FAILED session=%s error=%s", session_id, exc)
        return {"success": False, "message": str(exc), "session_id": session_id}


def resolve_project_working_directory(folder_path: str | None) -> str | None:
    """Resolve DB folder_path to an absolute directory under repo storage/."""
    if not folder_path or not str(folder_path).strip():
        return None
    raw = str(folder_path).strip()
    path = Path(raw)
    if not path.is_absolute():
        path = (_REPO_ROOT / path).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return str(path).replace("\\", "/")


def build_development_prompt(*, project_name: str, brief: str, repository_url: str | None = None) -> str:
    repo_line = f"\nGitHub repository: {repository_url}" if repository_url else ""
    return (
        f"Start development for the project '{project_name}'.{repo_line}\n\n"
        "Use this approved README brief as the single source of truth. "
        "Create the project scaffold and implement the first working version.\n\n"
        "IMPORTANT: Your working directory is the project root. "
        "Create all files directly here (e.g. src/index.html). "
        "Do NOT create an extra top-level folder named after the project.\n\n"
        f"{brief.strip()}\n"
    )


def agent_api_base_url() -> str:
    return os.getenv("AI_AGENT_API_URL", "http://localhost:8001").rstrip("/")


def agent_workspace_public_url() -> str:
    return os.getenv("AI_AGENT_PUBLIC_URL", agent_api_base_url()).rstrip("/")


def build_agent_workspace_url(
    *,
    project_id: str,
    project_name: str,
    session_id: str | None = None,
) -> str:
    ws_base = os.getenv(
        "AI_AGENT_WS_PUBLIC_URL",
        agent_workspace_public_url().replace("http://", "ws://").replace("https://", "wss://"),
    )
    if not ws_base.endswith("/ws/chat"):
        ws_base = f"{ws_base.rstrip('/')}/ws/chat"

    query = urlencode(
        {
            "autostart": "1",
            "projectId": project_id,
            "projectName": project_name,
            "session": session_id or f"project-{project_id}",
            "ws": ws_base,
        }
    )
    return f"{agent_workspace_public_url()}/workspace?{query}"


def trigger_agent_run(
    *,
    prompt: str,
    working_directory: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    """Fire-and-forget HTTP call to the ai_module agent API."""
    payload = {
        "prompt": prompt,
        "session_id": session_id,
        "working_directory": working_directory,
    }
    url = f"{agent_api_base_url()}/api/run"
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    except Exception as exc:
        logger.warning("Could not reach AI agent API at %s: %s", url, exc)
        return {"success": False, "message": str(exc), "session_id": session_id}
