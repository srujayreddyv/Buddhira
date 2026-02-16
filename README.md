# Buddhira

A second brain for saving notes, links, and code snippets, then finding them instantly when you need them.

Built with **Next.js 16** (frontend), **FastAPI** (backend), and **Supabase** (auth + Postgres).

**One repo:** Backend and frontend live in this single repository (`backend/` and `frontend/`). Deploy each from its folder (see [Deployment roots](#deployment-roots)).

**Scope:** MVP is locked. Core objects: **note**, **link**, **code snippet** only. No dashboards, agents, RAG, or AI. See [MVP_LOCKED.md](MVP_LOCKED.md) — do not add features.

### Docs (repo root)

| File | Purpose |
|------|---------|
| [MVP_LOCKED.md](MVP_LOCKED.md) | Locked feature list — no scope creep |
| [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) | Security sanity checks (service role, CORS, JWKS, user_id, no direct Supabase data from frontend) |
| [LICENSE](LICENSE) | MIT license |

### What’s done

- **Backend:** FastAPI + Supabase (service role). Items, tags, item-tags CRUD; search and filter (text, type, state, tag, pinned, archived); JWT via JWKS (ES256); request logging, rate limiting, single error format; health (DB + JWT config); smoke test script.
- **Frontend:** Next.js App Router; auth (signup, login, reset password); inbox with search/filters, pinned section header, quick actions (pin, archive, activate); new item (note/link/snippet); item detail edit; tags list and tag-scoped items; dark/light/system theme; icons (Lucide); empty states and app icon; 401 → sign out + redirect to login; retry-safe buttons.
- **Security:** CORS, input validation, search sanitization, RLS; no service role in frontend; all queries scoped by `user_id`.
- **Ops:** Root Makefile (`dev`, `dev-backend`, `dev-frontend`, `seed`); env standardized (`.env.example` in both apps); README has local dev, deployment roots, production checklist.

**Releases:** Tag when ready (e.g. `git tag v1.0.0 && git push origin v1.0.0`).

---

## Local development

One canonical way to start everything. From the repo root you can use the **Makefile** or run each app in its own terminal.

**Ports**

| Service  | Port |
|----------|------|
| Backend  | 8000 |
| Frontend | 3000 |

**Option 1: Root Makefile (one command for both)**

From the project root (after [one-time setup](#2-run-backend-and-frontend) of `.env` and deps):

```bash
make dev              # run backend + frontend together (Unix/macOS)
make dev-backend      # backend only (port 8000)
make dev-frontend     # frontend only (port 3000)
make seed USER_ID=xxx # seed demo data (get USER_ID from Supabase Auth or GET /me)
```

On Windows, run `make dev-backend` and `make dev-frontend` in two terminals instead of `make dev`.

**Option 2: Two terminals (per-service commands)**

**1. Backend**

```bash
cd backend
cp .env.example .env    # then fill in the values below
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Required env vars in `backend/.env` (copy from `backend/.env.example`):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL (`https://xxx.supabase.co`) — must match frontend |
| `SUPABASE_KEY` | **service_role** key (from Supabase Dashboard → Settings → API) |
| `CORS_ORIGINS` | Allowed origins; must include frontend URL (e.g. `http://localhost:3000`) |

**2. Frontend**

```bash
cd frontend
cp .env.example .env.local    # then fill in the values below
npm install
npm run dev
```

Required env vars in `frontend/.env.local` (copy from `frontend/.env.example`):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project URL as backend (must match exactly) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key (not service_role) |
| `NEXT_PUBLIC_API_URL` | Backend base URL (e.g. `http://localhost:8000`) — frontend calls this for all API requests |

**Cross-app consistency:** Use the same Supabase project URL in both apps. Set `NEXT_PUBLIC_API_URL` to your backend base URL and include that frontend’s origin in backend `CORS_ORIGINS` (e.g. dev: backend `http://localhost:8000`, frontend `http://localhost:3000`, and `CORS_ORIGINS=http://localhost:3000`).

Then open **http://localhost:3000** — sign up or log in, then go to `/inbox`.

---

## Project Structure

```
buddhira/
├── backend/               # FastAPI API server
│   ├── main.py            # App entry, CORS, routes, health, exception handlers
│   ├── seed.py            # Demo data seeder (run with user_id)
│   ├── smoke_test.py      # E2E smoke test (health, /me, create item, list+search+tag)
│   ├── app/
│   │   ├── auth.py        # JWKS-based JWT verification (ES256)
│   │   ├── config.py      # Pydantic env settings
│   │   ├── errors.py      # Single error response format (detail + code)
│   │   ├── middleware.py  # Request logging, rate limiting
│   │   ├── supabase_client.py  # Service-role Supabase client
│   │   └── routes/
│   │       ├── items.py       # Items CRUD + filtering + validation
│   │       ├── tags.py        # Tags CRUD + counts + validation
│   │       └── item_tags.py   # Attach / detach tags
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/              # Next.js 16 App Router
│   ├── src/
│   │   ├── app/           # Pages (inbox, new, item, tags, auth)
│   │   ├── components/    # Header, Toast, ThemeProvider, ThemeToggle, Providers
│   │   ├── hooks/         # useRequireAuth, useRedirectIfAuth, useKeyboardShortcuts
│   │   └── lib/           # supabaseClient, api fetch (Bearer + 401 → login), types
│   ├── package.json
│   └── .env.example
│
├── Makefile            # dev, dev-backend, dev-frontend, seed
├── LICENSE             # MIT
├── MVP_LOCKED.md
├── SECURITY_CHECKLIST.md
└── README.md
```

---

## Deployment roots

One repo, **two deployable services**. Set your build and start commands from these roots:

| Service  | Deployment root        |
|----------|------------------------|
| Backend  | `buddhira/backend`    |
| Frontend | `buddhira/frontend`   |

- **Backend:** Build/run from `backend/` (e.g. `pip install -r requirements.txt`, `uvicorn main:app --port 8000`). All app code lives under `backend/`. Use **Python 3.11 or 3.12** on Render (e.g. `backend/.python-version` or repo root `.python-version` with `3.12.8`) so pydantic-core installs from a pre-built wheel instead of building from source.
- **Frontend:** Build/run from `frontend/` (e.g. `npm install`, `npm run build` / `npm run start`). All app code lives under `frontend/`.

**Cold start (e.g. Render free tier):** On the free plan, the backend may take a few seconds to wake up on the first request. The frontend is designed for this: longer timeout, one automatic retry with a “Backend waking up, retrying…” toast, and a background `/health` warmup when you land on the inbox.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ and pip
- A **Supabase** project (free tier works)

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL schema (see [Database Schema](#database-schema) below) in the Supabase SQL Editor.
3. Note your **Project URL**, **publishable (anon) key**, and **service_role key** from Settings → API.

### 2. Run backend and frontend

Use the commands and env vars in [Local development](#local-development) above (ports 8000 and 3000, copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env.local`).

### 3. Seed demo data (optional)

```bash
cd backend
source venv/bin/activate
python seed.py <user_id>
```

Creates 9 sample notes, links, snippets, and 5 tags for the given user.

### 4. Smoke test (optional)

From `backend/` with venv activated, after setting in `.env`: `SUPABASE_ANON_KEY` (frontend anon key), `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD` (a real Supabase user):

```bash
cd backend
source venv/bin/activate
python smoke_test.py
```

Verifies: health → auth `/me` with token → create item → list with search and tag filter. Optional: `BACKEND_URL` (default `http://localhost:8000`).

---

## Environment Variables

Use the exact keys in `backend/.env.example` and `frontend/.env.example`. **Do not commit secrets:** `backend/.env` and `frontend/.env.local` are in `.gitignore` and must stay untracked. Summary:

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL — must match frontend `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_KEY` | **service_role** key (server-side only — never expose to frontend) |
| `CORS_ORIGINS` | Comma-separated origins; must include frontend URL (e.g. `http://localhost:3000`) |

JWT verification uses JWKS (auto-fetched from Supabase) — no manual JWT secret needed.

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL — must match backend `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key (code also accepts `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) |
| `NEXT_PUBLIC_API_URL` | Backend base URL — frontend uses this for all API calls (e.g. `http://localhost:8000`) |

---

## API Endpoints

### Auth
All `/api/*` routes require `Authorization: Bearer <supabase_access_token>`.

### Items

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/items` | List items (supports `q`, `type`, `state`, `tag`, `is_pinned`, `is_archived`, `limit`, `offset`) |
| `GET` | `/api/items/{id}` | Get single item with tags |
| `POST` | `/api/items` | Create item (defaults: `state=inbox`, `is_archived=false`, `is_pinned=false`) |
| `PATCH` | `/api/items/{id}` | Update item (enforces archive ↔ state sync) |
| `DELETE` | `/api/items/{id}` | Delete item |

### Tags

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tags` | List tags with item counts |
| `POST` | `/api/tags` | Create tag |
| `PATCH` | `/api/tags/{id}` | Rename tag |
| `DELETE` | `/api/tags/{id}` | Delete tag |

### Item-Tags

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/items/{item_id}/tags` | List tags on an item |
| `POST` | `/api/items/{item_id}/tags` | Attach tag (`{ "tag_id": "..." }`) |
| `DELETE` | `/api/items/{item_id}/tags/{tag_id}` | Detach tag |

---

## Business Rules (enforced in backend)

1. **New item defaults**: `state=inbox`, `is_archived=false`, `is_pinned=false`
2. **Archive sync**: `is_archived=true` → forces `state=archive`; `state=archive` → sets `is_archived=true`
3. **Inbox default view**: `is_archived=false AND state=inbox`
4. **Pinned items**: affect ordering only (pinned first), still respect filters
5. **Input validation**: title (500 chars), content (50k chars), URL (2048 chars), tag name (1–100 chars)

---

## Authentication Flow

1. **Frontend** signs up / signs in via Supabase Auth (email + password).
2. Supabase returns a signed **JWT access token** (ES256, asymmetric).
3. Frontend sends the token as `Authorization: Bearer <token>` on every API call.
4. **Backend** verifies the token via **JWKS** — fetches public keys from Supabase's `/.well-known/jwks.json`, caches them, and verifies locally. Handles key rotation automatically.
5. Backend extracts `user_id` from the token and filters all Supabase queries by that `user_id`.

---

## Security

- **JWT verification**: JWKS-based (ES256), no shared secrets, auto key rotation
- **User isolation**: all database queries filter by `user_id` from verified JWT
- **Row-Level Security**: RLS policies on all tables enforce owner-only access at the DB level
- **CORS**: restricted to configured origins, limited methods and headers
- **Input validation**: Pydantic models with `max_length` constraints on all string fields
- **Search sanitization**: PostgREST special characters stripped from search queries
- **Secrets management**: `.env` excluded by `.gitignore`; frontend only uses `NEXT_PUBLIC_` publishable keys

See [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) for the full sanity checklist.

## Production readiness

- **Backend**: Request logging (path, user_id, status, latency); single error format `{ detail, code }` for all errors; rate limiting (per IP, 120/min, `/health` and `/` excluded); health endpoint returns `status`, `database`, `jwt_config`.
- **Frontend**: All API calls handle 401 via `apiFetch` (sign out + redirect to `/login`); toasts use `body.detail` only; submit and action buttons are disabled while requests are in flight (no double submits).

---

## Production checklist

Before going live, complete and verify:

- [ ] **Supabase:** Set Site URL and Redirect URLs (Authentication → URL configuration) to your frontend origin(s), e.g. `https://your-app.vercel.app` and `https://your-app.vercel.app/**`.
- [ ] **Backend env:** Set `SUPABASE_URL`, `SUPABASE_KEY`, `CORS_ORIGINS` (include production frontend URL) in the backend deployment. Optional: `APP_VERSION` (e.g. `1.0.0`) so `/health` returns it and you can verify deploys.
- [ ] **Frontend env:** Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (production backend URL) in the frontend deployment.
- [ ] **Auth flow:** Test signup, login, and reset password (request email → use link → set new password).
- [ ] **Core flows:** Test create item (note/link/snippet), search, filter by tag, pin, archive.
- [ ] **Isolation:** Create a second user; confirm each user only sees their own items and tags.

---

## Frontend Pages

| Route | Description |
|---|---|
| `/` | Landing page (redirects to `/inbox` if signed in) |
| `/login` | Sign in with email + password |
| `/signup` | Create account |
| `/forgot-password` | Request password reset email |
| `/reset-password` | Set new password (from email link) |
| `/inbox` | Main view — search, filter, quick actions on items |
| `/new` | Create a new note / link / snippet |
| `/item/[id]` | View and edit a single item |
| `/tags` | All tags with item counts |
| `/tag/[name]` | Items filtered by a specific tag |

### UX Features
- **Dark / Light / System theme** toggle in the header (persisted to localStorage, no flash on reload)
- **Colored icons** throughout the UI — type-coded (amber=note, blue=link, emerald=snippet), contextual colors for actions
- **Toast notifications** for save, delete, archive, pin actions
- **Keyboard shortcut**: press `n` anywhere to open `/new`
- **Auth guards**: protected pages redirect to `/login`; auth pages redirect to `/inbox` if already signed in
- **Loading + empty states** on all list views
- **Quick actions** on item list: pin/unpin, archive/unarchive, activate, move to inbox

---

## Database Schema

```sql
-- Items (notes, links, snippets)
create table public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text not null check (type in ('note','link','snippet')),
  title       text,
  content     text,
  url         text,
  state       text not null default 'inbox' check (state in ('inbox','active','archive')),
  why_this_matters text,
  is_pinned   boolean not null default false,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tags
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Item ↔ Tag junction
create table public.item_tags (
  item_id    uuid not null references public.items(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

-- Auto-update timestamp trigger
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- RLS enabled on all tables with owner-only policies
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Lucide React |
| Backend | FastAPI, Python 3.10+, Pydantic v2 |
| Database | Supabase (PostgreSQL) with RLS |
| Auth | Supabase Auth (email/password), JWKS verification (ES256) |
| Icons | Lucide React (colored, contextual) |
| Theming | Class-based dark mode, localStorage persistence, system preference sync |
