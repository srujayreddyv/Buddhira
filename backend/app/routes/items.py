"""
Items CRUD — notes, links, and snippets.

All queries use the service-role client and filter by user_id.

Product rules (enforced in create & update):
  1. New item defaults: state=inbox, is_archived=false, is_pinned=false
  2. If is_archived=true  → force state=archive
  3. If state=archive     → set is_archived=true
  4. Default list (no filters) shows: is_archived=false AND state=inbox
  5. Pinned only affects ordering; pinned items still respect filters
"""

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user
from app.supabase_client import get_supabase

router = APIRouter()

ItemType = Literal["note", "link", "snippet"]
ItemState = Literal["inbox", "active", "archive"]

MAX_TITLE = 500
MAX_CONTENT = 50_000
MAX_URL = 2_048
MAX_WHY = 1_000


# ── Schemas ─────────────────────────────────────────────────────────────────

class ItemCreate(BaseModel):
    type: ItemType
    title: str | None = Field(None, max_length=MAX_TITLE)
    content: str | None = Field(None, max_length=MAX_CONTENT)
    url: str | None = Field(None, max_length=MAX_URL)
    state: ItemState = "inbox"
    why_this_matters: str | None = Field(None, max_length=MAX_WHY)
    is_pinned: bool = False


class ItemUpdate(BaseModel):
    title: str | None = Field(None, max_length=MAX_TITLE)
    content: str | None = Field(None, max_length=MAX_CONTENT)
    url: str | None = Field(None, max_length=MAX_URL)
    state: ItemState | None = None
    why_this_matters: str | None = Field(None, max_length=MAX_WHY)
    is_pinned: bool | None = None
    is_archived: bool | None = None


# ── Business rules ──────────────────────────────────────────────────────────

def enforce_archive_rules(data: dict) -> dict:
    """
    Keep state and is_archived in sync.
      - is_archived=true  → state must be "archive"
      - state="archive"   → is_archived must be true
      - state != "archive" and is_archived not explicitly true → is_archived=false
    """
    is_archived = data.get("is_archived")
    state = data.get("state")

    if is_archived is True:
        data["state"] = "archive"
    elif state == "archive":
        data["is_archived"] = True
    elif state is not None and state != "archive":
        # Moving out of archive → un-archive
        data["is_archived"] = False

    return data


# ── List items ──────────────────────────────────────────────────────────────

@router.get("")
async def list_items(
    q: str | None = Query(None, description="Search title and content (case-insensitive)"),
    type: ItemType | None = Query(None, description="Filter by item type"),
    state: ItemState | None = Query(None, description="Filter by state"),
    tag: str | None = Query(None, description="Filter by tag name"),
    is_pinned: bool | None = Query(None, description="Filter pinned items"),
    is_archived: bool | None = Query(None, description="Filter archived items"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("items").select("*, item_tags(tag_id, tags(id, name))").eq("user_id", user.id)

    # Rule 4: default view is the inbox (non-archived) unless any filter is set
    has_any_filter = any(v is not None for v in [q, type, state, tag, is_pinned, is_archived])
    if not has_any_filter:
        query = query.eq("state", "inbox").eq("is_archived", False)
    else:
        if type is not None:
            query = query.eq("type", type)
        if state is not None:
            query = query.eq("state", state)
        if is_pinned is not None:
            query = query.eq("is_pinned", is_pinned)
        if is_archived is not None:
            query = query.eq("is_archived", is_archived)

    # Search: match title or content (ilike = case-insensitive)
    # Sanitize: strip PostgREST special chars to prevent filter injection
    if q:
        safe_q = re.sub(r"[%_\\(),.]", "", q).strip()
        if safe_q:
            query = query.or_(f"title.ilike.%{safe_q}%,content.ilike.%{safe_q}%")

    # Tag filter: narrow to items that have this tag attached
    if tag:
        tag_row = sb.table("tags").select("id").eq("user_id", user.id).eq("name", tag).execute()
        if tag_row.data:
            tag_id = tag_row.data[0]["id"]
            tagged_items = sb.table("item_tags").select("item_id").eq("tag_id", tag_id).execute()
            item_ids = [r["item_id"] for r in (tagged_items.data or [])]
            if item_ids:
                query = query.in_("id", item_ids)
            else:
                return []
        else:
            return []

    # Rule 5: pinned items first, then by created_at desc
    query = (
        query
        .order("is_pinned", desc=True)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    response = query.execute()
    return response.data


# ── Get single item ─────────────────────────────────────────────────────────

def _ensure_item_owned(sb, item_id: str, user_id: str) -> None:
    """Raise 404 if item does not exist, 403 if it belongs to another user."""
    row = sb.table("items").select("id, user_id").eq("id", item_id).execute()
    if not row.data or len(row.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found",
        )
    if row.data[0]["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this item",
        )


@router.get("/{item_id}")
async def get_item(item_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_item_owned(sb, item_id, user.id)
    response = (
        sb.table("items")
        .select("*, item_tags(tag_id, tags(id, name))")
        .eq("id", item_id)
        .eq("user_id", user.id)
        .single()
        .execute()
    )
    return response.data


# ── Create item ─────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_item(body: ItemCreate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    row = body.model_dump(exclude_none=True)
    row["user_id"] = user.id

    # Rule 1: enforce defaults
    row.setdefault("state", "inbox")
    row.setdefault("is_archived", False)
    row.setdefault("is_pinned", False)

    # Rules 2 & 3: sync state ↔ is_archived
    row = enforce_archive_rules(row)

    response = sb.table("items").insert(row).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create item")
    return response.data[0]


# ── Update item ─────────────────────────────────────────────────────────────

@router.patch("/{item_id}")
async def update_item(item_id: str, body: ItemUpdate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_item_owned(sb, item_id, user.id)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    # Rules 2 & 3: sync state ↔ is_archived
    updates = enforce_archive_rules(updates)

    response = sb.table("items").update(updates).eq("id", item_id).eq("user_id", user.id).execute()
    return response.data[0]


# ── Delete item ─────────────────────────────────────────────────────────────

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_item_owned(sb, item_id, user.id)
    sb.table("items").delete().eq("id", item_id).eq("user_id", user.id).execute()
