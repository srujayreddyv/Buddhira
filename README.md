# Buddhira

A second brain for saving notes, links, and code snippets, then finding them instantly.

Built with **Next.js 16** (frontend), **FastAPI** (backend), and **Supabase** (auth + Postgres).

## Scope
MVP scope is frozen. See `/Users/srujayreddy/Projects/Buddhira/MVP_LOCKED.md`.

## Docs

| File | Purpose |
|---|---|
| `/Users/srujayreddy/Projects/Buddhira/MVP_LOCKED.md` | Locked MVP scope |
| `/Users/srujayreddy/Projects/Buddhira/SECURITY_CHECKLIST.md` | Security sanity checks |
| `/Users/srujayreddy/Projects/Buddhira/README.md` | Setup, run, deploy, CI |

## What Is Built

- Backend API: items, tags, item-tags CRUD; search/filter; JWT verification via JWKS; health; rate limiting; structured errors.
- Frontend app: auth (signup/login/forgot/reset), inbox, create/edit item, tags pages, pin/archive/activate quick actions.
- UX improvements: mobile filter drawer, sticky FAB, active filter chips, reset filters, loading skeletons, improved empty states.
- Accessibility pass: icon-only controls have `aria-label` and visible keyboard focus rings.
- CI gates: frontend lint, frontend build, backend smoke.

## Project Layout

- `/Users/srujayreddy/Projects/Buddhira/backend` FastAPI service
- `/Users/srujayreddy/Projects/Buddhira/frontend` Next.js app
- `/Users/srujayreddy/Projects/Buddhira/supabase/migrations/001_initial_schema.sql` initial schema
- `/Users/srujayreddy/Projects/Buddhira/.github/workflows/ci.yml` CI pipeline

## Local Development

Ports:
- Backend: `8000`
- Frontend: `3000`

### Option A (Makefile)

```bash
cd /Users/srujayreddy/Projects/Buddhira
make dev
```

Other commands:

```bash
make dev-backend
make dev-frontend
make prod-backend
make prod-frontend
make seed USER_ID=<uuid>
```

### Option B (manual)

Backend:

```bash
cd /Users/srujayreddy/Projects/Buddhira/backend
cp .env.example .env
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd /Users/srujayreddy/Projects/Buddhira/frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

### Backend (`backend/.env`)

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or legacy `SUPABASE_KEY`)
- `CORS_ORIGINS` (comma-separated origins)

Optional:
- `SUPABASE_JWKS_URL`
- `JWT_AUDIENCE` (default `authenticated`)
- `JWT_ISSUER`

### Frontend (`frontend/.env.local`)

Required:
- `NEXT_PUBLIC_API_BASE_URL` (or legacy `NEXT_PUBLIC_API_URL`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or fallback `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)

Optional:
- `NEXT_PUBLIC_SITE_URL`

Note: frontend Supabase client uses build-safe placeholder values if env vars are missing during CI prerender. Runtime auth still requires real values.

## Build and Smoke

Frontend:

```bash
cd /Users/srujayreddy/Projects/Buddhira/frontend
npm run lint
npm run build
npm run start
```

Backend smoke:

```bash
cd /Users/srujayreddy/Projects/Buddhira/backend
source venv/bin/activate
python smoke_test.py
```

Smoke test expects:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SMOKE_TEST_EMAIL`
- `SMOKE_TEST_PASSWORD`
- optional `BACKEND_URL` (default `http://localhost:8000`)

## CI Gates

Workflow: `/Users/srujayreddy/Projects/Buddhira/.github/workflows/ci.yml`

Jobs:
- `Frontend Lint`
- `Frontend Build`
- `Backend Smoke`

Required GitHub secrets for smoke:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SMOKE_TEST_EMAIL`
- `SMOKE_TEST_PASSWORD`

Behavior:
- Smoke runs on `push` to `main` and same-repo PRs.
- Smoke is skipped on fork PRs (secrets unavailable by default).

## Deployment Roots

- Backend root: `/Users/srujayreddy/Projects/Buddhira/backend`
- Frontend root: `/Users/srujayreddy/Projects/Buddhira/frontend`

Backend production command:

```bash
gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --workers 1
```

Frontend production commands:

```bash
npm run build
npm run start
```

## Release Checklist (Minimal)

1. `npm run lint` passes.
2. `npm run build` passes.
3. `python smoke_test.py` passes.
4. Login, create item, tags, pin/archive, and password reset work in deployed app.
