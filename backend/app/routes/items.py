"""
Items CRUD — notes, links, and snippets.

All queries use the service-role client and filter by user_id.
"""

import re
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user
from app.supabase_client import get_supabase

router = APIRouter()

ItemType = Literal["note", "link", "snippet"]
ItemState = Literal["inbox", "active", "archive"]
SortMode = Literal["smart", "created_desc", "updated_desc"]
BulkAction = Literal["archive", "unarchive", "pin", "unpin", "activate", "inbox", "delete"]

MAX_TITLE = 500
MAX_CONTENT = 50_000
MAX_URL = 2_048
MAX_WHY = 1_000
MAX_IMPORT_ITEMS = 1000
MAX_BULK_IDS = 200


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


class BulkItemsBody(BaseModel):
    ids: list[str] = Field(..., min_length=1, max_length=MAX_BULK_IDS)
    action: BulkAction


class ImportItem(BaseModel):
    type: ItemType
    title: str | None = Field(None, max_length=MAX_TITLE)
    content: str | None = Field(None, max_length=MAX_CONTENT)
    url: str | None = Field(None, max_length=MAX_URL)
    state: ItemState = "inbox"
    why_this_matters: str | None = Field(None, max_length=MAX_WHY)
    is_pinned: bool = False
    is_archived: bool = False
    tags: list[str] = Field(default_factory=list)


class ImportPayload(BaseModel):
    version: int | None = 1
    items: list[ImportItem] = Field(default_factory=list)


def enforce_archive_rules(data: dict) -> dict:
    """Keep state and is_archived in sync."""
    is_archived = data.get("is_archived")
    state = data.get("state")

    if is_archived is True:
        data["state"] = "archive"
    elif state == "archive":
        data["is_archived"] = True
    elif state is not None and state != "archive":
        data["is_archived"] = False

    return data


def _ensure_item_owned(sb, item_id: str, user_id: str) -> None:
    """Raise 404 if item does not exist, 403 if it belongs to another user."""
    row = sb.table("items").select("id, user_id").eq("id", item_id).execute()
    if not row.data or len(row.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    if row.data[0]["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this item",
        )


def _normalized_tag(name: str) -> str:
    return name.strip().lower()


def _order_items_query(query, sort: SortMode):
    if sort == "created_desc":
        return query.order("created_at", desc=True)
    if sort == "updated_desc":
        return query.order("updated_at", desc=True)
    # default: smart ordering for inbox UX
    return query.order("is_pinned", desc=True).order("created_at", desc=True)


@router.get("")
async def list_items(
    q: str | None = Query(None, description="Search title and content (case-insensitive)"),
    type: ItemType | None = Query(None, description="Filter by item type"),
    state: ItemState | None = Query(None, description="Filter by state"),
    tag: str | None = Query(None, description="Filter by tag name"),
    is_pinned: bool | None = Query(None, description="Filter pinned items"),
    is_archived: bool | None = Query(None, description="Filter archived items"),
    sort: SortMode = Query("smart", description="Sort mode"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("items").select("*, item_tags(tag_id, tags(id, name))").eq("user_id", user.id)

    # Default view: inbox non-archived unless filters are set.
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

    if q:
        safe_q = re.sub(r"[%_\\(),.]", "", q).strip()
        if safe_q:
            query = query.or_(f"title.ilike.%{safe_q}%,content.ilike.%{safe_q}%")

    if tag:
        tag_row = sb.table("tags").select("id").eq("user_id", user.id).eq("name", tag).execute()
        if not tag_row.data:
            return []
        tag_id = tag_row.data[0]["id"]
        tagged_items = sb.table("item_tags").select("item_id").eq("tag_id", tag_id).execute()
        item_ids = [r["item_id"] for r in (tagged_items.data or [])]
        if not item_ids:
            return []
        query = query.in_("id", item_ids)

    query = _order_items_query(query, sort).range(offset, offset + limit - 1)
    response = query.execute()
    return response.data


@router.post("/bulk")
async def bulk_update_items(body: BulkItemsBody, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    ids = list(dict.fromkeys(body.ids))  # dedupe while preserving order

    if body.action == "delete":
        deleted = (
            sb.table("items")
            .delete()
            .in_("id", ids)
            .eq("user_id", user.id)
            .execute()
        )
        return {"action": body.action, "count": len(deleted.data or []), "item_ids": ids}

    updates: dict[str, object]
    if body.action == "archive":
        updates = {"is_archived": True}
    elif body.action == "unarchive":
        updates = {"is_archived": False}
    elif body.action == "pin":
        updates = {"is_pinned": True}
    elif body.action == "unpin":
        updates = {"is_pinned": False}
    elif body.action == "activate":
        updates = {"state": "active"}
    elif body.action == "inbox":
        updates = {"state": "inbox"}
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported bulk action")

    updates = enforce_archive_rules(updates)
    response = (
        sb.table("items")
        .update(updates)
        .in_("id", ids)
        .eq("user_id", user.id)
        .execute()
    )
    return {
        "action": body.action,
        "count": len(response.data or []),
        "item_ids": [r["id"] for r in (response.data or []) if "id" in r],
    }


@router.get("/export")
async def export_items(user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    response = (
        sb.table("items")
        .select("*, item_tags(tag_id, tags(id, name))")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )

    items: list[dict] = []
    for row in response.data or []:
        tag_names = [
            it.get("tags", {}).get("name")
            for it in (row.get("item_tags") or [])
            if it.get("tags", {}).get("name")
        ]
        items.append({
            "type": row.get("type"),
            "title": row.get("title"),
            "content": row.get("content"),
            "url": row.get("url"),
            "state": row.get("state"),
            "why_this_matters": row.get("why_this_matters"),
            "is_pinned": row.get("is_pinned", False),
            "is_archived": row.get("is_archived", False),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "tags": tag_names,
        })

    return {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "item_count": len(items),
        "items": items,
    }


@router.post("/import")
async def import_items(payload: ImportPayload, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()

    if len(payload.items) > MAX_IMPORT_ITEMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many items in one import (max {MAX_IMPORT_ITEMS})",
        )

    existing_tags = (
        sb.table("tags").select("id, name").eq("user_id", user.id).execute().data or []
    )
    tag_map: dict[str, str] = {t["name"]: t["id"] for t in existing_tags}

    imported_count = 0
    attached_tag_links = 0

    for item in payload.items:
        row = {
            "user_id": user.id,
            "type": item.type,
            "title": item.title,
            "content": item.content,
            "url": item.url,
            "state": item.state,
            "why_this_matters": item.why_this_matters,
            "is_pinned": item.is_pinned,
            "is_archived": item.is_archived,
        }
        row = enforce_archive_rules(row)

        create_res = sb.table("items").insert(row).execute()
        if not create_res.data:
            continue

        imported_count += 1
        item_id = create_res.data[0]["id"]

        for raw_tag in item.tags:
            tag_name = _normalized_tag(raw_tag)
            if not tag_name:
                continue

            tag_id = tag_map.get(tag_name)
            if not tag_id:
                create_tag = (
                    sb.table("tags")
                    .upsert({"user_id": user.id, "name": tag_name}, on_conflict="user_id,name")
                    .execute()
                )
                if create_tag.data:
                    tag_id = create_tag.data[0]["id"]
                    tag_map[tag_name] = tag_id
                else:
                    tag_lookup = (
                        sb.table("tags")
                        .select("id")
                        .eq("user_id", user.id)
                        .eq("name", tag_name)
                        .execute()
                    )
                    if tag_lookup.data:
                        tag_id = tag_lookup.data[0]["id"]
                        tag_map[tag_name] = tag_id

            if tag_id:
                sb.table("item_tags").upsert({"item_id": item_id, "tag_id": tag_id}).execute()
                attached_tag_links += 1

    return {
        "imported_count": imported_count,
        "attached_tag_links": attached_tag_links,
    }


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


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_item(body: ItemCreate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    row = body.model_dump(exclude_none=True)
    row["user_id"] = user.id

    row.setdefault("state", "inbox")
    row.setdefault("is_archived", False)
    row.setdefault("is_pinned", False)
    row = enforce_archive_rules(row)

    response = sb.table("items").insert(row).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create item")
    return response.data[0]


@router.patch("/{item_id}")
async def update_item(item_id: str, body: ItemUpdate, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_item_owned(sb, item_id, user.id)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    updates = enforce_archive_rules(updates)
    response = sb.table("items").update(updates).eq("id", item_id).eq("user_id", user.id).execute()
    return response.data[0]


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str, user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase()
    _ensure_item_owned(sb, item_id, user.id)
    sb.table("items").delete().eq("id", item_id).eq("user_id", user.id).execute()
