#!/usr/bin/env python3
"""
Smoke test: end-to-end check of backend + auth + items.

Usage (from backend/ with venv activated):
  Set in .env or env: SUPABASE_URL, SUPABASE_ANON_KEY, SMOKE_TEST_EMAIL, SMOKE_TEST_PASSWORD.
  Optional: BACKEND_URL (default http://localhost:8000)
  Then: python smoke_test.py

Requires a real Supabase user (sign up once in the app, then use that email/password).
"""

import os
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json

# Load backend .env so we get SUPABASE_URL (and optionally the rest)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SMOKE_TEST_EMAIL = os.environ.get("SMOKE_TEST_EMAIL", "")
SMOKE_TEST_PASSWORD = os.environ.get("SMOKE_TEST_PASSWORD", "")


def req(method, path, body=None, token=None):
    url = f"{BACKEND_URL}{path}" if path.startswith("/") else f"{BACKEND_URL}/{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    r = Request(url, data=data, method=method, headers=headers)
    with urlopen(r, timeout=15) as res:
        return res.status, json.loads(res.read().decode()) if res.headers.get("Content-Length") else {}


def supabase_sign_in():
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    req_obj = Request(
        url,
        data=json.dumps({
            "email": SMOKE_TEST_EMAIL,
            "password": SMOKE_TEST_PASSWORD,
            "grant_type": "password",
        }).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
        },
    )
    with urlopen(req_obj, timeout=10) as res:
        out = json.loads(res.read().decode())
    return out["access_token"]


def main():
    errors = []
    if not SUPABASE_URL:
        errors.append("SUPABASE_URL not set")
    if not SUPABASE_ANON_KEY:
        errors.append("SUPABASE_ANON_KEY not set (use anon key for smoke test)")
    if not SMOKE_TEST_EMAIL or not SMOKE_TEST_PASSWORD:
        errors.append("SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD not set (use a real Supabase user)")
    if errors:
        print("Smoke test env missing:", "; ".join(errors))
        print("Add to backend/.env or set in shell. See smoke_test.py docstring.")
        sys.exit(1)

    # 1. Backend health
    try:
        status, data = req("GET", "/health")
        assert status == 200, f"health returned {status}"
        assert data.get("status") in ("healthy", "degraded"), data
        print("1. Health OK:", data.get("status"))
    except (HTTPError, URLError, AssertionError) as e:
        print("1. Health FAIL:", e)
        sys.exit(1)

    # 2. Auth: get token and call /me
    try:
        token = supabase_sign_in()
        status, data = req("GET", "/me", token=token)
        assert status == 200, f"/me returned {status}"
        assert "user_id" in data
        print("2. /me OK, user_id:", data.get("user_id", "")[:8], "...")
    except (HTTPError, URLError, AssertionError, KeyError) as e:
        print("2. Auth /me FAIL:", e)
        sys.exit(1)

    # 3. Create item
    try:
        status, item = req("POST", "/api/items", body={"type": "note", "title": "Smoke test", "content": "E2E"}, token=token)
        assert status == 201, f"create item returned {status}"
        item_id = item.get("id")
        assert item_id, "no id in response"
        print("3. Create item OK, id:", item_id[:8], "...")
    except (HTTPError, URLError, AssertionError, KeyError) as e:
        print("3. Create item FAIL:", e)
        sys.exit(1)

    # 4. List with search and tag filter
    try:
        status, list_data = req("GET", "/api/items?q=Smoke", token=token)
        assert status == 200, f"list returned {status}"
        assert isinstance(list_data, list), "list response not array"
        found = any(i.get("id") == item_id for i in list_data)
        assert found, "created item not in list"
        print("4. List + search OK, found created item")

        status2, list2 = req("GET", "/api/items?tag=smoke_test", token=token)
        assert status2 == 200
        print("4. List + tag filter OK (may be empty if no tag attached)")
    except (HTTPError, URLError, AssertionError) as e:
        print("4. List FAIL:", e)
        sys.exit(1)

    print("Smoke test passed.")


if __name__ == "__main__":
    main()
