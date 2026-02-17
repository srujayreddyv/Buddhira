"""
Tags CRUD.

Each user has their own set of tags (unique per user_id + name).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user
from app.supabase_client import get_supabase

router = APIRouter()

MAX_TAG_NAME = 100


# ── Schemas ─────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=MAX_TAG_NAME)


class TagUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=MAX_TAG_NAME)


# ── List tags (with item counts) ────────────────────────────────────────────

@router.get("")
async def list_tags(user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    response = (
        sb.table("tags")
        .select("*, item_tags(count)")
        .eq("user_id", user.id)
        .order("name")
        .execute()
    )
    # Flatten the count from [{count: N}] to a plain integer
    tags = []
    for tag in response.data or []:
        item_count = 0
        if tag.get("item_tags") and len(tag["item_tags"]) > 0:
            item_count = tag["item_tags"][0].get("count", 0)
        tags.append({
            "id": tag["id"],
            "name": tag["name"],
            "user_id": tag["user_id"],
            "created_at": tag["created_at"],
            "item_count": item_count,
        })
    return tags


# ── Create tag ──────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tag(body: TagCreate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    response = (
        sb.table("tags")
        .insert({"user_id": user.id, "name": body.name})
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create tag")
    return response.data[0]


# ── Helpers ─────────────────────────────────────────────────────────────────

def _ensure_tag_owned(sb, tag_id: str, user_id: str) -> None:
    """Raise 404 if tag does not exist, 403 if it belongs to another user."""
    row = sb.table("tags").select("id, user_id").eq("id", tag_id).execute()
    if not row.data or len(row.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    if row.data[0]["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this tag",
        )


# ── Update tag ──────────────────────────────────────────────────────────────

@router.patch("/{tag_id}")
async def update_tag(tag_id: str, body: TagUpdate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_tag_owned(sb, tag_id, user.id)
    response = (
        sb.table("tags")
        .update({"name": body.name})
        .eq("id", tag_id)
        .eq("user_id", user.id)
        .execute()
    )
    return response.data[0]


# ── Delete tag ──────────────────────────────────────────────────────────────

@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_tag_owned(sb, tag_id, user.id)
    sb.table("tags").delete().eq("id", tag_id).eq("user_id", user.id).execute()
