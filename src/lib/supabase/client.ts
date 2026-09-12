/**
 * Browser-side Supabase client (auth + Postgres + Storage).
 *
 * PieceMark talks to Supabase directly from the browser. There is no app
 * server in the data path: every table is protected by Row Level Security
 * (`user_id = auth.uid()`), so the publishable key can only ever act as the
 * signed-in user. Sessions are kept in cookies by `@supabase/ssr` so a server
 * client could read them later if server-side rendering of user data is ever
 * wanted; today SSR renders the signed-out shell and the client hydrates.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as
  | string
  | undefined;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when both env values are present (see .env.example). */
export const supabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

let client: SupabaseClient | null = null;

/** Lazy singleton. Throws when Supabase env is missing — callers gate on `supabaseConfigured`. */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  client ??= createBrowserClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!);
  return client;
}

export function errorMessage(e: unknown, fallback = "Request failed"): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return e instanceof Error && e.message ? e.message : fallback;
}
