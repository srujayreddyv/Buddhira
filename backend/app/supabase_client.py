from supabase import create_client, Client

from app.config import settings


def get_supabase() -> Client:
    """Get Supabase client instance (uses SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY)."""
    return create_client(settings.supabase_url, settings.service_role_key)
