"""
Item ↔ Tag associations.

Attach and detach tags from items. Both the item and tag must belong
to the authenticated user. Returns 403 when resource exists but belongs to another user.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import CurrentUser, get_current_user
from app.supabase_client import get_supabase

router = APIRouter()


def _ensure_resource_owned(sb, table: str, resource_id: str, user_id: str, name: str) -> None:
    """Raise 404 if resource does not exist, 403 if it belongs to another user."""
    row = sb.table(table).select("id, user_id").eq("id", resource_id).execute()
    if not row.data or len(row.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{name} not found")
    if row.data[0]["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have access to this {name.lower()}",
        )


class ItemTagBody(BaseModel):
    tag_id: str


# ── List tags for an item ──────────────────────────────────────────────────

@router.get("/{item_id}/tags")
async def list_item_tags(item_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_resource_owned(sb, "items", item_id, user.id, "Item")

    response = (
        sb.table("item_tags")
        .select("tag_id, tags(id, name)")
        .eq("item_id", item_id)
        .execute()
    )
    return response.data


# ── Attach tag to item ─────────────────────────────────────────────────────

@router.post("/{item_id}/tags", status_code=status.HTTP_201_CREATED)
async def add_tag_to_item(
    item_id: str,
    body: ItemTagBody,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase()
    _ensure_resource_owned(sb, "items", item_id, user.id, "Item")
    _ensure_resource_owned(sb, "tags", body.tag_id, user.id, "Tag")

    response = (
        sb.table("item_tags")
        .upsert({"item_id": item_id, "tag_id": body.tag_id})
        .execute()
    )
    return response.data[0] if response.data else {"item_id": item_id, "tag_id": body.tag_id}


# ── Detach tag from item ───────────────────────────────────────────────────

@router.delete("/{item_id}/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_tag_from_item(
    item_id: str,
    tag_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase()
    _ensure_resource_owned(sb, "items", item_id, user.id, "Item")

    response = (
        sb.table("item_tags")
        .delete()
        .eq("item_id", item_id)
        .eq("tag_id", tag_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not attached to item")
