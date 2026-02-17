import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

bearer_scheme = HTTPBearer()

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """Lazy init so health check can run without JWKS configured."""
    global _jwks_client
    if _jwks_client is None:
        url = settings.jwks_url
        if not url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="JWKS URL not configured (set SUPABASE_URL or SUPABASE_JWKS_URL)",
            )
        _jwks_client = PyJWKClient(
            url,
            cache_keys=True,
            lifespan=3600,
            headers={"apikey": settings.service_role_key} if settings.service_role_key else None,
        )
    return _jwks_client


class CurrentUser:
    """Represents a verified Supabase user extracted from the JWT."""

    def __init__(self, id: str, email: str | None = None, role: str | None = None):
        self.id = id
        self.email = email
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """
    FastAPI dependency that:
    1. Extracts the Bearer token from the Authorization header
    2. Resolves the signing key via JWKS (cached, handles rotation)
    3. Verifies the JWT signature + claims locally (no network call per request)
    4. Returns a CurrentUser with user_id, email, role
    """
    token = credentials.credentials

    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        decode_options: dict = {"algorithms": ["ES256"], "audience": settings.jwt_audience}
        if settings.jwt_issuer:
            decode_options["issuer"] = settings.jwt_issuer
        payload = jwt.decode(token, signing_key.key, **decode_options)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
        role=payload.get("role"),
    )
