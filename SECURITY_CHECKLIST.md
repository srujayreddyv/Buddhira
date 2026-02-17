# Security sanity checklist

Verified for Buddhira. Re-check when adding auth, CORS, or data access.

**Auth topology:** Option A — Frontend uses Supabase Auth and sends the access token to FastAPI; FastAPI validates JWT via JWKS and derives user id from the token. No login/signup on backend.

| Check | Status |
|-------|--------|
| **Service role key never in frontend** | ✓ Frontend env only has `NEXT_PUBLIC_SUPABASE_URL` and anon/publishable keys. No `SUPABASE_SERVICE_ROLE_KEY` or service_role. |
| **CORS only allows frontend domain(s)** | ✓ Backend uses `CORS_ORIGINS` from env (comma-separated). No hardcoded default; set e.g. `http://localhost:3000` in dev, Vercel domain(s) in production. |
| **CORS allows Bearer token flow** | ✓ We use Authorization header (no cookies). CORS allows: **Origin** (from `CORS_ORIGINS`, e.g. Vercel), **Authorization** and **Content-Type** headers, **OPTIONS** preflight. `allow_credentials=True` for cross-origin requests with Authorization. |
| **JWT verification uses JWKS only** | ✓ `app/auth.py` uses `PyJWKClient` and `jwt.decode(..., algorithms=["ES256"])`. No HS256 or shared secret. |
| **All backend queries include user_id filter** | ✓ Items, tags, and item_tags routes all use `user.id` from `get_current_user`; every Supabase call is scoped by `user_id`. |
| **No direct Supabase data calls from frontend** | ✓ Frontend uses Supabase only for auth (`getSession`, `signIn`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`, `onAuthStateChange`, `exchangeCodeForSession`). All item/tag data goes through FastAPI. |
| **Nothing sensitive in NEXT_PUBLIC_*** | ✓ Only `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `NEXT_PUBLIC_SITE_URL`. No secrets. |

If all true, you are in good shape.
