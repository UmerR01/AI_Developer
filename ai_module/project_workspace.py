"""
Per-user project workspaces, preview builds, file trees, and ZIP downloads.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import re
import shutil
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent
PROJECTS_ROOT = ROOT_DIR / "generated_projects"
META_FILENAME = ".ai-coder-meta.json"

# Binary extensions — skip reading full content for UI
BINARY_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
    ".eot", ".ttf", ".mp4", ".mp3", ".zip", ".pdf",
}


class ProjectStatus(str, Enum):
    IDLE = "idle"
    GENERATING = "generating"
    BUILDING = "building"
    READY = "ready"
    FAILED = "failed"


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sanitize_id(value: str, fallback: str = "default") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", (value or "").strip())
    return cleaned[:128] or fallback


def project_key(user_id: str, project_id: str) -> str:
    return f"{sanitize_id(user_id)}::{sanitize_id(project_id)}"


def get_project_dir(user_id: str, project_id: str) -> Path:
    path = PROJECTS_ROOT / sanitize_id(user_id) / sanitize_id(project_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


# Frontend artifacts the agent often creates at repo root by mistake (cwd not set).
_REPO_ROOT_ARTIFACTS = (
    "src",
    "public",
    "index.html",
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "vite.config.ts",
    "tailwind.config.js",
    "postcss.config.js",
    "tsconfig.json",
    "tsconfig.node.json",
)


def adopt_stray_repo_root_files(project_dir: Path, repo_root: Path) -> List[str]:
    """Move common frontend outputs from ai-coder repo root into the active project folder."""
    moved: List[str] = []
    proj = project_dir.resolve()
    root = repo_root.resolve()
    if proj == root:
        return moved
    for name in _REPO_ROOT_ARTIFACTS:
        src = root / name
        if not src.exists():
            continue
        dest = proj / name
        if dest.exists():
            continue
        try:
            shutil.move(str(src), str(dest))
            moved.append(name)
        except Exception:
            with suppress(Exception):
                if src.is_dir():
                    shutil.copytree(src, dest, dirs_exist_ok=True)
                    shutil.rmtree(src, ignore_errors=True)
                else:
                    shutil.copy2(src, dest)
                    src.unlink()
                moved.append(name)
    return moved


def is_under_project(path: Path, project_dir: Path) -> bool:
    try:
        path.resolve().relative_to(project_dir.resolve())
        return True
    except ValueError:
        return False


def to_relative_path(file_path: str, project_dir: Path) -> str:
    abs_path = Path(file_path).resolve()
    proj = project_dir.resolve()
    if is_under_project(abs_path, proj):
        return abs_path.relative_to(proj).as_posix()
    return Path(file_path).as_posix().replace("\\", "/")


def resolve_project_path(relative_or_abs: str, project_dir: Path) -> Path:
    rel = relative_or_abs.replace("\\", "/").lstrip("/")
    if ".." in rel.split("/"):
        raise ValueError("Invalid path")
    candidate = (project_dir / rel).resolve()
    if not is_under_project(candidate, project_dir):
        raise ValueError("Path outside project")
    return candidate


def is_text_file(path: Path) -> bool:
    return path.suffix.lower() not in BINARY_SUFFIXES


def detect_project_type(project_dir: Path) -> str:
    """Return 'react' if package.json exists, else 'static' if index.html, else 'unknown'."""
    if (project_dir / "package.json").is_file():
        return "react"
    if (project_dir / "index.html").is_file():
        return "static"
    for html in project_dir.rglob("*.html"):
        if html.is_file() and is_under_project(html, project_dir):
            return "static"
    return "unknown"


def find_static_entry(project_dir: Path) -> Optional[Path]:
    root_index = project_dir / "index.html"
    if root_index.is_file():
        return root_index
    html_files = sorted(
        p for p in project_dir.rglob("*.html")
        if p.is_file() and META_FILENAME not in p.parts
    )
    return html_files[0] if html_files else None


def build_file_tree(relative_paths: List[str]) -> List[Dict[str, Any]]:
    """Build nested tree from posix relative paths."""
    root: Dict[str, Any] = {"name": "", "type": "dir", "children": {}}

    for rel in sorted(set(relative_paths)):
        rel = rel.replace("\\", "/").strip("/")
        if not rel:
            continue
        parts = rel.split("/")
        node = root
        for i, part in enumerate(parts):
            is_file = i == len(parts) - 1
            children = node.setdefault("children", {})
            if part not in children:
                children[part] = {
                    "name": part,
                    "type": "file" if is_file else "dir",
                    "path": rel if is_file else "/".join(parts[: i + 1]),
                    "children": {} if not is_file else None,
                }
            node = children[part]

    def to_list(node: Dict[str, Any]) -> List[Dict[str, Any]]:
        children = node.get("children") or {}
        items = []
        for name in sorted(children.keys(), key=lambda n: (children[n]["type"] == "file", n.lower())):
            entry = children[name]
            item: Dict[str, Any] = {
                "name": entry["name"],
                "type": entry["type"],
                "path": entry.get("path", name),
            }
            if entry["type"] == "dir":
                item["children"] = to_list(entry)
            items.append(item)
        return items

    return to_list(root)


def list_project_files(project_dir: Path) -> List[Dict[str, Any]]:
    files: List[Dict[str, Any]] = []
    if not project_dir.exists():
        return files
    for path in sorted(project_dir.rglob("*")):
        if not path.is_file() or META_FILENAME in path.parts:
            continue
        rel = path.relative_to(project_dir).as_posix()
        entry: Dict[str, Any] = {
            "path": rel,
            "size": path.stat().st_size,
            "type": "text" if is_text_file(path) else "binary",
        }
        if is_text_file(path):
            try:
                entry["content"] = path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                entry["content"] = ""
        else:
            entry["content"] = ""
        files.append(entry)
    return files


def create_project_zip(project_dir: Path) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(project_dir.rglob("*")):
            if not path.is_file() or META_FILENAME in path.parts:
                continue
            arcname = path.relative_to(project_dir).as_posix()
            zf.write(path, arcname)
    buffer.seek(0)
    return buffer.getvalue()


@dataclass
class ProjectMeta:
    user_id: str
    project_id: str
    status: ProjectStatus = ProjectStatus.IDLE
    project_type: str = "unknown"
    preview_dir: str = ""
    preview_url: str = ""
    preview_error: str = ""
    updated_at: str = field(default_factory=iso_now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "project_id": self.project_id,
            "status": self.status.value,
            "project_type": self.project_type,
            "preview_dir": self.preview_dir,
            "preview_url": self.preview_url,
            "preview_error": self.preview_error,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any], user_id: str, project_id: str) -> "ProjectMeta":
        status_raw = data.get("status", ProjectStatus.IDLE.value)
        try:
            status = ProjectStatus(status_raw)
        except ValueError:
            status = ProjectStatus.IDLE
        return cls(
            user_id=user_id,
            project_id=project_id,
            status=status,
            project_type=data.get("project_type", "unknown"),
            preview_dir=data.get("preview_dir", ""),
            preview_url=data.get("preview_url", ""),
            preview_error=data.get("preview_error", ""),
            updated_at=data.get("updated_at", iso_now()),
        )


class ProjectWorkspace:
    def __init__(self, base_url: Optional[str] = None) -> None:
        self._base_url = (base_url or os.getenv("PREVIEW_BASE_URL", "http://localhost:8001")).rstrip("/")
        self._meta_cache: Dict[str, ProjectMeta] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def _lock_for(self, user_id: str, project_id: str) -> asyncio.Lock:
        key = project_key(user_id, project_id)
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    def meta_path(self, project_dir: Path) -> Path:
        return project_dir / META_FILENAME

    def load_meta(self, user_id: str, project_id: str) -> ProjectMeta:
        key = project_key(user_id, project_id)
        project_dir = get_project_dir(user_id, project_id)
        meta_file = self.meta_path(project_dir)
        if meta_file.is_file():
            try:
                data = json.loads(meta_file.read_text(encoding="utf-8"))
                meta = ProjectMeta.from_dict(data, user_id, project_id)
                self._meta_cache[key] = meta
                return meta
            except Exception:
                pass
        meta = ProjectMeta(user_id=user_id, project_id=project_id)
        self._meta_cache[key] = meta
        return meta

    def save_meta(self, meta: ProjectMeta) -> None:
        key = project_key(meta.user_id, meta.project_id)
        meta.updated_at = iso_now()
        self._meta_cache[key] = meta
        project_dir = get_project_dir(meta.user_id, meta.project_id)
        self.meta_path(project_dir).write_text(
            json.dumps(meta.to_dict(), indent=2),
            encoding="utf-8",
        )

    def preview_url_for(self, user_id: str, project_id: str) -> str:
        u = sanitize_id(user_id)
        p = sanitize_id(project_id)
        return f"{self._base_url}/preview/{u}/{p}/"

    def is_busy(self, user_id: str, project_id: str) -> bool:
        meta = self.load_meta(user_id, project_id)
        return meta.status in (ProjectStatus.GENERATING, ProjectStatus.BUILDING)

    def begin_generation(self, user_id: str, project_id: str) -> Tuple[bool, str]:
        if self.is_busy(user_id, project_id):
            meta = self.load_meta(user_id, project_id)
            return False, f"Project is busy ({meta.status.value}). Wait for the current run to finish."
        meta = self.load_meta(user_id, project_id)
        meta.status = ProjectStatus.GENERATING
        meta.preview_error = ""
        self.save_meta(meta)
        return True, ""

    def end_generation(self, user_id: str, project_id: str) -> None:
        meta = self.load_meta(user_id, project_id)
        if meta.status == ProjectStatus.GENERATING:
            meta.status = ProjectStatus.IDLE
            self.save_meta(meta)

    def sync_file(
        self,
        user_id: str,
        project_id: str,
        path: str,
        content: str,
        source_tool: str = "",
    ) -> Optional[Dict[str, str]]:
        """Persist a file under the project. Returns None for paths outside the project (e.g. screenshots)."""
        project_dir = get_project_dir(user_id, project_id)
        proj_resolved = project_dir.resolve()

        if os.path.isabs(path):
            abs_p = Path(path).resolve()
            if not is_under_project(abs_p, proj_resolved):
                return None
            rel = abs_p.relative_to(proj_resolved).as_posix()
        else:
            rel = path.replace("\\", "/").lstrip("/")
            if "screenshots/" in rel or rel.startswith("reference_uploads/"):
                return None

        try:
            target = resolve_project_path(rel, project_dir)
        except ValueError:
            return None

        target.parent.mkdir(parents=True, exist_ok=True)
        if content:
            target.write_text(content, encoding="utf-8", errors="replace")
        return {
            "path": rel,
            "content": content,
            "type": "text",
            "source_tool": source_tool,
        }

    def get_file_tree(self, user_id: str, project_id: str) -> Dict[str, Any]:
        project_dir = get_project_dir(user_id, project_id)
        paths = [
            p.relative_to(project_dir).as_posix()
            for p in project_dir.rglob("*")
            if p.is_file() and META_FILENAME not in p.parts
        ]
        meta = self.load_meta(user_id, project_id)
        return {
            "user_id": user_id,
            "project_id": project_id,
            "project_root": str(project_dir),
            "tree": build_file_tree(paths),
            "files": list_project_files(project_dir),
            "status": meta.status.value,
            "preview_url": meta.preview_url,
            "project_type": meta.project_type,
        }

    def read_file(self, user_id: str, project_id: str, path: str) -> Dict[str, Any]:
        project_dir = get_project_dir(user_id, project_id)
        target = resolve_project_path(path, project_dir)
        if not target.is_file():
            raise FileNotFoundError(path)
        if not is_text_file(target):
            return {"path": path, "content": "", "type": "binary", "size": target.stat().st_size}
        return {
            "path": path,
            "content": target.read_text(encoding="utf-8", errors="replace"),
            "type": "text",
            "size": target.stat().st_size,
        }

    def get_preview_serve_dir(self, user_id: str, project_id: str) -> Optional[Path]:
        meta = self.load_meta(user_id, project_id)
        if not meta.preview_dir:
            return None
        project_dir = get_project_dir(user_id, project_id)
        serve = (project_dir / meta.preview_dir).resolve()
        if is_under_project(serve, project_dir) and serve.is_dir():
            return serve
        return None

    def _existing_built_dir(self, project_dir: Path) -> Optional[Path]:
        """Return dist/ or build/ if it already contains a production index.html."""
        for name in ("dist", "build"):
            folder = project_dir / name
            if (folder / "index.html").is_file():
                return folder
        return None

    async def run_preview_build(
        self,
        user_id: str,
        project_id: str,
        force: bool = False,
    ) -> ProjectMeta:
        lock = self._lock_for(user_id, project_id)
        async with lock:
            meta = self.load_meta(user_id, project_id)
            meta.status = ProjectStatus.BUILDING
            meta.preview_error = ""
            self.save_meta(meta)

            project_dir = get_project_dir(user_id, project_id)
            project_type = detect_project_type(project_dir)
            meta.project_type = project_type

            try:
                if project_type == "react":
                    ok, err, serve_dir = await self._build_react(project_dir, force=force)
                elif project_type == "static":
                    # Plain static site only (no Vite) — do not serve dev index.html with /src/...
                    if (project_dir / "package.json").is_file():
                        ok, err, serve_dir = await self._build_react(project_dir, force=force)
                        meta.project_type = "react"
                    else:
                        ok, err, serve_dir = True, "", project_dir
                        entry = find_static_entry(project_dir)
                        if not entry:
                            ok, err = False, "No index.html found for static preview."
                else:
                    ok, err, serve_dir = False, "No package.json or index.html found.", project_dir

                if ok:
                    rel_serve = serve_dir.relative_to(project_dir).as_posix()
                    if rel_serve == ".":
                        rel_serve = ""
                    meta.preview_dir = rel_serve
                    meta.preview_url = self.preview_url_for(user_id, project_id)
                    meta.status = ProjectStatus.READY
                    meta.preview_error = ""
                else:
                    meta.status = ProjectStatus.FAILED
                    meta.preview_error = err or "Preview build failed."
                    meta.preview_url = ""
                    meta.preview_dir = ""
            except asyncio.TimeoutError:
                meta.status = ProjectStatus.FAILED
                meta.preview_error = "Preview build timed out (10 min)."
                meta.preview_url = ""
                meta.preview_dir = ""
            except Exception as exc:
                meta.status = ProjectStatus.FAILED
                meta.preview_error = f"{type(exc).__name__}: {exc}"
                meta.preview_url = ""
                meta.preview_dir = ""

            self.save_meta(meta)
            return meta

    async def _build_react(self, project_dir: Path, force: bool = False) -> Tuple[bool, str, Path]:
        dist = project_dir / "dist"

        existing = self._existing_built_dir(project_dir)
        if existing and not force:
            return True, "", existing

        if force and dist.exists():
            shutil.rmtree(dist, ignore_errors=True)

        npm = "npm.cmd" if os.name == "nt" else "npm"

        if not (project_dir / "node_modules").is_dir():
            install_args = [npm, "ci"] if (project_dir / "package-lock.json").is_file() else [npm, "install"]
            install = await asyncio.create_subprocess_exec(
                *install_args,
                cwd=str(project_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            out, _ = await asyncio.wait_for(install.communicate(), timeout=600)
            if install.returncode != 0:
                log = (out or b"").decode("utf-8", errors="replace")[-2000:]
                return False, f"npm install failed:\n{log}", project_dir

        build = await asyncio.create_subprocess_exec(
            npm, "run", "build",
            cwd=str(project_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        out, _ = await asyncio.wait_for(build.communicate(), timeout=600)
        if build.returncode != 0:
            log = (out or b"").decode("utf-8", errors="replace")[-2000:]
            return False, f"npm run build failed:\n{log}", project_dir

        built = self._existing_built_dir(project_dir)
        if built:
            return True, "", built
        return False, "Build finished but dist/index.html was not created.", project_dir


workspace = ProjectWorkspace()
