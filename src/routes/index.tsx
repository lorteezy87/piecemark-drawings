import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  FileWarning,
  Layers3,
  MessageSquareWarning,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SetRegister } from "@/components/drawings/set-register";
import { DrawingTable } from "@/components/drawings/drawing-table";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/stat-card";
import {
  DrawingStatusBadge,
  RfiPriorityBadge,
  RfiStatusBadge,
  SequenceStatusBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  DRAWING_STATUS_LABELS,
  DRAWING_TYPE_LABELS,
  type DrawingStatus,
} from "@/lib/types";
import {
  filterDrawingSets,
  filterDrawings,
  projectMetrics,
  useAppStore,
  useSelectedProject,
} from "@/lib/store";
import { formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: CommandCenter,
});

function CommandCenter() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const sequences = useAppStore((s) => s.sequences);
  const rfis = useAppStore((s) => s.rfis);
  const filters = useAppStore((s) => s.filters);

  const metrics = useMemo(
    () => (project ? projectMetrics(project.id) : null),
    [project, drawings, rfis],
  );

  const projectSeqs = useMemo(
    () => sequences.filter((s) => s.projectId === project?.id),
    [sequences, project?.id],
  );

  const attentionDrawings = useMemo(() => {
    if (!project) return [];
    return drawings
      .filter(
        (d) =>
          d.projectId === project.id &&
          (d.status === "on_hold" ||
            d.status === "revise_resubmit" ||
            d.status === "submitted"),
      )
      .slice(0, 6);
  }, [drawings, project?.id]);

  const openRfis = useMemo(
    () =>
      rfis
        .filter((r) => r.projectId === project?.id && r.status === "open")
        .sort((a, b) => {
          const order = { critical: 0, high: 1, normal: 2, low: 3 };
          return order[a.priority] - order[b.priority];
        }),
    [rfis, project?.id],
  );

  const statusChart = useMemo(() => {
    if (!project) return [];
    const counts: Partial<Record<DrawingStatus, number>> = {};
    for (const d of drawings.filter((x) => x.projectId === project.id)) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return (Object.keys(counts) as DrawingStatus[]).map((status) => ({
      status: DRAWING_STATUS_LABELS[status],
      count: counts[status] ?? 0,
      key: status,
    }));
  }, [drawings, project?.id]);

  const typeBreakdown = useMemo(() => {
    if (!project) return [];
    const map = new Map<string, number>();
    for (const d of drawings.filter((x) => x.projectId === project.id)) {
      const label = DRAWING_TYPE_LABELS[d.type];
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [drawings, project?.id]);

  const searchSets = useMemo(() => {
    if (!filters.query.trim() || !project) return [];
    return filterDrawingSets(drawingSets, drawings, filters, project.id);
  }, [drawingSets, drawings, filters, project?.id]);

  if (!project || !metrics) {
    return (
      <AppShell title="Command Center">
        <p className="text-[var(--color-muted)]">No projects loaded.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Command Center"
      subtitle={`${project.jobNumber} · ${project.name}`}
      actions={
        <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
          <Link to="/drawings">
            Open register
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Job banner */}
        <section className="panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 steel-grid opacity-30" />
          <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                Active job
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                {project.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                {project.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-muted)]">
                <span>
                  GC: <span className="text-[var(--color-fg)]">{project.client}</span>
                </span>
                <span>
                  EOR:{" "}
                  <span className="text-[var(--color-fg)]">{project.engineer}</span>
                </span>
                <span>
                  Shop:{" "}
                  <span className="text-[var(--color-fg)]">{project.fabShop}</span>
                </span>
                <span>
                  Contract:{" "}
                  <span className="font-mono-num text-[var(--color-fg)]">
                    {formatTons(project.tonnage)}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                  Target complete
                </div>
                <div className="font-mono-num text-lg font-medium">
                  {formatDate(project.targetComplete)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Drawing sets / sheets"
            value={`${metrics.setCount} / ${metrics.total}`}
            hint={`${metrics.fabReady} sheets ready for fab/field`}
          />
          <StatCard
            label="Released for fab / field"
            value={`${metrics.fabReadyPct}%`}
            hint={`${metrics.fabReady} of ${metrics.total} sheets`}
            tone="success"
          />
          <StatCard
            label="On hold / R&R"
            value={metrics.onHold + metrics.revise}
            hint={`${metrics.onHold} holds · ${metrics.revise} revise & resubmit`}
            tone={metrics.onHold + metrics.revise > 0 ? "warn" : "default"}
          />
          <StatCard
            label="Open RFIs"
            value={metrics.openRfis}
            hint={`${metrics.openSubs} packages in review`}
            tone={metrics.openRfis > 0 ? "danger" : "success"}
          />
        </section>

        {filters.query.trim() && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--color-muted)]">
              Matching sets for “{filters.query}”
            </h3>
            <SetRegister
              sets={searchSets}
              drawings={drawings}
              sequences={projectSeqs}
              defaultExpanded
            />
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-5">
          {/* Status chart */}
          <div className="panel p-4 sm:p-5 xl:col-span-3">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Drawing status pipeline</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Where sheets sit in the shop / field release chain
                </p>
              </div>
              <Layers3 className="size-4 text-[var(--color-subtle)]" />
            </div>
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChart} margin={{ top: 4, right: 8, left: -12, bottom: 40 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="status"
                    tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusChart.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={
                          entry.key === "on_hold" || entry.key === "revise_resubmit"
                            ? "var(--color-warn)"
                            : entry.key === "issued_for_erection" ||
                                entry.key === "issued_for_fab"
                              ? "var(--color-success)"
                              : "var(--color-accent)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Type breakdown */}
          <div className="panel p-4 sm:p-5 xl:col-span-2">
            <h3 className="font-medium">By drawing type</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Shop, erection, AB, connections…
            </p>
            <ul className="space-y-2.5">
              {typeBreakdown.map((row) => {
                const max = typeBreakdown[0]?.count || 1;
                return (
                  <li key={row.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-[var(--color-muted)]">{row.name}</span>
                      <span className="font-mono-num text-[var(--color-fg)]">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]/70"
                        style={{ width: `${(row.count / max) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {/* Needs attention */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <FileWarning className="size-4 text-[var(--color-warn)]" />
                <h3 className="font-medium">Needs attention</h3>
              </div>
              <Link
                to="/drawings"
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Full register
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border)]/70">
              {attentionDrawings.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
                  No holds, R&Rs, or pending reviews on this job.
                </li>
              )}
              {attentionDrawings.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/drawings/$drawingId"
                    params={{ drawingId: d.id }}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)]/50 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-num font-medium">{d.number}</span>
                        <DrawingStatusBadge status={d.status} />
                      </div>
                      <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
                        {d.title}
                      </div>
                      {d.holdReason && (
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-[var(--color-warn)]">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                          <span className="line-clamp-2">{d.holdReason}</span>
                        </div>
                      )}
                    </div>
                    <span className="font-mono-num text-xs text-[var(--color-subtle)]">
                      Rev {d.currentRev}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Open RFIs */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="size-4 text-[var(--color-danger)]" />
                <h3 className="font-medium">Open RFIs</h3>
              </div>
              <Link to="/rfis" className="text-xs text-[var(--color-accent)] hover:underline">
                RFI log
              </Link>
            </div>
            <ul className="divide-y divide-[var(--color-border)]/70">
              {openRfis.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
                  No open RFIs. Detailing can proceed without hold points.
                </li>
              )}
              {openRfis.map((r) => (
                <li key={r.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num font-medium">{r.number}</span>
                    <RfiPriorityBadge priority={r.priority} />
                    <RfiStatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-sm">{r.subject}</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                    Due {formatDate(r.dueDate)} · {r.raisedBy}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sequences strip */}
        <section className="panel p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium">Erection sequences</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Release order for field — shop status rolls up by sequence
              </p>
            </div>
            <Link to="/sequences" className="text-xs text-[var(--color-accent)] hover:underline">
              Manage sequences
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projectSeqs.map((seq) => {
              const seqDwgs = drawings.filter((d) => d.sequenceId === seq.id);
              const ready = seqDwgs.filter((d) =>
                ["issued_for_fab", "issued_for_erection", "approved", "aan"].includes(
                  d.status,
                ),
              ).length;
              return (
                <div
                  key={seq.id}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{seq.name}</div>
                    <SequenceStatusBadge status={seq.status} />
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-muted)]">
                    Grids {seq.grids} · {formatTons(seq.tonnage)}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[var(--color-subtle)]">
                      Sheets released
                    </span>
                    <span className="font-mono-num">
                      {ready}/{seqDwgs.length || "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-success)]/80"
                      style={{
                        width: `${seqDwgs.length ? (ready / seqDwgs.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
