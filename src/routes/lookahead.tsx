import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { JobScopeSelect } from "@/components/job-scope";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import {
  LOOKAHEAD_KIND_LABELS,
  LOOKAHEAD_WINDOWS,
  buildLookahead,
  groupByDay,
  lookaheadToCsv,
  type LookaheadItem,
  type LookaheadSeverity,
} from "@/lib/lookahead";
import { useAppStore } from "@/lib/store";
import { BALL_IN_COURT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lookahead")({
  component: LookaheadPage,
});

const severityStyles: Record<LookaheadSeverity, string> = {
  critical: "border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)]",
  high: "border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)]",
  normal: "border-[var(--color-border)] bg-[var(--color-bg-elevated)]",
  low: "border-[var(--color-border)] bg-[var(--color-bg-elevated)]",
};

function LookaheadPage() {
  const projects = useAppStore((s) => s.projects);
  const tasks = useAppStore((s) => s.tasks);
  const rfis = useAppStore((s) => s.rfis);
  const submittals = useAppStore((s) => s.submittals);
  const changeOrders = useAppStore((s) => s.changeOrders);
  const deliveries = useAppStore((s) => s.deliveries);
  const workPackages = useAppStore((s) => s.workPackages);
  const roadblocks = useAppStore((s) => s.roadblocks);
  const sequences = useAppStore((s) => s.sequences);

  const [scope, setScope] = useState<string | "all">("all");
  const [windowId, setWindowId] = useState<"48h" | "10d">("48h");
  const [allPastDue, setAllPastDue] = useState(false);

  const activeWindow = LOOKAHEAD_WINDOWS.find((w) => w.id === windowId) ?? LOOKAHEAD_WINDOWS[0]!;

  const source = useMemo(
    () => ({
      projects,
      tasks,
      rfis,
      submittals,
      changeOrders,
      deliveries,
      workPackages,
      roadblocks,
      sequences,
    }),
    [
      projects,
      tasks,
      rfis,
      submittals,
      changeOrders,
      deliveries,
      workPackages,
      roadblocks,
      sequences,
    ],
  );

  const items = useMemo(
    () =>
      buildLookahead(source, {
        projectId: scope,
        maxDaysOut: activeWindow.maxDaysOut,
        overdueLookbackDays: allPastDue ? 3650 : 30,
      }),
    [source, scope, activeWindow.maxDaysOut, allPastDue],
  );

  // How many stale dates the 30-day lookback is holding back
  const hiddenPastDue = useMemo(() => {
    if (allPastDue) return 0;
    const all = buildLookahead(source, {
      projectId: scope,
      maxDaysOut: activeWindow.maxDaysOut,
      overdueLookbackDays: 3650,
    });
    return all.filter((i) => i.overdue).length - items.filter((i) => i.overdue).length;
  }, [source, scope, activeWindow.maxDaysOut, allPastDue, items]);

  const overdue = items.filter((i) => i.overdue);
  const upcoming = items.filter((i) => !i.overdue);
  const days = useMemo(() => groupByDay(upcoming), [upcoming]);

  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const deliveryCount = items.filter(
    (i) => i.kind === "delivery_ship" || i.kind === "delivery_required",
  ).length;
  const fabCount = items.filter(
    (i) => i.kind === "fab_due" || i.kind === "fab_start" || i.kind === "release_to_fab",
  ).length;

  function exportCsv() {
    downloadCsv(
      `lookahead-${windowId}-${new Date().toISOString().slice(0, 10)}.csv`,
      lookaheadToCsv(items),
    );
    toast.success("Look ahead exported");
  }

  return (
    <AppShell
      title="Look Ahead"
      subtitle={`${activeWindow.label} window across ${scope === "all" ? "all jobs" : "one job"} — tasks, RFIs, submittals, trucks, fab dates, erection, and roadblocks`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="hidden sm:inline-flex"
          >
            <Printer className="size-3.5" />
            Print
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {LOOKAHEAD_WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWindowId(w.id)}
                className={cn(
                  "rounded-[var(--radius-md)] border px-4 py-2 text-sm transition-colors",
                  windowId === w.id
                    ? "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 text-[var(--color-fg)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={allPastDue}
              onChange={(e) => setAllPastDue(e.target.checked)}
              className="size-4"
            />
            All past due
            {hiddenPastDue > 0 && (
              <span className="font-mono-num text-[var(--color-subtle)]">
                (+{hiddenPastDue} older)
              </span>
            )}
          </label>
          <JobScopeSelect value={scope} onChange={setScope} className="ml-auto w-56" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={`${activeWindow.label} items`}
            value={items.length}
            hint={scope === "all" ? "All jobs" : undefined}
          />
          <StatCard
            label="Overdue"
            value={overdue.length}
            tone={overdue.length > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Truck movements"
            value={deliveryCount}
            tone="info"
            hint="Ships + required on site"
          />
          <StatCard
            label="Fab milestones"
            value={fabCount}
            tone={criticalCount > 0 ? "warn" : "default"}
            hint="Release, start, due"
          />
        </div>

        {overdue.length > 0 && (
          <section className="panel overflow-hidden border-[var(--color-danger)]/40">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-danger-bg)] px-4 py-2.5">
              <AlertTriangle className="size-4 text-[var(--color-danger)]" />
              <h2 className="text-sm font-medium text-[var(--color-danger)]">
                Past due — {overdue.length}
                {!allPastDue && hiddenPastDue > 0 && (
                  <span className="ml-2 font-normal text-[var(--color-muted)]">
                    within 30 days · {hiddenPastDue} older hidden
                  </span>
                )}
              </h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {overdue.map((item) => (
                <LookaheadRow key={item.id} item={item} showJob={scope === "all"} />
              ))}
            </div>
          </section>
        )}

        {days.length === 0 && overdue.length === 0 && (
          <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
            Nothing scheduled in the {activeWindow.label.toLowerCase()} window. Add due dates to
            tasks, trucks, and fab packages to populate it.
          </div>
        )}

        {days.map((day) => (
          <section key={day.date} className="panel overflow-hidden">
            <div className="flex items-baseline justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
              <h2 className="text-sm font-medium">{day.label}</h2>
              <span className="font-mono-num text-[11px] text-[var(--color-subtle)]">
                {day.date} · {day.items.length} item
                {day.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {day.items.map((item) => (
                <LookaheadRow key={item.id} item={item} showJob={scope === "all"} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

function LookaheadRow({ item, showJob }: { item: LookaheadItem; showJob: boolean }) {
  return (
    <Link
      to={item.to}
      className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[var(--color-surface)] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              severityStyles[item.severity],
            )}
          >
            {LOOKAHEAD_KIND_LABELS[item.kind]}
          </span>
          {showJob && (
            <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
              {item.jobNumber}
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-sm">{item.title}</div>
        {item.detail && (
          <div className="truncate text-[11px] text-[var(--color-muted)]">{item.detail}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[11px]">
        {item.ballInCourt && (
          <span className="text-[var(--color-warn)]">{BALL_IN_COURT_LABELS[item.ballInCourt]}</span>
        )}
        {item.owner && <span className="text-[var(--color-muted)]">{item.owner}</span>}
        <span
          className={cn(
            "font-mono-num",
            item.overdue
              ? "text-[var(--color-danger)]"
              : item.daysOut === 0
                ? "text-[var(--color-warn)]"
                : "text-[var(--color-muted)]",
          )}
        >
          {item.overdue
            ? `${Math.abs(item.daysOut)}d late`
            : item.daysOut === 0
              ? "today"
              : `+${item.daysOut}d`}
        </span>
      </div>
    </Link>
  );
}
