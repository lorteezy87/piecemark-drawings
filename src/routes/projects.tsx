import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
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

  const cards = useMemo(
    () =>
      projects.map((p) => ({
        project: p,
        metrics: projectMetrics(p.id),
      })),
    [projects, drawings, rfis],
  );

  return (
    <AppShell
      title="Jobs"
      subtitle="Steel fab & erection portfolio"
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetDemoData();
          }}
        >
          Reset demo
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-[var(--color-muted)]">
          Each job carries its own drawing register, erection sequences, submittal
          packages, and RFI log. Switch the active job from the sidebar to drive
          every other view.
        </p>

        <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-1">
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
                      {project.description}
                    </p>
                    <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <Item label="GC / Client" value={project.client} />
                      <Item label="Engineer of record" value={project.engineer} />
                      <Item label="Location" value={project.location} />
                      <Item label="Contract tonnage" value={formatTons(project.tonnage)} />
                      <Item label="Detailer" value={project.detailerFirm} />
                      <Item label="Fab shop" value={project.fabShop} />
                      <Item label="Start" value={formatDate(project.startDate)} />
                      <Item
                        label="Target complete"
                        value={formatDate(project.targetComplete)}
                      />
                    </dl>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[220px]">
                    <Metric label="Sheets" value={metrics.total} />
                    <Metric
                      label="Released"
                      value={`${metrics.fabReadyPct}%`}
                      tone="success"
                    />
                    <Metric
                      label="Holds"
                      value={metrics.onHold}
                      tone={metrics.onHold ? "warn" : "default"}
                    />
                    <Metric
                      label="Open RFIs"
                      value={metrics.openRfis}
                      tone={metrics.openRfis ? "danger" : "default"}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    {active ? "Currently active" : "Set as active job"}
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to="/drawings"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      Open register
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link
                      to="/"
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      Command center
                    </Link>
                  </Button>
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

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warn" | "danger";
}) {
  const color = {
    default: "text-[var(--color-fg)]",
    success: "text-[var(--color-success)]",
    warn: "text-[var(--color-warn)]",
    danger: "text-[var(--color-danger)]",
  }[tone];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className={`font-mono-num text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
