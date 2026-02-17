import asyncio
import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.auth import CurrentUser, get_current_user
from app.config import settings
from app.errors import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.middleware import RateLimitMiddleware, RequestLoggingMiddleware
from app.routes.item_tags import router as item_tags_router
from app.routes.items import router as items_router
from app.routes.tags import router as tags_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("buddhira")

app = FastAPI(
    title="Buddhira API",
    description="Backend API for Buddhira - powered by FastAPI & Supabase",
    version="0.1.0",
)

# Single error format so frontend toasts never break
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)


@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    """Root and HEAD for load balancer / Render probes."""
    return {"message": "Buddhira API", "status": "running"}


def _health_db_check_sync() -> bool:
    """Synchronous DB ping for use in executor with timeout."""
    from app.supabase_client import get_supabase
    get_supabase().table("items").select("id").limit(1).execute()
    return True


@app.get("/health")
async def health():
    """
    Unauthenticated, cheap health check for Render and warmup.
    No JWT. DB check runs in a thread with a 2s timeout; timeout or error → degraded.
    Returns 200 with status "healthy" or "degraded" so Render stays green.
    Returns 500 only when the app cannot function at all (missing Supabase config).
    """
    version = os.environ.get("APP_VERSION") or app.version

    supabase_ok = bool(settings.supabase_url and settings.service_role_key)
    if not supabase_ok:
        return JSONResponse(
            status_code=500,
            content={
                "status": "unhealthy",
                "reason": "missing_supabase_config",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "version": version,
            },
        )

    db_ok = False
    try:
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(None, _health_db_check_sync),
            timeout=2.0,
        )
        db_ok = True
    except asyncio.TimeoutError:
        logger.warning("Health check: database check timed out (2s)")
    except Exception as e:
        logger.warning("Health check: database unreachable: %s", e)

    status_str = "healthy" if db_ok else "degraded"
    return {
        "status": status_str,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": version,
        "database": "ok" if db_ok else "unreachable",
        "jwt_config": "ok",
    }


@app.get("/me", tags=["auth"])
async def me(user: CurrentUser = Depends(get_current_user)):
    """Return the currently authenticated user (quick auth test)."""
    return {"user_id": user.id, "email": user.email, "role": user.role}


app.include_router(items_router, prefix="/api/items", tags=["items"])
app.include_router(tags_router, prefix="/api/tags", tags=["tags"])
app.include_router(item_tags_router, prefix="/api/items", tags=["item-tags"])
