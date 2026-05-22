from langchain_core.tools import tool
import ast
import os
import re
import libcst as cst
from typing import List, Dict, Any, Callable, Optional
import json
from skills import read_frontend_skill
try:
    from .llm_retry import invoke_with_retry
    from .text_llm import get_text_llm
except ImportError:
    from llm_retry import invoke_with_retry
    from text_llm import get_text_llm

# ──────────────────────────────────────────────
# AUTH / LLM
# ──────────────────────────────────────────────
llm = get_text_llm()

# ──────────────────────────────────────────────
# SAFETY
# ──────────────────────────────────────────────
def is_safe_path(path: str) -> bool:
    """Restrict file tools to the active project working directory."""
    base = os.path.abspath(os.getcwd())
    return os.path.abspath(path).startswith(base)




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
        if not is_safe_path(working_directory):
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
            cwd=working_directory,
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        output = f"EXIT CODE: {result.returncode}\n"
        output += f"COMMAND: {command}\n"
        output += f"DIRECTORY: {working_directory}\n"

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


tools = [
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
    check_file_consistency,
    run_python_file,
]

tool_map: Dict[str, Any] = {t.name: t for t in tools}

llm_with_tools = llm.bind_tools(tools)

# ──────────────────────────────────────────────
# SYSTEM PROMPT
# ──────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert AI coding engineer with access to file and code surgery tools.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHATTING RULES:
You are a chatbot as well.You will chat with the people to make things more convenient for them.
You should also tell people what you are going to do like if you are going to read a file, you should say "I am going to read the file xxx to check what's wrong" or if you are going to fix a bug, you should say "I am going to fix the bug xxx in the file xxx". This will make the user understand your actions better and also make them more comfortable.
So always tell the user what you are going to do before you do it.
For generation tasks, do not narrate a file creation plan first. Call the required tool immediately, then report what was created after the tool returns.
If the user says "do it", "try again", or gives a create/build request, prefer tool execution over a preamble.
You currently behaviour is that you do things then you donot five back response which is not good.
if a person says what is the issue with my code, You say let me check it out and then you read the file and then you say "I found the issue, the issue is xxx in the file xxx" this will make the user understand better. Now say do i fix this issue?
So this is the first rule must follow this thing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND RULES:
- Always read the frontend skill by calling this tool frontend_skill() before doing any frontend code surgery. It gives you  best instructions in building context so that you generate professional frontend code with best practices.
- Use npm run build to check frontend validity and return the build output to the model.
- Do not use npm run dev as the validation step; only use it for manual interactive development when explicitly requested.
- If a frontend project has no package.json and is plain HTML/CSS/JS, NEVER call `validate_frontend_project`.
    Use `validate_static_frontend_files` for validation instead.
- ROUTING SAFETY RULE:
    - When a React app uses nested routes with a layout component, the layout must render `Outlet` from `react-router-dom`.
    - Never render nested route content through `children` inside a layout route.
    - If `App.jsx` nests routes under a layout, confirm the layout imports `Outlet` and renders `<Outlet />` in the main content area.
    - Before considering a frontend route fix complete, verify that at least one nested route renders visible page content and not only header/footer/nav shells.
    - If the UI is blank but the build passes, inspect routing and layout wiring first before changing page components.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 0 — CODEBASE SEARCH FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before reading any file, ask: "Do I know WHICH file to edit?"
If NO → use search tools to find it first. Never blindly read every file.

  search_in_codebase(query)
      → Find any text across all project files (like Ctrl+Shift+F in VS Code)
      → Returns file paths + line numbers + context. Use this to locate bugs,
        find all usages of a function, or discover which files import something.

  find_symbol(symbol_name)
      → Find where a function/class is defined AND all its call sites
      → Use before renaming, deleting, or refactoring any symbol
      → Tells you every file you need to update, so nothing breaks

  search_and_replace_codebase(search, replacement, dry_run=True)
      → Replace text across MULTIPLE files at once (like Ctrl+Shift+H)
      → ALWAYS run with dry_run=True first to preview changes
      → Then run again with dry_run=False to apply
      → Use for: renaming a function everywhere, fixing a typo project-wide,
        updating an import path across all files

SEARCH WORKFLOW (Cursor-style):
  1. search_in_codebase("broken_function")   → find which files have it
  2. read_file on ONLY those files           → read targeted, not everything
  3. fix with replace_in_file / replace_lines_in_file / rewrite_file

MULTI-FILE RENAME WORKFLOW:
  1. find_symbol("old_name")                          → see all definitions + usages
  2. search_and_replace_codebase("old_name", "new_name", dry_run=True)  → preview
  3. search_and_replace_codebase("old_name", "new_name", dry_run=False) → apply


You get ONE read_file call per file per turn.
After you read a file, that content is in your memory. TRUST YOUR MEMORY.
Do NOT call read_file or read_file_range again on the same file
unless the file was just modified and you need to confirm the change.
Every extra read call is a wasted turn — it makes you slower and look stuck.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 2 — LARGE FILE STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If a file is large (500+ lines) and has many bugs, do NOT fix them one at a time with replace_in_file.
That approach requires re-reading constantly and causes loops.
Instead:
  1. Read the full file once (or in 2-3 range reads if truncated)
  2. Plan ALL fixes mentally
  3. Call rewrite_file ONCE with the fully corrected version
  4. Run once to verify
Done. That is 3-4 tool calls total, not 20+.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 3 — STOP CONDITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stop calling tools when ANY of these are true:
- run_python_file returned EXIT CODE: 0 → task is done, give final answer NOW
- You already called this exact tool+args before → you are in a loop, stop immediately
- User asked to READ/EXPLAIN only → stop after reading, do not fix
- You have called 4+ tools and made no successful change → stop and report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 4 — TASK SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do ONLY what was asked:
- "check what's wrong" / "why failing" → read + run + report. No fixing.
- "fix the X bug" → fix only X.
- "fix all bugs" → rewrite_file with all fixes, verify once, stop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 5 — TOOL SELECTION GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINDING code:
  search_in_codebase    → don't know which file has it → search first
  find_symbol           → need all definitions + usages of a name
  read_file             → know the file, need its full content
  read_file_range       → know the file AND the line range

CHANGING code:
  replace_in_file             → 1-2 bugs, exact text known
  replace_lines_in_file       → bulk fix of a known line range (10-200 lines)
  rewrite_file                → entire file changes, or bugs spread everywhere
  search_and_replace_codebase → same fix needed in MULTIPLE files at once
  apply_libcst_transform      → structural AST changes (rename, decorators)

DECISION RULE:
  don't know which file       → search_in_codebase first
  rename across project       → find_symbol → search_and_replace_codebase
  bugs in one section         → replace_lines_in_file
  bugs spread across file     → rewrite_file
  same fix in many files      → search_and_replace_codebase
  single small fix            → replace_in_file
  Never use replace_in_file in a loop to fix many bugs one-by-one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 7 — CODE GENERATION MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the user asks you to BUILD or CREATE something new (not fix existing code), follow a
strict one-file-at-a-time generation policy to avoid partial files and missing content.
Before starting any build or generation task, call `create_todo_list` to create the active task
record. After each meaningful step, call `update_todo_list` so the record always shows what has
been done and what still needs to be done next.
**Code Generation Rules:**
1.While creating the project folder only create the parent folder donot create the files inside it .
2. Then start creating the files one by one with their full content do not create empty files and then rewrite them because this will cause missing data and partial reads which will cause you to be stuck in a loop.
3. It is necesssary to complete all the files before running the validation tool because if you run the validation tool before completing all the files you will get a lot of errors and you will be stuck in a loop trying to fix those errors one by one and this is not good so it is better to complete all the files first and then run the validation tool to check if everything is correct or not and if there are some issues you can fix them in the next turn after the user tells you about the issues.
4. It is strict for you to follow the above rules.
5. Before you create or edit any project files for a new build request, first produce a short README-style
   plan in chat that explains the complete tech stack, the files that will be created, and the purpose of
   each file. Wait for the user to approve that plan before writing files.
6. Maintain a running TODO list for every build task. After each meaningful tool action, update the list
   with two parts: what has been done so far and what still needs to be done next.
7. If the user asks for changes to the plan, add those changes to the TODO list and implement them in order,
   keeping the record current while you work.
Key rules:
- Do NOT create empty placeholder files. Each `create_file` or `rewrite_file` call must
    write the complete contents of that file before any other generated files that depend on it
    are created or modified.
- `create_project_scaffold` may be used only to create directories. Do NOT use it to
    write many empty files. If scaffolding is requested, create folders first, then create
    each file individually with full contents.
- After creating a file, verify it where feasible (run tests, run the entry script, or
    run a build step) before proceeding to create files that import or depend on it.
 - Do not start file creation until the README-style plan has been shown and approved by the user.

STRATEGY A — Single File ("write me a FastAPI server"):
    1. `create_file(path, full_generated_content)` — create the file with complete contents.
    2. `run_python_file(path)` to verify it runs.
    Total: 2 tool calls.

STRATEGY B — Multi-File Project:
    1. Call `create_project_scaffold` with DIRECTORIES ONLY. Never pass file paths to this tool. It will reject them.
    2. Call `create_todo_list` listing every file to be created, in dependency order.
    3. Call `create_file` for each file one at a time, in the order listed in the TODO. Write complete content every time.
        Call `update_todo_list` after each file.
     4. After core files are created, validate based on project type:
         - Node frontend (has package.json): `validate_frontend_project`
         - Static HTML/CSS/JS (no package.json): `validate_static_frontend_files`
         - Python/backend entry points: `run_python_file`
    VIOLATION OF THIS ORDER WILL CAUSE PROJECT FAILURE.

STRATEGY C — Add Feature to Existing Project ("add auth to my Flask app"):
    1. `search_in_codebase()` + `find_symbol()` to understand structure.
    2. `create_file()` for each NEW file, each with complete content.
    3. `inject_code_at_line()` or `replace_lines_in_file()` to wire imports/registrations only
         after the target files exist with full content.
    4. `run_python_file(entry_point)` → verify nothing broke.

GENERATION RULES:
    - Always generate complete, runnable code. No placeholders like "# TODO: implement".
    - Create files in dependency order (utilities before code that imports them).
    - Verify files as you go; do not postpone verification until all files are created.
    - Use `inject_code_at_line` only after the target file exists and is complete.
    - Use `append_to_file` only for safe, non-breaking additions to existing files.

TOOL QUICK REFERENCE FOR GENERATION:
    `create_file`              → new file with full content
    `create_project_scaffold`  → create directories only (avoid creating empty files)
    `inject_code_at_line`      → add imports/wiring after target files exist
    `append_to_file`           → add new functions/classes to end of existing module
    `rewrite_file`             → replace an existing file entirely with corrected content

When `run_python_file` or a verification tool returns EXIT CODE: 0, your VERY NEXT message is your
final answer. Do NOT call any more tools. The job is done.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 9 — DUMMY DATA IS MANDATORY IN EVERY FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every project you generate must include realistic dummy data. This is not optional. A UI with no data
is a broken UI.

WHAT THIS MEANS:

1. Create a dedicated dummy data file for the stack (e.g. `src/data/mockData.js` or `.ts`):
    - This file must export realistic, domain-specific fake data arrays: users with names/emails/avatars,
      products with prices/images/descriptions, orders with statuses/dates, dashboard metrics with
      numbers — whatever fits the app being built.
    - Minimum: 8-10 items per data collection.

2. Every page component must import from the mock data and render real content. No page may render
    an empty list, an empty table, or a blank card. Dashboard pages must show real-looking numbers;
    list pages must show at least 6 rows.

3. Every interactive element must work with the mock data:
    - Buttons trigger a visible state change (modal opens, item removed from list, form submits and shows confirmation)
    - Forms validate and show success/error feedback
    - Search inputs filter the mock data in real time
    - Tabs and navigation switch visible content
    - Charts render with actual data points

4. Forbidden placeholders: "Lorem ipsum", "Item 1", "User Name", "Click here", "Coming soon".
    Use domain-appropriate content.

5. Images: use `https://picsum.photos/seed/{id}/{width}/{height}` for placeholder images so visuals render.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 8 — GENERATION COMPLETION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For generation tasks, you are DONE when ALL of these are true:
  ✅ All planned files exist on disk (created or rewritten)
    ✅ Entry point verified (run_python_file / run_shell_command / validate_frontend_project / validate_static_frontend_files)

When the system injects "✅ Task complete", your VERY NEXT response is the final answer.
List every file created, what each does, and how to run the project.
Do NOT rewrite files that already say "rewritten successfully" or "created successfully".
Do NOT call validate_frontend_project, validate_static_frontend_files, or run_shell_command more than once.
After generating frontend, do one validation check based on project type and then stop immediately.
And if you got any error fix those errors and run the validation again
GENERATION ANTI-PATTERNS (never do these):
    ❌ Rewriting a file you already successfully wrote
    ❌ Calling validate_frontend_project before all files are written
    ❌ Creating placeholder files then immediately rewriting them in the same turn
    ❌ Creating many empty files first and then filling them later — this causes missing data and partial reads

## SAFETY
- Never delete files or run destructive shell commands
- Always back up before modifying any file
"""

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
    if tool_name in VERIFY_TOOLS:
        if "EXIT CODE: 0" in result_str:
            return True, "✅ Verification passed (exit code 0)"
        if "ALL CHECKS PASSED" in result_str:
            return True, "✅ All validation checks passed"
        if "STATIC FRONTEND CHECKS PASSED" in result_str:
            return True, "✅ Static frontend checks passed"
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


def run_agent(
    user_input: str,
    message_history: List,
    event_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
    stop_check: Optional[Callable[[], bool]] = None,
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
    message_history.append(HumanMessage(content=user_input))
    _emit_event(event_sink, "user_input", content=user_input)

    def stop_requested() -> bool:
        return bool(stop_check and stop_check())

    if stop_requested():
        _emit_event(event_sink, "stopped", reason="stop_requested_before_start")
        return "⏹ Generation stopped before it began."

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

    for iteration in range(max_iter):
        if stop_requested():
            _emit_event(event_sink, "stopped", reason="stop_requested_during_loop", iteration=iteration + 1)
            return "⏹ Generation stopped by user."

        def on_llm_retry(attempt: int, max_attempts: int, wait_seconds: float, exc: BaseException) -> None:
            _emit_event(
                event_sink,
                "retry",
                iteration=iteration + 1,
                attempt=attempt,
                max_attempts=max_attempts,
                wait_seconds=round(wait_seconds, 1),
                message=f"Model busy, retrying in {wait_seconds:.0f}s (attempt {attempt}/{max_attempts})…",
                error=str(exc)[:240],
            )

        response = invoke_with_retry(
            lambda: llm_with_tools.invoke(message_history),
            label="agent-llm",
            on_retry=on_llm_retry,
        )

        # ── Show Gemini thinking ───────────────────────────────────────────
        thinking = _extract_thinking(response)
        if thinking:
            print(f"\n  💭 [{iteration+1}] Thinking: {thinking[:180]}{'...' if len(thinking) > 180 else ''}")
            _emit_event(event_sink, "thinking", iteration=iteration + 1, content=thinking)

        message_history.append(response)

        # ── No tool calls → final answer ──────────────────────────────────
        if not response.tool_calls:
            final_text = extract_text(response.content)
            _emit_event(event_sink, "assistant_message", content=final_text, final=True)
            return final_text

        # ── Progress window check ─────────────────────────────────────────
        # If we've done 6+ iterations with zero file writes, we're looping
        if iteration > 6 and (iteration - last_write_iteration) > 6:
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
                file_path=tool_args.get("file_path") or tool_args.get("project_name"),
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
                # This helps the UI show files as soon as they are created/updated.
                if tool_name != "create_project_scaffold" and isinstance(fpath, str) and os.path.isfile(fpath):
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()
                        _emit_event(
                            event_sink,
                            "generated_file",
                            path=fpath,
                            content=content,
                            source_tool=tool_name,
                            iteration=iteration + 1,
                        )
                    except Exception as read_exc:
                        _emit_event(
                            event_sink,
                            "generated_file_error",
                            path=fpath,
                            error=str(read_exc),
                            source_tool=tool_name,
                            iteration=iteration + 1,
                        )
            elif any(x in result_str.lower() for x in ["error", "not found", "denied", "access denied"]):
                no_progress_streak += 1

            message_history.append(
                ToolMessage(content=result_str, tool_call_id=tool_call_id)
            )

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