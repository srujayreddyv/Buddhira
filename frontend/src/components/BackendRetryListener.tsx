"use client";

import { useEffect } from "react";
import { BACKEND_RETRY_EVENT } from "@/lib/api";
import { useToast } from "@/components/Toast";

/**
 * Listens for backend retry (cold start). Shows a toast so the user knows the app is retrying.
 */
export function BackendRetryListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handler = () => {
      toast("Backend waking up, retrying…", "info");
    };
    window.addEventListener(BACKEND_RETRY_EVENT, handler);
    return () => window.removeEventListener(BACKEND_RETRY_EVENT, handler);
  }, [toast]);

  return null;
}
