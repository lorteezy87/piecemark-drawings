import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BufferedTextarea } from "@/components/buffered-field";
import { AppShell } from "@/components/layout/app-shell";
import { JobScopeSelect } from "@/components/job-scope";
import { WorkPackageStatusBadge, WorkPackageTypeBadge } from "@/components/pm-badges";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useAppStore } from "@/lib/store";
import {
  WORK_PACKAGE_STATUS_LABELS,
  WORK_PACKAGE_TYPE_LABELS,
  fabDurationDays,
  type WorkPackage,
  type WorkPackageStatus,
  type WorkPackageType,
} from "@/lib/types";
import { cn, daysUntil, formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/work-packages")({
  component: WorkPackagesPage,
});

/** The fab/erection milestone chain, in the order the shop and field hit them. */
const MILESTONES: {
  key: keyof WorkPackage;
  label: string;
}[] = [
  { key: "releaseToFabDate", label: "Release to fab" },
  { key: "fabStartDate", label: "Fab start" },
  { key: "fabDueDate", label: "Fab due" },
  { key: "paintOutDate", label: "Paint out" },
  { key: "paintBackDate", label: "Paint back" },
  { key: "shipDate", label: "Ship" },
  { key: "onSiteDate", label: "On site" },
  { key: "erectStartDate", label: "Erect start" },
  { key: "erectEndDate", label: "Erect end" },
];

function WorkPackagesPage() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const sequences = useAppStore((s) => s.sequences);
  const workPackages = useAppStore((s) => s.workPackages);
  const addWorkPackage = useAppStore((s) => s.addWorkPackage);
  const updateWorkPackage = useAppStore((s) => s.updateWorkPackage);
  const deleteWorkPackage = useAppStore((s) => s.deleteWorkPackage);

  const [scope, setScope] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<WorkPackageType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<WorkPackageStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [projectId, setProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkPackageType>("fabrication");
  const [sequenceId, setSequenceId] = useState("");
  const [owner, setOwner] = useState("");
  const [tonnage, setTonnage] = useState("");
  const [fabStartDate, setFabStartDate] = useState("");
  const [fabDueDate, setFabDueDate] = useState("");

  const jobLabel = (id: string) => projects.find((p) => p.id === id)?.jobNumber ?? "—";
  const seqLabel = (id?: string) => (id ? (sequences.find((s) => s.id === id)?.name ?? "—") : "—");

  const rows = useMemo(
    () =>
      workPackages
        .filter((w) => scope === "all" || w.projectId === scope)
        .filter((w) => typeFilter === "all" || w.type === typeFilter)
        .filter((w) => statusFilter === "all" || w.status === statusFilter)
        .sort((a, b) => {
          const ad = a.fabDueDate ?? a.erectStartDate ?? "9999";
          const bd = b.fabDueDate ?? b.erectStartDate ?? "9999";
          return ad.localeCompare(bd);
        }),
    [workPackages, scope, typeFilter, statusFilter],
  );

  const stats = useMemo(() => {
    const scoped = workPackages.filter((w) => scope === "all" || w.projectId === scope);
    const active = scoped.filter((w) => w.status === "in_progress");
    const late = scoped.filter((w) => {
      if (w.status === "complete") return false;
      const d = daysUntil(w.fabDueDate);
      return d != null && d < 0;
    });
    const blocked = scoped.filter((w) => w.status === "blocked");
    const inFab = scoped.filter((w) => w.type === "fabrication" && w.status !== "complete");
    const fabTons = inFab.reduce((n, w) => n + (w.tonnage ?? 0), 0);
    const erection = scoped.filter((w) => w.type === "erection");
    const erectedTons = erection.reduce(
      (n, w) => n + ((w.tonnage ?? 0) * (w.erectedPct ?? 0)) / 100,
      0,
    );
    return {
      active: active.length,
      late: late.length,
      blocked: blocked.length,
      fabTons,
      erectedTons,
      erection: erection.length,
    };
  }, [workPackages, scope]);

  function submitCreate() {
    if (!projectId || !name.trim()) {
      toast.error("Job and package name are required");
      return;
    }
    addWorkPackage({
      projectId,
      name: name.trim(),
      type,
      sequenceId: sequenceId || undefined,
      owner: owner || undefined,
      tonnage: tonnage ? Number(tonnage) : undefined,
      fabStartDate: fabStartDate || undefined,
      fabDueDate: fabDueDate || undefined,
      status: "not_started",
    });
    toast.success("Work package created");
    setShowCreate(false);
    setName("");
    setTonnage("");
    setFabStartDate("");
    setFabDueDate("");
  }

  function exportCsv() {
    downloadCsv(
      `work-packages-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        [
          "Job",
          "Code",
          "Package",
          "Type",
          "Status",
          "Sequence",
          "Owner",
          "Tons",
          "% complete",
          "Release to fab",
          "Fab start",
          "Fab due",
          "Fab days",
          "Paint out",
          "Paint back",
          "Ship",
          "On site",
          "Erect start",
          "Erect end",
          "% erected",
        ],
        ...rows.map((w) => [
          jobLabel(w.projectId),
          w.code,
          w.name,
          WORK_PACKAGE_TYPE_LABELS[w.type],
          WORK_PACKAGE_STATUS_LABELS[w.status],
          seqLabel(w.sequenceId),
          w.owner ?? "",
          w.tonnage ?? "",
          w.percentComplete,
          w.releaseToFabDate ?? "",
          w.fabStartDate ?? "",
          w.fabDueDate ?? "",
          fabDurationDays(w) ?? "",
          w.paintOutDate ?? "",
          w.paintBackDate ?? "",
          w.shipDate ?? "",
          w.onSiteDate ?? "",
          w.erectStartDate ?? "",
          w.erectEndDate ?? "",
          w.erectedPct ?? "",
        ]),
      ]),
    );
    toast.success("Work packages exported");
  }

  const projectSeqs = sequences.filter((s) => s.projectId === projectId);

  return (
    <AppShell
      title="Work Packages"
      subtitle="Fabrication times, due dates, and erection tracking by sequence"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showCreate ? "Cancel" : "New package"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active packages" value={stats.active} />
          <StatCard
            label="Past fab due"
            value={stats.late}
            tone={stats.late > 0 ? "danger" : "success"}
          />
          <StatCard label="Tons in fab" value={formatTons(stats.fabTons)} tone="info" />
          <StatCard
            label="Tons erected"
            value={formatTons(stats.erectedTons)}
            tone="success"
            hint={`${stats.erection} erection package(s)`}
          />
        </div>

        {showCreate && (
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="font-medium">New work package</h2>
              <p className="text-xs text-[var(--color-muted)]">
                One package per sequence and phase. Fab dates here feed the 48-hour and 10-day look
                ahead.
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
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Package name
                </label>
                <Input
                  aria-label="Package name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Levels 3–4 primary frame — fabrication"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Type</label>
                <Select
                  aria-label="Type"
                  value={type}
                  onChange={(e) => setType(e.target.value as WorkPackageType)}
                >
                  {(Object.keys(WORK_PACKAGE_TYPE_LABELS) as WorkPackageType[]).map((t) => (
                    <option key={t} value={t}>
                      {WORK_PACKAGE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Sequence</label>
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
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Owner</label>
                <Input
                  aria-label="Owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="Shop / crew / firm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Tons</label>
                <Input
                  aria-label="Tons"
                  type="number"
                  value={tonnage}
                  onChange={(e) => setTonnage(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Fab start</label>
                <Input
                  aria-label="Fab start"
                  type="date"
                  value={fabStartDate}
                  onChange={(e) => setFabStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Fab due</label>
                <Input
                  aria-label="Fab due"
                  type="date"
                  value={fabDueDate}
                  onChange={(e) => setFabDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submitCreate}>Create package</Button>
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <JobScopeSelect value={scope} onChange={setScope} className="w-56" />
          <Select
            aria-label="Type filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as WorkPackageType | "all")}
            className="w-40"
          >
            <option value="all">All types</option>
            {(Object.keys(WORK_PACKAGE_TYPE_LABELS) as WorkPackageType[]).map((t) => (
              <option key={t} value={t}>
                {WORK_PACKAGE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkPackageStatus | "all")}
            className="w-40"
          >
            <option value="all">All statuses</option>
            {(Object.keys(WORK_PACKAGE_STATUS_LABELS) as WorkPackageStatus[]).map((s) => (
              <option key={s} value={s}>
                {WORK_PACKAGE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No work packages for this filter.
            </div>
          )}
          {rows.map((w) => {
            const fabDue = daysUntil(w.fabDueDate);
            const late = w.status !== "complete" && fabDue != null && fabDue < 0;
            const isOpen = expanded === w.id;
            const duration = fabDurationDays(w);
            return (
              <article
                key={w.id}
                className={cn(
                  "panel overflow-hidden",
                  late && "border-[var(--color-danger)]/40",
                  w.status === "blocked" && "border-[var(--color-warn)]/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpanded(isOpen ? null : w.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-base font-semibold">{w.code}</span>
                      <WorkPackageTypeBadge type={w.type} />
                      <WorkPackageStatusBadge status={w.status} />
                      {scope === "all" && (
                        <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                          {jobLabel(w.projectId)}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 font-medium">{w.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                      <span>{seqLabel(w.sequenceId)}</span>
                      {w.owner && <span>{w.owner}</span>}
                      {w.tonnage != null && (
                        <span className="font-mono-num">{formatTons(w.tonnage)}</span>
                      )}
                      {w.fabDueDate && (
                        <span>
                          Fab due{" "}
                          <span
                            className={cn(
                              "font-mono-num",
                              late ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
                            )}
                          >
                            {formatDate(w.fabDueDate)}
                            {late ? ` (${Math.abs(fabDue!)}d late)` : ""}
                          </span>
                        </span>
                      )}
                      {duration != null && (
                        <span className="font-mono-num">{duration}d in shop</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                      <span>{w.type === "erection" ? "Erected" : "Complete"}</span>
                      <span className="font-mono-num text-[var(--color-fg)]">
                        {w.type === "erection" ? (w.erectedPct ?? 0) : w.percentComplete}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          late ? "bg-[var(--color-danger)]" : "bg-[var(--color-primary)]",
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(0, w.type === "erection" ? (w.erectedPct ?? 0) : w.percentComplete))}%`,
                        }}
                      />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                    <div>
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        Fabrication & erection dates
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {MILESTONES.map((m) => (
                          <div key={String(m.key)}>
                            <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                              {m.label}
                            </label>
                            <Input
                              aria-label={m.label}
                              type="date"
                              value={(w[m.key] as string | undefined) ?? ""}
                              onChange={(e) =>
                                updateWorkPackage(w.id, {
                                  [m.key]: e.target.value || undefined,
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Status
                        </label>
                        <Select
                          aria-label="Status"
                          value={w.status}
                          onChange={(e) =>
                            updateWorkPackage(w.id, {
                              status: e.target.value as WorkPackageStatus,
                            })
                          }
                        >
                          {(Object.keys(WORK_PACKAGE_STATUS_LABELS) as WorkPackageStatus[]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {WORK_PACKAGE_STATUS_LABELS[s]}
                              </option>
                            ),
                          )}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          % complete
                        </label>
                        <Input
                          aria-label="Percent complete"
                          type="number"
                          min={0}
                          max={100}
                          value={String(w.percentComplete)}
                          onChange={(e) =>
                            updateWorkPackage(w.id, {
                              percentComplete: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          % erected
                        </label>
                        <Input
                          aria-label="Percent erected"
                          type="number"
                          min={0}
                          max={100}
                          value={String(w.erectedPct ?? 0)}
                          onChange={(e) =>
                            updateWorkPackage(w.id, {
                              erectedPct: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Crane days
                        </label>
                        <Input
                          aria-label="Crane days"
                          type="number"
                          value={String(w.craneDays ?? "")}
                          onChange={(e) =>
                            updateWorkPackage(w.id, {
                              craneDays: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Crew size
                        </label>
                        <Input
                          aria-label="Crew size"
                          type="number"
                          value={String(w.crewSize ?? "")}
                          onChange={(e) =>
                            updateWorkPackage(w.id, {
                              crewSize: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                        Notes
                      </label>
                      <BufferedTextarea
                        aria-label="Notes"
                        value={w.notes ?? ""}
                        onCommit={(v) => updateWorkPackage(w.id, { notes: v || undefined })}
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteWorkPackage(w.id);
                          toast.success("Work package deleted");
                        }}
                      >
                        Delete package
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
