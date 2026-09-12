import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  authEnabled,
  resetPassword,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "signup" | "magic";

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!authEnabled) return <Navigate to="/" />;
  if (!isPending && user) return <Navigate to="/" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    setBusy(true);
    try {
      if (mode === "magic") {
        await signInWithMagicLink(email);
        setNotice("Check your email for the sign-in link.");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        const r = await signUpWithPassword(email, password);
        if (r.needsConfirmation) {
          setNotice("Account created — confirm the email we just sent, then sign in.");
          setMode("signin");
        }
        // With confirmation off, Supabase signs the new user in; the session
        // listener flips `user` and the Navigate above takes over.
      } else {
        await signInWithPassword(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email first, then choose reset.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setNotice("Password reset email sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signup" ? "Create account" : mode === "magic" ? "Email me a link" : "Sign in";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <div>
          <div className="font-mono-num text-xs font-semibold tracking-[0.2em] text-[var(--color-accent)]">
            PIECEMARK
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Steel drawings control for fab and erection. Your jobs, sheets, RFIs
            and uploads save to your account and follow you to any station.
          </p>
        </div>

        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Checking session…
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <div>
              <label
                htmlFor="login-email"
                className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-subtle)]"
              >
                Email
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            {mode !== "magic" && (
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--color-subtle)]"
                >
                  Password
                </label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {title}
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--color-muted)]">
              {mode !== "signin" ? (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => setMode("signin")}>
                  Have an account? Sign in
                </button>
              ) : (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  New here? Create account
                </button>
              )}
              {mode === "magic" ? (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => setMode("signin")}>
                  Use a password instead
                </button>
              ) : (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => setMode("magic")}>
                  Email me a sign-in link
                </button>
              )}
              {mode === "signin" && (
                <button type="button" className="underline-offset-4 hover:underline" disabled={busy} onClick={() => void onReset()}>
                  Forgot password?
                </button>
              )}
            </div>
          </form>
        )}

        {error && (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-[var(--color-info)]" role="status">
            {notice}
          </p>
        )}

        <p className="text-center text-xs text-[var(--color-subtle)]">
          <Link to="/" className="underline-offset-4 hover:underline">
            Continue without signing in (local demo — nothing saves to the cloud)
          </Link>
        </p>
      </div>
    </div>
  );
}
