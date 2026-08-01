import { createFileRoute } from "@tanstack/react-router";
import { Filter, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { SetRegister } from "@/components/drawings/set-register";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DRAWING_STATUS_LABELS,
  DRAWING_TYPE_LABELS,
  type DrawingStatus,
  type DrawingType,
} from "@/lib/types";
import {
  filterDrawingSets,
  useAppStore,
  useSelectedProject,
} from "@/lib/store";

export const Route = createFileRoute("/drawings/")({
  component: DrawingsPage,
});

function DrawingsPage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const sequences = useAppStore((s) => s.sequences);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);

  const projectSeqs = useMemo(
    () =>
      sequences
        .filter((s) => s.projectId === project?.id)
        .sort((a, b) => a.number - b.number),
    [sequences, project?.id],
  );

  const projectSets = useMemo(
    () => drawingSets.filter((s) => s.projectId === project?.id),
    [drawingSets, project?.id],
  );

  const filteredSets = useMemo(
    () => filterDrawingSets(drawingSets, drawings, filters, project?.id),
    [drawingSets, drawings, filters, project?.id],
  );

  const counts = useMemo(() => {
    const all = projectSets;
    const sheets = drawings.filter((d) => d.projectId === project?.id);
    return {
      sets: all.length,
      sheets: sheets.length,
      hold: sheets.filter((d) => d.status === "on_hold").length,
      field: sheets.filter((d) => d.status === "issued_for_erection").length,
      fab: sheets.filter((d) => d.status === "issued_for_fab").length,
    };
  }, [projectSets, drawings, project?.id]);

  return (
    <AppShell
      title="Drawing Sets"
      subtitle={
        project
          ? `${project.jobNumber} · ${filteredSets.length} of ${counts.sets} sets · ${counts.sheets} sheets`
          : undefined
      }
    >
      <div className="space-y-4">
        <p className="max-w-3xl text-sm text-[var(--color-muted)]">
          Track work by <span className="text-[var(--color-fg)]">named drawing set</span>{" "}
          (the parent package). Expand a set to see its child sheets, or open the set
          for full package status, RFIs, and submittals.
        </p>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={!filters.holdsOnly && filters.status === "all"}
            onClick={() => resetFilters()}
            label={`All sets (${counts.sets})`}
          />
          <FilterChip
            active={filters.holdsOnly}
            onClick={() => setFilters({ holdsOnly: true, status: "all" })}
            label={`With holds (${counts.hold} sheets)`}
          />
          <FilterChip
            active={filters.status === "issued_for_erection"}
            onClick={() =>
              setFilters({ status: "issued_for_erection", holdsOnly: false })
            }
            label={`Field IFC sheets (${counts.field})`}
          />
          <FilterChip
            active={filters.status === "issued_for_fab"}
            onClick={() =>
              setFilters({ status: "issued_for_fab", holdsOnly: false })
            }
            label={`Issued for fab (${counts.fab})`}
          />
        </div>

        <div className="panel p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--color-subtle)]">
            <Filter className="size-3.5" />
            Filters
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Search set, sheet, or piece mark
              </label>
              <Input
                value={filters.query}
                onChange={(e) => setFilters({ query: e.target.value })}
                placeholder="e.g. SET-L34, BR-3, E-101"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Drawing set
              </label>
              <Select
                value={filters.setId}
                onChange={(e) => setFilters({ setId: e.target.value })}
              >
                <option value="all">All sets</option>
                {projectSets
                  .slice()
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Type
              </label>
              <Select
                value={filters.type}
                onChange={(e) =>
                  setFilters({ type: e.target.value as DrawingType | "all" })
                }
              >
                <option value="all">All types</option>
                {(Object.keys(DRAWING_TYPE_LABELS) as DrawingType[]).map((t) => (
                  <option key={t} value={t}>
                    {DRAWING_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Status
              </label>
              <Select
                value={filters.status}
                onChange={(e) =>
                  setFilters({
                    status: e.target.value as DrawingStatus | "all",
                    holdsOnly: false,
                  })
                }
              >
                <option value="all">All statuses</option>
                {(Object.keys(DRAWING_STATUS_LABELS) as DrawingStatus[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {DRAWING_STATUS_LABELS[s]}
                    </option>
                  ),
                )}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Sequence
              </label>
              <Select
                value={filters.sequenceId}
                onChange={(e) => setFilters({ sequenceId: e.target.value })}
              >
                <option value="all">All sequences</option>
                {projectSeqs.map((s) => (
                  <option key={s.id} value={s.id}>
                    Seq {s.number} — {s.area}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="size-3.5" />
              Reset filters
            </Button>
          </div>
        </div>

        <SetRegister
          sets={filteredSets}
          drawings={drawings}
          sequences={projectSeqs}
          defaultExpanded={Boolean(filters.query.trim() || filters.setId !== "all")}
        />
      </div>
    </AppShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-fg)]"
          : "rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
      }
    >
      {label}
    </button>
  );
}
