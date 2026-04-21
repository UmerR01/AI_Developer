# AI-Developer

AI-Developer is a modular SaaS workspace platform where teams collaborate with AI agents through a structured pipeline.

This repository is currently scaffolded to the first executable checkpoint: authentication login.

## Current Phase Scope
- Project scaffold is ready with modular backend and frontend folders.
- PostgreSQL runs in Docker Compose (database only).
- Django backend exposes GraphQL endpoint with login mutation.
- Next.js frontend includes login screen and dashboard auth gate.

## Tech Stack
- Backend: Django + Strawberry GraphQL
- Frontend: Next.js (App Router, TypeScript)
- Database: PostgreSQL (Docker Compose)
- Auth checkpoint: GraphQL login mutation returning access token

## Repository Structure

```text
AI_Developer/
  backend/
    config/
      settings.py
      urls.py
      schema.py
    apps/
      accounts/
        mutations.py
        queries.py
        services.py
        types.py
        management/commands/bootstrap_auth_seed.py
    manage.py
  frontend/
    app/
      login/page.tsx
      dashboard/page.tsx
    src/modules/auth/
      api.ts
      types.ts
      components/LoginForm.tsx
    package.json
  docker-compose.yml
  requirements.txt
  .env.example
  README.md
```

## Development Standards
- Keep modules separated by feature (`accounts`, `projects`, `team`, etc.).
- Avoid large single-file views.
- Split each feature into submodules as needed (types, queries, mutations, services, components).
- Keep business logic in backend service files, not directly inside transport/controller code.

## Prerequisites
- Python 3.12+
- Node.js 20+
- Docker Desktop (or Docker Engine + Compose)

## 1) Environment Setup
From repo root:

1. Copy environment template.
2. Start PostgreSQL container.

```powershell
Copy-Item .env.example .env
docker compose up -d db
```

Important:
- Set a strong local `DJANGO_SECRET_KEY` in `.env` before sharing any environment snapshot.

## 2) Backend Setup (Django)
From repo root:

```powershell
# Create venv if needed
python -m venv .venv

# Activate venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r requirements.txt

# Run migrations
.\.venv\Scripts\python.exe backend/manage.py migrate

# Seed demo accounts, roles, and team
.\.venv\Scripts\python.exe backend/manage.py bootstrap_auth_seed

# Start backend server
.\.venv\Scripts\python.exe backend/manage.py runserver 0.0.0.0:8011
```

Backend URL:
- http://localhost:8011/graphql/

## 3) Frontend Setup (Next.js)
Open a new terminal and run:

```powershell
Set-Location frontend
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

Frontend URL:
- http://localhost:3000/login

## Login Checkpoint
Seed credentials:
- Ibrahim (Admin): username `ibrahim`, password `Ibrahim@123`
- Ismail (Developer): username `ismail`, password `Ismail@123`
- Zahid (QA): username `zahid`, password `Zahid@123`
- Faizan (QA): username `faizan`, password `Faizan@123`
- AI_dev (Support): username `ai_dev`, password `AI_dev@123`

Team mapping:
- Ibrahim team members: Ismail, Zahid, Faizan

Quick subscriptions (mock):
- Basic: 300 GB
- Pro: 500 GB
- Enterprise: 1 TB

Linked subscription:
- Ibrahim account -> Pro

When login succeeds:
- Frontend stores token in local storage.
- User is redirected to `/dashboard`.

Dashboard mock widgets currently include:
- Pipeline status summary cards
- My tasks list
- Recent project activity list
- Notifications preview list
- Storage widget with current usage
- Team member list with add icon
- Storage access rows with project name, space taken, files total, member avatars, and share access action

## GraphQL Auth Contract
Login mutation:

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    success
    message
    accessToken
    user {
      id
      username
      email
    }
  }
}
```

Variables:

```json
{
  "input": {
    "username": "admin",
    "password": "admin12345"
  }
}
```

## What Comes Next
After login checkpoint, next build phases should add:
1. Workspace and membership domain
2. Projects unified workspace and pipeline states
3. Comment review/push loop
4. Team workspace and role-driven controls
5. Support, notifications, and deployment mock
