import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Build-safe fallback values so Next.js prerender in CI does not crash when
// NEXT_PUBLIC_* env vars are not provided at build time.
const fallbackUrl = "http://127.0.0.1:54321";
const fallbackAnonKey = "public-anon-key";

if (
  typeof window !== "undefined" &&
  (!supabaseUrl || !supabaseAnonKey)
) {
  console.warn(
    "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl || fallbackUrl,
  supabaseAnonKey || fallbackAnonKey
);
