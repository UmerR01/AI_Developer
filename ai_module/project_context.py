"""
Per-run project root for tool path checks (no process-wide os.chdir).
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from pathlib import Path
from typing import Iterator, Optional

SERVER_ROOT = Path(__file__).resolve().parent

_active_project_root: ContextVar[Optional[Path]] = ContextVar(
    "active_project_root",
    default=None,
)


def get_active_project_root() -> Path:
    active = _active_project_root.get()
    if active is not None:
        return active.resolve()
    return SERVER_ROOT.resolve()


def is_safe_path(path: str) -> bool:
    try:
        resolved = Path(path).resolve()
        root = get_active_project_root()
        resolved.relative_to(root)
        return True
    except (ValueError, OSError):
        return False


def resolve_in_project(path: str) -> str:
    if not path or path == ".":
        return str(get_active_project_root())
    p = Path(path)
    if p.is_absolute():
        return str(p.resolve())
    return str((get_active_project_root() / p).resolve())


def enter_project_root(project_root: Optional[str]) -> Optional[Token]:
    if not project_root or not str(project_root).strip():
        return None
    return _active_project_root.set(Path(project_root).resolve())


def leave_project_root(token: Optional[Token]) -> None:
    if token is not None:
        _active_project_root.reset(token)


@contextmanager
def project_root_context(project_root: Optional[str]) -> Iterator[None]:
    token = enter_project_root(project_root)
    try:
        yield
    finally:
        leave_project_root(token)
