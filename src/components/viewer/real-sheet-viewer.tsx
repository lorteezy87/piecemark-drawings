import {
  Expand,
  FileUp,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { destroyPdf, loadPdfjs } from "@/lib/pdfjs";
import type { SheetAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  asset: SheetAsset;
  title?: string;
  onClear?: () => void;
  className?: string;
};

/**
 * View a real uploaded drawing (PDF or image) with pan / zoom / scroll / fullscreen.
 * PDFs are rendered via pdf.js (not iframe) so zoomed sheets can be panned.
 */
export function RealSheetViewer({ asset, title, onClear, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const isPdf =
    asset.mime === "application/pdf" ||
    asset.name.toLowerCase().endsWith(".pdf");
  const isImage = asset.mime.startsWith("image/");

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pageCount, setPageCount] = useState(1);
  const [pageIndex, setPageIndex] = useState(1);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spaceDown = useRef(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  // Reset view when asset changes
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setPageIndex(1);
    setNatural(null);
    setRenderError(null);
  }, [asset.url]);

  // Space = temporary pan mode (CAD-style)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceDown.current = true;
        if (wrapRef.current) wrapRef.current.style.cursor = "grab";
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        if (wrapRef.current) wrapRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Load image natural size
  useEffect(() => {
    if (!isImage) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = asset.url;
  }, [asset.url, isImage]);

  // Render PDF page to offscreen bitmap, then display via canvas in content
  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setRenderError(null);
      // Only the rendered bitmap outlives this effect; the parsed document and
      // its worker are released in `finally` on every exit path (done,
      // cancelled, or the file failed to load).
      let task: { destroy(): Promise<void> } | null = null;
      try {
        const pdfjs = await loadPdfjs();
        const res = await fetch(asset.url);
        const data = new Uint8Array(await res.arrayBuffer());
        const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true });
        task = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        const idx = Math.min(Math.max(1, pageIndex), doc.numPages);
        const page = await doc.getPage(idx);
        const base = page.getViewport({ scale: 1 });
        // High-res bitmap for crisp zoom
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.min(2800, Math.max(1600, base.width * dpr * 1.5));
        const renderScale = targetW / base.width;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        }).promise;
        if (cancelled) return;
        pdfCanvasRef.current = canvas;
        // CSS size ~ fit width of wrap at scale 1
        const wrap = wrapRef.current;
        const cssW = wrap
          ? Math.min(wrap.clientWidth - 24, 1200)
          : Math.min(base.width, 1000);
        const cssH = cssW * (base.height / base.width);
        setNatural({ w: cssW, h: cssH });
      } catch (e) {
        if (!cancelled) {
          setRenderError(
            e instanceof Error ? e.message : "Could not render PDF",
          );
        }
      } finally {
        await destroyPdf(task);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset.url, isPdf, pageIndex]);

  // Paint PDF canvas into display surface when natural size / scale ready
  useEffect(() => {
    if (!isPdf || !pdfCanvasRef.current || !natural) return;
    const display = contentRef.current?.querySelector(
      "canvas[data-sheet-pdf]",
    ) as HTMLCanvasElement | null;
    if (!display) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = natural.w * scale;
    const cssH = natural.h * scale;
    display.style.width = `${cssW}px`;
    display.style.height = `${cssH}px`;
    display.width = Math.round(cssW * dpr);
    display.height = Math.round(cssH * dpr);
    const ctx = display.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(pdfCanvasRef.current, 0, 0, cssW, cssH);
  }, [isPdf, natural, scale, loading, pageIndex]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !natural) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const pad = 24;
    const sx = (wrap.clientWidth - pad) / natural.w;
    const sy = (wrap.clientHeight - pad) / natural.h;
    const s = Math.min(sx, sy, 1.25);
    setScale(Math.max(0.15, s));
    setOffset({
      x: Math.max(0, (wrap.clientWidth - natural.w * s) / 2),
      y: Math.max(0, (wrap.clientHeight - natural.h * s) / 2),
    });
  }, [natural]);

  useEffect(() => {
    if (natural) fit();
  }, [natural, isFullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  function zoomBy(delta: number, clientX?: number, clientY?: number) {
    const wrap = wrapRef.current;
    setScale((prev) => {
      const next = Math.min(6, Math.max(0.15, prev + delta));
      if (wrap && clientX != null && clientY != null && natural) {
        const rect = wrap.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        // Keep point under cursor stable
        setOffset((off) => {
          const wx = (mx - off.x) / prev;
          const wy = (my - off.y) / prev;
          return {
            x: mx - wx * next,
            y: my - wy * next,
          };
        });
      }
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    // Left-drag always pans when zoomed or space held; middle always pans
    const canPan = e.button === 1 || spaceDown.current || scale > 1.02;
    if (!canPan && e.button === 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    // Shift+wheel or trackpad horizontal → pan; else zoom toward cursor
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      setOffset((off) => ({
        x: off.x - (e.deltaX || e.deltaY),
        y: off.y - (e.deltaX ? e.deltaY : 0),
      }));
      return;
    }
    zoomBy(e.deltaY > 0 ? -0.12 : 0.12, e.clientX, e.clientY);
  }

  const showChrome = isPdf || isImage;

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)]",
        isFullscreen && "h-screen min-h-screen rounded-none border-0",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {title ?? "Uploaded drawing"}
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            {asset.name} · {(asset.size / 1024).toFixed(0)} KB ·{" "}
            {isPdf ? "PDF" : isImage ? "Image" : asset.mime} · drag to pan ·
            scroll to zoom · Shift+scroll pan · Space+drag pan
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showChrome && (
            <>
              {isPdf && pageCount > 1 && (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pageIndex <= 1}
                    onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <Minus className="size-4 rotate-90" />
                  </Button>
                  <span className="min-w-[3.5rem] text-center font-mono-num text-xs text-[var(--color-muted)]">
                    {pageIndex}/{pageCount}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={pageIndex >= pageCount}
                    onClick={() =>
                      setPageIndex((p) => Math.min(pageCount, p + 1))
                    }
                    aria-label="Next page"
                  >
                    <Plus className="size-4 rotate-90" />
                  </Button>
                </>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => zoomBy(-0.15)}
                aria-label="Zoom out"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-12 text-center font-mono-num text-xs text-[var(--color-muted)]">
                {Math.round(scale * 100)}%
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => zoomBy(0.15)}
                aria-label="Zoom in"
              >
                <Plus className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={fit}
                aria-label="Fit"
                title="Fit to view"
              >
                <Expand className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setScale(1);
                  setOffset({ x: 12, y: 12 });
                }}
                aria-label="Reset view"
              >
                <RotateCcw className="size-4" />
              </Button>
            </>
          )}
          {onClear && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onClear}
              aria-label="Remove upload"
              title="Remove uploaded file"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant={isFullscreen ? "secondary" : "ghost"}
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-[#1a1c20] cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[var(--color-muted)]">
            Rendering sheet…
          </div>
        )}
        {renderError && (
          <div className="flex h-full items-center justify-center p-6 text-sm text-[var(--color-danger)]">
            {renderError}
          </div>
        )}
        {isPdf && !renderError && (
          <div
            ref={contentRef}
            className="absolute origin-top-left"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          >
            <canvas data-sheet-pdf className="block bg-white shadow-2xl" />
          </div>
        )}
        {isImage && (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <img
            src={asset.url}
            alt={asset.name}
            draggable={false}
            className="absolute max-w-none select-none shadow-2xl"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "0 0",
            }}
            onDoubleClick={() => void toggleFullscreen()}
          />
        )}
        {!isPdf && !isImage && (
          <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-[var(--color-muted)]">
            <FileUp className="size-4" />
            Unsupported type {asset.mime}. Use PDF, PNG, or JPG.
          </div>
        )}
      </div>
    </div>
  );
}

export const SHEET_UPLOAD_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/*";

export async function fileToSheetAsset(
  drawingId: string,
  file: File,
): Promise<SheetAsset> {
  const max = 40 * 1024 * 1024; // 40 MB
  if (file.size > max) {
    throw new Error("File is larger than 40 MB. Use a smaller PDF or image.");
  }
  const mime = file.type || guessMime(file.name);
  const url = URL.createObjectURL(file);
  return {
    drawingId,
    name: file.name,
    mime,
    url,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".tif") || n.endsWith(".tiff")) return "image/tiff";
  return "application/octet-stream";
}
