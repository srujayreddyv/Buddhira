from supabase import create_client, Client

from app.config import settings


def get_supabase() -> Client:
    """Get Supabase client instance."""
    return create_client(settings.supabase_url, settings.supabase_key)
