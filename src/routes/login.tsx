import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  authEnabled,
  GROK_PROVIDERS,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authEnabled) {
    return <Navigate to="/" />;
  }
  if (!isPending && user) {
    return <Navigate to="/" />;
  }

  async function onSignIn(providerId: string) {
    setError(null);
    setBusy(providerId);
    try {
      await signIn(providerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <div>
          <div className="font-mono-num text-xs font-semibold tracking-[0.2em] text-[var(--color-accent)]">
            PIECEMARK
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Steel drawings control for fab and erection. Sign in to keep sessions
            on this device and enable multi-user deploy later.
          </p>
        </div>

        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Checking session…
          </div>
        ) : (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                className="w-full"
                disabled={!!busy}
                onClick={() => void onSignIn(p.providerId)}
              >
                {busy === p.providerId ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Continue with {p.label}
              </Button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}

        <p className="text-center text-xs text-[var(--color-subtle)]">
          <Link to="/" className="underline-offset-4 hover:underline">
            Continue without signing in (demo mode)
          </Link>
        </p>
      </div>
    </div>
  );
}
