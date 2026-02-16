"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { Item, ItemState, ItemType, TagWithCount } from "@/lib/types";
import {
  ArrowLeft, Pencil, Trash2, Save, X, Pin, PinOff,
  Inbox, Zap, Archive, Tag, StickyNote, Link2, Code2,
  ExternalLink, Lightbulb, Calendar,
} from "lucide-react";

const STATE_LABELS: Record<ItemState, string> = { inbox: "Inbox", active: "Active", archive: "Archive" };
const STATE_ICONS: Record<ItemState, React.ReactNode> = {
  inbox: <Inbox className="h-3.5 w-3.5 text-blue-500" />,
  active: <Zap className="h-3.5 w-3.5 text-emerald-500" />,
  archive: <Archive className="h-3.5 w-3.5 text-orange-500" />,
};
const TYPE_ICONS: Record<ItemType, React.ReactNode> = {
  note: <StickyNote className="h-3.5 w-3.5 text-amber-500" />,
  link: <Link2 className="h-3.5 w-3.5 text-blue-500" />,
  snippet: <Code2 className="h-3.5 w-3.5 text-emerald-500" />,
};

export default function ItemDetailPage() {
  const authChecking = useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [item, setItem] = useState<Item | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || deleting || actioning;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [whyThisMatters, setWhyThisMatters] = useState("");

  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [tagInput, setTagInput] = useState("");

  async function fetchItem() {
    try {
      const data = await apiFetch<Item>(`/api/items/${id}`);
      setItem(data);
      setTitle(data.title ?? "");
      setContent(data.content ?? "");
      setUrl(data.url ?? "");
      setWhyThisMatters(data.why_this_matters ?? "");
    } catch {
      setError("Item not found");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authChecking) {
      fetchItem();
      apiFetch<TagWithCount[]>("/api/tags").then(setAllTags).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authChecking]);

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Item>(`/api/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title || null,
          content: content || null,
          url: url || null,
          why_this_matters: whyThisMatters || null,
        }),
      });
      setItem({ ...item, ...updated });
      setEditing(false);
      toast("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this item permanently?")) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/items/${id}`, { method: "DELETE" });
      toast("Deleted");
      router.push("/inbox");
    } catch {
      toast("Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function quickPatch(patch: Record<string, unknown>) {
    if (!item) return;
    setActioning(true);
    try {
      const updated = await apiFetch<Item>(`/api/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setItem({ ...item, ...updated });
      if (patch.is_pinned === true) toast("Pinned");
      else if (patch.is_pinned === false) toast("Unpinned");
      else if (patch.state) toast(`Moved to ${patch.state}`);
    } catch {
      toast("Action failed", "error");
    } finally {
      setActioning(false);
    }
  }

  async function addTag(name: string) {
    if (!item) return;
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return;
    let tag = allTags.find((t) => t.name === trimmed);
    if (!tag) {
      tag = await apiFetch<TagWithCount>("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setAllTags((prev) => [...prev, tag!]);
    }
    try {
      await apiFetch(`/api/items/${id}/tags`, {
        method: "POST",
        body: JSON.stringify({ tag_id: tag.id }),
      });
      await fetchItem();
    } catch {}
    setTagInput("");
  }

  async function removeTag(tagId: string) {
    try {
      await apiFetch(`/api/items/${id}/tags/${tagId}`, { method: "DELETE" });
      await fetchItem();
    } catch {}
  }

  function itemTagNames(): { id: string; name: string }[] {
    return (item?.item_tags ?? [])
      .map((it) => ({ id: it.tag_id, name: it.tags?.name }))
      .filter((t): t is { id: string; name: string } => !!t.name);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!item) return null;

  if (authChecking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* ── Controls bar ────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => router.push("/inbox")}
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex-1" />

        {/* State controls */}
        {(["inbox", "active", "archive"] as ItemState[]).map((s) => (
          <button key={s} type="button" onClick={() => quickPatch({ state: s })} disabled={item.state === s || busy}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              item.state === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}>
            {item.state === s ? STATE_ICONS[s] : STATE_ICONS[s]}
            {STATE_LABELS[s]}
          </button>
        ))}

        <button type="button" onClick={() => quickPatch({ is_pinned: !item.is_pinned })} disabled={busy}
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
            item.is_pinned
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              : "border border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
          }`}>
          {item.is_pinned ? <PinOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" /> : <Pin className="h-3.5 w-3.5 text-amber-400" />}
          {item.is_pinned ? "Unpin" : "Pin"}
        </button>

        <button type="button" onClick={handleDelete} disabled={busy}
          className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20">
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {/* ── Detail / Edit ───────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
          <span className="flex items-center gap-1 font-medium uppercase tracking-wide">
            {TYPE_ICONS[item.type]}
            {item.type}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-sky-400" />
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>

        {editing ? (
          <div className="space-y-4">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-lg font-semibold text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Title" autoFocus />
            {item.type === "link" && (
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="https://…" />
              </div>
            )}
            <textarea rows={item.type === "snippet" ? 10 : 6} value={content} onChange={(e) => setContent(e.target.value)}
              className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 ${item.type === "snippet" ? "font-mono" : ""}`}
              placeholder="Content…" />
            <div className="relative">
              <Lightbulb className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
              <input type="text" value={whyThisMatters} onChange={(e) => setWhyThisMatters(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                placeholder="Why this matters…" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
                <Save className="h-4 w-4 text-emerald-300 dark:text-emerald-600" />
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => {
                  setEditing(false);
                  setTitle(item.title ?? "");
                  setContent(item.content ?? "");
                  setUrl(item.url ?? "");
                  setWhyThisMatters(item.why_this_matters ?? "");
                }}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <X className="h-4 w-4 text-zinc-400" />
                Cancel
              </button>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {item.title || "Untitled"}
              </h2>
              <button type="button" onClick={() => setEditing(true)}
                className="flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Pencil className="h-3.5 w-3.5 text-blue-400" />
                Edit
              </button>
            </div>
            {item.type === "link" && item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="mt-1 flex items-center gap-1 truncate text-sm text-blue-600 hover:underline dark:text-blue-400">
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                {item.url}
              </a>
            )}
            {item.content && (
              <div className={`mt-4 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 ${
                item.type === "snippet" ? "rounded bg-zinc-50 p-3 font-mono dark:bg-zinc-800" : ""
              }`}>
                {item.content}
              </div>
            )}
            {item.why_this_matters && (
              <div className="mt-4 flex items-start gap-2 rounded border-l-2 border-amber-400 bg-amber-50 py-2 pl-3 pr-2 text-sm text-amber-900 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-medium">Why this matters:</span> {item.why_this_matters}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Tags editor ─────────────────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Tag className="h-4 w-4 text-purple-500" />
          Tags
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {itemTagNames().map((tag) => (
            <span key={tag.id}
              className="flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              <Tag className="h-3 w-3 text-purple-400" />
              {tag.name}
              <button type="button" onClick={() => removeTag(tag.id)} className="text-purple-300 hover:text-purple-500 dark:text-purple-500 dark:hover:text-purple-300">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
            onBlur={() => tagInput && addTag(tagInput)}
            className="min-w-[80px] flex-1 border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            placeholder="Add tag…" list="detail-tag-suggestions" />
          <datalist id="detail-tag-suggestions">
            {allTags.filter((t) => !itemTagNames().some((it) => it.name === t.name)).map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
