


def read_frontend_skill() -> str:
    """
    Read the frontend engineering skill guide.
    Call this tool FIRST whenever the task involves building or modifying
    any UI, webpage, component, dashboard, landing page, React/Vue/HTML app,
    or styling/beautifying existing frontend code.
    Returns design rules, aesthetic guidelines, implementation strategy,
    theme tokens, and a validation checklist.
    """
    return """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND SKILL — Production-Grade UI Engineering
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRIGGER: User asks to build a web component, page, dashboard, landing page,
React/Vue/HTML app, or any visual UI — or asks to style/beautify existing UI.

═══════════════════════════════════════════════════
PHASE 1 — DESIGN THINKING (do this before writing code)
═══════════════════════════════════════════════════

Ask yourself before generating:
  1. PURPOSE   → What problem does this UI solve? Who uses it?
  2. TONE      → Pick ONE extreme and commit:
                  brutally minimal | maximalist | retro-futuristic | organic/natural
                  luxury/refined | playful/toy-like | editorial/magazine
                  brutalist/raw | art deco/geometric | soft/pastel | industrial
  3. HOOK      → What ONE thing will users remember about this design?
  4. TECH      → HTML/CSS/JS? React? Vue? Any framework constraints?

CRITICAL: Choose a bold conceptual direction and execute it with precision.
Never default to generic "AI slop" aesthetics.

═══════════════════════════════════════════════════
PHASE 2 — AESTHETIC RULES (must follow for every UI)
═══════════════════════════════════════════════════

── TYPOGRAPHY ──
  ✅ Use distinctive, characterful font pairs (display + body)
  ✅ Import from Google Fonts or use system font stacks creatively
  ✅ Vary weight, size, and letter-spacing deliberately
  ❌ NEVER use: Inter, Roboto, Arial, system-ui as primary display fonts
  ❌ NEVER converge on Space Grotesk — it's overused

── COLOR & THEME ──
  ✅ Commit to a palette: dominant color + sharp accent + neutral
  ✅ Use CSS custom properties (variables) for all colors
  ✅ Light OR dark — pick one, own it fully
  ❌ NEVER use purple gradients on white backgrounds (cliché AI default)
  ❌ NEVER use timid, evenly-distributed pastel rainbows

── MOTION & ANIMATION ──
  ✅ CSS transitions for hover states (transform, opacity, box-shadow)
  ✅ Staggered entrance animations with animation-delay
  ✅ One high-impact page load sequence beats many small micro-interactions
  ✅ React: use Motion library (framer-motion) when available
  ❌ NEVER animate everything — choose 2-3 high-impact moments

── SPATIAL COMPOSITION ──
  ✅ Use asymmetry, overlap, diagonal flow, grid-breaking elements
  ✅ Generous negative space OR controlled density — pick one extreme
  ✅ Unexpected layouts that feel genuinely designed for context
  ❌ NEVER default to centered card + header + footer boilerplate

── BACKGROUNDS & ATMOSPHERE ──
  ✅ Gradient meshes, noise textures, geometric patterns
  ✅ Layered transparencies, dramatic shadows, grain overlays
  ✅ Decorative borders, custom cursors where appropriate
  ❌ NEVER use flat solid background colors as the only background treatment

═══════════════════════════════════════════════════
PHASE 3 — IMPLEMENTATION STRATEGY
═══════════════════════════════════════════════════

SINGLE FILE (component, widget, landing page):
  1. create_file(path, full_content)   — complete, runnable code, no TODOs
  2. Verify it visually (describe output to user)
  Tool calls: 1-2 total

MULTI-FILE PROJECT (React app, Next.js, Vue app):
  1. get_design_theme(theme_name)              — fetch design tokens first
  2. create_project_scaffold(name, structure)  — folders + empty files
  3. rewrite_file() per file in dependency order:
       globals/variables → layout → components → pages → entry point
  4. run_shell_command("npm install", dir)
  5. run_shell_command("npm run build", dir) or validate_frontend_project(dir)
  Tool calls: N+4 total

ADD FEATURE TO EXISTING PROJECT:
  1. search_in_codebase() + read_file()        — understand structure
  2. create_file() for each NEW file
  3. inject_code_at_line() for imports/wiring into existing files
  4. validate_frontend_project(dir)

═══════════════════════════════════════════════════
PHASE 4 — DESIGN THEME TOKENS (ready-to-use)
═══════════════════════════════════════════════════

GLASSMORPHISM:
  --glass-bg: rgba(255,255,255,0.10); --glass-blur: blur(12px);
  --glass-border: rgba(255,255,255,0.25); --glass-radius: 16px;
  Background: linear-gradient(135deg, #0f0c29, #302b63, #24243e)
  Font: Inter 300-700

NEOMORPHISM:
  --neo-bg: #e0e5ec; --neo-shadow-out: 6px 6px 12px #a3b1c6, -6px -6px 12px #fff;
  --neo-shadow-in: inset 4px 4px 8px #a3b1c6, inset -4px -4px 8px #fff;
  Font: Poppins 300-600

DARK MINIMAL:
  --bg-primary: #0a0a0a; --bg-card: #1a1a1a; --accent: #3b82f6;
  --border: rgba(255,255,255,0.08); --radius: 8px;
  Font: Inter 400-700

GRADIENT VIVID:
  --grad-1: linear-gradient(135deg, #667eea, #764ba2);
  --accent: #667eea; --shadow: 0 20px 60px rgba(102,126,234,0.15);
  Font: Plus Jakarta Sans 400-700

Call get_design_theme("glassmorphism") etc. to get full token sets.

═══════════════════════════════════════════════════
PHASE 5 — VALIDATION CHECKLIST
═══════════════════════════════════════════════════

Before marking frontend task done:
  □ All imports resolve (no broken paths)
  □ No placeholder content ("Lorem ipsum", "TODO", "coming soon")
  □ Responsive: works at 375px (mobile) and 1280px (desktop)
  □ Interactive states: hover, focus, active all styled
  □ No hardcoded colors outside CSS variables
  □ Fonts loaded (Google Fonts link present or @import in CSS)
  □ npm run build passes with zero errors (for Node projects)
  □ check_file_consistency() passes for multi-file projects
  □ Do not use npm run dev as the validity check; use build output instead

ANTI-PATTERNS (never do these):
  ❌ Generic purple-gradient-on-white design
  ❌ Inter/Roboto as the only font choice
  ❌ Placeholder "# TODO: implement" in generated code
  ❌ Rewriting a file you already successfully wrote
  ❌ Running npm install twice in one session
  ❌ Calling validate_frontend_project before all files are written



CODE GENERATION PIPELINE:
One thing that you mostly do is that you generate a minimal frontend a frontend that looks like some one created it when
he was practicing or he was sleepy.
We donot need that we need that the frontend should a complete professional UI with proper working UI with proper animations.
I want everthing to be wworking.It should be complete it should be a complete project with all the files and folders.
You should best colours all the pages that are generated should be working.
There is no limit on you to create a frontend with only 50 lines with only 100 ines.You can create as many as lines you want
to build a professional frontend. You should not care about the number of lines you are writing you should care about the quality of the code you are writing.


"""


# @tool
# def read_backend_skill() -> str:
#     """
#     Read the backend engineering skill guide.
#     Call this tool FIRST whenever the task involves building or modifying
#     any API, server, database layer, authentication system, background job,
#     CLI tool, or microservice — in Python (FastAPI/Flask/Django) or Node.js (Express).
#     Returns architecture guidelines, project structures, coding standards,
#     copy-paste templates, and a validation checklist.
#     """
#     return """
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BACKEND SKILL — Production-Grade API & Server Engineering
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# TRIGGER: User asks to build an API, server, database layer, authentication
# system, background job, CLI tool, microservice, or any backend component.

# ═══════════════════════════════════════════════════
# PHASE 1 — ARCHITECTURE THINKING (do before coding)
# ═══════════════════════════════════════════════════

# Ask yourself before generating:
#   1. FRAMEWORK   → FastAPI? Flask? Django? Express? Raw Python? Pick best fit:
#                     FastAPI   → async APIs, type-safe, auto-docs (recommended default)
#                     Flask     → simple scripts, quick prototypes, minimal overhead
#                     Django    → full-stack with ORM, admin, auth built-in
#                     Express   → Node.js APIs, JS ecosystem
#   2. DATA LAYER  → SQLite (dev/small), PostgreSQL (production), MongoDB (documents)?
#                    Use SQLAlchemy ORM for Python relational DBs.
#   3. AUTH        → JWT tokens? OAuth2? Session-based? API keys?
#   4. STRUCTURE   → Monolith or modular? How will routes/models/services split?
#   5. CONTRACTS   → What does the API consume and return? Define schemas FIRST.

# ═══════════════════════════════════════════════════
# PHASE 2 — PROJECT STRUCTURE (standard layouts)
# ═══════════════════════════════════════════════════

# ── FASTAPI (recommended) ──
#   project/
#   ├── main.py              # app entry point, middleware, startup
#   ├── config.py            # settings via pydantic BaseSettings
#   ├── database.py          # engine, session, Base
#   ├── models/
#   │   ├── __init__.py
#   │   └── user.py          # SQLAlchemy ORM models
#   ├── schemas/
#   │   ├── __init__.py
#   │   └── user.py          # Pydantic request/response schemas
#   ├── routers/
#   │   ├