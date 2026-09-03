import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectStatusBadge } from "@/components/status-badges";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { buildLookahead } from "@/lib/lookahead";
import { useAppStore } from "@/lib/store";
import { PROJECT_STATUS_LABELS } from "@/lib/types";
import { cn, daysUntil, formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
});

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

function PortfolioPage() {
  const projects = useAppStore((s) => s.projects);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const rfis = useAppStore((s) => s.rfis);
  const submittals = useAppStore((s) => s.submittals);
  const changeOrders = useAppStore((s) => s.changeOrders);
  const deliveries = useAppStore((s) => s.deliveries);
  const workPackages = useAppStore((s) => s.workPackages);
  const roadblocks = useAppStore((s) => s.roadblocks);
  const sequences = useAppStore((s) => s.sequences);
  const drawings = useAppStore((s) => s.drawings);

  const rows = useMemo(
    () =>
      projects.map((p) => {
        const pTasks = tasks.filter((t) => t.projectId === p.id && t.status !== "done");
        const overdue = pTasks.filter((t) => {
          const d = daysUntil(t.dueDate);
          return d != null && d < 0;
        });
        const pRoadblocks = roadblocks.filter(
          (r) => r.projectId === p.id && r.status !== "resolved",
        );
        const criticalRoadblocks = pRoadblocks.filter(
          (r) => r.severity === "critical" || r.severity === "high",
        );
        const openRfis = rfis.filter((r) => r.projectId === p.id && r.status === "open");
        const openSubs = submittals.filter(
          (s) =>
            s.projectId === p.id && ["submitted", "under_review", "resubmit"].includes(s.status),
        );
        const pendingCos = changeOrders.filter(
          (c) =>
            c.projectId === p.id &&
            c.status !== "approved" &&
            c.status !== "rejected" &&
            c.status !== "void",
        );
        const holds = drawings.filter((d) => d.projectId === p.id && d.status === "on_hold");
        const nextDelivery = deliveries
          .filter(
            (d) =>
              d.projectId === p.id &&
              d.status !== "received" &&
              d.status !== "exception" &&
              d.requiredDate,
          )
          .sort((a, b) => (a.requiredDate ?? "").localeCompare(b.requiredDate ?? ""))[0];
        const pWps = workPackages.filter((w) => w.projectId === p.id);
        const lateFab = pWps.filter((w) => {
          if (w.status === "complete") return false;
          const d = daysUntil(w.fabDueDate);
          return d != null && d < 0;
        });
        const erection = pWps.filter((w) => w.type === "erection");
        const erectedTons = erection.reduce(
          (n, w) => n + ((w.tonnage ?? 0) * (w.erectedPct ?? 0)) / 100,
          0,
        );

        return {
          project: p,
          openTasks: pTasks.length,
          overdue: overdue.length,
          roadblocks: pRoadblocks.length,
          criticalRoadblocks: criticalRoadblocks.length,
          openRfis: openRfis.length,
          openSubs: openSubs.length,
          pendingCoCount: pendingCos.length,
          pendingCoValue: pendingCos.reduce((n, c) => n + (c.amount || 0), 0),
          holds: holds.length,
          nextDelivery,
          lateFab: lateFab.length,
          erectedTons,
        };
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
      drawings,
    ],
  );

  const totals = useMemo(
    () => ({
      jobs: rows.length,
      openTasks: rows.reduce((n, r) => n + r.openTasks, 0),
      overdue: rows.reduce((n, r) => n + r.overdue, 0),
      roadblocks: rows.reduce((n, r) => n + r.roadblocks, 0),
      pendingCoValue: rows.reduce((n, r) => n + r.pendingCoValue, 0),
      tonnage: rows.reduce((n, r) => n + (r.project.tonnage || 0), 0),
      erectedTons: rows.reduce((n, r) => n + r.erectedTons, 0),
    }),
    [rows],
  );

  // The cross-job hot list: everything critical inside the next 10 days
  const hotList = useMemo(() => {
    const items = buildLookahead(
      {
        projects,
        tasks,
        rfis,
        submittals,
        changeOrders,
        deliveries,
        workPackages,
        roadblocks,
        sequences,
      },
      { projectId: "all", maxDaysOut: 10 },
    );
    return items.filter((i) => i.severity === "critical" || i.severity === "high").slice(0, 12);
  }, [
    projects,
    tasks,
    rfis,
    submittals,
    changeOrders,
    deliveries,
    workPackages,
    roadblocks,
    sequences,
  ]);

  function exportCsv() {
    downloadCsv(
      `portfolio-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        [
          "Job number",
          "Job",
          "Client",
          "Status",
          "Contract tons",
          "Tons erected",
          "Open tasks",
          "Overdue tasks",
          "Roadblocks",
          "Critical roadblocks",
          "Open RFIs",
          "Open submittals",
          "Sheet holds",
          "Late fab packages",
          "Pending COs",
          "Pending CO value",
          "Next required delivery",
        ],
        ...rows.map((r) => [
          r.project.jobNumber,
          r.project.name,
          r.project.client,
          PROJECT_STATUS_LABELS[r.project.status],
          r.project.tonnage,
          r.erectedTons.toFixed(1),
          r.openTasks,
          r.overdue,
          r.roadblocks,
          r.criticalRoadblocks,
          r.openRfis,
          r.openSubs,
          r.holds,
          r.lateFab,
          r.pendingCoCount,
          r.pendingCoValue,
          r.nextDelivery?.requiredDate ?? "",
        ]),
      ]),
    );
    toast.success("Portfolio exported");
  }

  return (
    <AppShell
      title="Portfolio"
      subtitle="Every job on one screen — what is hot, what is blocked, what ships next"
      actions={
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active jobs" value={totals.jobs} hint={formatTons(totals.tonnage)} />
          <StatCard
            label="Overdue tasks"
            value={totals.overdue}
            tone={totals.overdue > 0 ? "danger" : "success"}
            hint={`${totals.openTasks} open`}
          />
          <StatCard
            label="Open roadblocks"
            value={totals.roadblocks}
            tone={totals.roadblocks > 0 ? "warn" : "success"}
          />
          <StatCard
            label="Pending change value"
            value={money(totals.pendingCoValue)}
            tone="info"
            hint={`${formatTons(totals.erectedTons)} erected`}
          />
        </div>

        <section className="panel overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-sm font-medium">Jobs</h2>
            <p className="text-xs text-[var(--color-muted)]">
              Click a job to make it the active job everywhere else in the app.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                  <th className="px-4 py-2.5 font-medium">Job</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tasks</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-3 py-2.5 text-right font-medium">Blocks</th>
                  <th className="px-3 py-2.5 text-right font-medium">RFIs</th>
                  <th className="px-3 py-2.5 text-right font-medium">Subs</th>
                  <th className="px-3 py-2.5 text-right font-medium">Holds</th>
                  <th className="px-3 py-2.5 text-right font-medium">Late fab</th>
                  <th className="px-3 py-2.5 text-right font-medium">Pending CO</th>
                  <th className="px-3 py-2.5 font-medium">Next truck</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((r) => {
                  const nextReq = daysUntil(r.nextDelivery?.requiredDate);
                  return (
                    <tr
                      key={r.project.id}
                      className="cursor-pointer transition-colors hover:bg-[var(--color-surface)]"
                      onClick={() => {
                        setSelectedProjectId(r.project.id);
                        toast.success(`Active job → ${r.project.jobNumber}`);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono-num text-xs text-[var(--color-muted)]">
                          {r.project.jobNumber}
                        </div>
                        <div className="max-w-[240px] truncate font-medium">
                          {r.project.name.split("—")[0].trim()}
                        </div>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          {r.project.client}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <ProjectStatusBadge status={r.project.status} />
                      </td>
                      <td className="px-3 py-3 text-right font-mono-num">{r.openTasks}</td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-mono-num",
                          r.overdue > 0 && "text-[var(--color-danger)]",
                        )}
                      >
                        {r.overdue}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-mono-num",
                          r.criticalRoadblocks > 0 && "text-[var(--color-danger)]",
                        )}
                      >
                        {r.roadblocks}
                      </td>
                      <td className="px-3 py-3 text-right font-mono-num">{r.openRfis}</td>
                      <td className="px-3 py-3 text-right font-mono-num">{r.openSubs}</td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-mono-num",
                          r.holds > 0 && "text-[var(--color-warn)]",
                        )}
                      >
                        {r.holds}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-mono-num",
                          r.lateFab > 0 && "text-[var(--color-danger)]",
                        )}
                      >
                        {r.lateFab}
                      </td>
                      <td className="px-3 py-3 text-right font-mono-num">
                        {r.pendingCoCount > 0 ? money(r.pendingCoValue) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {r.nextDelivery ? (
                          <div>
                            <div className="font-mono-num text-xs">{r.nextDelivery.loadNumber}</div>
                            <div
                              className={cn(
                                "text-[11px]",
                                nextReq != null && nextReq < 0
                                  ? "text-[var(--color-danger)]"
                                  : "text-[var(--color-muted)]",
                              )}
                            >
                              {formatDate(r.nextDelivery.requiredDate)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--color-subtle)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div>
              <h2 className="text-sm font-medium">Hot list — next 10 days</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Critical and high-priority items across every job
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to="/lookahead">Full look ahead</Link>
            </Button>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {hotList.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-[var(--color-muted)]">
                Nothing critical in the next 10 days.
              </div>
            )}
            {hotList.map((i) => (
              <Link
                key={i.id}
                to={i.to}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--color-surface)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm">{i.title}</div>
                  <div className="text-[11px] text-[var(--color-muted)]">
                    <span className="font-mono-num">{i.jobNumber}</span>
                    {i.detail ? ` · ${i.detail}` : ""}
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono-num text-[11px]",
                    i.overdue
                      ? "text-[var(--color-danger)]"
                      : i.daysOut === 0
                        ? "text-[var(--color-warn)]"
                        : "text-[var(--color-muted)]",
                  )}
                >
                  {i.overdue
                    ? `${Math.abs(i.daysOut)}d late`
                    : i.daysOut === 0
                      ? "today"
                      : `+${i.daysOut}d`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
