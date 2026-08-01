import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RfiPriorityBadge, RfiStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  DISCIPLINE_LABELS,
  RFI_STATUS_LABELS,
  type RfiStatus,
} from "@/lib/types";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/rfis")({
  component: RfisPage,
});

function RfisPage() {
  const project = useSelectedProject();
  const rfis = useAppStore((s) => s.rfis);
  const drawings = useAppStore((s) => s.drawings);
  const updateRfiStatus = useAppStore((s) => s.updateRfiStatus);
  const [statusFilter, setStatusFilter] = useState<RfiStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    return rfis
      .filter((r) => r.projectId === project?.id)
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => {
        if (a.status === "open" && b.status !== "open") return -1;
        if (b.status === "open" && a.status !== "open") return 1;
        const order = { critical: 0, high: 1, normal: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      });
  }, [rfis, project?.id, statusFilter]);

  return (
    <AppShell
      title="RFI Log"
      subtitle={
        project
          ? `${project.jobNumber} · questions holding detailing, fab, or erection`
          : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-[var(--color-muted)]">
            RFIs are linked to drawings and piece marks so the shop and field know
            exactly which sheets are blocked — critical for connection holds and
            sequence releases.
          </p>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RfiStatus | "all")}
            className="w-40"
          >
            <option value="all">All statuses</option>
            {(Object.keys(RFI_STATUS_LABELS) as RfiStatus[]).map((s) => (
              <option key={s} value={s}>
                {RFI_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No RFIs for this filter.
            </div>
          )}
          {rows.map((rfi) => {
            const linked = drawings.filter((d) => rfi.drawingIds.includes(d.id));
            const due = daysUntil(rfi.dueDate);
            const isOpen = expanded === rfi.id;
            const overdue = rfi.status === "open" && due != null && due < 0;

            return (
              <article
                key={rfi.id}
                className={cn(
                  "panel overflow-hidden",
                  overdue && "border-[var(--color-danger)]/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpanded(isOpen ? null : rfi.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-base font-semibold">
                        {rfi.number}
                      </span>
                      <RfiStatusBadge status={rfi.status} />
                      <RfiPriorityBadge priority={rfi.priority} />
                      <span className="text-[11px] uppercase tracking-wide text-[var(--color-subtle)]">
                        {DISCIPLINE_LABELS[rfi.discipline]}
                      </span>
                    </div>
                    <h2 className="mt-1 font-medium">{rfi.subject}</h2>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">
                      Raised {formatDate(rfi.raisedDate)} by {rfi.raisedBy}
                      {rfi.dueDate && (
                        <>
                          {" "}
                          · Due{" "}
                          <span
                            className={cn(
                              "font-mono-num",
                              overdue
                                ? "text-[var(--color-danger)]"
                                : "text-[var(--color-fg)]",
                            )}
                          >
                            {formatDate(rfi.dueDate)}
                            {overdue && " (overdue)"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {linked.map((d) => (
                      <span
                        key={d.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 font-mono-num text-[11px]"
                      >
                        {d.number}
                      </span>
                    ))}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        Question
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]">
                        {rfi.question}
                      </p>
                    </div>
                    {rfi.answer && (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/25 bg-[var(--color-success-bg)] px-4 py-3">
                        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-success)]">
                          Answer
                          {rfi.answeredDate
                            ? ` · ${formatDate(rfi.answeredDate)}`
                            : ""}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{rfi.answer}</p>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        Affected drawings
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {linked.map((d) => (
                          <Link
                            key={d.id}
                            to="/drawings/$drawingId"
                            params={{ drawingId: d.id }}
                            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs hover:border-[var(--color-border-strong)]"
                          >
                            <span className="font-mono-num font-medium">{d.number}</span>
                            <span className="mt-0.5 block max-w-[180px] truncate text-[var(--color-muted)]">
                              {d.title}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    {rfi.status === "open" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateRfiStatus(
                              rfi.id,
                              "answered",
                              rfi.answer ??
                                "Answer recorded — update detailing and release holds as required.",
                            );
                            toast.success(`${rfi.number} marked answered`);
                          }}
                        >
                          Mark answered
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            updateRfiStatus(rfi.id, "closed");
                            toast.success(`${rfi.number} closed`);
                          }}
                        >
                          Close RFI
                        </Button>
                      </div>
                    )}
                    {rfi.status === "answered" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          updateRfiStatus(rfi.id, "closed");
                          toast.success(`${rfi.number} closed`);
                        }}
                      >
                        Close RFI
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
