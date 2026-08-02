import * as React from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  className?: string;
  hint?: string;
  children: React.ReactNode;
};

/** Accessible labeled field wrapper (label + control). */
export function Field({ label, htmlFor, className, hint, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[11px] text-[var(--color-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
