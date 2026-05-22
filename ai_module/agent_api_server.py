from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from contextlib import suppress
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parent
REPO_ROOT = ROOT_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.chdir(ROOT_DIR)


def resolve_working_directory(path: Optional[str]) -> Optional[str]:
    if not path or not str(path).strip():
        return None
    resolved = Path(str(path).strip())
    if not resolved.is_absolute():
        resolved = (REPO_ROOT / resolved).resolve()
    resolved.mkdir(parents=True, exist_ok=True)
    return str(resolved).replace("\\", "/")

from agent import SYSTEM_PROMPT, run_agent  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai_module.agent_api")

app = FastAPI(title="ai-coder HTTP server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    working_directory: Optional[str] = None


class BackgroundRunRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    working_directory: Optional[str] = None


class SessionBootstrapRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    working_directory: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None


class ResetRequest(BaseModel):
    session_id: Optional[str] = None


class RunResponse(BaseModel):
    session_id: str
    prompt: str
    output: str
    timestamp: str


class SocketRequest(BaseModel):
    type: str = Field(default="message")
    prompt: Optional[str] = None
    content: Optional[str] = None
    session_id: Optional[str] = None
    working_directory: Optional[str] = None


class SocketResponse(BaseModel):
    type: str
    session_id: str
    prompt: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None
    timestamp: str


class SessionStore:
    def __init__(self) -> None:
        self._histories: Dict[str, List[Any]] = {}
        self._generated_files: Dict[str, Dict[str, Dict[str, str]]] = {}
        self._bootstrap: Dict[str, Dict[str, Any]] = {}

    def get_history(self, session_id: str) -> List[Any]:
        if session_id not in self._histories:
            from langchain_core.messages import SystemMessage

            self._histories[session_id] = [SystemMessage(content=SYSTEM_PROMPT)]
        return self._histories[session_id]

    def reset(self, session_id: str) -> None:
        self._histories.pop(session_id, None)
        self._generated_files.pop(session_id, None)
        self._bootstrap.pop(session_id, None)

    def set_bootstrap(
        self,
        session_id: str,
        *,
        prompt: str,
        working_directory: Optional[str] = None,
        project_id: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        record = {
            "session_id": session_id,
            "prompt": prompt,
            "prompt_chars": len(prompt),
            "working_directory": working_directory or "",
            "project_id": project_id or "",
            "project_name": project_name or "",
            "stored_at": iso_now(),
        }
        self._bootstrap[session_id] = record
        return record

    def get_bootstrap(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._bootstrap.get(session_id)

    def upsert_generated_file(self, session_id: str, path: str, content: str, source_tool: str = "") -> None:
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


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "ai-coder HTTP server",
        "timestamp": iso_now(),
    }


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "name": "ai-coder",
        "routes": [
            "/health",
            "/workspace",
            "/ws/chat",
            "/api/run",
            "/api/session/bootstrap",
            "/api/session/{session_id}",
            "/api/reset",
        ],
    }


@app.post("/api/session/bootstrap")
async def session_bootstrap(request: SessionBootstrapRequest) -> Dict[str, Any]:
    """Store development prompt for a session (called by Django before opening workspace tab)."""
    resolved_workdir = resolve_working_directory(request.working_directory)
    record = session_store.set_bootstrap(
        request.session_id,
        prompt=request.prompt,
        working_directory=resolved_workdir or "",
        project_id=request.project_id,
        project_name=request.project_name,
    )
    logger.info(
        "[session-bootstrap] stored session=%s prompt_chars=%s project=%s workdir=%s",
        request.session_id,
        record["prompt_chars"],
        request.project_id,
        request.working_directory,
    )
    return {"success": True, **record}


@app.get("/api/session/{session_id}")
async def get_session_bootstrap(session_id: str) -> Dict[str, Any]:
    record = session_store.get_bootstrap(session_id)
    if record is None:
        logger.warning("[session-bootstrap] miss session=%s", session_id)
        raise HTTPException(status_code=404, detail=f"No bootstrap payload for session '{session_id}'")
    logger.info(
        "[session-bootstrap] fetch session=%s prompt_chars=%s",
        session_id,
        record.get("prompt_chars"),
    )
    return record


@app.get("/workspace")
async def workspace() -> FileResponse:
    """Agent UI used by AI Developer (opens in a separate browser tab)."""
    page = ROOT_DIR / "agent_frontend.html"
    if not page.is_file():
        raise HTTPException(status_code=404, detail="agent_frontend.html not found")
    return FileResponse(page)


@app.post("/api/run")
async def start_background_run(request: BackgroundRunRequest) -> Dict[str, Any]:
    """Start an agent run without keeping a WebSocket connection (used by Django)."""
    session_id = request.session_id or str(uuid.uuid4())
    loop = asyncio.get_running_loop()
    event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
    stop_event = threading.Event()

    def emit(event: Dict[str, Any]) -> None:
        loop.call_soon_threadsafe(event_queue.put_nowait, event)

    history = session_store.get_history(session_id)
    working_directory = resolve_working_directory(request.working_directory)

    def worker() -> None:
        previous_cwd = os.getcwd()
        try:
            if working_directory and os.path.isdir(working_directory):
                os.chdir(working_directory)
                logger.info("[api/run] cwd=%s", os.getcwd())
            run_agent(
                request.prompt,
                history,
                event_sink=emit,
                stop_check=stop_event.is_set,
            )
        except Exception as exc:
            emit({"type": "error", "session_id": session_id, "error": str(exc), "timestamp": iso_now()})
        finally:
            os.chdir(previous_cwd)
            emit({"type": "run_complete", "session_id": session_id, "timestamp": iso_now()})

    asyncio.create_task(asyncio.to_thread(worker))
    return {
        "success": True,
        "session_id": session_id,
        "message": "Agent run started.",
        "timestamp": iso_now(),
    }


@app.websocket("/ws/chat")
async def chat_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    session_id = str(uuid.uuid4())
    logger.info("[ws] connected internal=%s", session_id)
    loop = asyncio.get_running_loop()
    event_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
    stop_event = threading.Event()
    current_run_task: Optional[asyncio.Task[Any]] = None

    async def sender_loop() -> None:
        try:
            while True:
                event = await event_queue.get()
                if event.get("type") == "__close__":
                    return
                if event.get("type") == "generated_file":
                    path = event.get("path", "")
                    if isinstance(path, str) and path:
                        session_store.upsert_generated_file(
                            session_id,
                            path,
                            str(event.get("content", "")),
                            str(event.get("source_tool", "")),
                        )
                        logger.info("[ws] generated_file session=%s path=%s", session_id, path)
                logger.debug("[ws] -> session=%s event=%s", session_id, event.get("type"))
                await websocket.send_text(json.dumps(event))
        except WebSocketDisconnect:
            return

    sender_task = asyncio.create_task(sender_loop())

    def emit(event: Dict[str, Any]) -> None:
        loop.call_soon_threadsafe(event_queue.put_nowait, event)

    def start_run(prompt: str, run_session_id: str, working_directory: Optional[str] = None) -> None:
        nonlocal current_run_task
        stop_event.clear()

        history = session_store.get_history(run_session_id)

        resolved_workdir = resolve_working_directory(working_directory)

        def worker() -> None:
            previous_cwd = os.getcwd()
            try:
                if resolved_workdir and os.path.isdir(resolved_workdir):
                    os.chdir(resolved_workdir)
                    logger.info("[ws] run cwd=%s session=%s", os.getcwd(), run_session_id)
                output = run_agent(
                    prompt,
                    history,
                    event_sink=emit,
                    stop_check=stop_event.is_set,
                )
                emit(
                    {
                        "type": "response",
                        "session_id": run_session_id,
                        "prompt": prompt,
                        "output": output,
                        "timestamp": iso_now(),
                    }
                )
            except Exception as exc:  # pragma: no cover - websocket boundary
                emit(
                    {
                        "type": "error",
                        "session_id": run_session_id,
                        "error": str(exc),
                        "timestamp": iso_now(),
                    }
                )
            finally:
                os.chdir(previous_cwd)
                emit(
                    {
                        "type": "run_complete",
                        "session_id": run_session_id,
                        "timestamp": iso_now(),
                    }
                )

        current_run_task = asyncio.create_task(asyncio.to_thread(worker))

    try:
        while True:
            raw_message = await websocket.receive_text()
            logger.info("[ws] <- session=%s type=%s", session_id, raw_message[:120])

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

            if payload.type == "reset":
                stop_event.set()
                target_session_id = payload.session_id or session_id
                session_store.reset(target_session_id)
                session_id = target_session_id
                logger.info("[ws] reset session=%s", session_id)
                await websocket.send_text(
                    SocketResponse(
                        type="reset",
                        session_id=session_id,
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            if payload.type == "stop":
                stop_event.set()
                logger.info("[ws] stopping requested session=%s", payload.session_id or session_id)
                await websocket.send_text(
                    SocketResponse(
                        type="stopping",
                        session_id=payload.session_id or session_id,
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            if payload.type == "list_files":
                target_session_id = payload.session_id or session_id
                files = session_store.get_generated_files(target_session_id)
                logger.info("[ws] list_files session=%s count=%s", target_session_id, len(files))
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "files",
                            "session_id": target_session_id,
                            "files": files,
                            "timestamp": iso_now(),
                        }
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
            if current_run_task is not None and not current_run_task.done():
                await websocket.send_text(
                    SocketResponse(
                        type="error",
                        session_id=session_id,
                        error="An agent run is already in progress. Stop it before starting a new one.",
                        timestamp=iso_now(),
                    ).model_dump_json()
                )
                continue

            await websocket.send_text(
                SocketResponse(
                    type="ack",
                    session_id=session_id,
                    prompt=prompt,
                    timestamp=iso_now(),
                ).model_dump_json()
            )

            run_session = payload.session_id or session_id
            logger.info(
                "[ws] start_run session=%s prompt_chars=%s workdir=%s",
                run_session,
                len(prompt),
                payload.working_directory,
            )
            start_run(prompt, run_session, resolve_working_directory(payload.working_directory))
    except WebSocketDisconnect:
        stop_event.set()
        logger.info("[ws] disconnected session=%s", session_id)
        return
    except Exception as exc:
        stop_event.set()
        logger.exception("[ws] error session=%s: %s", session_id, exc)
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
