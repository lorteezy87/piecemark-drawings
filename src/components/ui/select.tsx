import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, id, name, ...props }, ref) => {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const resolvedName = name ?? resolvedId;
  return (
    <select
      ref={ref}
      id={resolvedId}
      name={resolvedName}
      className={cn(
        "flex h-10 w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";
