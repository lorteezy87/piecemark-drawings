import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { authEnabled } from "./client";
import { getSupabase } from "@/lib/supabase/client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the local-only fallback (auth disabled / not configured). */
  isDevFallback: boolean;
};

/**
 * Stable fallback user, used ONLY when auth is off (`VITE_AUTH_ENABLED=false`
 * or Supabase not configured). Nothing is written to the cloud in that mode.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

const PENDING: CurrentUserState = { user: null, isPending: true };
const DEV_STATE: CurrentUserState = { user: DEV_USER, isPending: false };

let snapshot: CurrentUserState = PENDING;
const listeners = new Set<() => void>();
let started = false;

function toAppUser(u: User | null | undefined): AppUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : null);
  return {
    id: u.id,
    displayName: str("full_name") ?? str("name") ?? null,
    primaryEmail: u.email ?? null,
    profileImageUrl: str("avatar_url") ?? null,
    isDevFallback: false,
  };
}

function publish(next: CurrentUserState) {
  const same =
    next.isPending === snapshot.isPending &&
    next.user?.id === snapshot.user?.id &&
    next.user?.displayName === snapshot.user?.displayName &&
    next.user?.primaryEmail === snapshot.user?.primaryEmail;
  if (same) return;
  snapshot = next;
  for (const l of listeners) l();
}

/** Start listening to Supabase Auth once, in the browser only. */
function ensureStarted() {
  if (started || typeof window === "undefined" || !authEnabled) return;
  started = true;
  const sb = getSupabase();
  void sb.auth
    .getSession()
    .then(({ data }) =>
      publish({ user: toAppUser(data.session?.user), isPending: false }),
    )
    .catch(() => publish({ user: null, isPending: false }));
  sb.auth.onAuthStateChange((_event, session) => {
    publish({ user: toAppUser(session?.user ?? null), isPending: false });
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  ensureStarted();
  return () => {
    listeners.delete(l);
  };
}

/**
 * Current user + loading state.
 *   - Auth enabled -> the real signed-in user; `user` is `null` while the
 *     session resolves (`isPending: true`) and when signed out (`isPending: false`).
 *   - Auth disabled -> `DEV_USER`, never pending.
 *
 * Guard a route by waiting out `isPending` before acting on `user`:
 *
 *   const { user, isPending } = useCurrentUserState();
 *   if (isPending) return null;
 *   if (!user) return <RedirectToSignIn />;
 *
 * `authEnabled` is a module-level constant, so the hook order below is stable.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return DEV_STATE;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled is constant for the app's lifetime
  return useSyncExternalStore(subscribe, () => snapshot, () => PENDING);
}

/** `useCurrentUserState().user` for display. `null` means loading OR signed out. */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
