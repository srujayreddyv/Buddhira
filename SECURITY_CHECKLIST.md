# Security sanity checklist

Verified for Buddhira. Re-check when adding auth, CORS, or data access.

| Check | Status |
|-------|--------|
| **Service role key never in frontend** | ✓ Frontend env only has `NEXT_PUBLIC_SUPABASE_URL` and anon/publishable keys. No `SUPABASE_KEY` or service_role. |
| **CORS only allows frontend domain(s)** | ✓ Backend uses `CORS_ORIGINS` (comma-separated). Default `http://localhost:3000`. Set to your production origin(s) in production. |
| **JWT verification uses JWKS only** | ✓ `app/auth.py` uses `PyJWKClient` and `jwt.decode(..., algorithms=["ES256"])`. No HS256 or shared secret. |
| **All backend queries include user_id filter** | ✓ Items, tags, and item_tags routes all use `user.id` from `get_current_user`; every Supabase call is scoped by `user_id`. |
| **No direct Supabase data calls from frontend** | ✓ Frontend uses Supabase only for auth (`getSession`, `signIn`, `signUp`, `signOut`, `resetPasswordForEmail`, `updateUser`, `onAuthStateChange`, `exchangeCodeForSession`). All item/tag data goes through FastAPI. |

If all true, you are in good shape.
