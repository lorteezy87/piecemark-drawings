import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DefaultErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset?: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="size-10 text-[var(--color-warn)]" />
      <div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">
          {error.message || "An unexpected error occurred in this view."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {reset && (
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/">Back to Command Center</Link>
        </Button>
      </div>
    </div>
  );
}

export function NotFoundComponent() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-mono-num text-4xl font-semibold text-[var(--color-muted)]">
        404
      </h1>
      <p className="text-sm text-[var(--color-muted)]">
        That page is not in the drawings register.
      </p>
      <Button asChild size="sm">
        <Link to="/">Command Center</Link>
      </Button>
    </div>
  );
}
