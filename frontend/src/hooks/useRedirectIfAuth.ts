"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Redirects to `redirectTo` if the user IS already signed in.
 * Uses getSession() (local, no network call) for speed.
 * Returns `true` while the auth check is still in progress.
 */
export function useRedirectIfAuth(redirectTo = "/"): boolean {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session) {
          router.replace(redirectTo);
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router, redirectTo]);

  return checking;
}
