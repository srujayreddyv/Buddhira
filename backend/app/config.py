"""
All config from env — no hardcoded URLs or secrets.

Required in production: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY), CORS_ORIGINS.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""  # legacy name; prefer supabase_service_role_key
    supabase_service_role_key: str = ""
    supabase_jwks_url: str = ""  # optional; if empty, derived from supabase_url

    # JWT verification (JWKS)
    jwt_audience: str = "authenticated"
    jwt_issuer: str = ""  # optional; if set, issuer claim is validated

    # CORS — production must set to your frontend origin(s), e.g. Vercel domain(s)
    cors_origins: str = ""

    @property
    def service_role_key(self) -> str:
        return self.supabase_service_role_key or self.supabase_key

    @property
    def jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url
        if self.supabase_url:
            return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
