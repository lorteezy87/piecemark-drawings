import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warn" | "danger" | "info";
}) {
  const toneClass = {
    default: "text-[var(--color-fg)]",
    success: "text-[var(--color-success)]",
    warn: "text-[var(--color-warn)]",
    danger: "text-[var(--color-danger)]",
    info: "text-[var(--color-info)]",
  }[tone];

  return (
    <div className="panel p-4 sm:p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className={cn("mt-2 font-mono-num text-2xl font-semibold tracking-tight sm:text-3xl", toneClass)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}
