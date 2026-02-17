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
- **Ops:** Root Makefile (`dev`, `dev-backend`, `dev-frontend`, `prod-backend`, `prod-frontend`, `seed`); env standardized (`.env.example` in both apps); README has local dev, deployment roots, production checklist, pre-deploy smoke checklist, and [What to do next](#what-to-do-next).

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

Required env vars in `backend/.env` (copy from `backend/.env.example`). No hardcoded URLs in code.

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL (`https://xxx.supabase.co`) — must match frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key (Dashboard → Settings → API). Legacy: `SUPABASE_KEY` still works. |
| `CORS_ORIGINS` | Comma-separated origins; dev: `http://localhost:3000`, production: your Vercel domain(s) |
| Optional | `SUPABASE_JWKS_URL`, `JWT_AUDIENCE`, `JWT_ISSUER` — see [Environment Variables](#environment-variables) |

**2. Frontend**

```bash
cd frontend
cp .env.example .env.local    # then fill in the values below
npm install
npm run dev
```

Required env vars in `frontend/.env.local` (copy from `frontend/.env.example`). No hardcoded URLs; nothing sensitive in `NEXT_PUBLIC_*`.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL (dev: `http://localhost:8000`, production: e.g. Render). Legacy: `NEXT_PUBLIC_API_URL` still works. |
| `NEXT_PUBLIC_SUPABASE_URL` | Same project URL as backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable anon key (safe to expose). Optional fallback: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. |
| Optional | `NEXT_PUBLIC_SITE_URL` — password reset redirect base (e.g. custom domain) |

**Cross-app:** Same Supabase project in both apps. Backend `CORS_ORIGINS` must include frontend origin (e.g. dev `http://localhost:3000`, prod your Vercel URL).

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
├── Makefile            # dev, dev-backend, dev-frontend, prod-backend, prod-frontend, seed
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Run once on fresh Supabase project
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

- **Backend:** Build/run from `backend/`. **Production:** use the same command as on Render — `gunicorn` with uvicorn workers (see [Build and run in production mode locally](#build-and-run-in-production-mode-locally)). Use **Python 3.11 or 3.12** on Render so pydantic-core installs from a pre-built wheel.
- **Frontend:** Build/run from `frontend/` (`npm install`, `npm run build`, `npm run start`).

**Cold start (e.g. Render free tier):** On the free plan, the backend may take a few seconds to wake up on the first request. The frontend is designed for this: longer timeout, one automatic retry with a “Backend waking up, retrying…” toast, and a background `/health` warmup when you land on the inbox.

---

## Build and run in production mode locally

Use this to verify production build and env before deploying (e.g. to Render + Vercel). For a full checklist that catches most deployment bugs (health, auth, CORS, login, create item, password reset, no localhost in network), see [Run a true production simulation locally](#run-a-true-production-simulation-locally).

### Frontend

From `frontend/` with env set (e.g. copy `.env.example` to `.env.local` and fill in):

```bash
cd frontend
npm run build
npm run start
```

- App runs at **http://localhost:3000** (or your configured port). Confirm all pages work (/, /login, /signup, /inbox, /new, /item/…, /tags, /tag/…).
- Confirm **env vars are picked up**: e.g. API calls go to `NEXT_PUBLIC_API_BASE_URL`; auth uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No hardcoded URLs.

### Backend

From `backend/` with `.env` set, run with the **same command you use on Render** — gunicorn with uvicorn workers:

```bash
cd backend
pip install -r requirements.txt   # includes gunicorn
gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --workers 1
```

- On Render, set the start command to the same (and use `-b 0.0.0.0:$PORT` if Render provides `PORT`).
- Confirm the **health endpoint** works: `curl http://localhost:8000/health` returns 200 with `"status": "healthy"` or `"degraded"` (and `database`, `jwt_config`). No JWT required for `/health`.

From the repo root you can use **`make prod-backend`** and **`make prod-frontend`** (after `npm run build` once for frontend) for the same production commands.

---

## Run a true production simulation locally

This catches most deployment bugs before you push. **Do not use `next dev`** for the frontend part.

### 1. Backend — run exactly like Render

Start the backend the same way Render will (gunicorn, uvicorn workers, bound to `0.0.0.0` and a port):

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows
gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --workers 1
```

Then verify:

- [ ] **Health endpoint:** `curl http://localhost:8000/health` returns 200 and JSON with `"status": "healthy"` or `"degraded"`, plus `database` and `jwt_config`.
- [ ] **Auth-protected endpoint:** Call an endpoint that requires a real Supabase token (e.g. `GET /me` or `GET /api/items` with `Authorization: Bearer <access_token>`). Use a token from signing in in the app or from Supabase Auth. Expect 200 with data, or 401 if token is missing/invalid.
- [ ] **CORS preflight:** From a browser (or a request that sends `Origin`), send `OPTIONS` to `http://localhost:8000/api/items` (or any `/api/*` route) with `Origin: http://localhost:3000`. Response should be 200 with CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`). Backend must have `CORS_ORIGINS=http://localhost:3000` in `.env` for this to allow the origin.

### 2. Frontend — build and start (no dev server)

```bash
cd frontend
npm run build
npm run start
```

Use **`next start`** only — do not use `next dev` for this test. Open **http://localhost:3000** in a browser.

Then verify:

- [ ] **Login works:** Sign in with email/password; you land on the inbox and see your data (or empty state).
- [ ] **Creating items works:** Create a note, link, or snippet from `/new`; it appears in the inbox and opens at `/item/[id]`.
- [ ] **Password reset redirect works:** Use “Forgot password”, enter email, then (with a real reset link from Supabase email) open the link and set a new password; redirect should land on your app (e.g. `/reset-password` then redirect to login). Supabase redirect URLs must include your origin (for local sim, `http://localhost:3000` if you use it in the reset link).
- [ ] **No localhost in network tab:** Open DevTools → Network. Use the app (login, load inbox, create item). Every request to your API should go to the URL in `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:8000` when simulating locally). There should be no stray requests to a hardcoded `localhost` that doesn’t match your env (e.g. wrong port or wrong host).

If all checks pass, your production simulation matches what Render and Vercel will run.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+ and pip
- A **Supabase** project (free tier works)

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the migration **once** on the new project: [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql). (See [Database and migrations](#database-and-migrations) for what it creates.)
3. Note your **Project URL**, **publishable (anon) key**, and **service_role key** from Settings → API.

### 2. Run backend and frontend

Use the commands and env vars in [Local development](#local-development) above (ports 8000 and 3000, copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env.local`).

### 3. Seed demo data (optional)

Get `user_id` from Supabase Dashboard → Authentication → Users, or from `GET /me` after signing in.

```bash
cd backend
source venv/bin/activate
python seed.py <user_id>
```

Creates sample notes, links, snippets, and tags for that user.

### 4. Smoke test (optional)

From `backend/` with venv activated, set in `.env`: `SUPABASE_ANON_KEY` (same as frontend anon key), `SMOKE_TEST_EMAIL`, `SMOKE_TEST_PASSWORD` (real Supabase user). Optional: `BACKEND_URL` (default `http://localhost:8000`).

```bash
cd backend
source venv/bin/activate
python smoke_test.py
```

Verifies: health → auth `/me` → create item → list with search and tag filter.

---

## Environment Variables

**Config and secrets:** Backend and frontend run with **no hardcoded URLs**. Set every value in `.env` / `.env.local`. Do not commit secrets — `backend/.env` and `frontend/.env.local` are in `.gitignore`. **Nothing sensitive in `NEXT_PUBLIC_*`** (only Supabase project URL and anon key, which are safe to expose).

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL — must match frontend `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role** key (server-side only — never in frontend). Legacy: `SUPABASE_KEY` accepted. |
| `SUPABASE_JWKS_URL` | Optional. Default: `SUPABASE_URL` + `/auth/v1/.well-known/jwks.json` |
| `JWT_AUDIENCE` | Optional. Default: `authenticated` |
| `JWT_ISSUER` | Optional. If set, issuer claim is validated |
| `CORS_ORIGINS` | Comma-separated; must include frontend origin(s), e.g. Vercel domain(s). Dev: `http://localhost:3000` |

No `DATABASE_URL` — backend uses Supabase client only. JWT verification uses JWKS (no shared secret).

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL (e.g. Render). Dev: `http://localhost:8000`. Legacy: `NEXT_PUBLIC_API_URL` accepted. |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL — must match backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable anon key (safe in `NEXT_PUBLIC_*`). Optional fallback: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. |
| `NEXT_PUBLIC_SITE_URL` | Optional. Password reset redirect base (e.g. custom domain); else `window.location.origin` is used |

### Environment fallbacks (predictable defaults)

Backward compatibility is intentional. Confirm these before deployment:

| Scenario | Fallback behavior |
|----------|--------------------|
| **Missing `NEXT_PUBLIC_API_BASE_URL`** | Frontend uses `NEXT_PUBLIC_API_URL` if set, else `""`. So legacy env still works; if both are missing, API calls go to empty base URL (intentional — no hardcoded localhost). Set at least one in production. |
| **Missing `SUPABASE_JWKS_URL`** | Backend builds JWKS URL from `SUPABASE_URL` + `/auth/v1/.well-known/jwks.json`. Override only if you use a custom auth server. |
| **Missing `JWT_ISSUER`** | Backend does not pass `issuer` into JWT decode; issuer claim is not validated. Decoding still works (Supabase tokens validate on audience and signature). Set `JWT_ISSUER` only if you need strict issuer check. |

These defaults are implemented in `frontend/src/lib/api.ts` (API URL) and `backend/app/config.py` + `backend/app/auth.py` (JWKS URL, JWT options).

---

## API Endpoints

Authenticated routes (`/api/*` and `GET /me`) require `Authorization: Bearer <supabase_access_token>`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/me` | Current user (auth check); returns `user_id`, `email`, `role` |

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

### API error behavior (consistent JSON and codes)

All errors return JSON in one format: `{ "detail": "<message>", "code": "<code>" }`. The `code` field is optional and helps with debugging.

| Status | When | `code` |
|--------|------|--------|
| **401** | Unauthenticated: missing or invalid Bearer token, expired JWT, or invalid signature | `unauthenticated` |
| **403** | Authenticated but the resource (item/tag) exists and belongs to another user | `forbidden` |
| **404** | Resource not found (item/tag id does not exist, or tag not attached to item) | `not_found` |
| **422** | Validation error (body or query params) | `validation_error` |
| **429** | Rate limit exceeded | `rate_limited` |
| **500** | Unexpected server error (no internal details leaked) | `internal_error` |

This makes deployment debugging easier: check status and `code` first, then `detail` for the message.

---

## Business Rules (enforced in backend)

1. **New item defaults**: `state=inbox`, `is_archived=false`, `is_pinned=false`
2. **Archive sync**: `is_archived=true` → forces `state=archive`; `state=archive` → sets `is_archived=true`
3. **Inbox default view**: `is_archived=false AND state=inbox`
4. **Pinned items**: affect ordering only (pinned first), still respect filters
5. **Input validation**: title (500 chars), content (50k chars), URL (2048 chars), tag name (1–100 chars)

---

## Auth topology (Option A)

**Chosen and consistent:** Frontend uses Supabase Auth and sends the access token to FastAPI; FastAPI validates the JWT via JWKS and derives the user id from the token.

- **Frontend:** Supabase Auth only (sign up, sign in, reset password, session). No custom auth. Every API request uses `apiFetch`, which attaches `Authorization: Bearer <access_token>` from `supabase.auth.getSession()`.
- **Backend:** No login/signup endpoints. All protected routes depend on `get_current_user`, which validates the Bearer JWT via JWKS (Supabase’s `/.well-known/jwks.json`), then uses the token’s `sub` claim as `user_id` and scopes all data by it.

## Authentication Flow (how Option A works)

1. **Frontend** signs up / signs in via Supabase Auth (email + password).
2. Supabase returns a signed **JWT access token** (ES256, asymmetric).
3. Frontend sends the token as `Authorization: Bearer <token>` on every API call (`apiFetch`).
4. **Backend** verifies the token via **JWKS** — fetches public keys from Supabase’s `/.well-known/jwks.json`, caches them, and verifies locally. Handles key rotation automatically.
5. Backend extracts `user_id` from the token (`sub` claim) and filters all Supabase queries by that `user_id`.

---

## Verify auth end to end once

This is the most important step. If auth or user isolation fails in production, it is painful to debug later.

**Flow:**

```
Frontend: Supabase Auth login
    ↓
Access token
    ↓
Authorization: Bearer <token> to FastAPI
    ↓
FastAPI validates via JWKS
    ↓
User id extracted (sub claim)
    ↓
All queries scoped by user_id
```

**Test this manually (local or production):**

1. **Log in as user A** (e.g. first test account). Confirm you see the inbox (empty or with A’s data).
2. **Create an item** as user A (note, link, or snippet). Confirm it appears in the inbox and opens at `/item/[id]`.
3. **Log out** (or use an incognito window / different browser).
4. **Log in as user B** (second test account).
5. **Confirm user A’s item does not appear** in B’s inbox. List, search, and tags should only show B’s data. If A’s item is visible to B, user isolation is broken — fix before deploying.

Run this check at least once after any change that touches auth, JWKS, or data access (e.g. new env, new Supabase project, or before first production deploy).

---

## Security

- **JWT verification**: JWKS-based (ES256), no shared secrets, auto key rotation
- **User isolation**: all database queries filter by `user_id` from verified JWT
- **Row-Level Security**: RLS policies on all tables enforce owner-only access at the DB level
- **CORS and cookies**: We use **Authorization Bearer tokens** (simplest). No auth cookies. CORS is configured so that: (1) **Origin** is taken from `CORS_ORIGINS` (set to your Vercel frontend origin in production), (2) **Authorization** and **Content-Type** headers are allowed, (3) **OPTIONS** preflight is allowed (`allow_methods` includes `OPTIONS`). Set `CORS_ORIGINS` to your exact frontend origin(s); no wildcards.
- **Input validation**: Pydantic models with `max_length` constraints on all string fields
- **Search sanitization**: PostgREST special characters stripped from search queries
- **Secrets management**: `.env` excluded by `.gitignore`; frontend only uses `NEXT_PUBLIC_` publishable keys

See [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) for the full sanity checklist.

### CORS and cookies sanity

- **We use Bearer tokens** in the `Authorization` header. No auth cookies (avoids sameSite/secure and cross-domain cookie pain.)
- **CORS must allow:** (1) **Origin** — set `CORS_ORIGINS` to your Vercel (or frontend) origin, e.g. `https://your-app.vercel.app`; (2) **Authorization** and **Content-Type** headers; (3) **OPTIONS** preflight. The backend is already configured for this (`main.py`: `allow_origins`, `allow_headers=["Authorization", "Content-Type"]`, `allow_methods` including `OPTIONS`, `allow_credentials=True`).

### Confirm CORS configuration is explicit (no wildcard)

- **No wildcard.** Do not use `*` for `CORS_ORIGINS`. The backend uses FastAPI/Starlette `CORSMiddleware`, which matches the request `Origin` header against an **exact** list of allowed origins. Pattern wildcards (e.g. `https://*.vercel.app`) are **not** supported — each origin must be listed in full.
- **For production** set `CORS_ORIGINS` to:
  - Your **Vercel production domain**, e.g. `https://yourapp.vercel.app`
  - Every **Vercel preview origin** you need, listed explicitly (e.g. `https://yourapp-git-branch-username.vercel.app`). Add preview URLs from the Vercel deployment URL when you need API access from preview deployments.
- **Example** (comma-separated, no spaces inside URLs):
  ```text
  https://yourapp.vercel.app,https://yourapp-git-main-yourteam.vercel.app
  ```
  If you use many preview branches, you can add multiple preview origins; there is no pattern support, so each must be a full URL.
- **Test in the browser:** Open your app, open DevTools → Console. Use the app (login, load inbox, create item). Confirm **no CORS warnings or errors** on API calls. If you see "blocked by CORS policy" or "No 'Access-Control-Allow-Origin' header", add the request’s `Origin` to `CORS_ORIGINS` and redeploy the backend.

## Production readiness

- **Backend**: Request logging (path, user_id, status, latency); single error format `{ detail, code }` for all errors; rate limiting (per IP, 120/min, `/health` and `/` excluded); health endpoint returns `status`, `database`, `jwt_config`.
- **Frontend**: All API calls handle 401 via `apiFetch` (sign out + redirect to `/login`); toasts use `body.detail` only; submit and action buttons are disabled while requests are in flight (no double submits).

---

## Production checklist

Before going live, complete and verify:

- [ ] **Supabase:** Set Site URL and Redirect URLs (Authentication → URL configuration) to your frontend origin(s), e.g. `https://your-app.vercel.app` and `https://your-app.vercel.app/**`.
- [ ] **Backend env:** Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS` (explicit Vercel production + preview origins, no wildcard). Optional: `APP_VERSION`, `SUPABASE_JWKS_URL`, `JWT_AUDIENCE`, `JWT_ISSUER`.
- [ ] **CORS:** Confirm [CORS configuration is explicit](#confirm-cors-configuration-is-explicit-no-wildcard); test in browser console — no CORS warnings on API calls.
- [ ] **Frontend env:** Set `NEXT_PUBLIC_API_BASE_URL` (Render/backend URL), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: `NEXT_PUBLIC_SITE_URL` for password reset redirect.
- [ ] **Auth flow:** Test signup, login, and reset password (request email → use link → set new password).
- [ ] **Auth end-to-end and isolation:** Run the [Verify auth end to end once](#verify-auth-end-to-end-once) test (login as A, create item, login as B, confirm B does not see A’s item). Most important step.
- [ ] **Core flows:** Test create item (note/link/snippet), search, filter by tag, pin, archive.
- [ ] **Pre-deploy smoke:** Run the [Pre-deploy smoke checklist](#pre-deploy-smoke-checklist) once after backend deploy and again after frontend deploy.

---

## Pre-deploy smoke checklist

Run this **test sequence** before considering the deploy done. Do it **once after backend deploy** (e.g. Render), then **again after frontend deploy** (e.g. Vercel), each time against the live backend + frontend you just deployed.

| # | Step | What to do |
|---|------|------------|
| 1 | Sign up | Create a new account (email + password). Confirm you land on inbox or redirect to sign-in. |
| 2 | Sign in | Sign in with that account. Confirm you see the inbox (empty or with data). |
| 3 | Create note | Go to `/new`, choose **Note**, add title and content, save. Confirm it appears in the inbox and opens at `/item/[id]`. |
| 4 | Create link | Go to `/new`, choose **Link**, add title, URL, optional notes, save. Confirm it appears and the URL is clickable on the item page. |
| 5 | Create snippet | Go to `/new`, choose **Snippet**, add title and code/content, save. Confirm it appears and shows in a code-style block on the item page. |
| 6 | Add tags | On an item (or when creating), add one or more tags. Confirm tags appear on the item and in the inbox row; go to **Tags** and confirm the tag(s) list with counts; open a tag and confirm the item appears. |
| 7 | Search text | In the inbox search box, type text that matches a note/link/snippet title or content. Confirm only matching items show. |
| 8 | Filter by type | In the inbox, set **All types** to **Note** (then **Link**, then **Snippet**). Confirm the list filters correctly. |
| 9 | Archive and unarchive | On an item (inbox or item page), use **Archive**. Confirm it leaves the default inbox view. Turn on **Archived** filter (or show archived) and confirm the item appears; **Unarchive** and confirm it returns to the inbox. |
| 10 | Pin and unpin | **Pin** an item from the inbox; confirm it moves to the **Pinned** section at the top. **Unpin**; confirm it moves back to the main list. |
| 11 | Password reset link | Use **Forgot password**, enter your email, submit. In the reset email, open the link and set a new password. Confirm you land on the app (e.g. `/reset-password` then redirect to login) and can sign in with the new password. |

If any step fails, fix before treating the deploy as complete. Running the sequence after both backend and frontend deploys catches env, CORS, and routing issues early.

---

## Render and Vercel gotchas

### Render (backend)

- **Set the start command explicitly.** Use the same command as [production mode locally](#build-and-run-in-production-mode-locally), with Render’s `PORT`:
  ```bash
  gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --workers 1
  ```
- **Bind to `0.0.0.0` and the provided `PORT`.** Render sets `PORT`; the command above uses `-b 0.0.0.0:$PORT` so the service is reachable.
- **Set the health check path** in the Render dashboard (e.g. `/health`) so Render can detect a healthy instance.
- **Auto deploy:** Enable “Auto-Deploy” from the **main** branch only if it’s stable; otherwise deploy manually or from a release branch.
- **Allowed origins:** Set `CORS_ORIGINS` to your **Vercel production domain and each preview domain explicitly** (comma-separated). No wildcards — list full URLs, e.g. `https://your-app.vercel.app,https://your-app-git-main-yourteam.vercel.app`. Missing origins will cause CORS errors in the browser.

### Vercel (frontend)

- **`NEXT_PUBLIC_API_BASE_URL`:** Set it for **Production** and **Preview** separately in Vercel (Project → Settings → Environment Variables) if preview deployments should hit a different backend (e.g. staging) or the same Render API. Preview builds get Preview env vars.
- **Supabase password reset:** If you use “Forgot password”, add your **Vercel domain(s)** in Supabase: Authentication → URL configuration → Redirect URLs (e.g. `https://your-app.vercel.app/reset-password`, `https://*-your-team.vercel.app/reset-password` for previews if you use them for auth).
- **No server-side fetch to localhost:** All API calls use `NEXT_PUBLIC_API_BASE_URL` (or `NEXT_PUBLIC_API_URL`). This codebase does not hardcode `localhost`; keep it that way so preview and production always use the configured backend.

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

## Database and migrations

**Single SQL migration:** [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql). Run it **once** in the Supabase SQL Editor on a **fresh project**. Re-running on the same DB will fail on existing objects; to reapply from scratch, use a new Supabase project and run the file again.

### What the migration creates

- **Tables:** `items`, `tags`, `item_tags` (with FKs and `on delete cascade`). Constraints: `items.type` / `items.state` checks, `tags (user_id, name)` unique.
- **Scope:** All item access is scoped by `user_id`. Unique index `(user_id, id)` on `items` enforces user + item id scope and speeds up get-by-id.
- **Indexes for list queries:**
  - `(user_id, is_pinned desc, created_at desc)` — default list order
  - `(user_id, state)` — state filter
  - `(user_id, is_archived)` — archived filter
  - `(user_id, is_pinned)` — pinned filter
  - `tags (user_id, name)`; `item_tags (item_id)`, `item_tags (tag_id)`
- **Search (q):** Backend uses `ilike` on `title` and `content`. Migration enables **pg_trgm** and adds GIN trigram indexes on `items.title` and `items.content` so `ilike '%...%'` can use an index.
- **RLS:** Enabled on all three tables; owner-only policies using `auth.uid()`. API uses the service role (bypasses RLS) and always filters by `user_id` from the JWT.

### Quick reference (table shapes)

| Table      | Key columns / constraints |
|-----------|---------------------------|
| `items`   | `user_id`, `type`, `state`, `is_pinned`, `is_archived`, `created_at`, `updated_at`; checks on `type`, `state` |
| `tags`    | `user_id`, `name`; unique `(user_id, name)` |
| `item_tags` | `(item_id, tag_id)` PK; FK to `items` and `tags` with `on delete cascade` |

### Basic database performance sanity (safety, not feature work)

With **~1000 items** you want:

- **GET items with search** to still feel fast (no full table scans).
- **Pinned ordering** (pinned first, then by `created_at`) to use indexes, not full scans.

The migration already creates the needed indexes on `public.items`. **Quick check in Supabase:** Table Editor → `items` → check indexes, or run in SQL:

```sql
select indexname from pg_indexes where tablename = 'items' and schemaname = 'public';
```

You should see indexes that cover:

- **user_id** (all item queries filter by user): e.g. `idx_items_user_id_id`, `idx_items_user_pinned_created_at`, `idx_items_user_state`, `idx_items_user_is_archived`, `idx_items_user_is_pinned`
- **state**, **is_archived**, **is_pinned** (as part of composite indexes with `user_id`)
- **Search:** `idx_items_title_trgm`, `idx_items_content_trgm` (GIN trigram for `ilike`)

If you applied [001_initial_schema.sql](supabase/migrations/001_initial_schema.sql), these exist. Hosted environments (e.g. Supabase free tier) often feel slower than local; having these indexes in place avoids full scans and keeps list + search responsive.

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

---

## What to do next

**Supabase already set up.** Ensure the [migration](supabase/migrations/001_initial_schema.sql) has been run once on your project and that `backend/.env` and `frontend/.env.local` are filled from `.env.example` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGINS; NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).

1. **Before first deploy:** Run a [true production simulation locally](#run-a-true-production-simulation-locally) (backend with gunicorn, frontend with `next build` + `next start`). Complete the [auth end-to-end](#verify-auth-end-to-end-once) test (user A creates item, user B does not see it).
2. **Deploy backend** (e.g. Render): Set env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGINS). Use start command: `gunicorn main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --workers 1`. Set health check path `/health`.
3. **Smoke-check after backend:** Run the [Pre-deploy smoke checklist](#pre-deploy-smoke-checklist) against your **frontend URL** (local or a preview) pointing at the **new backend URL**.
4. **Deploy frontend** (e.g. Vercel): Set NEXT_PUBLIC_API_BASE_URL (and other env). Add Vercel domain(s) to Supabase redirect URLs if using password reset.
5. **Smoke-check after frontend:** Run the [Pre-deploy smoke checklist](#pre-deploy-smoke-checklist) again on the live frontend + backend.
6. **Ongoing:** Tag releases (e.g. `git tag v1.0.0 && git push origin v1.0.0`). Re-run smoke after any deploy.
