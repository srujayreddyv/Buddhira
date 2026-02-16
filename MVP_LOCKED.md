# MVP locked — scope frozen

**Do not add features.** This document defines the MVP. No scope creep.

---

## The product (tagline)

**“A second brain for saving notes, links, and code snippets, then finding them instantly when you need them.”**

---

## The one question the MVP answers

**Why would someone use Buddhira instead of a notes app?**

- **Notes apps** = mostly one type of content, generic search.
- **Buddhira** = three distinct types (note, link, snippet), tagged and filterable, so you can **find the right thing instantly** by type, tag, or search — not just a single blob of notes.

The MVP delivers only that. Nothing else.

---

## Core objects (only these three)

| Type     | What it is |
|----------|------------|
| **Note** | Free-form text (ideas, thoughts, copy). |
| **Link** | URL + title + optional notes (bookmarks, references). |
| **Snippet** | Code or command-line snippet (reusable bits). |

**Nothing else right now.** No tasks, no projects, no folders, no custom types.

---

## In scope (MVP only)

- **Capture** — create and edit note, link, or snippet.
- **Search and filter** — by text, type (note/link/snippet), state, tag, archived.
- **Tags with counts** — list tags, filter items by tag.
- **States** — inbox, active, archive.
- **Pin and archive** — pin/unpin, archive/unarchive.
- **Auth and user isolation** — sign up, sign in, reset password; all data scoped by user.

---

## Explicitly out of scope (do not add yet)

- **Dashboards** — no analytics, charts, or overview screens beyond the inbox/list.
- **Agents** — no automated assistants or bots.
- **RAG / retrieval-augmented anything** — no semantic search, embeddings, or “AI memory.”
- **AI features** — no summarization, suggestions, or AI-generated content.
- **Tasks / todos** — no due dates, checkboxes, or task management.
- **Collaboration** — no sharing, teams, or multi-user editing.
- **Integrations** — no browser extensions, Slack, or third-party sync in MVP.

When in doubt: if it’s not “capture a note/link/snippet and find it instantly,” it’s out of scope.

---

## MVP completion checklist

| MVP item | Backend | Frontend | Status |
|----------|---------|----------|--------|
| **Capture** — create note, link, snippet | ✅ POST `/api/items` with `type` (note/link/snippet), title, content, url | ✅ `/new` — type selector, form, tags; creates item + attaches tags | ✅ Done |
| **Capture** — edit item | ✅ PATCH `/api/items/{id}` | ✅ `/item/[id]` — edit mode, save, add/remove tags | ✅ Done |
| **Search and filter** — text, type, state, tag, archived | ✅ GET `/api/items` — `q`, `type`, `state`, `tag`, `is_archived` | ✅ Inbox — search box, “All types”, “All states”, “All tags”, “Archived” checkbox | ✅ Done |
| **Tags with counts** — list tags, filter by tag | ✅ GET `/api/tags` returns `item_count`; list items filtered by `tag` | ✅ `/tags` — tags with counts; `/tag/[name]` — items for tag; inbox tag filter | ✅ Done |
| **States** — inbox, active, archive | ✅ `state` in DB and API; default inbox; archive sync | ✅ Inbox state filter; quick actions “Activate”, “Move to Inbox” | ✅ Done |
| **Pin and archive** — pin/unpin, archive/unarchive | ✅ PATCH `is_pinned`, `is_archived`; ordering pinned first | ✅ Inbox quick actions: Pin/Unpin, Archive/Unarchive; pinned section header | ✅ Done |
| **Auth and user isolation** | ✅ JWT via JWKS; all queries `.eq("user_id", user.id)` | ✅ Sign up, login, forgot-password, reset-password; 401 → sign out + redirect | ✅ Done |

**All MVP tasks are complete.** The app delivers: capture (note/link/snippet), find (search + filters + tags), and organize (states, pin, archive) with full user isolation.
