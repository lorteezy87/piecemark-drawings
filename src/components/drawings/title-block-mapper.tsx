import {
  Crop,
  Eraser,
  Loader2,
  Save,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  TITLE_BLOCK_FIELD_COLORS,
  TITLE_BLOCK_FIELD_LABELS,
  type NormRect,
  type TitleBlockField,
  type TitleBlockMap,
  clampNormRect,
  emptyTitleBlockMap,
  hasAnyRegion,
} from "@/lib/title-block";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  className?: string;
  /**
   * Files from an in-progress upload set. First PDF page is loaded as the map
   * sample so the user titles off the package being submitted.
   */
  seedFiles?: File[] | null;
  /** Called after Save when used in the upload wizard. */
  onSaved?: (map: TitleBlockMap) => void;
  /** Optional: continue without mapping */
  onSkip?: () => void;
  /** Primary action label when used as upload gate */
  confirmLabel?: string;
};

type CanvasBag = {
  /** Full-res page bitmap (high DPI) */
  bg: HTMLCanvasElement;
  cssW: number;
  cssH: number;
};

/**
 * Draw boxes on a sheet for Title / Sheet no. / Rev.
 * Renders the page at high resolution; zoom for tight title-block boxes.
 */
export function TitleBlockMapper({
  projectId,
  className,
  seedFiles,
  onSaved,
  onSkip,
  confirmLabel,
}: Props) {
  const map = useAppStore((s) => s.titleBlockMaps[projectId]);
  const setTitleBlockMap = useAppStore((s) => s.setTitleBlockMap);
  const clearTitleBlockMap = useAppStore((s) => s.clearTitleBlockMap);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bitmapRef = useRef<CanvasBag | null>(null);
  const [activeField, setActiveField] = useState<TitleBlockField>("title");
  const [local, setLocal] = useState<TitleBlockMap>(
    () => map ?? emptyTitleBlockMap(projectId),
  );
  const [pageReady, setPageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [viewZoom, setViewZoom] = useState(1);
  const drag = useRef<{
    x0: number;
    y0: number;
    drawing: boolean;
  } | null>(null);
  const [previewRect, setPreviewRect] = useState<NormRect | null>(null);
  const seedKey = useRef<string>("");

  useEffect(() => {
    setLocal(map ?? emptyTitleBlockMap(projectId));
  }, [map, projectId]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const pack = bitmapRef.current;
    if (!canvas || !pack || !pageReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const dispW = pack.cssW * viewZoom;
    const dispH = pack.cssH * viewZoom;
    canvas.style.width = `${dispW}px`;
    canvas.style.height = `${dispH}px`;
    canvas.width = Math.round(dispW * dpr);
    canvas.height = Math.round(dispH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.drawImage(pack.bg, 0, 0, dispW, dispH);

    const fields: TitleBlockField[] = ["title", "sheetNo", "rev"];
    for (const f of fields) {
      const r = f === activeField && previewRect ? previewRect : local[f];
      if (!r) continue;
      const col = TITLE_BLOCK_FIELD_COLORS[f];
      const x = r.x * dispW;
      const y = r.y * dispH;
      const w = r.w * dispW;
      const h = r.h * dispH;
      ctx.fillStyle = col.fill;
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = (f === activeField ? 2.5 : 1.5) / Math.sqrt(viewZoom);
      ctx.setLineDash(f === activeField ? [] : [4, 3]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = col.stroke;
      ctx.font = `600 ${11 / Math.sqrt(viewZoom)}px IBM Plex Sans, system-ui, sans-serif`;
      ctx.fillText(TITLE_BLOCK_FIELD_LABELS[f], x + 4, y + 12);
    }
  }, [local, activeField, previewRect, pageReady, viewZoom]);

  useEffect(() => {
    paint();
  }, [paint]);

  async function loadSample(file: File | null, opts?: { pageIndex?: number }) {
    if (!file) return;
    setLoading(true);
    setPageReady(false);
    setFileName(file.name);
    try {
      const pdfjs = await import("pdfjs-dist");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true })
        .promise;
      setPageCount(doc.numPages);
      const pageIndex = Math.min(
        Math.max(1, opts?.pageIndex ?? 1),
        doc.numPages,
      );
      const page = await doc.getPage(pageIndex);
      const base = page.getViewport({ scale: 1 });

      // High-res render: aim ~2200–2800px wide bitmap for crisp title-block text
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const wrapW = wrapRef.current?.clientWidth ?? 960;
      const cssW = Math.min(1400, Math.max(720, wrapW - 16));
      const cssH = cssW * (base.height / base.width);
      // Internal bitmap larger than CSS for sharpness when zoomed
      const targetPxW = Math.min(3200, Math.max(2000, cssW * dpr * 1.75));
      const scale = targetPxW / base.width;
      const viewport = page.getViewport({ scale });

      const bg = document.createElement("canvas");
      bg.width = Math.floor(viewport.width);
      bg.height = Math.floor(viewport.height);
      const bgCtx = bg.getContext("2d", { alpha: false });
      if (!bgCtx) throw new Error("Canvas not available");
      bgCtx.fillStyle = "#ffffff";
      bgCtx.fillRect(0, 0, bg.width, bg.height);
      await page.render({
        canvasContext: bgCtx,
        viewport,
        canvas: bg,
      }).promise;

      try {
        doc.cleanup();
      } catch {
        /* ignore */
      }

      bitmapRef.current = { bg, cssW, cssH };
      setViewZoom(1);
      setLocal((m) => ({
        ...m,
        pageAspect: cssW / cssH,
      }));
      setPageReady(true);
      // Default zoom into lower-right title block for easier mapping
      requestAnimationFrame(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        wrap.scrollLeft = Math.max(0, cssW - wrap.clientWidth);
        wrap.scrollTop = Math.max(0, cssH - wrap.clientHeight);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open PDF");
    } finally {
      setLoading(false);
    }
  }

  // Load first PDF from the package being uploaded
  useEffect(() => {
    if (!seedFiles?.length) return;
    const key = seedFiles.map((f) => `${f.name}:${f.size}`).join("|");
    if (key === seedKey.current) return;
    seedKey.current = key;
    const pdf =
      seedFiles.find((f) => /\.pdf$/i.test(f.name) || f.type.includes("pdf")) ??
      seedFiles[0];
    void loadSample(pdf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFiles]);

  function clientToNorm(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!pageReady) return;
    const p = clientToNorm(e);
    drag.current = { x0: p.x, y0: p.y, drawing: true };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setPreviewRect({ x: p.x, y: p.y, w: 0.01, h: 0.01 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current?.drawing) return;
    const p = clientToNorm(e);
    const x = Math.min(drag.current.x0, p.x);
    const y = Math.min(drag.current.y0, p.y);
    const w = Math.abs(p.x - drag.current.x0);
    const h = Math.abs(p.y - drag.current.y0);
    setPreviewRect(clampNormRect({ x, y, w, h }));
  }

  function onPointerUp() {
    if (!drag.current?.drawing || !previewRect) {
      drag.current = null;
      setPreviewRect(null);
      return;
    }
    drag.current = null;
    if (previewRect.w < 0.008 || previewRect.h < 0.006) {
      setPreviewRect(null);
      return;
    }
    const rect = clampNormRect(previewRect);
    setLocal((m) => ({ ...m, [activeField]: rect }));
    setPreviewRect(null);
  }

  function save() {
    const next: TitleBlockMap = {
      ...local,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    if (!hasAnyRegion(next)) {
      toast.error("Draw at least one box (Title, Sheet no., or Rev)");
      return;
    }
    setTitleBlockMap(next);
    toast.success("Title-block map saved — applying to this set");
    onSaved?.(next);
  }

  function clearField(field: TitleBlockField) {
    setLocal((m) => ({ ...m, [field]: null }));
  }

  const inUploadFlow = !!seedFiles?.length;

  return (
    <div className={cn("panel space-y-3 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Crop className="size-4 text-[var(--color-accent)]" />
            {inUploadFlow
              ? "Map title block on this set"
              : "Title-block map"}
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)]">
            {inUploadFlow
              ? "Using the first page of the package you selected. Zoom in, box Title / Sheet no. / Rev, then continue — every page in this set uses those boxes."
              : "Load a sample sheet (or map during Upload). High-res preview + zoom so title-block text stays sharp."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!inUploadFlow && (
            <label className="inline-flex">
              <Button size="sm" variant="outline" asChild disabled={loading}>
                <span>
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Crop className="size-3.5" />
                  )}
                  Sample PDF
                </span>
              </Button>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                aria-label="Load sample PDF for title-block mapping"
                onChange={(e) => {
                  void loadSample(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Zoom out"
            disabled={!pageReady || viewZoom <= 1}
            onClick={() => setViewZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Zoom in"
            disabled={!pageReady || viewZoom >= 4}
            onClick={() => setViewZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
          >
            <ZoomIn className="size-3.5" />
          </Button>
          <span className="inline-flex h-8 items-center font-mono-num text-[11px] text-[var(--color-muted)]">
            {Math.round(viewZoom * 100)}%
          </span>
          <Button
            size="sm"
            onClick={save}
            disabled={!pageReady && !hasAnyRegion(local)}
          >
            <Save className="size-3.5" />
            {confirmLabel ?? (inUploadFlow ? "Save & continue upload" : "Save map")}
          </Button>
          {inUploadFlow && onSkip && (
            <Button size="sm" variant="secondary" onClick={onSkip}>
              <Upload className="size-3.5" />
              Skip map · upload anyway
            </Button>
          )}
          {!inUploadFlow && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearTitleBlockMap(projectId);
                setLocal(emptyTitleBlockMap(projectId));
                toast.message("Title-block map cleared");
              }}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["title", "sheetNo", "rev"] as TitleBlockField[]).map((f) => {
          const col = TITLE_BLOCK_FIELD_COLORS[f];
          const set = !!local[f];
          return (
            <button
              key={f}
              type="button"
              onClick={() => setActiveField(f)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-xs font-medium transition-colors",
                activeField === f
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                  : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]",
              )}
            >
              <span
                className="size-2.5 rounded-sm"
                style={{ background: col.stroke }}
              />
              {TITLE_BLOCK_FIELD_LABELS[f]}
              {set ? " · set" : ""}
              {set && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-1 text-[var(--color-subtle)] hover:text-[var(--color-danger)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearField(f);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      clearField(f);
                    }
                  }}
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(fileName || loading) && (
        <div className="text-[11px] text-[var(--color-subtle)]">
          {loading && "Rendering high-res page… "}
          {fileName && (
            <>
              Set page: <span className="font-medium text-[var(--color-muted)]">{fileName}</span>
              {pageCount > 1 ? ` · ${pageCount} pages in package` : ""}
              {hasAnyRegion(map) && " · job map on file"}
            </>
          )}
        </div>
      )}

      <div
        ref={wrapRef}
        className="max-h-[min(70vh,720px)] overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[#1a1c20]"
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.25 : 0.25;
          setViewZoom((z) => Math.min(4, Math.max(1, +(z + delta).toFixed(2))));
        }}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "block touch-none",
            pageReady ? "cursor-crosshair" : "min-h-[200px] w-full",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!pageReady && !loading && (
          <div className="flex min-h-[200px] items-center justify-center px-4 py-10 text-center text-sm text-[var(--color-muted)]">
            {inUploadFlow
              ? "Loading first page of the set…"
              : "Load a sample PDF, or use Upload PDFs to map off the set you submit."}
          </div>
        )}
        {loading && (
          <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-[var(--color-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Rendering crisp title-block preview…
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--color-subtle)]">
        Tip: zoom in on the title block (buttons or Ctrl/⌘ + scroll), then drag
        tight boxes around Title, Sheet no., and Rev only.
      </p>
    </div>
  );
}
