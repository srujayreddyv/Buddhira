"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Brain, Inbox, Plus, Tags, LogOut, LogIn, UserPlus } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href={user ? "/inbox" : "/"}
            className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100"
          >
            <Brain className="h-5 w-5 text-violet-500" />
            Buddhira
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 sm:flex">
              <Link
                href="/inbox"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Inbox className="h-4 w-4 text-blue-500" />
                Inbox
              </Link>
              <Link
                href="/new"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Plus className="h-4 w-4 text-emerald-500" />
                New
              </Link>
              <Link
                href="/tags"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Tags className="h-4 w-4 text-purple-500" />
                Tags
              </Link>
            </nav>
          )}
        </div>

        <nav className="flex items-center gap-3">
          <ThemeToggle />

          {loading ? (
            <span className="h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
          ) : user ? (
            <>
              <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-500" />
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                <LogIn className="h-4 w-4 text-blue-500" />
                Sign in
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <UserPlus className="h-4 w-4 text-emerald-300 dark:text-emerald-600" />
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
