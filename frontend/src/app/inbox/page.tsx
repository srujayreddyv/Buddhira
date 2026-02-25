"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, getApiBaseUrl, warmupHealth } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/lib/supabaseClient";
import type { Item, ItemState, ItemType, TagWithCount } from "@/lib/types";
import {
  Search,
  Plus,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Zap,
  Inbox as InboxIcon,
  StickyNote,
  Link2,
  Code2,
  Tag,
  PackageOpen,
  SlidersHorizontal,
  X,
  Download,
  Upload,
  CheckSquare,
  Square,
  ArrowDownUp,
} from "lucide-react";

const PAGE_SIZE = 30;

type SortMode = "smart" | "created_desc" | "updated_desc";
type BulkAction = "archive" | "unarchive" | "pin" | "unpin" | "activate" | "inbox" | "delete";

const TYPE_LABELS: Record<ItemType, string> = { note: "Note", link: "Link", snippet: "Snippet" };
const TYPE_ICONS: Record<ItemType, React.ReactNode> = {
  note: <StickyNote className="h-3.5 w-3.5 text-amber-500" />,
  link: <Link2 className="h-3.5 w-3.5 text-blue-500" />,
  snippet: <Code2 className="h-3.5 w-3.5 text-emerald-500" />,
};
const STATE_LABELS: Record<ItemState, string> = { inbox: "Inbox", active: "Active", archive: "Archive" };
const STATE_COLORS: Record<ItemState, string> = {
  inbox: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  archive: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
};
const SORT_LABELS: Record<SortMode, string> = {
  smart: "Smart (Pinned + Recent)",
  created_desc: "Newest created",
  updated_desc: "Recently updated",
};

function InboxSkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
      {Array.from({ length: rows }).map((_, idx) => (
        <li key={idx} className="flex items-start gap-3 px-4 py-3">
          <div className="mt-1 h-4 w-4 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="flex items-center gap-1 opacity-60">
            <div className="h-7 w-7 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-7 w-7 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function applyPatchToItem(item: Item, patch: Record<string, unknown>): Item {
  const updated = { ...item, ...patch } as Item;
  if (patch.is_archived === true) {
    updated.state = "archive";
    updated.is_archived = true;
  } else if (patch.is_archived === false) {
    updated.is_archived = false;
    if (updated.state === "archive") updated.state = "inbox";
  }
  if (patch.state === "archive") updated.is_archived = true;
  if ((patch.state === "inbox" || patch.state === "active") && patch.is_archived !== true) {
    updated.is_archived = false;
  }
  return updated;
}

function InboxContent() {
  const authChecking = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterType, setFilterType] = useState<ItemType | "">((searchParams.get("type") as ItemType) ?? "");
  const [filterState, setFilterState] = useState<ItemState | "">((searchParams.get("state") as ItemState) ?? "");
  const [filterTag, setFilterTag] = useState(searchParams.get("tag") ?? "");
  const [showArchived, setShowArchived] = useState(searchParams.get("is_archived") === "true");
  const [sort, setSort] = useState<SortMode>((searchParams.get("sort") as SortMode) || "smart");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const importInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = Boolean(search.trim() || filterType || filterState || filterTag || showArchived || sort !== "smart");
  const activeFilters: string[] = [];
  if (search.trim()) activeFilters.push(`Search: "${search.trim()}"`);
  if (filterType) activeFilters.push(`Type: ${TYPE_LABELS[filterType]}`);
  if (filterState) activeFilters.push(`State: ${STATE_LABELS[filterState]}`);
  if (filterTag) activeFilters.push(`Tag: ${filterTag}`);
  if (showArchived) activeFilters.push("Archived included");
  if (sort !== "smart") activeFilters.push(`Sort: ${SORT_LABELS[sort]}`);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => items.map((i) => i.id), [items]);

  const fetchItems = useCallback(
    async ({ offset = 0, append = false }: { offset?: number; append?: boolean } = {}) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setLoadError(null);
      }

      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterType) params.set("type", filterType);
      if (filterState) params.set("state", filterState);
      if (filterTag) params.set("tag", filterTag);
      if (showArchived) params.set("is_archived", "true");
      params.set("sort", sort);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      try {
        const data = await apiFetch<Item[]>(`/api/items?${params.toString()}`);
        const next = data ?? [];
        setHasMore(next.length === PAGE_SIZE);
        setItems((prev) => (append ? [...prev, ...next] : next));
        if (!append) setSelectedIds([]);
      } catch (err) {
        if (!append) {
          setItems([]);
          setLoadError(err instanceof Error ? err.message : "Could not load inbox");
        }
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [search, filterType, filterState, filterTag, showArchived, sort],
  );

  useEffect(() => {
    if (!authChecking) {
      warmupHealth();
      fetchItems({ offset: 0, append: false });
    }
  }, [fetchItems, authChecking]);

  useEffect(() => {
    if (!authChecking) apiFetch<TagWithCount[]>("/api/tags").then(setTags).catch(() => {});
  }, [authChecking]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllVisible() {
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(visibleIds);
  }

  function itemTags(item: Item): string[] {
    return (item.item_tags ?? []).map((it) => it.tags?.name).filter(Boolean);
  }

  function resetFilters() {
    setSearch("");
    setFilterType("");
    setFilterState("");
    setFilterTag("");
    setShowArchived(false);
    setSort("smart");
  }

  async function quickAction(id: string, patch: Record<string, unknown>) {
    const prev = items.find((i) => i.id === id);
    if (!prev) return;

    setActioningId(id);
    setItems((curr) => curr.map((item) => (item.id === id ? applyPatchToItem(item, patch) : item)));

    try {
      await apiFetch(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (patch.is_archived === true) toast("Archived");
      else if (patch.is_archived === false) toast("Unarchived");
      else if (patch.is_pinned === true) toast("Pinned");
      else if (patch.is_pinned === false) toast("Unpinned");
      else if (patch.state) toast(`Moved to ${patch.state}`);
    } catch {
      setItems((curr) => curr.map((item) => (item.id === id ? prev : item)));
      toast("Action failed", "error");
    } finally {
      setActioningId(null);
    }
  }

  async function runBulkAction(action: BulkAction) {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await apiFetch("/api/items/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids: selectedIds }),
      });
      setSelectedIds([]);
      await fetchItems({ offset: 0, append: false });
      toast(`Bulk ${action} done`);
    } catch {
      toast("Bulk action failed", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportJson() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch(`${getApiBaseUrl()}/api/items/export`, { headers });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buddhira-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Export ready");
    } catch {
      toast("Export failed", "error");
    }
  }

  async function importJson(file: File) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await apiFetch<{ imported_count: number; attached_tag_links: number }>("/api/items/import", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast(`Imported ${result.imported_count} items`);
      await fetchItems({ offset: 0, append: false });
    } catch {
      toast("Import failed", "error");
    }
  }

  if (authChecking) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <InboxSkeletonRows />
      </div>
    );
  }

  if (loading && items.length === 0 && !loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <InboxSkeletonRows rows={5} />
      </div>
    );
  }

  if (loadError && items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">Could not load inbox</p>
          <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
          <button
            type="button"
            onClick={() => fetchItems({ offset: 0, append: false })}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const pinned = items.filter((i) => i.is_pinned);
  const rest = items.filter((i) => !i.is_pinned);

  const renderList = (list: Item[]) => (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
      {list.map((item) => (
        <li key={item.id} className="group flex items-start gap-3 px-4 py-3">
          <button
            type="button"
            aria-label={selectedSet.has(item.id) ? "Deselect item" : "Select item"}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelected(item.id);
            }}
            className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {selectedSet.has(item.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>

          <div className="mt-0.5 w-4 shrink-0 text-center">{item.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}</div>

          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/item/${item.id}`)}>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                {TYPE_ICONS[item.type]}
                {item.type}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATE_COLORS[item.state]}`}>{STATE_LABELS[item.state]}</span>
            </div>
            <p className="mt-0.5 truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.title || "Untitled"}</p>
            {item.content && <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{item.content.slice(0, 120)}</p>}
            {itemTags(item).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {itemTags(item).map((tag) => (
                  <span key={tag} className="flex items-center gap-0.5 rounded bg-zinc-100/70 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-500">
                    <Tag className="h-3 w-3 text-zinc-500 dark:text-zinc-500" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => quickAction(item.id, { is_pinned: !item.is_pinned })}
              aria-label={item.is_pinned ? "Unpin item" : "Pin item"}
              disabled={actioningId === item.id}
              title={item.is_pinned ? "Unpin" : "Pin"}
              className="rounded p-1.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-zinc-800 dark:focus-visible:ring-amber-500"
            >
              {item.is_pinned ? <PinOff className="h-4 w-4 text-amber-500 dark:text-amber-300" /> : <Pin className="h-4 w-4 text-amber-400 dark:text-amber-300" />}
            </button>
            <button
              type="button"
              onClick={() => quickAction(item.id, { is_archived: !item.is_archived })}
              aria-label={item.is_archived ? "Unarchive item" : "Archive item"}
              disabled={actioningId === item.id}
              title={item.is_archived ? "Unarchive" : "Archive"}
              className="rounded p-1.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-zinc-800 dark:focus-visible:ring-orange-500"
            >
              {item.is_archived ? <ArchiveRestore className="h-4 w-4 text-orange-500 dark:text-orange-300" /> : <Archive className="h-4 w-4 text-orange-400 dark:text-orange-300" />}
            </button>
            {item.state !== "active" && !item.is_archived && (
              <button
                type="button"
                onClick={() => quickAction(item.id, { state: "active" })}
                aria-label="Move item to active"
                disabled={actioningId === item.id}
                title="Activate"
                className="rounded p-1.5 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-green-900/30 dark:focus-visible:ring-emerald-500"
              >
                <Zap className="h-4 w-4 text-emerald-500 dark:text-emerald-300" />
              </button>
            )}
            {item.state === "active" && (
              <button
                type="button"
                onClick={() => quickAction(item.id, { state: "inbox" })}
                aria-label="Move item to inbox"
                disabled={actioningId === item.id}
                title="Move to Inbox"
                className="rounded p-1.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-blue-900/30 dark:focus-visible:ring-blue-500"
              >
                <InboxIcon className="h-4 w-4 text-blue-500 dark:text-blue-300" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:pb-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importJson(file);
          e.currentTarget.value = "";
        }}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          <InboxIcon className="h-6 w-6 text-blue-500" />
          Inbox
        </h1>
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={exportJson}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <Link
            href="/new"
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4 text-emerald-300 dark:text-emerald-600" />
            New item
          </Link>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{selectedIds.length} selected</span>
          <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("pin")} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800">Pin</button>
          <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("unpin")} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800">Unpin</button>
          <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("archive")} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800">Archive</button>
          <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("unarchive")} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800">Unarchive</button>
          <button type="button" disabled={bulkBusy} onClick={() => runBulkAction("delete")} className="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20">Delete</button>
          <button type="button" onClick={() => setSelectedIds([])} className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800">Clear</button>
        </div>
      )}

      <div className="mb-3 md:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-1 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus-visible:ring-zinc-500"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
            Filters
            {hasActiveFilters && (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">{activeFilters.length}</span>
            )}
          </span>
          {filtersOpen ? <X className="h-4 w-4 text-zinc-500" /> : <span className="text-xs text-zinc-500">Open</span>}
        </button>
      </div>

      <div className={`mb-4 flex flex-col items-stretch gap-2 md:flex md:flex-row md:flex-wrap md:items-center ${filtersOpen ? "md:flex" : "hidden md:flex"}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 md:w-48 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as ItemType | "")} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 md:w-auto dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="">All types</option>
          {(["note", "link", "snippet"] as ItemType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value as ItemState | "")} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 md:w-auto dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="">All states</option>
          {(["inbox", "active", "archive"] as ItemState[]).map((s) => (
            <option key={s} value={s}>{STATE_LABELS[s]}</option>
          ))}
        </select>
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 md:w-auto dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>{t.name} ({t.item_count})</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 md:w-auto dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="smart">Smart (Pinned + Recent)</option>
          <option value="created_desc">Newest created</option>
          <option value="updated_desc">Recently updated</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-zinc-300 dark:border-zinc-600" />
          <Archive className="h-3.5 w-3.5 text-orange-500" />
          Archived
        </label>
        {hasActiveFilters && (
          <button type="button" onClick={resetFilters} className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            Reset filters
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((label) => (
            <span key={label} className="rounded-full border border-zinc-200 bg-zinc-100/80 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{label}</span>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <button type="button" onClick={toggleSelectAllVisible} className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800">
            <ArrowDownUp className="h-3 w-3" />
            {visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id)) ? "Clear visible" : "Select visible"}
          </button>
          <span>{items.length} loaded</span>
        </div>
      )}

      {loading ? (
        <InboxSkeletonRows rows={3} />
      ) : items.length === 0 ? (
        hasActiveFilters ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No items match your current filters.</p>
            <button type="button" onClick={resetFilters} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">Clear filters</button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Your inbox is clear. Capture a thought or link and it’ll show up here.</p>
            <Link href="/new" className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
              <Plus className="h-4 w-4 text-emerald-500" /> Capture something
            </Link>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                <Pin className="h-3.5 w-3.5" /> Pinned
              </h2>
              {renderList(pinned)}
            </section>
          )}
          {rest.length > 0 && <section>{renderList(rest)}</section>}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => fetchItems({ offset: items.length, append: true })}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 md:hidden">
        <button
          type="button"
          aria-label="Export items"
          onClick={exportJson}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Import items"
          onClick={() => importInputRef.current?.click()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 shadow hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          <Upload className="h-4 w-4" />
        </button>
        <Link
          href="/new"
          aria-label="New item"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-emerald-500"
        >
          <Plus className="h-5 w-5 text-emerald-300 dark:text-emerald-600" />
        </Link>
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-6">
          <InboxSkeletonRows />
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
