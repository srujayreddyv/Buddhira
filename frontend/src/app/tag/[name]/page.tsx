"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { Item, ItemState, ItemType } from "@/lib/types";
import {
  ArrowLeft, Hash, Pin, PinOff, Archive, ArchiveRestore,
  StickyNote, Link2, Code2, Tag, PackageOpen,
} from "lucide-react";

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

export default function TagItemsPage() {
  const authChecking = useRequireAuth();
  const { name } = useParams<{ name: string }>();
  const tagName = decodeURIComponent(name);
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiFetch<Item[]>(`/api/items?tag=${encodeURIComponent(tagName)}&is_archived=false`);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tagName]);

  useEffect(() => {
    if (!authChecking) fetchItems();
  }, [fetchItems, authChecking]);

  async function quickAction(id: string, patch: Record<string, unknown>) {
    setActioningId(id);
    try {
      await apiFetch(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await fetchItems();
    } catch {
      // apiFetch throws; 401 already redirects to login
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/tags" className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
          Tags
        </Link>
        <h1 className="flex items-center gap-1.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          <Hash className="h-5 w-5 text-purple-500" />
          {tagName}
        </h1>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-400">Loading…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing with this tag yet. Tag an item when you create or edit it to see it here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((item) => (
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
                    {itemTags(item).map((t) => (
                      <span key={t} className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs ${
                        t === tagName
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        <Tag className="h-3 w-3 text-purple-400" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button type="button" onClick={() => quickAction(item.id, { is_pinned: !item.is_pinned })}
                  aria-label={item.is_pinned ? "Unpin item" : "Pin item"}
                  disabled={actioningId === item.id}
                  title={item.is_pinned ? "Unpin" : "Pin"}
                  className="rounded p-1.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-zinc-800 dark:focus-visible:ring-amber-500">
                  {item.is_pinned ? <PinOff className="h-4 w-4 text-amber-500 dark:text-amber-300" /> : <Pin className="h-4 w-4 text-amber-400 dark:text-amber-300" />}
                </button>
                <button type="button" onClick={() => quickAction(item.id, { is_archived: !item.is_archived })}
                  aria-label={item.is_archived ? "Unarchive item" : "Archive item"}
                  disabled={actioningId === item.id}
                  title={item.is_archived ? "Unarchive" : "Archive"}
                  className="rounded p-1.5 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1 disabled:opacity-50 dark:hover:bg-zinc-800 dark:focus-visible:ring-orange-500">
                  {item.is_archived ? <ArchiveRestore className="h-4 w-4 text-orange-500 dark:text-orange-300" /> : <Archive className="h-4 w-4 text-orange-400 dark:text-orange-300" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
