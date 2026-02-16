"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { TagWithCount } from "@/lib/types";
import { Tags as TagsIcon, Tag, Hash, PackageOpen } from "lucide-react";

export default function TagsPage() {
  const authChecking = useRequireAuth();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecking) {
      apiFetch<TagWithCount[]>("/api/tags")
        .then(setTags)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [authChecking]);

  if (authChecking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        <TagsIcon className="h-6 w-6 text-purple-500" />
        Tags
      </h1>

      {loading ? (
        <p className="py-12 text-center text-sm text-zinc-400">Loading…</p>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <PackageOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No tags yet. Create items and add tags to organize your second brain.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/tag/${encodeURIComponent(tag.name)}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-purple-300 hover:bg-purple-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-purple-700 dark:hover:bg-purple-900/10"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Hash className="h-4 w-4 text-purple-500" />
                {tag.name}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <Tag className="h-3 w-3" />
                {tag.item_count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
