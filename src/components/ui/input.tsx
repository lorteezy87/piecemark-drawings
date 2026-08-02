import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, id, name, ...props }, ref) => {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const resolvedName = name ?? resolvedId;
  return (
    <input
      type={type}
      id={resolvedId}
      name={resolvedName}
      className={cn(
        "flex h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
