"""
Item ↔ Tag associations.

Attach and detach tags from items. Both the item and tag must belong
to the authenticated user.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import CurrentUser, get_current_user
from app.supabase_client import get_supabase

router = APIRouter()


class ItemTagBody(BaseModel):
    tag_id: str


# ── List tags for an item ──────────────────────────────────────────────────

@router.get("/{item_id}/tags")
async def list_item_tags(item_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()

    # Verify the item belongs to the user
    item = sb.table("items").select("id").eq("id", item_id).eq("user_id", user.id).single().execute()
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

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

    # Verify both item and tag belong to the user
    item = sb.table("items").select("id").eq("id", item_id).eq("user_id", user.id).single().execute()
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    tag = sb.table("tags").select("id").eq("id", body.tag_id).eq("user_id", user.id).single().execute()
    if not tag.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

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

    # Verify the item belongs to the user
    item = sb.table("items").select("id").eq("id", item_id).eq("user_id", user.id).single().execute()
    if not item.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    response = (
        sb.table("item_tags")
        .delete()
        .eq("item_id", item_id)
        .eq("tag_id", tag_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not attached to item")
