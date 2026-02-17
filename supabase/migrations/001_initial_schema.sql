-- Buddhira initial schema — run once on a fresh Supabase project (SQL Editor).
-- Re-running on the same DB will fail on "already exists"; for a new project it is safe to run as-is.
-- Tables, constraints, indexes for list queries (user_id + state/archived/pinned/created_at), and ilike search (pg_trgm).

-- =============================================================================
-- Extension for ilike search (title, content)
-- =============================================================================
create extension if not exists pg_trgm;

-- =============================================================================
-- Tables
-- =============================================================================

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  type        text not null check (type in ('note','link','snippet')),
  title       text,
  content     text,
  url         text,
  state       text not null default 'inbox' check (state in ('inbox','active','archive')),
  why_this_matters text,
  is_pinned   boolean not null default false,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.items is 'Notes, links, snippets — scoped by user_id. API always filters by user_id.';

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.item_tags (
  item_id    uuid not null references public.items(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

-- =============================================================================
-- Trigger: auto-update updated_at on items
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Indexes for list queries (backend filters by user_id, then state/archived/pinned, order by created_at)
-- =============================================================================

-- Single-item lookup: user_id + id (enforces “user_id plus item id” scope for get/update/delete)
create unique index idx_items_user_id_id on public.items (user_id, id);

-- List ordering: user_id, then is_pinned desc, created_at desc
create index idx_items_user_pinned_created_at on public.items (user_id, is_pinned desc, created_at desc);

-- Filters used in list_items
create index idx_items_user_state on public.items (user_id, state);
create index idx_items_user_is_archived on public.items (user_id, is_archived);
create index idx_items_user_is_pinned on public.items (user_id, is_pinned);

-- Tags: list by user, lookup by (user_id, name)
create index idx_tags_user_name on public.tags (user_id, name);

-- Item-tags: lookup by item_id (for select with item_tags), by tag_id (for tag filter)
create index idx_item_tags_item_id on public.item_tags (item_id);
create index idx_item_tags_tag_id on public.item_tags (tag_id);

-- =============================================================================
-- Search: ilike on title and content (backend uses title.ilike.%q%, content.ilike.%q%)
-- =============================================================================

create index idx_items_title_trgm on public.items using gin (title gin_trgm_ops);
create index idx_items_content_trgm on public.items using gin (content gin_trgm_ops);

-- =============================================================================
-- RLS (defense-in-depth; API uses service_role and scopes by user_id)
-- =============================================================================

alter table public.items enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;

create policy items_owner on public.items
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tags_owner on public.tags
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- item_tags: allow only when the item belongs to the current user
create policy item_tags_via_items on public.item_tags
  for all
  using (
    exists (select 1 from public.items where items.id = item_tags.item_id and items.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.items where items.id = item_tags.item_id and items.user_id = auth.uid())
  );
