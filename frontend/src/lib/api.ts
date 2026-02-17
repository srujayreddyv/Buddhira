import { supabase } from "./supabaseClient";

// No hardcoded URLs — set NEXT_PUBLIC_API_BASE_URL (or NEXT_PUBLIC_API_URL) in .env.local
const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

export function getApiBaseUrl(): string {
  return API_URL;
}

/** Timeout for API calls — enough for Render free-tier cold start. */
const API_TIMEOUT_MS = 20_000;
/** Delay before one automatic retry after timeout/network error. */
const RETRY_DELAY_MS = 2_500;

/** Event dispatched before retrying a GET after timeout — listener can show "Backend waking up, retrying…" */
export const BACKEND_RETRY_EVENT = "buddhira:backend-retry";

/**
 * API error shape from backend (single format for all errors).
 * Frontend can always use body.detail for toast messages.
 */
export interface ApiErrorBody {
  detail: string;
  code?: string;
}

function isGetRequest(init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET";
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "AbortError") return true;
    if (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("Failed to fetch")) return true;
  }
  return false;
}

/**
 * Fetch wrapper that automatically attaches the current Supabase
 * access token as a Bearer token in the Authorization header.
 *
 * - Timeout: 20s (survives cold start on Render free tier).
 * - GET only: one automatic retry after 2.5s on timeout/network error (POST/PATCH/DELETE are never retried to avoid duplicates).
 * - Dispatches BACKEND_RETRY_EVENT before retry so UI can show "Backend waking up, retrying…".
 * - On 401: signs out, redirects to /login, then throws (session expired / invalid token).
 * - All errors are thrown as Error with message from body.detail so toasts never break.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  options?: { skipRetry?: boolean }
): Promise<T> {
  const doFetch = async (signal: AbortSignal): Promise<T> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal,
    } as RequestInit);

    if (!res.ok) {
      if (res.status === 401) {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      const message =
        typeof body?.detail === "string"
          ? body.detail
          : `API error ${res.status}: ${res.statusText}`;
      throw new Error(message);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  };

  const run = async (isRetry: boolean): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const result = await doFetch(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      if (
        !isRetry &&
        !options?.skipRetry &&
        isGetRequest(init) &&
        isRetryableError(err)
      ) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(BACKEND_RETRY_EVENT));
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return run(true);
      }
      throw err;
    }
  };

  return run(false);
}

/**
 * Call GET /health in the background to wake the backend (e.g. Render free tier).
 * Uses plain fetch (not apiFetch) so it never triggers the retry toast — warmup stays silent.
 * No auth; use when the user has just landed after login so the next API calls are fast.
 */
export function warmupHealth(): void {
  if (typeof window === "undefined") return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  fetch(`${API_URL}/health`, { signal: controller.signal })
    .then(() => { clearTimeout(timeoutId); })
    .catch(() => { clearTimeout(timeoutId); });
}
