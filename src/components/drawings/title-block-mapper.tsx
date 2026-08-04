import { Crop, Eraser, Loader2, Save } from "lucide-react";
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
};

/**
 * Draw boxes on a sample sheet for Title / Sheet no. / Rev.
 * Regions are saved per job and used when uploading multi-page PDFs.
 */
export function TitleBlockMapper({ projectId, className }: Props) {
  const map = useAppStore((s) => s.titleBlockMaps[projectId]);
  const setTitleBlockMap = useAppStore((s) => s.setTitleBlockMap);
  const clearTitleBlockMap = useAppStore((s) => s.clearTitleBlockMap);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeField, setActiveField] = useState<TitleBlockField>("title");
  const [local, setLocal] = useState<TitleBlockMap>(
    () => map ?? emptyTitleBlockMap(projectId),
  );
  const [pageReady, setPageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const drag = useRef<{
    x0: number;
    y0: number;
    drawing: boolean;
  } | null>(null);
  const [previewRect, setPreviewRect] = useState<NormRect | null>(null);
  const pageSize = useRef({ w: 1, h: 1 });

  useEffect(() => {
    setLocal(map ?? emptyTitleBlockMap(projectId));
  }, [map, projectId]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pageReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // bitmap already drawn underneath — re-render from stored image data
    const img = (canvas as HTMLCanvasElement & { __bg?: ImageData }).__bg;
    if (img) {
      ctx.putImageData(img, 0, 0);
    }
    const fields: TitleBlockField[] = ["title", "sheetNo", "rev"];
    for (const f of fields) {
      const r = f === activeField && previewRect ? previewRect : local[f];
      if (!r) continue;
      const col = TITLE_BLOCK_FIELD_COLORS[f];
      const x = r.x * canvas.width;
      const y = r.y * canvas.height;
      const w = r.w * canvas.width;
      const h = r.h * canvas.height;
      ctx.fillStyle = col.fill;
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = f === activeField ? 2.5 : 1.5;
      ctx.setLineDash(f === activeField ? [] : [4, 3]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = col.stroke;
      ctx.font = "600 11px IBM Plex Sans, system-ui, sans-serif";
      ctx.fillText(TITLE_BLOCK_FIELD_LABELS[f], x + 4, y + 12);
    }
  }, [local, activeField, previewRect, pageReady]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  async function loadSample(file: File | null) {
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
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      // Fit width ~720px
      const targetW = Math.min(720, Math.max(480, wrapRef.current?.clientWidth ?? 640));
      const scale = targetW / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      pageSize.current = { w: canvas.width, h: canvas.height };
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      try {
        doc.cleanup();
      } catch {
        /* ignore */
      }
      const bg = ctx.getImageData(0, 0, canvas.width, canvas.height);
      (canvas as HTMLCanvasElement & { __bg?: ImageData }).__bg = bg;
      setLocal((m) => ({
        ...m,
        pageAspect: canvas.width / canvas.height,
      }));
      setPageReady(true);
      toast.message("Draw boxes: Title, Sheet no., Rev — then Save map");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open PDF");
    } finally {
      setLoading(false);
    }
  }

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
    if (previewRect.w < 0.015 || previewRect.h < 0.01) {
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
    toast.success("Title-block map saved for this job");
  }

  function clearField(field: TitleBlockField) {
    setLocal((m) => ({ ...m, [field]: null }));
  }

  return (
    <div className={cn("panel space-y-3 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Crop className="size-4 text-[var(--color-accent)]" />
            Title-block map
          </h3>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--color-muted)]">
            Load one sample sheet from this job, pick a field, then drag a box
            over the title block. Uploads use these boxes for Title, Sheet no.,
            and Rev on every page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button size="sm" onClick={save} disabled={!pageReady && !hasAnyRegion(local)}>
            <Save className="size-3.5" />
            Save map
          </Button>
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

      {fileName && (
        <div className="text-[11px] text-[var(--color-subtle)]">
          Sample: {fileName}
          {hasAnyRegion(map) && " · map saved for this job"}
        </div>
      )}

      <div
        ref={wrapRef}
        className="overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "mx-auto block max-w-full touch-none",
            pageReady ? "cursor-crosshair" : "min-h-[160px]",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!pageReady && !loading && (
          <div className="flex min-h-[160px] items-center justify-center px-4 py-10 text-center text-sm text-[var(--color-muted)]">
            Load a sample PDF (first page) to draw title-block boxes.
          </div>
        )}
      </div>
    </div>
  );
}
