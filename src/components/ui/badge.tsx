import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-muted)]",
        primary:
          "border-transparent bg-[var(--color-primary)]/15 text-[var(--color-primary)]",
        success:
          "border-[var(--color-success)]/25 bg-[var(--color-success-bg)] text-[var(--color-success)]",
        warn:
          "border-[var(--color-warn)]/25 bg-[var(--color-warn-bg)] text-[var(--color-warn)]",
        danger:
          "border-[var(--color-danger)]/25 bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
        info:
          "border-[var(--color-info)]/25 bg-[var(--color-info-bg)] text-[var(--color-info)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
