"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Redirects to /login if the user is NOT signed in.
 * Uses getSession() (local, no network call) for speed.
 * Returns `true` while the check is in progress.
 */
export function useRequireAuth(): boolean {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        router.replace("/login");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return checking;
}
