/**
 * Sign-in / sign-out on top of Supabase Auth.
 *
 * `authEnabled` is a module-level constant: auth is on whenever Supabase is
 * configured, unless VITE_AUTH_ENABLED=false forces the local-only demo mode
 * (shared "dev user", nothing leaves the browser).
 */
import {
  errorMessage,
  getSupabase,
  supabaseConfigured,
} from "@/lib/supabase/client";

export const authEnabled =
  import.meta.env.VITE_AUTH_ENABLED !== "false" && supabaseConfigured;

function origin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(errorMessage(error, "Sign-in failed"));
}

/** Returns true when the project requires email confirmation before first sign-in. */
export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${origin()}/login` },
  });
  if (error) throw new Error(errorMessage(error, "Could not create account"));
  return { needsConfirmation: !data.session };
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${origin()}/` },
  });
  if (error) throw new Error(errorMessage(error, "Could not send sign-in link"));
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(
    email.trim(),
    { redirectTo: `${origin()}/login` },
  );
  if (error) throw new Error(errorMessage(error, "Could not send reset email"));
}

/** Sign out of this browser, then hard-navigate so every store starts clean. */
export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } finally {
    window.location.href = redirectTo;
  }
}
