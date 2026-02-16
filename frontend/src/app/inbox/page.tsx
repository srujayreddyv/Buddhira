"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, warmupHealth } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { Item, ItemState, ItemType, TagWithCount } from "@/lib/types";
import {
  Search, Plus, Pin, PinOff, Archive, ArchiveRestore,
  Zap, Inbox as InboxIcon, StickyNote, Link2, Code2,
  Tag, PackageOpen,
} from "lucide-react";

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

function InboxContent() {
  const authChecking = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterType, setFilterType] = useState<ItemType | "">((searchParams.get("type") as ItemType) ?? "");
  const [filterState, setFilterState] = useState<ItemState | "">((searchParams.get("state") as ItemState) ?? "");
  const [filterTag, setFilterTag] = useState(searchParams.get("tag") ?? "");
  const [showArchived, setShowArchived] = useState(searchParams.get("is_archived") === "true");

  const fetchItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filterType) params.set("type", filterType);
    if (filterState) params.set("state", filterState);
    if (filterTag) params.set("tag", filterTag);
    if (showArchived) params.set("is_archived", "true");
    const qs = params.toString();
    try {
      const data = await apiFetch<Item[]>(`/api/items${qs ? `?${qs}` : ""}`);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterState, filterTag, showArchived]);

  useEffect(() => {
    if (!authChecking) {
      warmupHealth();
      fetchItems();
    }
  }, [fetchItems, authChecking]);

  useEffect(() => {
    if (!authChecking) apiFetch<TagWithCount[]>("/api/tags").then(setTags).catch(() => {});
  }, [authChecking]);

  async function quickAction(id: string, patch: Record<string, unknown>) {
    setActioningId(id);
    try {
      await apiFetch(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await fetchItems();
      if (patch.is_archived === true) toast("Archived");
      else if (patch.is_archived === false) toast("Unarchived");
      else if (patch.is_pinned === true) toast("Pinned");
      else if (patch.is_pinned === false) toast("Unpinned");
      else if (patch.state) toast(`Moved to ${patch.state}`);
    } catch {
      toast("Action failed", "error");
    } finally {
      setActioningId(null);
    }
  }

  function itemTags(item: Item): string[] {
    return (item.item_tags ?? []).map((it) => it.tags?.name).filter(Boolean);
  }

  if (authChecking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2">
        <p className="text-sm text-zinc-400">Loading your inbox…</p>
        <p className="text-xs text-zinc-500">First load may take a few seconds if the backend is waking up.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* ── Header row ──────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          <InboxIcon className="h-6 w-6 text-blue-500" />
          Inbox
        </h1>
        <Link
          href="/new"
          className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <Plus className="h-4 w-4 text-emerald-300 dark:text-emerald-600" />
          New item
        </Link>
      </div>

      {/* ── Search & filters ────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-md border border-zinc-300 bg-white py-1.5 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as ItemType | "")}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="">All types</option>
          {(["note", "link", "snippet"] as ItemType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value as ItemState | "")}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="">All states</option>
          {(["inbox", "active", "archive"] as ItemState[]).map((s) => (
            <option key={s} value={s}>{STATE_LABELS[s]}</option>
          ))}
        </select>
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>{t.name} ({t.item_count})</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-600" />
          <Archive className="h-3.5 w-3.5 text-orange-500" />
          Archived
        </label>
      </div>

      {/* ── Items list ──────────────────────────────────────────── */}
      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Your inbox is clear. Capture a thought or link and it’ll show up here.</p>
          <Link href="/new" className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">
            <Plus className="h-4 w-4 text-emerald-500" />
            Capture something
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const pinned = items.filter((i) => i.is_pinned);
            const rest = items.filter((i) => !i.is_pinned);
            const renderList = (list: Item[]) => (
              <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
                {list.map((item) => (
                  <li key={item.id} className="group flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 w-4 shrink-0 text-center">
                {item.is_pinned && <Pin className="h-4 w-4 text-amber-500" />}
              </div>

              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => router.push(`/item/${item.id}`)}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {TYPE_ICONS[item.type]}
                    {item.type}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATE_COLORS[item.state]}`}>
                    {STATE_LABELS[item.state]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.title || "Untitled"}
                </p>
                {item.content && (
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {item.content.slice(0, 120)}
                  </p>
                )}
                {itemTags(item).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {itemTags(item).map((tag) => (
                      <span key={tag} className="flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        <Tag className="h-3 w-3 text-purple-400" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => quickAction(item.id, { is_pinned: !item.is_pinned })}
                  disabled={actioningId === item.id}
                  title={item.is_pinned ? "Unpin" : "Pin"}
                  className="rounded p-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">
                  {item.is_pinned ? <PinOff className="h-4 w-4 text-amber-500" /> : <Pin className="h-4 w-4 text-amber-400" />}
                </button>
                <button type="button" onClick={() => quickAction(item.id, { is_archived: !item.is_archived })}
                  disabled={actioningId === item.id}
                  title={item.is_archived ? "Unarchive" : "Archive"}
                  className="rounded p-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">
                  {item.is_archived ? <ArchiveRestore className="h-4 w-4 text-orange-500" /> : <Archive className="h-4 w-4 text-orange-400" />}
                </button>
                {item.state !== "active" && !item.is_archived && (
                  <button type="button" onClick={() => quickAction(item.id, { state: "active" })}
                    disabled={actioningId === item.id}
                    title="Activate"
                    className="rounded p-1.5 hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-900/30">
                    <Zap className="h-4 w-4 text-emerald-500" />
                  </button>
                )}
                {item.state === "active" && (
                  <button type="button" onClick={() => quickAction(item.id, { state: "inbox" })}
                    disabled={actioningId === item.id}
                    title="Move to Inbox"
                    className="rounded p-1.5 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-900/30">
                    <InboxIcon className="h-4 w-4 text-blue-500" />
                  </button>
                )}
              </div>
            </li>
                ))}
              </ul>
            );
            return (
              <>
                {pinned.length > 0 && (
                  <section>
                    <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <Pin className="h-3.5 w-3.5" />
                      Pinned
                    </h2>
                    {renderList(pinned)}
                  </section>
                )}
                {rest.length > 0 && <section>{renderList(rest)}</section>}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}
