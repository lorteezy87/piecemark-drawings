import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Box,
  FileImage,
  FileUp,
  Layers3,
  Link2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  RealSheetViewer,
  SHEET_UPLOAD_ACCEPT,
} from "@/components/viewer/real-sheet-viewer";
import { IfcModelViewer } from "@/components/viewer/ifc-model-viewer";
import type { IfcPickInfo } from "@/lib/ifc-loader";
import { AppShell } from "@/components/layout/app-shell";
import { DrawingStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { toast } from "sonner";
import { attachSheetsFromFiles } from "@/lib/attach-sheet";
import { DRAWING_TYPE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewerSearch = {
  mode?: "sheet" | "ifc";
  drawingId?: string;
  mark?: string;
};

export const Route = createFileRoute("/viewer")({
  validateSearch: (search: Record<string, unknown>): ViewerSearch => ({
    mode: search.mode === "ifc" ? "ifc" : search.mode === "sheet" ? "sheet" : undefined,
    drawingId: typeof search.drawingId === "string" ? search.drawingId : undefined,
    mark: typeof search.mark === "string" ? search.mark : undefined,
  }),
  component: ViewerPage,
});

function ViewerPage() {
  const project = useSelectedProject();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const drawings = useAppStore((s) => s.drawings);
  const markups = useAppStore((s) => s.markups);
  const sheetAssets = useAppStore((s) => s.sheetAssets);
  const setSheetAsset = useAppStore((s) => s.setSheetAsset);
  const clearSheetAsset = useAppStore((s) => s.clearSheetAsset);
  const upsertDrawingMarks = useAppStore((s) => s.upsertDrawingMarks);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const projectDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.projectId === project?.id)
        .sort((a, b) => a.number.localeCompare(b.number)),
    [drawings, project?.id],
  );

  const [mode, setMode] = useState<"sheet" | "ifc">(
    search.mode === "ifc" ? "ifc" : "sheet",
  );
  const [drawingId, setDrawingId] = useState(
    search.drawingId ?? projectDrawings[0]?.id ?? "",
  );
  const [selectedMark, setSelectedMark] = useState<string | null>(
    search.mark ?? null,
  );
  const [split, setSplit] = useState(false);

  const drawing =
    projectDrawings.find((d) => d.id === drawingId) ?? projectDrawings[0];

  const pieceStatus = useMemo(() => {
    const map: Record<string, { onHold: boolean }> = {};
    for (const d of projectDrawings) {
      for (const m of d.pieceMarks) {
        map[m] = { onHold: d.status === "on_hold" };
      }
    }
    return map;
  }, [projectDrawings]);

  const dwgMarkups = useMemo(
    () => (drawing ? markups.filter((m) => m.drawingId === drawing.id) : []),
    [markups, drawing],
  );

  const sheetAsset = drawing ? sheetAssets[drawing.id] : undefined;
  const showRealSheet = !!sheetAsset;

  async function reportAttach(
    result: Awaited<ReturnType<typeof attachSheetsFromFiles>>,
  ) {
    if (result.attached) {
      const bits: string[] = [`Attached ${result.attached} sheet(s)`];
      if (result.splitPdfs > 0) {
        bits.push(
          `split ${result.splitPdfs} multi-page PDF(s) into one sheet per page`,
        );
      }
      if (result.created > 0) bits.push(`${result.created} new row(s)`);
      toast.success(bits.join(" · "));
      setMode("sheet");
      setSplit(false);
      const firstId = result.drawingIds[0];
      if (firstId) setDrawingId(firstId);
    }
    if (result.failed.length) {
      toast.message(
        `Could not attach: ${result.failed.slice(0, 3).join(", ")}${
          result.failed.length > 3 ? "…" : ""
        }`,
      );
      if (!result.attached) {
        setUploadError(result.failed[0] ?? "Upload failed");
      }
    }
  }

  async function onUploadSheet(file: File | null) {
    if (!file || !project) return;
    setUploadError(null);
    // Always go through attach (splits multi-page PDFs into one sheet each)
    try {
      const result = await attachSheetsFromFiles({
        files: [file],
        projectId: project.id,
        createIfMissing: true,
        preferSetId: drawing?.setId,
      });
      await reportAttach(result);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function onBulkUploadSheets(files: FileList | null) {
    if (!files?.length || !project) return;
    setUploadError(null);
    try {
      const result = await attachSheetsFromFiles({
        files: Array.from(files),
        projectId: project.id,
        createIfMissing: true,
        preferSetId: drawing?.setId,
      });
      await reportAttach(result);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
  }


  function selectMark(mark: string) {
    setSelectedMark(mark);
    // If mark appears on another sheet, offer that sheet
    const hit = projectDrawings.find((d) => d.pieceMarks.includes(mark));
    if (hit && hit.id !== drawing?.id && mode === "sheet") {
      // keep current sheet unless mark not on it
      if (drawing && !drawing.pieceMarks.includes(mark)) {
        setDrawingId(hit.id);
      }
    }
  }

  function onIfcPick(member: IfcPickInfo) {
    setSelectedMark(member.mark);
    if (member.drawingId) {
      setDrawingId(member.drawingId);
    }
  }

  function setModeAndUrl(next: "sheet" | "ifc") {
    setMode(next);
    navigate({
      to: "/viewer",
      search: {
        mode: next,
        drawingId: drawing?.id,
        mark: selectedMark ?? undefined,
      },
      replace: true,
    });
  }

  if (!project) {
    return (
      <AppShell title="Viewer">
        <p className="text-[var(--color-muted)]">Select a job to view drawings.</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Drawings & IFC Viewer"
      subtitle={`${project.jobNumber} · sheet graphics + structural model twin`}
      actions={
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] p-0.5">
          <Button
            size="sm"
            variant={mode === "sheet" && !split ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => {
              setSplit(false);
              setModeAndUrl("sheet");
            }}
          >
            <FileImage className="size-3.5" />
            <span className="hidden sm:inline">Sheet</span>
          </Button>
          <Button
            size="sm"
            variant={mode === "ifc" && !split ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => {
              setSplit(false);
              setModeAndUrl("ifc");
            }}
          >
            <Box className="size-3.5" />
            <span className="hidden sm:inline">IFC 3D</span>
          </Button>
          <Button
            size="sm"
            variant={split ? "secondary" : "ghost"}
            className="h-8"
            onClick={() => setSplit(true)}
          >
            <Layers3 className="size-3.5" />
            <span className="hidden sm:inline">Split</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* Side panel */}
        <aside className="w-full shrink-0 space-y-3 lg:w-72">
          <div className="panel p-4">
            <label
              htmlFor="viewer-drawing-select"
              className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]"
            >
              Drawing sheet
            </label>
            <Select
              id="viewer-drawing-select"
              name="drawingSheet"
              aria-label="Drawing sheet"
              value={drawing?.id ?? ""}
              onChange={(e) => {
                setDrawingId(e.target.value);
                setSelectedMark(null);
              }}
            >
              {projectDrawings.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.number} — {d.title.slice(0, 36)}
                </option>
              ))}
            </Select>
            {drawing && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <DrawingStatusBadge status={drawing.status} />
                  <span className="text-xs text-[var(--color-muted)]">
                    {DRAWING_TYPE_LABELS[drawing.type]}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-muted)]">{drawing.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {drawing.pieceMarks.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => selectMark(m)}
                      className={cn(
                        "rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono-num text-[11px] transition-colors",
                        selectedMark === m
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-fg)]"
                          : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link
                    to="/drawings/$drawingId"
                    params={{ drawingId: drawing.id }}
                  >
                    Open register card
                  </Link>
                </Button>
                <label
                  htmlFor="sheet-file-upload"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5"
                >
                  <FileUp className="size-3.5 text-[var(--color-accent)]" />
                  Upload real drawing (PDF / image)
                  <input
                    id="sheet-file-upload"
                    name="sheetFile"
                    type="file"
                    accept={SHEET_UPLOAD_ACCEPT}
                    className="sr-only"
                    aria-label="Upload drawing PDF or image"
                    onChange={(e) => {
                      void onUploadSheet(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label
                  htmlFor="sheet-bulk-upload"
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
                >
                  Bulk upload PDFs (auto-match or create sheets)
                  <input
                    id="sheet-bulk-upload"
                    name="sheetBulk"
                    type="file"
                    multiple
                    accept={SHEET_UPLOAD_ACCEPT}
                    className="sr-only"
                    aria-label="Bulk upload drawing PDFs"
                    onChange={(e) => {
                      void onBulkUploadSheets(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-[var(--color-subtle)]">
                  Any filename works. Multi-page PDFs become one sheet per page. Names with a sheet number (E-101, S301) match when empty; otherwise new rows are created.
                </p>
                {sheetAsset && (
                  <div className="space-y-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 text-[11px] text-[var(--color-muted)]">
                    <div className="truncate font-medium text-[var(--color-fg)]">
                      {sheetAsset.name}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => clearSheetAsset(drawing.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
                {uploadError && (
                  <p className="text-xs text-[var(--color-danger)]">{uploadError}</p>
                )}
              </div>
            )}
          </div>

          <div className="panel p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
              <Link2 className="size-3.5" />
              Linked selection
            </div>
            {selectedMark ? (
              <div className="mt-2">
                <div className="font-mono-num text-lg font-semibold">
                  {selectedMark}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Highlighted on the sheet and in the IFC model. Status colors
                  follow the drawing register.
                </p>
                {pieceStatus[selectedMark]?.onHold && (
                  <p className="mt-2 text-xs text-[var(--color-warn)]">
                    Piece is on a held sheet — do not fab / erect.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Click a piece mark bubble on the sheet or a member in the 3D
                model to cross-highlight.
              </p>
            )}
          </div>

          <div className="panel p-4 text-xs leading-relaxed text-[var(--color-muted)]">
            <strong className="text-[var(--color-fg)]">Real drawings + IFC only</strong>
            <p className="mt-1.5">
              Upload shop/erection PDFs — multi-page PDFs split into one sheet per page; multi-select also creates one sheet per file.
              IFC: upload your job model (.ifc / .ifczip). No sample sheets or
              demo models are loaded.
            </p>
          </div>
        </aside>

        {/* Viewports */}
        <div
          className={cn(
            "min-h-[520px] min-w-0 flex-1",
            split ? "grid gap-3 lg:grid-rows-2" : "flex flex-col",
          )}
          style={split ? { minHeight: 720 } : undefined}
        >
          {(mode === "sheet" || split) && drawing && (
            showRealSheet && sheetAsset ? (
              <RealSheetViewer
                asset={sheetAsset}
                title={`${drawing.number} · Rev ${drawing.currentRev}`}
                onClear={() => clearSheetAsset(drawing.id)}
                className={split ? "min-h-[340px]" : "min-h-[560px] flex-1"}
              />
            ) : (
              <div
                className={
                  split
                    ? "panel flex min-h-[340px] flex-col items-center justify-center gap-3 p-8 text-center"
                    : "panel flex min-h-[560px] flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
                }
              >
                <FileUp className="size-8 text-[var(--color-subtle)]" />
                <div>
                  <div className="text-sm font-semibold">
                    No drawing file on {drawing.number}
                  </div>
                  <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
                    Upload a PDF or image for this sheet. Generated placeholders
                    have been removed — only real uploads are shown.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer">
                  <span className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-fg)]">
                    <FileUp className="size-4" />
                    Upload this sheet
                  </span>
                  <input
                    type="file"
                    accept={SHEET_UPLOAD_ACCEPT}
                    className="sr-only"
                    aria-label={`Upload file for ${drawing.number}`}
                    onChange={(e) => {
                      void onUploadSheet(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )
          )}
          {(mode === "ifc" || split) && (
            <IfcModelViewer
              drawings={projectDrawings}
              projectName={project.name}
              selectedMark={selectedMark}
              onSelectMember={onIfcPick}
              onMarksDiscovered={(marks) => {
                if (!project || marks.length === 0) return;
                // only prompt once per session via window flag
                const key = `ifc-marks-${project.id}`;
                if (sessionStorage.getItem(key)) return;
                sessionStorage.setItem(key, "1");
                const r = upsertDrawingMarks(
                  project.id,
                  marks.map((mark) => ({ mark })),
                );
                if (r.marksAdded > 0) {
                  toast.success(
                    `IFC Tags → register: ${r.marksAdded} piece marks indexed`,
                  );
                }
              }}
              className={split ? "min-h-[340px]" : "min-h-[560px] flex-1"}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
