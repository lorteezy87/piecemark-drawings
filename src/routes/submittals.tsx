import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SubmittalStatusBadge } from "@/components/status-badges";
import { Select } from "@/components/ui/select";
import {
  SUBMITTAL_STATUS_LABELS,
  SUBMITTAL_TYPE_LABELS,
  type SubmittalStatus,
} from "@/lib/types";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/submittals")({
  component: SubmittalsPage,
});

function SubmittalsPage() {
  const project = useSelectedProject();
  const submittals = useAppStore((s) => s.submittals);
  const drawings = useAppStore((s) => s.drawings);
  const [statusFilter, setStatusFilter] = useState<SubmittalStatus | "all">("all");

  const rows = useMemo(() => {
    return submittals
      .filter((s) => s.projectId === project?.id)
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .sort((a, b) => (b.submittedDate ?? "").localeCompare(a.submittedDate ?? ""));
  }, [submittals, project?.id, statusFilter]);

  const openCount = submittals.filter(
    (s) =>
      s.projectId === project?.id &&
      ["submitted", "under_review", "resubmit"].includes(s.status),
  ).length;

  return (
    <AppShell
      title="Submittal Log"
      subtitle={
        project
          ? `${project.jobNumber} · packages to ${project.engineer}`
          : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-2xl text-sm text-[var(--color-muted)]">
            Track shop drawing packages, erection sets, and resubmittals the way the
            GC and EOR actually review them — not as a generic document list.
          </p>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[var(--color-muted)]">
              <span className="font-mono-num text-[var(--color-warn)]">{openCount}</span>{" "}
              open packages
            </div>
            <Select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as SubmittalStatus | "all")
              }
              className="w-44"
            >
              <option value="all">All statuses</option>
              {(Object.keys(SUBMITTAL_STATUS_LABELS) as SubmittalStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {SUBMITTAL_STATUS_LABELS[s]}
                  </option>
                ),
              )}
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No submittals match this filter.
            </div>
          )}
          {rows.map((sub) => {
            const sheets = drawings.filter((d) => sub.drawingIds.includes(d.id));
            return (
              <article key={sub.id} className="panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-lg font-semibold">
                        {sub.number}
                      </span>
                      <SubmittalStatusBadge status={sub.status} />
                      <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                        {SUBMITTAL_TYPE_LABELS[sub.packageType]}
                      </span>
                    </div>
                    <h2 className="mt-1 font-medium">{sub.title}</h2>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">
                      Reviewer: {sub.reviewer ?? "—"} · Submitted{" "}
                      {formatDate(sub.submittedDate)}
                      {sub.returnedDate
                        ? ` · Returned ${formatDate(sub.returnedDate)}`
                        : ""}
                    </div>
                  </div>
                  <div className="font-mono-num text-sm text-[var(--color-subtle)]">
                    {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
                  </div>
                </div>

                {sub.notes && (
                  <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-muted)]">
                    {sub.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {sheets.map((d) => (
                    <Link
                      key={d.id}
                      to="/drawings/$drawingId"
                      params={{ drawingId: d.id }}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-xs hover:border-[var(--color-border-strong)]"
                    >
                      <span className="font-mono-num font-medium">{d.number}</span>
                      <span className="text-[var(--color-subtle)]">
                        Rev {d.currentRev}
                      </span>
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
