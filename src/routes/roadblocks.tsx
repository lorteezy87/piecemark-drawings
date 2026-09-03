import { createFileRoute } from "@tanstack/react-router";
import { Download, OctagonAlert, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { JobScopeSelect } from "@/components/job-scope";
import {
  BallInCourtBadge,
  RoadblockSeverityBadge,
  RoadblockStatusBadge,
} from "@/components/pm-badges";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useAppStore } from "@/lib/store";
import {
  BALL_IN_COURT_LABELS,
  ROADBLOCK_CATEGORY_LABELS,
  ROADBLOCK_SEVERITY_LABELS,
  ROADBLOCK_STATUS_LABELS,
  type BallInCourt,
  type RoadblockCategory,
  type RoadblockSeverity,
  type RoadblockStatus,
} from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/roadblocks")({
  component: RoadblocksPage,
});

function RoadblocksPage() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const sequences = useAppStore((s) => s.sequences);
  const workPackages = useAppStore((s) => s.workPackages);
  const roadblocks = useAppStore((s) => s.roadblocks);
  const addRoadblock = useAppStore((s) => s.addRoadblock);
  const updateRoadblock = useAppStore((s) => s.updateRoadblock);
  const resolveRoadblock = useAppStore((s) => s.resolveRoadblock);
  const deleteRoadblock = useAppStore((s) => s.deleteRoadblock);

  const [scope, setScope] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<RoadblockStatus | "all">("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resolutionDraft, setResolutionDraft] = useState("");

  const [projectId, setProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RoadblockCategory>("design");
  const [severity, setSeverity] = useState<RoadblockSeverity>("high");
  const [owner, setOwner] = useState("");
  const [ballInCourt, setBallInCourt] = useState<BallInCourt>("eor");
  const [targetResolution, setTargetResolution] = useState("");
  const [scheduleImpactDays, setScheduleImpactDays] = useState("");
  const [sequenceId, setSequenceId] = useState("");

  const jobLabel = (id: string) => projects.find((p) => p.id === id)?.jobNumber ?? "—";

  const rows = useMemo(() => {
    const sevRank: Record<RoadblockSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    return roadblocks
      .filter((r) => scope === "all" || r.projectId === scope)
      .filter((r) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "open") return r.status === "open" || r.status === "mitigating";
        return r.status === statusFilter;
      })
      .sort((a, b) => {
        const s = sevRank[a.severity] - sevRank[b.severity];
        if (s !== 0) return s;
        return (a.targetResolution ?? "9999").localeCompare(b.targetResolution ?? "9999");
      });
  }, [roadblocks, scope, statusFilter]);

  const stats = useMemo(() => {
    const scoped = roadblocks.filter((r) => scope === "all" || r.projectId === scope);
    const open = scoped.filter((r) => r.status !== "resolved");
    const critical = open.filter((r) => r.severity === "critical");
    const pastTarget = open.filter((r) => {
      const d = daysUntil(r.targetResolution);
      return d != null && d < 0;
    });
    return {
      open: open.length,
      critical: critical.length,
      pastTarget: pastTarget.length,
      scheduleDays: open.reduce((n, r) => n + (r.scheduleImpactDays ?? 0), 0),
      cost: open.reduce((n, r) => n + (r.costImpact ?? 0), 0),
    };
  }, [roadblocks, scope]);

  const projectSeqs = sequences.filter((s) => s.projectId === projectId);

  function submitCreate() {
    if (!projectId || !title.trim() || !description.trim()) {
      toast.error("Job, title, and description are required");
      return;
    }
    addRoadblock({
      projectId,
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      owner: owner || undefined,
      ballInCourt,
      targetResolution: targetResolution || undefined,
      scheduleImpactDays: scheduleImpactDays ? Number(scheduleImpactDays) : undefined,
      sequenceIds: sequenceId ? [sequenceId] : [],
    });
    toast.success("Roadblock logged — chase task raised");
    setShowCreate(false);
    setTitle("");
    setDescription("");
    setTargetResolution("");
    setScheduleImpactDays("");
  }

  function exportCsv() {
    downloadCsv(
      `roadblocks-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        [
          "Job",
          "Number",
          "Title",
          "Category",
          "Severity",
          "Status",
          "Raised",
          "Owner",
          "Ball in court",
          "Target resolution",
          "Days open",
          "Schedule impact",
          "Cost impact",
          "Mitigation",
        ],
        ...rows.map((r) => {
          const age = daysUntil(r.raisedDate);
          return [
            jobLabel(r.projectId),
            r.number,
            r.title,
            ROADBLOCK_CATEGORY_LABELS[r.category],
            ROADBLOCK_SEVERITY_LABELS[r.severity],
            ROADBLOCK_STATUS_LABELS[r.status],
            r.raisedDate,
            r.owner ?? "",
            r.ballInCourt ? BALL_IN_COURT_LABELS[r.ballInCourt] : "",
            r.targetResolution ?? "",
            age != null ? Math.abs(age) : "",
            r.scheduleImpactDays ?? "",
            r.costImpact ?? "",
            r.mitigation ?? "",
          ];
        }),
      ]),
    );
    toast.success("Roadblock log exported");
  }

  return (
    <AppShell
      title="Roadblocks"
      subtitle="What is actually stopping the job — design, material, access, approvals, equipment"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showCreate ? "Cancel" : "Log roadblock"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Open roadblocks"
            value={stats.open}
            tone={stats.open > 0 ? "warn" : "success"}
          />
          <StatCard
            label="Critical"
            value={stats.critical}
            tone={stats.critical > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Past target date"
            value={stats.pastTarget}
            tone={stats.pastTarget > 0 ? "danger" : "default"}
          />
          <StatCard
            label="Schedule exposure"
            value={`${stats.scheduleDays} d`}
            hint={
              stats.cost ? `$${Math.round(stats.cost).toLocaleString("en-US")} cost` : undefined
            }
            tone="info"
          />
        </div>

        {showCreate && (
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="font-medium">Log a roadblock</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Every roadblock gets an owner, a target date, and an automatic chase task. Nothing
                sits unowned.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Job</label>
                <Select
                  aria-label="Job"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSequenceId("");
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.jobNumber}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Title</label>
                <Input
                  aria-label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Embed layout conflict at CP-C — awaiting EOR"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Category</label>
                <Select
                  aria-label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as RoadblockCategory)}
                >
                  {(Object.keys(ROADBLOCK_CATEGORY_LABELS) as RoadblockCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {ROADBLOCK_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Severity</label>
                <Select
                  aria-label="Severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as RoadblockSeverity)}
                >
                  {(Object.keys(ROADBLOCK_SEVERITY_LABELS) as RoadblockSeverity[]).map((s) => (
                    <option key={s} value={s}>
                      {ROADBLOCK_SEVERITY_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Owner</label>
                <Input
                  aria-label="Owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="Who chases it"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Ball in court
                </label>
                <Select
                  aria-label="Ball in court"
                  value={ballInCourt}
                  onChange={(e) => setBallInCourt(e.target.value as BallInCourt)}
                >
                  {(Object.keys(BALL_IN_COURT_LABELS) as BallInCourt[]).map((b) => (
                    <option key={b} value={b}>
                      {BALL_IN_COURT_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Target resolution
                </label>
                <Input
                  aria-label="Target resolution"
                  type="date"
                  value={targetResolution}
                  onChange={(e) => setTargetResolution(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Schedule impact (days)
                </label>
                <Input
                  aria-label="Schedule impact"
                  type="number"
                  value={scheduleImpactDays}
                  onChange={(e) => setScheduleImpactDays(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Sequence blocked
                </label>
                <Select
                  aria-label="Sequence"
                  value={sequenceId}
                  onChange={(e) => setSequenceId(e.target.value)}
                >
                  <option value="">—</option>
                  {projectSeqs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  What is blocked and why
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the conflict, what work it stops, and the downstream date it threatens…"
                  className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submitCreate}>Log roadblock</Button>
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <JobScopeSelect value={scope} onChange={setScope} className="w-56" />
          <Select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RoadblockStatus | "all")}
            className="w-44"
          >
            <option value="open">Open + mitigating</option>
            <option value="mitigating">Mitigating</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </Select>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No roadblocks for this filter. Clear road.
            </div>
          )}
          {rows.map((r) => {
            const target = daysUntil(r.targetResolution);
            const late = r.status !== "resolved" && target != null && target < 0;
            const age = daysUntil(r.raisedDate);
            const isOpen = expanded === r.id;
            const seqs = sequences.filter((s) => r.sequenceIds.includes(s.id));
            const wps = workPackages.filter((w) => r.workPackageIds.includes(w.id));
            return (
              <article
                key={r.id}
                className={cn(
                  "panel overflow-hidden",
                  r.severity === "critical" &&
                    r.status !== "resolved" &&
                    "border-[var(--color-danger)]/40",
                  late && "border-[var(--color-danger)]/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <OctagonAlert
                        className={cn(
                          "size-4",
                          r.severity === "critical"
                            ? "text-[var(--color-danger)]"
                            : "text-[var(--color-muted)]",
                        )}
                      />
                      <span className="font-mono-num text-base font-semibold">{r.number}</span>
                      <RoadblockSeverityBadge severity={r.severity} />
                      <RoadblockStatusBadge status={r.status} />
                      <BallInCourtBadge who={r.ballInCourt} />
                      {scope === "all" && (
                        <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                          {jobLabel(r.projectId)}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 font-medium">{r.title}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                      <span className="uppercase tracking-wide">
                        {ROADBLOCK_CATEGORY_LABELS[r.category]}
                      </span>
                      {age != null && <span className="font-mono-num">{Math.abs(age)}d open</span>}
                      {r.targetResolution && (
                        <span>
                          Target{" "}
                          <span
                            className={cn(
                              "font-mono-num",
                              late ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
                            )}
                          >
                            {formatDate(r.targetResolution)}
                            {late ? ` (${Math.abs(target!)}d past)` : ""}
                          </span>
                        </span>
                      )}
                      {r.scheduleImpactDays != null && (
                        <span className="font-mono-num text-[var(--color-warn)]">
                          {r.scheduleImpactDays}d impact
                        </span>
                      )}
                      {r.owner && <span>{r.owner}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {seqs.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 text-[11px]"
                      >
                        Seq {s.number}
                      </span>
                    ))}
                    {wps.map((w) => (
                      <span
                        key={w.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 font-mono-num text-[11px]"
                      >
                        {w.code}
                      </span>
                    ))}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        What is blocked
                      </div>
                      <p className="mt-1 text-sm leading-relaxed">{r.description}</p>
                    </div>

                    {r.mitigation && (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-info)]/25 bg-[var(--color-info-bg)] px-4 py-3">
                        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-info)]">
                          Mitigation
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{r.mitigation}</p>
                      </div>
                    )}

                    {r.status === "resolved" && r.resolution && (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/25 bg-[var(--color-success-bg)] px-4 py-3">
                        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-success)]">
                          Resolved {formatDate(r.resolvedDate)}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{r.resolution}</p>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Status
                        </label>
                        <Select
                          aria-label="Status"
                          value={r.status}
                          onChange={(e) =>
                            updateRoadblock(r.id, {
                              status: e.target.value as RoadblockStatus,
                            })
                          }
                        >
                          {(Object.keys(ROADBLOCK_STATUS_LABELS) as RoadblockStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {ROADBLOCK_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Severity
                        </label>
                        <Select
                          aria-label="Severity"
                          value={r.severity}
                          onChange={(e) =>
                            updateRoadblock(r.id, {
                              severity: e.target.value as RoadblockSeverity,
                            })
                          }
                        >
                          {(Object.keys(ROADBLOCK_SEVERITY_LABELS) as RoadblockSeverity[]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {ROADBLOCK_SEVERITY_LABELS[s]}
                              </option>
                            ),
                          )}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Target resolution
                        </label>
                        <Input
                          aria-label="Target resolution"
                          type="date"
                          value={r.targetResolution ?? ""}
                          onChange={(e) =>
                            updateRoadblock(r.id, {
                              targetResolution: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Owner
                        </label>
                        <Input
                          aria-label="Owner"
                          value={r.owner ?? ""}
                          onChange={(e) =>
                            updateRoadblock(r.id, {
                              owner: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                        Mitigation plan
                      </label>
                      <textarea
                        value={r.mitigation ?? ""}
                        onChange={(e) =>
                          updateRoadblock(r.id, {
                            mitigation: e.target.value || undefined,
                          })
                        }
                        rows={2}
                        placeholder="What you are doing about it, and the fallback if it does not clear…"
                        className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                      />
                    </div>

                    {r.status !== "resolved" && (
                      <div className="space-y-2">
                        <label className="block text-[11px] text-[var(--color-muted)]">
                          Resolution
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            aria-label="Resolution"
                            value={resolutionDraft}
                            onChange={(e) => setResolutionDraft(e.target.value)}
                            placeholder="How it cleared"
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              resolveRoadblock(r.id, resolutionDraft || undefined);
                              setResolutionDraft("");
                              toast.success(`${r.number} resolved`);
                            }}
                          >
                            Mark resolved
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteRoadblock(r.id);
                          toast.success("Roadblock deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
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
