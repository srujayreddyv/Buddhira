"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { Item, ItemType, TagWithCount } from "@/lib/types";
import { StickyNote, Link2, Code2, Save, X, Tag, Lightbulb } from "lucide-react";

const TYPE_CONFIG: Record<ItemType, { icon: React.ReactNode; color: string; label: string }> = {
  note: { icon: <StickyNote className="h-4 w-4" />, color: "text-amber-500", label: "Note" },
  link: { icon: <Link2 className="h-4 w-4" />, color: "text-blue-500", label: "Link" },
  snippet: { icon: <Code2 className="h-4 w-4" />, color: "text-emerald-500", label: "Snippet" },
};

export default function NewItemPage() {
  const authChecking = useRequireAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [type, setType] = useState<ItemType>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [whyThisMatters, setWhyThisMatters] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authChecking) apiFetch<TagWithCount[]>("/api/tags").then(setAllTags).catch(() => {});
  }, [authChecking]);

  function addTag(name: string) {
    const trimmed = name.trim().toLowerCase();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }

  function removeTag(name: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== name));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const item = await apiFetch<Item>("/api/items", {
        method: "POST",
        body: JSON.stringify({
          type,
          title: title || null,
          content: content || null,
          url: url || null,
          why_this_matters: whyThisMatters || null,
        }),
      });
      for (const tagName of selectedTags) {
        let tagObj = allTags.find((t) => t.name === tagName);
        if (!tagObj) {
          tagObj = await apiFetch<TagWithCount>("/api/tags", {
            method: "POST",
            body: JSON.stringify({ name: tagName }),
          });
        }
        await apiFetch(`/api/items/${item.id}/tags`, {
          method: "POST",
          body: JSON.stringify({ tag_id: tagObj.id }),
        });
      }
      toast("Saved");
      router.push(`/item/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      toast("Save failed", "error");
      setSaving(false);
    }
  }

  if (authChecking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        <span className={TYPE_CONFIG[type].color}>{TYPE_CONFIG[type].icon}</span>
        New {TYPE_CONFIG[type].label}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type selector */}
        <div className="flex gap-2">
          {(["note", "link", "snippet"] as ItemType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                type === t
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className={type === t ? "" : TYPE_CONFIG[t].color}>{TYPE_CONFIG[t].icon}</span>
              {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Title</label>
          <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder={type === "link" ? "Bookmark title" : "What is this about?"} autoFocus />
        </div>

        {/* URL — links only */}
        {type === "link" && (
          <div>
            <label htmlFor="url" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Link2 className="h-4 w-4 text-blue-500" /> URL
            </label>
            <input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="https://…" />
          </div>
        )}

        {/* Content */}
        <div>
          <label htmlFor="content" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {type === "snippet" ? "Code / Snippet" : "Content"}
          </label>
          <textarea id="content" rows={type === "snippet" ? 8 : 4} value={content} onChange={(e) => setContent(e.target.value)}
            className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 ${type === "snippet" ? "font-mono" : ""}`}
            placeholder={type === "snippet" ? "Paste your code here…" : type === "link" ? "Why did you save this?" : "Your thoughts…"} />
        </div>

        {/* Why this matters */}
        <div>
          <label htmlFor="why" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Why this matters <span className="text-zinc-400">(optional)</span>
          </label>
          <input id="why" type="text" value={whyThisMatters} onChange={(e) => setWhyThisMatters(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Future you will thank you for this note…" />
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <Tag className="h-4 w-4 text-purple-500" /> Tags
          </label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800">
            {selectedTags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <Tag className="h-3 w-3 text-purple-400" />
                {tag}
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => removeTag(tag)}
                  className="rounded p-0.5 text-purple-500 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-1 dark:text-purple-300 dark:hover:text-purple-200 dark:focus-visible:ring-purple-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
              onBlur={() => tagInput && addTag(tagInput)}
              className="min-w-[80px] flex-1 border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              placeholder="Add tag…" list="tag-suggestions" />
            <datalist id="tag-suggestions">
              {allTags.filter((t) => !selectedTags.includes(t.name)).map((t) => (<option key={t.id} value={t.name} />))}
            </datalist>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
            <Save className="h-4 w-4 text-emerald-300 dark:text-emerald-600" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <X className="h-4 w-4 text-zinc-400" />
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
