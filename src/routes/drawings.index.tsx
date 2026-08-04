import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { SHEET_UPLOAD_ACCEPT } from "@/components/viewer/real-sheet-viewer";
import { attachSheetsFromFiles } from "@/lib/attach-sheet";
import { useMemo, useState } from "react";
import { SetRegister } from "@/components/drawings/set-register";
import { TitleBlockMapper } from "@/components/drawings/title-block-mapper";
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
  const createDrawingSet = useAppStore((s) => s.createDrawingSet);
  const createDrawing = useAppStore((s) => s.createDrawing);
  const setSheetAsset = useAppStore((s) => s.setSheetAsset);
  const allDrawings = useAppStore((s) => s.drawings);
  const [showAdd, setShowAdd] = useState(false);
  const [showTitleMap, setShowTitleMap] = useState(false);
  const [sheetNo, setSheetNo] = useState("");
  const [sheetTitle, setSheetTitle] = useState("");
  const [setCode, setSetCode] = useState("SET-SHOP");

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
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="size-3.5" />
            Add sheet
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowTitleMap((v) => !v)}
          >
            Title-block map
          </Button>
          <label className="inline-flex">
            <Button size="sm" variant="outline" asChild>
              <span>
                <Upload className="size-3.5" />
                Upload PDFs
              </span>
            </Button>
            <input
              id="register-bulk-pdf"
              name="bulkPdfs"
              type="file"
              multiple
              accept={SHEET_UPLOAD_ACCEPT}
              className="sr-only"
              aria-label="Upload drawing PDFs"
              onChange={(e) => {
                void (async () => {
                  const files = e.target.files;
                  if (!files?.length || !project) return;
                  const result = await attachSheetsFromFiles({
                    files: Array.from(files),
                    projectId: project.id,
                    createIfMissing: true,
                  });
                  if (result.attached) {
                    const bits = [`Attached ${result.attached} sheet(s)`];
                    if (result.splitPdfs)
                      bits.push(
                        `split ${result.splitPdfs} multi-page PDF(s)`,
                      );
                    if (result.created)
                      bits.push(`${result.created} new row(s)`);
                    toast.success(bits.join(" · "));
                  }
                  if (result.failed.length) {
                    toast.message(
                      `Failed: ${result.failed.slice(0, 3).join(", ")}`,
                    );
                  }
                  e.target.value = "";
                })();
              }}
            />
          </label>
        </div>
      }
      subtitle={
        project
          ? `${project.jobNumber} · ${filteredSets.length} of ${counts.sets} sets · ${counts.sheets} sheets`
          : undefined
      }
    >
      <div className="space-y-4">
        {showTitleMap && project && (
          <TitleBlockMapper projectId={project.id} />
        )}
        {showAdd && project && (
          <div className="panel space-y-3 p-4">
            <h3 className="text-sm font-semibold">New sheet on {project.jobNumber}</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                aria-label="Set code"
                placeholder="Set code (e.g. SET-AB-01)"
                value={setCode}
                onChange={(e) => setSetCode(e.target.value)}
              />
              <Input
                aria-label="Sheet number"
                placeholder="Sheet number (e.g. S-401)"
                value={sheetNo}
                onChange={(e) => setSheetNo(e.target.value)}
              />
              <Input
                aria-label="Sheet title"
                placeholder="Title"
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (!sheetNo.trim() || !sheetTitle.trim()) {
                  toast.error("Number and title required");
                  return;
                }
                let setId = projectSets.find(
                  (s) => s.code.toLowerCase() === setCode.trim().toLowerCase(),
                )?.id;
                if (!setId) {
                  setId = createDrawingSet({
                    projectId: project.id,
                    code: setCode.trim() || "SET-NEW",
                    name: setCode.trim() || "New set",
                    type: "shop",
                  });
                }
                createDrawing({
                  projectId: project.id,
                  setId,
                  number: sheetNo.trim(),
                  title: sheetTitle.trim(),
                  type: "shop",
                });
                toast.success(`Added ${sheetNo.trim()}`);
                setShowAdd(false);
                setSheetNo("");
                setSheetTitle("");
              }}
            >
              Create sheet
            </Button>
          </div>
        )}

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
              <Input aria-label="e.g. SET-L34, BR-3, E-101"
                value={filters.query}
                onChange={(e) => setFilters({ query: e.target.value })}
                placeholder="e.g. SET-L34, BR-3, E-101"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Drawing set
              </label>
              <Select aria-label="Select field"
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
              <Select aria-label="Select field"
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
              <Select aria-label="Select field"
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
              <Select aria-label="Select field"
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
