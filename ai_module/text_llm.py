"""Shared Vertex/Gemini LLM factory for text-only and agent workloads."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_MODULE_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _MODULE_DIR.parent

load_dotenv(_REPO_ROOT / ".env")


def resolve_credentials_path() -> str | None:
    """Resolve Google service account JSON from env or default locations."""
    configured = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if configured:
        path = Path(configured)
        if not path.is_absolute():
            path = (_REPO_ROOT / path).resolve()
        if path.is_file():
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)
            return str(path)

    candidates = [
        _MODULE_DIR / "credentials" / "google-service-account.json",
        _MODULE_DIR / "joblynk-489820-af7502e8d6cf (1).json",
        _MODULE_DIR / "joblynk-489820-af7502e8d6cf.json",
    ]
    for candidate in candidates:
        if candidate.is_file():
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(candidate)
            return str(candidate)
    return None


def credentials_available() -> bool:
    return resolve_credentials_path() is not None


def get_text_llm():
    import google.auth
    from google.auth.transport.requests import Request
    from langchain_google_genai import ChatGoogleGenerativeAI

    if not resolve_credentials_path():
        raise RuntimeError(
            "Google credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS in .env "
            "to your Joblynk service account JSON file."
        )

    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(Request())

    return ChatGoogleGenerativeAI(
        model=os.getenv("AI_MODEL_NAME", "gemini-2.5-flash"),
        credentials=creds,
        project=os.getenv("GOOGLE_CLOUD_PROJECT", "joblynk-489820"),
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "global"),
        vertexai=True,
    )
