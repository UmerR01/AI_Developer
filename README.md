# AI-Developer

AI-Developer is a modular SaaS workspace where teams create projects, refine requirements with AI, and run a coding agent that implements the approved brief.

## Current Scope

- Django + Strawberry GraphQL backend with auth, projects, and support modules
- Next.js frontend with login, dashboard, project creation wizard, and project workspace
- `ai_module/` — Gemini/Vertex-powered brief review and autonomous coding agent (FastAPI + WebSocket UI)

## Tech Stack

| Layer | Stack |
|-------|--------|
| Backend | Django, Strawberry GraphQL, PostgreSQL |
| Frontend | Next.js (App Router), TypeScript |
| AI | Google Vertex AI (Gemini), LangChain, FastAPI agent server |

## Repository Structure

```text
AI_Developer/
  ai_module/                 # Coding agent + brief review + workspace UI
    agent.py
    agent_api_server.py
    agent_frontend.html
    brief_service.py
    credentials/             # Place Joblynk service account JSON here (gitignored)
    requirements-core.txt
  backend/
  frontend/
  docker-compose.yml
  requirements.txt           # Backend + ai_module deps for root .venv
  .env.example
```

## Prerequisites

- Python 3.12+
- Node.js 20+
- Docker Desktop (PostgreSQL)
- Google Cloud service account JSON for project `joblynk-489820` (Vertex AI enabled)

## 1) Environment Setup

From the repo root:

```powershell
Copy-Item .env.example .env
docker compose up -d db
```

### Google credentials (Joblynk)

1. Place your service account JSON at:
   `ai_module/credentials/google-service-account.json`
   (You can copy the existing `joblynk-489820-*.json` file from `ai_module/` into that path.)
2. Ensure `.env` contains:

```env
GOOGLE_APPLICATION_CREDENTIALS=ai_module/credentials/google-service-account.json
GOOGLE_CLOUD_PROJECT=joblynk-489820
```

## 2) Python virtual environment (backend + AI module)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

This installs Django dependencies **and** `ai_module/requirements-core.txt` into the same root `.venv`.

## 3) Backend (Django)

```powershell
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py bootstrap_auth_seed
.\.venv\Scripts\python.exe backend/manage.py runserver 0.0.0.0:8011
```

GraphQL: http://localhost:8011/graphql/

## 4) AI agent server

In a **second terminal** (same venv):

```powershell
.\.venv\Scripts\Activate.ps1
Set-Location ai_module
..\.venv\Scripts\python.exe -m uvicorn agent_api_server:app --host 0.0.0.0 --port 8001 --reload
```

Or from repo root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn agent_api_server:app --host 0.0.0.0 --port 8001 --app-dir ai_module --reload
```

| URL | Purpose |
|-----|---------|
| http://localhost:8001/workspace | Agent workspace UI (opens in a new tab during development) |
| ws://localhost:8001/ws/chat | WebSocket for live agent events |
| http://localhost:8001/health | Health check |

## 5) Frontend (Next.js)

```powershell
Set-Location frontend
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

App: http://localhost:3000/login

## Project creation & AI flow

1. **Setup** — Project name + GitHub repository URL  
2. **Description** — Write text or upload a `.txt`/`.md` document (parsed to plain text for the AI)  
3. **AI review** — Gemini reviews the brief, asks the minimum clarifying questions (e.g. tech stack if missing), then produces a README-style final brief  
4. **Final brief** — Approve and create the project (saved as **Draft**)  
5. **Project page** — Click **Start Development** to open the agent workspace in a new tab and begin implementation from the approved brief  

The agent only accepts **text** inputs; uploads are converted to text before review.

## Login (seed)

| User | Username | Password |
|------|----------|----------|
| Ibrahim (Admin) | `ibrahim` | `Ibrahim@123` |
| Ismail (Developer) | `ismail` | `Ismail@123` |

## Development standards

- Keep feature logic in module services (`backend/apps/*/services.py`, `ai_module/*.py`)
- Avoid monolithic view files; split UI steps into focused components
- Never commit service account JSON files

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Brief review uses heuristic questions only | Check `GOOGLE_APPLICATION_CREDENTIALS` path and Vertex API access |
| Agent workspace tab does not connect | Start the agent server on port 8001 |
| `pip install` fails on ai deps | Use Python 3.12+ and install from repo root `requirements.txt` |
