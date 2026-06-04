import google.auth
from google.auth.transport.requests import Request
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_core.tools import tool
import ast
import os
import re
import libcst as cst
from typing import List, Dict, Any, Callable, Optional
import json
from skills import read_frontend_skill

try:
    from .llm_retry import invoke_with_retry, retry_settings
except ImportError:
    from llm_retry import invoke_with_retry, retry_settings

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
    check_file_consistency,
    run_python_file,
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
PROJECT WORKSPACE RULES (when a PROJECT WORKSPACE block is present):
- Your current working directory is already the user's project folder. Stay in it.
- create_file / rewrite_file paths must be relative: src/App.jsx, package.json, index.html
- NEVER write to a sibling folder outside the project (no ../ and no repo-root-only src/).
- New React app: package.json + src/main.jsx + src/App.jsx + index.html at project root paths.
- validate_frontend_project(project_directory=".") when package.json is in the project cwd.
- run_shell_command npm commands from the project directory (cwd is already set).
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
WEB & VISUAL INTELLIGENCE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You now have access to live web search, browser automation, image fetching,
and a Redis cache. Use these tools to build better, more informed frontends.

── WHEN TO USE EACH TOOL ──────────────────────────────────────────────────

web_search(query)
    USE WHEN:
    - User asks for "something like X website" or references a UI style
    - You need code examples for a specific library or component pattern
    - You need to check current best practices (CSS, animations, libraries)
    - You need to find a CDN link, package name, or API reference
    NEVER use for: things already in your training data (basic HTML/CSS/JS syntax)

fetch_url(url)
    USE WHEN:
    - web_search returns a promising URL and you need the full content
    - User provides a URL and says "use this as reference"
    - You need full documentation from a static page
    NOTE: For JavaScript-rendered sites (React/Vue apps), use playwright_extract_dom instead

image_search(query)
    USE WHEN:
    - User asks for a specific visual style e.g. "glassmorphism dashboard"
    - You want design reference images before generating UI
    - User says "find me a reference for X layout"
    ALWAYS follow with fetch_image(url) on the best result so you can see it

fetch_image(url)
    USE WHEN:
    - After image_search to visually inspect a design reference
    - User provides a direct image URL to use as inspiration
    - You want to analyze colors, layout, or spacing from a real screenshot
    The returned base64 can be passed to Claude vision for analysis

fetch_image_to_file(url)
    USE WHEN:
    - You want to download and persist a reference image for later frontend generation
    - The user wants to upload/provide references and keep them on disk

load_local_reference_image(file_path)
    USE WHEN:
    - User provides a local file path for reference-driven UI generation
    - You need to pass user-uploaded images into multimodal generation

analyze_reference_image(image_json, question)
    USE WHEN:
    - You need to inspect layout/colors/typography of a reference before coding

generate_frontend_from_reference(image_json, generation_task)
    USE WHEN:
    - User asks to generate UI/frontend code inspired by a reference image
    - You need visual grounding before writing components/pages

playwright_screenshot(url)
    USE WHEN:
    - User says "make it look like X" and names a real website
    - You need to SEE a live site before replicating its design
    - fetch_url returns empty/skeleton content (SPA site)
    This is your most powerful visual reference tool — use it for real sites

playwright_extract_dom(url, selector)
    USE WHEN:
    - You want the actual rendered HTML structure of a component on a live site
    - You need real CSS class names or layout structure from a reference site
    - The site is a JavaScript SPA that fetch_url cannot read
    Use selector to zoom in: e.g. "nav", ".sidebar", "[data-component='card']"

playwright_render_and_check(file_path)
    USE WHEN:
    - You have just generated an HTML/CSS file and want to verify it looks correct
    - After fixing a visual bug — screenshot the result to confirm the fix
    - Any time you are unsure if the generated UI will render properly
    RULE: Always call this after generating a static HTML frontend before
    declaring the task complete. If the screenshot shows blank or broken UI,
    fix and re-check.

cache_set(key, value) / cache_get(key)
    USE WHEN:
    - You fetched expensive content (DOM, screenshot, search results) that you
        will need again later in the same task
    - User is likely to ask follow-up questions about the same reference site
    NOTE: web_search, fetch_url, image_search, playwright_screenshot all cache
    automatically. Use cache_set/cache_get only for manual intermediate results.

── VISUAL REFERENCE WORKFLOW ──────────────────────────────────────────────

When user says "make it look like [website]":
    1. playwright_screenshot(url)          → SEE the real site
    2. playwright_extract_dom(url, "body") → GET the HTML structure
    3. web_search("[site] design system colors fonts")  → FIND design details
    4. frontend_skill() + get_design_theme()            → APPLY design system
    5. Generate files using all gathered context
    6. playwright_render_and_check(output_file)         → VERIFY the result

When user provides a design reference image URL:
    1. fetch_image(url)                    → download and analyze visually
    1b. fetch_image_to_file(url)            → persist reference for reuse
    2. frontend_skill()                    → apply design rules
    3. Generate files matching the visual style
    4. playwright_render_and_check()       → verify output

When user asks for a specific UI style ("glassmorphism dashboard"):
    1. image_search("glassmorphism dashboard UI 2024") → find references
    2. fetch_image(best_result.image_url)              → analyze the reference
    3. get_design_theme("glassmorphism")               → get CSS tokens
    4. Generate files
    5. playwright_render_and_check()                   → verify

── SEARCH BEFORE GENERATING ───────────────────────────────────────────────

For any non-trivial frontend component, do a quick web_search BEFORE
generating code. This finds:
    - The latest API for a library (things change fast)
    - Working code examples you can adapt
    - CDN URLs for libraries instead of guessing version numbers

Example:
    User: "add a chart dashboard"
    WRONG: immediately generate code from memory
    RIGHT: web_search("recharts dashboard example 2024") → find real example
                 → adapt the working pattern → generate

── REDIS CACHE IS FREE — USE IT ───────────────────────────────────────────

Every search and fetch is automatically cached. This means:
    - Searching the same query twice costs nothing the second time
    - If you screenshot a site, re-screening it within 10 minutes is instant
    - Do not hesitate to search multiple queries — cache makes it fast

── RENDER CHECK IS MANDATORY FOR STATIC HTML ──────────────────────────────

For every static HTML/CSS project:
    1. Generate all files
    2. validate_static_frontend_files(dir)  → structural check
    3. playwright_render_and_check(html_file) → VISUAL check

If playwright_render_and_check shows blank or broken UI:
    - Read the HTML file
    - Fix the issue (missing CSS path, broken JS, layout bug)
    - Call playwright_render_and_check again to confirm the fix
    - Only declare task complete when screenshot shows correct UI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

CODE GENERATION PIPELINE:
One thing that you mostly do is that you generate a minimal frontend a frontend that looks like some one created it when 
he was practicing or he was sleepy.
We donot need that we need that the frontend should a complete professional UI with proper working UI with proper animations.
I want everthing to be wworking.It should be complete it should be a complete project with all the files and folders.
You should best colours all the pages that are generated should be working.
There is no limit on you to create a frontend with only 50 lines with only 100 ines.You can create as many as lines you want 
to build a professional frontend. You should not care about the number of lines you are writing you should care about the quality of the code you are writing.
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

    for iteration in range(max_iter):
        if stop_requested():
            _emit_event(event_sink, "stopped", reason="stop_requested_during_loop", iteration=iteration + 1)
            return "⏹ Generation stopped by user."

        def _on_llm_retry(attempt: int, max_attempts: int, wait: float, exc: BaseException) -> None:
            retries_allowed = max(1, max_attempts - 1)
            _emit_event(
                event_sink,
                "llm_retry",
                iteration=iteration + 1,
                attempt=attempt,
                max_attempts=max_attempts,
                retries_allowed=retries_allowed,
                wait_seconds=round(wait, 1),
                error=str(exc)[:240],
                message=f"API busy — retry {attempt}/{retries_allowed} in {wait:.0f}s…",
            )

        response = invoke_with_retry(
            lambda: llm_with_tools.invoke(message_history),
            label="agent",
            on_retry=_on_llm_retry,
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