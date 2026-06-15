import google.auth
from google.auth.transport.requests import Request
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_core.tools import tool
import ast
import logging
import os
import re
import libcst as cst
from typing import List, Dict, Any, Callable, Optional
import json
from skills import read_frontend_skill
from llm_retry import invoke_with_retry, is_context_limit_error
from prompt import agent_prompt

logger_agent = logging.getLogger("agent")

from tools import (
    web_search,
    fetch_url,
    image_search,
    fetch_image,
    fetch_image_to_file,
    load_local_reference_image,
    analyze_reference_image,
    generate_frontend_from_reference,
    playwright_screenshot,
    playwright_extract_dom,
    playwright_render_and_check,
    cache_set,
    cache_get,
    read_file,
    read_file_range,
    list_files,
    create_todo_list,
    update_todo_list,
    # ── searching ──
    search_in_codebase,
    find_symbol,
    search_and_replace_codebase,
    # ── editing (surgical) ──
    replace_in_file,
    replace_lines_in_file,
    inject_code_at_line,
    append_to_file,
    # ── editing (bulk) ──
    rewrite_file,
    apply_libcst_transform,
    # ── generation ──
    create_file,
    create_project_scaffold,
    # ── verification ──
    frontend_skill,
    get_design_theme,
    run_shell_command,
    validate_frontend_project,
    validate_static_frontend_files,
    build_and_publish_preview,
    diagnose_ui_screenshot,
    check_file_consistency,
    run_python_file,
    _extract_data_uri_parts,
)

load_dotenv()

# ──────────────────────────────────────────────
# AUTH
# ──────────────────────────────────────────────
creds, project = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
creds.refresh(Request())

llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    credentials=creds,
    project="joblynk-489820",
    location="global",
    vertexai=True,
    max_retries=1,
)

# ──────────────────────────────────────────────
# SAFETY
# ──────────────────────────────────────────────
BASE_DIR = os.getcwd()

def is_safe_path(path: str) -> bool:
    return os.path.abspath(path).startswith(BASE_DIR)






tools = [
    web_search,
    fetch_url,
    image_search,
    fetch_image,
    fetch_image_to_file,
    load_local_reference_image,
    analyze_reference_image,
    generate_frontend_from_reference,
    playwright_screenshot,
    playwright_extract_dom,
    playwright_render_and_check,
    cache_set,
    cache_get,
    read_file,
    read_file_range,
    list_files,
    create_todo_list,
    update_todo_list,
    # ── searching ──
    search_in_codebase,
    find_symbol,
    search_and_replace_codebase,
    # ── editing (surgical) ──
    replace_in_file,
    replace_lines_in_file,
    inject_code_at_line,
    append_to_file,
    # ── editing (bulk) ──
    rewrite_file,
    apply_libcst_transform,
    # ── generation ──
    create_file,
    create_project_scaffold,
    # ── verification ──
    frontend_skill,
    get_design_theme,
    run_shell_command,
    validate_frontend_project,
    validate_static_frontend_files,
    build_and_publish_preview,
    diagnose_ui_screenshot,
    check_file_consistency,
    run_python_file,
]

tool_map: Dict[str, Any] = {t.name: t for t in tools}

llm_with_tools = llm.bind_tools(tools)

# ──────────────────────────────────────────────
# SYSTEM PROMPT
# ──────────────────────────────────────────────
SYSTEM_PROMPT = agent_prompt()

# ──────────────────────────────────────────────
# REACT AGENT LOOP
# ──────────────────────────────────────────────
from langchain_core.messages import (
    HumanMessage, AIMessage, ToolMessage, SystemMessage
)

MAX_ITERATIONS = 40  # generation tasks need more steps than debugging

# Generation tools that count as "forward progress" per file written
WRITE_TOOLS = {
    "create_file", "rewrite_file", "replace_in_file",
    "replace_lines_in_file", "inject_code_at_line",
    "append_to_file", "apply_libcst_transform",
    "create_project_scaffold",
}

# Verification tools — success here means task is done
VERIFY_TOOLS = {
    "run_python_file", "run_shell_command",
    "validate_frontend_project", "validate_static_frontend_files",
    "build_and_publish_preview",
}

def extract_text(content) -> str:
    """Safely extract text from various LangChain content formats."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    if isinstance(content, dict):
        return content.get("text", str(content))
    return str(content)


def _is_generation_task(user_input: str) -> bool:
    """Detect if this is a code generation task vs a debug/read task."""
    gen_keywords = {
        "create", "build", "generate", "scaffold", "make", "write",
        "add feature", "add auth", "new project", "set up", "initialize",
        "implement", "develop", "design", "produce"
    }
    inp = user_input.lower()
    return any(k in inp for k in gen_keywords)


def _is_static_frontend_project(project_directory: str) -> bool:
    """Heuristic: a frontend folder with HTML/CSS/JS files but no package.json."""
    if not project_directory or not os.path.isdir(project_directory):
        return False
    has_pkg = os.path.exists(os.path.join(project_directory, "package.json"))
    if has_pkg:
        return False

    try:
        for root, _, files in os.walk(project_directory):
            for name in files:
                lower = name.lower()
                if lower.endswith((".html", ".css", ".js")):
                    return True
    except Exception:
        return False
    return False


def _looks_like_frontend_task(files_written: set) -> bool:
    hints = (".html", ".css", ".jsx", ".tsx", ".vue", "package.json", "vite.config")
    for fpath in files_written:
        lower = str(fpath).lower().replace("\\", "/")
        if any(h in lower for h in hints):
            return True
    return False


def _build_user_message(text: str, image_attachments: Optional[List[Dict[str, Any]]] = None) -> HumanMessage:
    if not image_attachments:
        return HumanMessage(content=text)
    parts: List[Any] = [{"type": "text", "text": text}]
    for img in image_attachments:
        uri = str(img.get("data_uri") or "")
        parsed = _extract_data_uri_parts(uri)
        if parsed:
            parts.append({
                "type": "image",
                "base64": parsed["base64"],
                "mime_type": parsed["mime_type"],
            })
    if len(parts) == 1:
        return HumanMessage(content=text)
    return HumanMessage(content=parts)


def _task_complete_signal(
    tool_name: str,
    result_str: str,
    files_written: set,
    verify_passed: bool,
) -> tuple[bool, str]:
    """
    Decide if the current task is complete based on what just happened.
    Returns (should_stop, reason).
    """
    # Verification success → always done
    if tool_name == "build_and_publish_preview":
        try:
            parsed = json.loads(result_str)
            if parsed.get("status") == "ready":
                return True, "✅ App preview published and ready"
        except json.JSONDecodeError:
            pass
        return False, ""

    if tool_name in VERIFY_TOOLS:
        if "EXIT CODE: 0" in result_str:
            return True, "✅ Verification passed (exit code 0)"
        if "ALL CHECKS PASSED" in result_str:
            return False, ""  # require build_and_publish_preview next
        if "STATIC FRONTEND CHECKS PASSED" in result_str:
            return False, ""  # require build_and_publish_preview next
        if "EXIT CODE: 0" not in result_str and tool_name == "run_python_file":
            return False, ""   # failed run — keep going to fix

    return False, ""


def _emit_event(event_sink: Optional[Callable[[Dict[str, Any]], None]], event_type: str, **payload: Any) -> None:
    """Emit a structured event if a sink is configured."""
    if event_sink is None:
        return
    try:
        event_sink({"type": event_type, **payload})
    except Exception:
        pass


def _path_for_event(file_path: str, project_root: Optional[str]) -> str:
    if not project_root:
        return file_path.replace("\\", "/")
    try:
        return os.path.relpath(os.path.abspath(file_path), os.path.abspath(project_root)).replace("\\", "/")
    except ValueError:
        return file_path.replace("\\", "/")


def _emit_generated_file(
    event_sink: Optional[Callable[[Dict[str, Any]], None]],
    file_path: str,
    project_root: Optional[str],
    source_tool: str,
    iteration: int,
) -> None:
    if not event_sink or not file_path or not os.path.isfile(file_path):
        return
    rel_path = _path_for_event(file_path, project_root)
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        _emit_event(
            event_sink,
            "generated_file",
            path=rel_path,
            content=content,
            source_tool=source_tool,
            iteration=iteration,
        )
    except Exception as read_exc:
        _emit_event(
            event_sink,
            "generated_file_error",
            path=rel_path,
            error=str(read_exc),
            source_tool=source_tool,
            iteration=iteration,
        )


def _emit_scaffold_files(
    event_sink: Optional[Callable[[Dict[str, Any]], None]],
    project_name: str,
    project_root: Optional[str],
    source_tool: str,
    iteration: int,
) -> None:
    if not event_sink:
        return
    root = os.path.abspath(project_name)
    if not os.path.isdir(root):
        return
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            full = os.path.join(dirpath, name)
            _emit_generated_file(event_sink, full, project_root, source_tool, iteration)


def run_agent(
    user_input: str,
    message_history: List,
    event_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
    stop_check: Optional[Callable[[], bool]] = None,
    project_root: Optional[str] = None,
    image_attachments: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    ReAct agent loop with:
    - Generation-aware completion detection (tracks files written, not just exit codes)
    - Read budget (prevents re-read loops)
    - Stall detection (blocks repeated identical calls)
    - Verification hard stop (exit code 0 / ALL CHECKS PASSED = done)
    - Progress window (stops if no write progress in last N iterations)
    - Adaptive MAX_ITERATIONS (higher for generation tasks)
    """
    message_history.append(_build_user_message(user_input, image_attachments))
    _emit_event(event_sink, "user_input", content=user_input)

    def stop_requested() -> bool:
        return bool(stop_check and stop_check())

    if stop_requested():
        _emit_event(event_sink, "stopped", reason="stop_requested_before_start")
        return "⏹ Generation stopped before it began."

    from project_context import enter_project_root, leave_project_root

    root_token = enter_project_root(project_root)
    try:
        return _run_agent_loop(
            user_input,
            message_history,
            event_sink=event_sink,
            stop_check=stop_check,
            project_root=project_root,
        )
    finally:
        leave_project_root(root_token)


_COMPACT_KEEP_LAST_AGENT: int = int(os.getenv("CONTEXT_COMPACT_KEEP_LAST", "6"))


def _compact_history_on_429(
    message_history: List,
    event_sink: Optional[Callable[[Dict[str, Any]], None]],
    *,
    session_id: Optional[str],
    attempt: int,
    exc: BaseException,
) -> bool:
    """Compact *message_history* in-place when a 429 / context-limit error fires.

    Keeps the first message (system prompt) + a compact summary of older messages
    + the most recent ``_COMPACT_KEEP_LAST_AGENT`` messages.

    Returns True if compaction was performed (history was actually shortened).
    """
    from langchain_core.messages import SystemMessage

    keep = _COMPACT_KEEP_LAST_AGENT
    if len(message_history) <= keep + 1:  # nothing meaningful to compact
        logger_agent.warning(
            "[compact-429] history too short to compact (len=%d), skipping", len(message_history)
        )
        return False

    system_msg = message_history[0]
    old_messages = message_history[1 : len(message_history) - keep]
    recent_messages = message_history[len(message_history) - keep :]

    summary_parts: List[str] = []
    for msg in old_messages:
        role = type(msg).__name__.replace("Message", "").lower()
        content = getattr(msg, "content", "") or ""
        if isinstance(content, list):
            content = " ".join(
                p.get("text", "") if isinstance(p, dict) else str(p)
                for p in content
            )
        snippet = str(content)[:300].replace("\n", " ")
        summary_parts.append(f"[{role}]: {snippet}")

    compact_text = (
        "[CONTEXT COMPACTED — 429 / quota error forced history reduction]\n"
        + "\n".join(summary_parts)
        + "\n[End of compacted context. Continue from the most recent messages below.]"
    )

    # Mutate in-place so the retry uses the shorter history
    message_history.clear()
    message_history.append(system_msg)
    message_history.append(SystemMessage(content=compact_text))
    message_history.extend(recent_messages)

    logger_agent.warning(
        "[compact-429] compacted history attempt=%d exc=%s kept=%d+compact+%d",
        attempt, exc, 1, len(recent_messages),
    )

    _emit_event(
        event_sink,
        "context_compacted",
        session_id=session_id or "agent",
        reason="429_rate_limit",
        tokens_after=None,
        attempt=attempt,
        error=str(exc),
    )
    _emit_event(
        event_sink,
        "agent_log",
        message=(
            f"⚡ Context compacted due to 429 / quota error (attempt {attempt}). "
            f"History reduced to {len(message_history)} messages. Retrying…"
        ),
    )
    return True


def _run_agent_loop(
    user_input: str,
    message_history: List,
    event_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
    stop_check: Optional[Callable[[], bool]] = None,
    project_root: Optional[str] = None,
) -> str:
    def stop_requested() -> bool:
        return bool(stop_check and stop_check())

    is_gen       = _is_generation_task(user_input)
    max_iter     = MAX_ITERATIONS if is_gen else 15
    mode_label   = "🏗️  GENERATION" if is_gen else "🔍 DEBUG/EDIT"
    print(f"\n  Mode: {mode_label} | Max iterations: {max_iter}")

    seen_tool_signatures: List[str] = []
    read_budget:  Dict[str, int]   = {}   # file_path → read count this turn
    files_written: set             = set() # files successfully written this turn
    no_progress_streak             = 0    # consecutive iterations with no write success
    last_write_iteration           = -1
    verify_passed                  = False
    preview_published              = False
    preview_nudges                 = 0

    for iteration in range(max_iter):
        if stop_requested():
            _emit_event(event_sink, "stopped", reason="stop_requested_during_loop", iteration=iteration + 1)
            return "⏹ Generation stopped by user."

        response = invoke_with_retry(
            lambda: llm_with_tools.invoke(message_history),
            label="agent-llm",
            on_retry=lambda attempt, max_a, wait, exc: (
                _emit_event(
                    event_sink,
                    "agent_log",
                    message=f"⚠️ LLM error (attempt {attempt}/{max_a}), retrying in {wait:.1f}s: {exc}",
                    iteration=iteration + 1,
                )
            ),
            on_context_error=lambda attempt, exc: _compact_history_on_429(
                message_history, event_sink, session_id=None, attempt=attempt, exc=exc
            ),
        )

        # ── Show Gemini thinking ───────────────────────────────────────────
        thinking = _extract_thinking(response)
        if thinking:
            print(f"\n  💭 [{iteration+1}] Thinking: {thinking[:180]}{'...' if len(thinking) > 180 else ''}")
            _emit_event(event_sink, "thinking", iteration=iteration + 1, content=thinking)

        message_history.append(response)

        # ── No tool calls → final answer ──────────────────────────────────
        if not response.tool_calls:
            if (
                is_gen
                and files_written
                and _looks_like_frontend_task(files_written)
                and not preview_published
                and preview_nudges < 3
            ):
                preview_nudges += 1
                message_history.append(HumanMessage(
                    content=(
                        "⚠️ SYSTEM: Frontend files were written but preview is not published. "
                        "Call build_and_publish_preview(project_directory='.') NOW before giving your final answer."
                    )
                ))
                continue
            final_text = extract_text(response.content)
            _emit_event(event_sink, "assistant_message", content=final_text, final=True)
            return final_text

        # ── Progress window check ─────────────────────────────────────────
        # If we've done 6+ iterations with zero file writes, we're looping
        if iteration > 20 and (iteration - last_write_iteration) > 6:
            return (
                "⚠️ Agent made no file changes in the last 6 iterations — likely stuck.\n"
                "Try being more specific: e.g. 'create only the package.json file' "
                "or 'rewrite the main.py file with the correct imports'."
            )

        # ── Execute tool calls ─────────────────────────────────────────────
        iteration_wrote_something = False

        for tool_call in response.tool_calls:
            if stop_requested():
                _emit_event(event_sink, "stopped", reason="stop_requested_before_tool", iteration=iteration + 1)
                return "⏹ Generation stopped by user."

            tool_name    = tool_call["name"]
            tool_args    = tool_call["args"]
            tool_call_id = tool_call["id"]

            # ── Validation guard for static frontend projects ───────────
            if tool_name == "validate_frontend_project":
                project_dir = tool_args.get("project_directory", "")
                if _is_static_frontend_project(project_dir):
                    guard_msg = (
                        "⚠️ SYSTEM: Detected static HTML/CSS/JS project (no package.json). "
                        "Do NOT call validate_frontend_project here. "
                        "Use validate_static_frontend_files(project_directory=...) instead."
                    )
                    print(f"\n  🚫 [{iteration+1}] Blocked validate_frontend_project for static project: {project_dir}")
                    _emit_event(
                        event_sink,
                        "tool_blocked",
                        tool=tool_name,
                        reason="static_project_validation_mismatch",
                        project_directory=project_dir,
                        iteration=iteration + 1,
                    )
                    message_history.append(ToolMessage(content=guard_msg, tool_call_id=tool_call_id))
                    continue

            # ── Read budget ───────────────────────────────────────────────
            if tool_name in ("read_file", "read_file_range"):
                fpath = tool_args.get("file_path", "")
                read_budget[fpath] = read_budget.get(fpath, 0) + 1
                if read_budget[fpath] > 2:
                    print(f"\n  🚫 [{iteration+1}] Read budget hit for '{fpath}'")
                    _emit_event(
                        event_sink,
                        "tool_blocked",
                        tool=tool_name,
                        reason="read_budget",
                        path=fpath,
                        iteration=iteration + 1,
                    )
                    message_history.append(ToolMessage(
                        content=(
                            f"⚠️ SYSTEM: '{fpath}' already read {read_budget[fpath]-1}x. "
                            "Content is in your context — use it. Do NOT read again."
                        ),
                        tool_call_id=tool_call_id
                    ))
                    continue

            # ── Stall detection ───────────────────────────────────────────
            # For write tools, use only tool_name + file_path as signature
            # (not full args) so the model can rewrite with different content
            if tool_name in WRITE_TOOLS:
                fpath    = tool_args.get("file_path", tool_args.get("project_name", ""))
                sig_key  = f"{tool_name}:{fpath}"
            elif tool_name == "run_shell_command":
                sig_key  = None
            else:
                sig_key  = f"{tool_name}:{json.dumps(tool_args, sort_keys=True)}"

            if sig_key is not None and sig_key in seen_tool_signatures and tool_name not in WRITE_TOOLS:
                # Block repeated non-write calls (reads, searches, verifications)
                print(f"\n  ⚠️  [{iteration+1}] Stall: '{tool_name}' repeated — blocking")
                _emit_event(
                    event_sink,
                    "tool_blocked",
                    tool=tool_name,
                    reason="repeat_call",
                    args=tool_args,
                    iteration=iteration + 1,
                )
                message_history.append(ToolMessage(
                    content=(
                        f"⚠️ SYSTEM: '{tool_name}' already called with same args. Blocked. "
                        "Give your final answer now or use a different approach."
                    ),
                    tool_call_id=tool_call_id
                ))
                no_progress_streak += 1
                if no_progress_streak >= 4:
                    return (
                        "⚠️ Agent stuck — repeated identical non-write calls blocked 4 times.\n"
                        "Suggestion: break your request into smaller steps."
                    )
                continue

            if tool_name not in WRITE_TOOLS and sig_key is not None:
                seen_tool_signatures.append(sig_key)

            print(f"\n  🔧 [{iteration+1}] {tool_name}")
            # Print truncated args for readability
            args_preview = json.dumps(tool_args, indent=2)
            if len(args_preview) > 400:
                args_preview = args_preview[:400] + "\n  ... (content truncated)"
            print(f"     Args: {args_preview}")
            _emit_event(
                event_sink,
                "tool_start",
                tool=tool_name,
                args=tool_args,
                iteration=iteration + 1,
            )

            # ── Execute ───────────────────────────────────────────────────
            if tool_name not in tool_map:
                result_str = f"Error: tool '{tool_name}' not found."
            else:
                try:
                    result_str = str(tool_map[tool_name].invoke(tool_args))
                except Exception as e:
                    result_str = f"Tool execution error: {str(e)}"

            preview = result_str[:250] + ("..." if len(result_str) > 250 else "")
            print(f"     Result: {preview}")
            _emit_event(
                event_sink,
                "tool_result",
                tool=tool_name,
                result=result_str,
                preview=preview,
                iteration=iteration + 1,
            )

            # ── Track writes ──────────────────────────────────────────────
            success_phrases = ["successfully", "✅", "created", "rewritten", "appended", "inserted", "applied", "scaffolded"]
            wrote_this_call = (
                tool_name in WRITE_TOOLS and
                any(p in result_str.lower() for p in success_phrases)
            )
            if wrote_this_call:
                fpath = tool_args.get("file_path", tool_args.get("project_name", "?"))
                files_written.add(fpath)
                last_write_iteration    = iteration
                no_progress_streak      = 0
                iteration_wrote_something = True
                # Reset read budget so model can verify what it just wrote
                read_budget[fpath] = 0

                # Emit generated file payload for realtime frontend file list updates.
                if tool_name == "create_project_scaffold":
                    scaffold_root = tool_args.get("project_name", fpath)
                    if isinstance(scaffold_root, str):
                        _emit_scaffold_files(
                            event_sink,
                            scaffold_root,
                            project_root,
                            tool_name,
                            iteration + 1,
                        )
                elif isinstance(fpath, str) and os.path.isfile(fpath):
                    _emit_generated_file(
                        event_sink,
                        fpath,
                        project_root,
                        tool_name,
                        iteration + 1,
                    )
            elif any(x in result_str.lower() for x in ["error", "not found", "denied", "access denied"]):
                no_progress_streak += 1

            message_history.append(
                ToolMessage(content=result_str, tool_call_id=tool_call_id)
            )

            if tool_name == "build_and_publish_preview":
                try:
                    parsed = json.loads(result_str)
                    if parsed.get("status") == "ready":
                        preview_published = True
                        _emit_event(
                            event_sink,
                            "preview_ready",
                            preview_url=parsed.get("preview_url", ""),
                            project_type=parsed.get("project_type", ""),
                            status="ready",
                        )
                except json.JSONDecodeError:
                    pass

            if tool_name in ("validate_frontend_project", "validate_static_frontend_files"):
                if "ALL CHECKS PASSED" in result_str or "STATIC FRONTEND CHECKS PASSED" in result_str:
                    message_history.append(HumanMessage(
                        content=(
                            "Validation passed. Call build_and_publish_preview(project_directory='.') "
                            "NOW to publish the live preview before finishing."
                        )
                    ))

            # ── Verification hard stop ────────────────────────────────────
            should_stop, reason = _task_complete_signal(
                tool_name, result_str, files_written, verify_passed
            )
            if should_stop:
                verify_passed = True
                summary = (
                    f"\n{reason}\n"
                    f"Files written this session: {len(files_written)}\n"
                    f"  " + "\n  ".join(sorted(files_written))
                )
                _emit_event(
                    event_sink,
                    "agent_complete",
                    reason=reason,
                    files_written=sorted(files_written),
                    verification_passed=True,
                )
                message_history.append(HumanMessage(
                    content=(
                        f"{summary}\n\n"
                        "✅ Task complete. Give your final answer NOW summarizing what was built. "
                        "Do NOT call any more tools."
                    )
                ))
                print(f"     {reason} — stop signal injected")

            # ── Shell command success also stops ──────────────────────────
            elif tool_name == "run_shell_command" and "EXIT CODE: 0" in result_str:
                # Only stop for build/test commands
                cmd = tool_args.get("command", "")
                if any(k in cmd for k in ["build", "test"]):
                    _emit_event(
                        event_sink,
                        "agent_complete",
                        reason=f"shell:{cmd}",
                        files_written=sorted(files_written),
                        verification_passed=True,
                    )
                    message_history.append(HumanMessage(
                        content=(
                            f"✅ '{cmd}' succeeded (exit code 0).\n"
                            f"Files written: {sorted(files_written)}\n"
                            "Task is complete. Give your final answer NOW. Do NOT call more tools."
                        )
                    ))
                    print(f"     ✅ Shell command '{cmd}' succeeded — stop signal injected")

    return (
        f"⚠️ Reached {max_iter} iterations.\n"
        f"Progress made: {len(files_written)} file(s) written: {sorted(files_written)}\n"
        "Try: break your request into smaller steps, or ask me to continue from where I left off."
    )



def _extract_thinking(response) -> str:
    """
    Extract Gemini chain-of-thought thinking blocks if present.
    Gemini 2.5 Flash returns these as additional_kwargs or content blocks.
    """
    try:
        # Method 1: additional_kwargs (some LangChain versions)
        thinking = response.additional_kwargs.get("thinking", "")
        if thinking:
            return thinking

        # Method 2: content list with type=thinking blocks
        if isinstance(response.content, list):
            for block in response.content:
                if isinstance(block, dict) and block.get("type") == "thinking":
                    return block.get("thinking", block.get("text", ""))

        # Method 3: usage_metadata sometimes has thinking summary
        meta = getattr(response, "usage_metadata", {}) or {}
        return meta.get("thinking_summary", "")

    except Exception:
        return ""


# ──────────────────────────────────────────────
# MAIN CHAT LOOP
# ──────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  🤖  Agentic Coding Assistant  (type 'exit' to quit)")
    print("=" * 60)

    # Persistent message history across the whole session
    message_history: List = [SystemMessage(content=SYSTEM_PROMPT)]

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit"}:
            print("Goodbye!")
            break

        print()  # spacing
        final_answer = run_agent(user_input, message_history)
        print(f"\nAssistant: {final_answer}")


if __name__ == "__main__":
    main()