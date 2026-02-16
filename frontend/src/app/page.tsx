"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Brain, LogIn, UserPlus, StickyNote, Link2, Code2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/inbox");
    });
  }, [router]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <main className="flex w-full max-w-3xl flex-col items-center justify-center gap-8 px-16 py-32">
        <div className="flex items-center gap-3">
          <Brain className="h-10 w-10 text-violet-500" />
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Buddhira
          </h1>
        </div>
        <p className="max-w-md text-center text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A second brain for saving notes, links, and code snippets, then
          finding them instantly when you need them.
        </p>

        <div className="flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5">
            <StickyNote className="h-4 w-4 text-amber-500" /> Notes
          </span>
          <span className="flex items-center gap-1.5">
            <Link2 className="h-4 w-4 text-blue-500" /> Links
          </span>
          <span className="flex items-center gap-1.5">
            <Code2 className="h-4 w-4 text-emerald-500" /> Snippets
          </span>
        </div>

        <div className="flex gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <LogIn className="h-4 w-4 text-blue-300 dark:text-blue-600" />
            Sign in
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-md border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <UserPlus className="h-4 w-4 text-emerald-500" />
            Sign up
          </Link>
        </div>
      </main>
    </div>
  );
}
