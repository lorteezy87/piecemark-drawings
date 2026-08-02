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
import type { SheetAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  asset: SheetAsset;
  title?: string;
  onClear?: () => void;
  className?: string;
};

/**
 * View a real uploaded drawing (PDF or image) with pan/zoom/fullscreen.
 */
export function RealSheetViewer({ asset, title, onClear, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const isPdf =
    asset.mime === "application/pdf" ||
    asset.name.toLowerCase().endsWith(".pdf");
  const isImage = asset.mime.startsWith("image/");

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setImgSize(null);
    if (!isImage) return;
    const img = new Image();
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = asset.url;
  }, [asset.url, isImage]);

  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (isPdf) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    if (!imgSize) return;
    const pad = 24;
    const sx = (wrap.clientWidth - pad) / imgSize.w;
    const sy = (wrap.clientHeight - pad) / imgSize.h;
    const s = Math.min(sx, sy, 1.5);
    setScale(Math.max(0.1, s));
    setOffset({
      x: (wrap.clientWidth - imgSize.w * s) / 2,
      y: (wrap.clientHeight - imgSize.h * s) / 2,
    });
  }, [imgSize, isPdf]);

  useEffect(() => {
    fit();
  }, [fit, isFullscreen]);

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
            {isPdf ? "PDF" : isImage ? "Image" : asset.mime} · drag pan · scroll
            zoom
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setScale((s) => Math.max(0.1, s - 0.1))}
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
                onClick={() => setScale((s) => Math.min(4, s + 0.1))}
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
        className={cn(
          "relative min-h-0 flex-1 bg-[#1a1c20]",
          !isPdf && "cursor-grab active:cursor-grabbing",
        )}
        onWheel={(e) => {
          if (isPdf) return;
          e.preventDefault();
          setScale((s) =>
            Math.min(4, Math.max(0.1, s + (e.deltaY > 0 ? -0.08 : 0.08))),
          );
        }}
      >
        {isPdf ? (
          <iframe
            title={asset.name}
            src={asset.url}
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
        ) : isImage ? (
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
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                ox: offset.x,
                oy: offset.y,
              };
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              setOffset({
                x: drag.current.ox + (e.clientX - drag.current.x),
                y: drag.current.oy + (e.clientY - drag.current.y),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onDoubleClick={() => void toggleFullscreen()}
          />
        ) : (
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
