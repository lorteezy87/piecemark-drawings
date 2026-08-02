import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadJobPackage, parseJobPackage } from "@/lib/job-package";
import { can } from "@/lib/permissions";
import { projectMetrics, useAppStore } from "@/lib/store";
import { formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useAppStore((s) => s.setSelectedProjectId);
  const drawings = useAppStore((s) => s.drawings);
  const rfis = useAppStore((s) => s.rfis);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const clearDemoProjects = useAppStore((s) => s.clearDemoProjects);
  const createProject = useAppStore((s) => s.createProject);
  const crewRole = useAppStore((s) => s.crewRole);
  const exportPackage = useAppStore((s) => s.exportPackage);
  const importPackage = useAppStore((s) => s.importPackage);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [client, setClient] = useState("");
  const [engineer, setEngineer] = useState("");
  const [location, setLocation] = useState("");
  const [tonnage, setTonnage] = useState("");

  const cards = useMemo(
    () =>
      projects.map((p) => ({
        project: p,
        metrics: projectMetrics(p.id),
      })),
    [projects, drawings, rfis],
  );

  function onCreate() {
    if (!name.trim() || !jobNumber.trim()) {
      toast.error("Job name and number are required");
      return;
    }
    const id = createProject({
      name: name.trim(),
      jobNumber: jobNumber.trim(),
      client: client.trim() || "TBD",
      engineer: engineer.trim() || "TBD",
      location: location.trim() || "TBD",
      tonnage: tonnage ? Number(tonnage) : 0,
    });
    setSelectedProjectId(id);
    toast.success(`Job ${jobNumber.trim()} created`);
    setShowCreate(false);
    setName("");
    setJobNumber("");
    setClient("");
    setEngineer("");
    setLocation("");
    setTonnage("");
  }

  function onExport() {
    const pkg = exportPackage();
    downloadJobPackage(pkg);
    toast.success("Job package downloaded");
  }

  async function onImport(file: File | null) {
    if (!file) return;
    try {
      const text = await file.text();
      const pkg = parseJobPackage(JSON.parse(text));
      importPackage(pkg, "replace");
      toast.success(
        `Imported ${pkg.projects.length} job(s), ${pkg.drawings.length} sheet(s)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <AppShell
      title="Jobs"
      subtitle="Steel fab & erection portfolio · production workspace"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {can(crewRole, "job.create") && (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="size-3.5" />
              New job
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="size-3.5" />
            Export
          </Button>
          <label className="inline-flex cursor-pointer">
            <Button size="sm" variant="outline" asChild>
              <span>
                <Upload className="size-3.5" />
                Import
              </span>
            </Button>
            <input
              id="job-package-import"
              name="jobPackage"
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import job package JSON"
              onChange={(e) => {
                void onImport(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          {can(crewRole, "job.delete") && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Remove built-in demo jobs (PMC, warehouse, office tower)? Your other jobs stay.",
                  )
                ) {
                  const n = clearDemoProjects();
                  if (n > 0) {
                    toast.success(`Removed ${n} demo job(s)`);
                  } else {
                    toast.message("No demo jobs left to remove");
                  }
                }
              }}
            >
              <Trash2 className="size-3.5" />
              Remove demos
            </Button>
          )}
          {can(crewRole, "job.reset") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    "Reset all jobs to demo seed? Unsaved local changes will be lost.",
                  )
                ) {
                  resetDemoData();
                  toast.message("Demo data restored");
                }
              }}
            >
              Reset demo
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-[var(--color-muted)]">
          Use <strong className="font-medium text-[var(--color-fg)]">Remove demos</strong> in
          the top bar to drop the sample jobs, or <strong className="font-medium text-[var(--color-fg)]">Delete job</strong> on each card.
          Detailer / PM / Admin can delete.
        </p>

        {showCreate && (
          <div className="panel space-y-3 p-4">
            <h3 className="text-sm font-semibold">New production job</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                id="job-number"
                name="jobNumber"
                aria-label="Job number"
                placeholder="Job number (e.g. SE-26-0042)"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
              />
              <Input
                id="job-name"
                name="name"
                aria-label="Job name"
                placeholder="Job name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                id="job-client"
                name="client"
                aria-label="GC / client"
                placeholder="GC / client"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
              <Input
                id="job-engineer"
                name="engineer"
                aria-label="Engineer of record"
                placeholder="Engineer of record"
                value={engineer}
                onChange={(e) => setEngineer(e.target.value)}
              />
              <Input
                id="job-location"
                name="location"
                aria-label="Location"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Input
                id="job-tonnage"
                name="tonnage"
                aria-label="Contract tonnage"
                placeholder="Contract tonnage"
                value={tonnage}
                onChange={(e) => setTonnage(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={onCreate}>
              Create job
            </Button>
          </div>
        )}

        <div className="grid gap-4">
          {cards.map(({ project, metrics }) => {
            const active = project.id === selectedProjectId;
            return (
              <article
                key={project.id}
                className={
                  active
                    ? "panel border-[var(--color-border-strong)] p-5 sm:p-6"
                    : "panel p-5 sm:p-6"
                }
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-sm font-medium text-[var(--color-accent)]">
                        {project.jobNumber}
                      </span>
                      <ProjectStatusBadge status={project.status} />
                      {active && (
                        <span className="rounded-full bg-[var(--color-primary)]/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-primary)]">
                          Active
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">
                      {project.name}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                      {project.description || "No description yet."}
                    </p>
                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <Item label="GC / Client" value={project.client} />
                      <Item label="Engineer of record" value={project.engineer} />
                      <Item label="Location" value={project.location} />
                      <Item
                        label="Contract tonnage"
                        value={formatTons(project.tonnage)}
                      />
                      <Item label="Detailer" value={project.detailerFirm || "—"} />
                      <Item label="Fab shop" value={project.fabShop || "—"} />
                      <Item label="Start" value={formatDate(project.startDate)} />
                      <Item
                        label="Target complete"
                        value={formatDate(project.targetComplete)}
                      />
                    </dl>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[220px]">
                    <Metric label="Sheets" value={metrics.total} />
                    <Metric label="On hold" value={metrics.onHold} />
                    <Metric label="Open RFIs" value={metrics.openRfis} />
                    <Metric label="Pieces" value={metrics.pieceCount} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    {active ? "Active job" : "Make active"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/drawings">Open register</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/viewer">Viewer</Link>
                  </Button>
                  {can(crewRole, "job.delete") && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete job ${project.jobNumber} — ${project.name}? All sheets, RFIs, holds, and sequences on this job will be removed.`,
                          )
                        ) {
                          const ok = deleteProject(project.id);
                          if (ok) {
                            toast.success(`Deleted ${project.jobNumber}`);
                          }
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete job
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </dt>
      <dd className="text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className="font-mono-num text-lg font-semibold">{value}</div>
    </div>
  );
}
