import { Expand, Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFullscreen } from "@/hooks/use-fullscreen";
import {
  buildSheetLayout,
  markupPositions,
  type SheetLayout,
  type SheetMember,
} from "@/lib/drawing-geometry";
import type { Drawing, Markup } from "@/lib/types";
import { DRAWING_TYPE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  drawing: Drawing;
  markups?: Markup[];
  pieceStatus?: Record<string, { onHold: boolean }>;
  selectedMark?: string | null;
  onSelectMark?: (mark: string) => void;
  jobNumber?: string;
  className?: string;
};

type MarkHit = { mark: string; x: number; y: number; r: number };

export function DrawingSheetViewer({
  drawing,
  markups = [],
  pieceStatus = {},
  selectedMark,
  onSelectMark,
  jobNumber,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const layout = buildSheetLayout(drawing, pieceStatus, jobNumber);
  const [scale, setScale] = useState(0.65);
  const [offset, setOffset] = useState({ x: 20, y: 20 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const hitsRef = useRef<MarkHit[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#0e1014";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    hitsRef.current = paintEngineeringSheet(
      ctx,
      layout,
      markups,
      selectedMark,
    );
    ctx.restore();
  }, [layout, markups, offset, scale, selectedMark]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (!isFullscreen) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = Math.min(
      (wrap.clientWidth - 40) / layout.width,
      (wrap.clientHeight - 40) / layout.height,
    );
    setScale(Math.max(0.28, Math.min(1.4, fit)));
    setOffset({ x: 20, y: 20 });
  }, [isFullscreen, layout.width, layout.height]);

  function hitTest(e: React.MouseEvent) {
    if (!onSelectMark) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;
    for (const m of hitsRef.current) {
      const dx = x - m.x;
      const dy = y - m.y;
      if (dx * dx + dy * dy <= m.r * m.r) {
        onSelectMark(m.mark);
        return;
      }
    }
  }

  function fitSheet() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = Math.min(
      (wrap.clientWidth - 40) / layout.width,
      (wrap.clientHeight - 40) / layout.height,
    );
    setScale(Math.max(0.28, Math.min(1.1, fit)));
    setOffset({ x: 16, y: 16 });
  }

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
          <div className="font-mono-num text-sm font-semibold">
            {drawing.number}{" "}
            <span className="text-[var(--color-muted)]">
              Rev {drawing.currentRev}
            </span>
          </div>
          <div className="truncate text-xs text-[var(--color-muted)]">
            {DRAWING_TYPE_LABELS[drawing.type]} · {layout.scaleLabel} ·{" "}
            {drawing.sheetSize} · drag pan · scroll zoom · click mark
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.08))}
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
            onClick={() => setScale((s) => Math.min(2.8, s + 0.08))}
            aria-label="Zoom in"
          >
            <Plus className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setScale(0.65);
              setOffset({ x: 20, y: 20 });
            }}
            aria-label="Reset view"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={fitSheet}
            aria-label="Fit sheet"
            title="Fit sheet to view"
          >
            <Expand className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant={isFullscreen ? "secondary" : "ghost"}
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
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
        className="relative min-h-0 flex-1 cursor-grab active:cursor-grabbing"
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) =>
            Math.min(2.8, Math.max(0.25, s + (e.deltaY > 0 ? -0.05 : 0.05))),
          );
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
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
          onPointerCancel={() => {
            drag.current = null;
          }}
          onClick={hitTest}
          onDoubleClick={() => void toggleFullscreen()}
        />
        {isFullscreen && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/80">
            Esc to exit fullscreen
          </div>
        )}
      </div>
    </div>
  );
}

function paintEngineeringSheet(
  ctx: CanvasRenderingContext2D,
  layout: SheetLayout,
  markups: Markup[],
  selectedMark: string | null | undefined,
): MarkHit[] {
  const hits: MarkHit[] = [];
  const { width: W, height: H } = layout;

  ctx.fillStyle = "#f4f1ea";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.25;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.lineWidth = 0.6;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  const plotL = 70;
  const plotT = 55;
  const plotR = W - 200;
  const plotB = H - 150;
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(plotL, plotT, plotR - plotL, plotB - plotT);

  ctx.save();
  ctx.beginPath();
  ctx.rect(plotL, plotT, plotR - plotL, plotB - plotT);
  ctx.clip();

  for (const g of layout.gridsX) {
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 0.7;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(g.x, plotT);
    ctx.lineTo(g.x, plotB);
    ctx.stroke();
    ctx.setLineDash([]);
    drawGridBubble(ctx, g.x, plotT - 18, g.label);
    drawGridBubble(ctx, g.x, plotB + 18, g.label);
  }
  for (const g of layout.gridsY) {
    ctx.strokeStyle = "#9aa3ad";
    ctx.lineWidth = 0.7;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(plotL, g.y);
    ctx.lineTo(plotR, g.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawGridBubble(ctx, plotL - 18, g.y, g.label);
    drawGridBubble(ctx, plotR + 18, g.y, g.label);
  }

  for (const m of layout.members) {
    paintMember(ctx, m, selectedMark === m.mark);
  }
  ctx.restore();

  for (const d of layout.dims) paintDim(ctx, d);
  for (const c of layout.callouts) paintCallout(ctx, c);

  for (const m of layout.members) {
    if (!m.mark) continue;
    const mx = (m.from.x + m.to.x) / 2;
    const my = (m.from.y + m.to.y) / 2;
    const r = 12;
    const selected = selectedMark === m.mark;
    const hold = !!m.onHold;
    const cy = my - (m.kind === "column" ? 0 : 10);
    ctx.beginPath();
    ctx.arc(mx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "#0d9488" : hold ? "#b45309" : "#1e293b";
    ctx.fill();
    ctx.strokeStyle = selected ? "#5eead4" : hold ? "#fbbf24" : "#94a3b8";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(m.mark, mx, cy);
    hits.push({ mark: m.mark, x: mx, y: cy, r: r + 4 });
  }

  const mpos = markupPositions(layout, markups);
  mpos.forEach(({ markup, x, y }, i) => {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = markup.resolved
      ? "#16a34a"
      : markup.type === "hold"
        ? "#ca8a04"
        : "#dc2626";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y);
  });

  paintTitleBlock(ctx, layout);
  paintBom(ctx, layout);
  paintNotes(ctx, layout);
  if (layout.style === "plan" || layout.style === "anchor") {
    paintNorth(ctx, plotR - 40, plotT + 40);
  }
  paintScaleBar(ctx, plotL + 10, plotB - 18, layout.scaleLabel);
  return hits;
}

function drawGridBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
) {
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fillStyle = "#f4f1ea";
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = "#111";
  ctx.font = "bold 11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y + 0.5);
}

function paintMember(
  ctx: CanvasRenderingContext2D,
  m: SheetMember,
  selected: boolean,
) {
  const hold = !!m.onHold;
  const col = selected ? "#0f766e" : hold ? "#b45309" : "#1f2937";
  ctx.strokeStyle = col;
  ctx.fillStyle = col;

  if (m.kind === "column") {
    const s = 14;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(m.from.x - s / 2, m.from.y - s / 2, s, s);
    ctx.beginPath();
    ctx.moveTo(m.from.x - s / 2 - 3, m.from.y);
    ctx.lineTo(m.from.x + s / 2 + 3, m.from.y);
    ctx.moveTo(m.from.x, m.from.y - s / 2 - 3);
    ctx.lineTo(m.from.x, m.from.y + s / 2 + 3);
    ctx.stroke();
    return;
  }

  if (m.kind === "anchor") {
    const s = 18;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(m.from.x - s / 2, m.from.y - s / 2, s, s);
    for (const [dx, dy] of [
      [-5, -5],
      [5, -5],
      [-5, 5],
      [5, 5],
    ] as const) {
      ctx.beginPath();
      ctx.arc(m.from.x + dx, m.from.y + dy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (m.kind === "plate" || m.kind === "embed") {
    ctx.lineWidth = 1.2;
    ctx.setLineDash(m.kind === "embed" ? [4, 3] : []);
    ctx.strokeRect(
      Math.min(m.from.x, m.to.x),
      Math.min(m.from.y, m.to.y),
      Math.abs(m.to.x - m.from.x) || 40,
      Math.abs(m.to.y - m.from.y) || 16,
    );
    ctx.setLineDash([]);
    return;
  }

  if (m.kind === "weld") {
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(m.from.x, m.from.y);
    ctx.lineTo(m.to.x, m.to.y);
    ctx.stroke();
    const mx = (m.from.x + m.to.x) / 2;
    const my = (m.from.y + m.to.y) / 2;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + 8, my + 10);
    ctx.lineTo(mx - 8, my + 10);
    ctx.closePath();
    ctx.fill();
    return;
  }

  ctx.lineWidth =
    m.kind === "brace" ? 1.6 : m.kind === "joist" || m.kind === "deck" ? 1 : 2.2;
  if (m.kind === "brace") ctx.setLineDash([10, 4]);
  if (m.kind === "joist" || m.kind === "deck") ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(m.from.x, m.from.y);
  ctx.lineTo(m.to.x, m.to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (m.kind === "beam") {
    const ang = Math.atan2(m.to.y - m.from.y, m.to.x - m.from.x);
    for (const p of [m.from, m.to]) {
      ctx.beginPath();
      ctx.moveTo(
        p.x + Math.cos(ang + Math.PI / 2) * 6,
        p.y + Math.sin(ang + Math.PI / 2) * 6,
      );
      ctx.lineTo(
        p.x + Math.cos(ang - Math.PI / 2) * 6,
        p.y + Math.sin(ang - Math.PI / 2) * 6,
      );
      ctx.stroke();
    }
  }
}

function paintDim(
  ctx: CanvasRenderingContext2D,
  d: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    text: string;
    offset: number;
    side: "h" | "v";
  },
) {
  ctx.strokeStyle = "#334155";
  ctx.fillStyle = "#1e293b";
  ctx.lineWidth = 0.8;
  const o = d.offset;
  if (d.side === "h") {
    const y = d.a.y + o;
    ctx.beginPath();
    ctx.moveTo(d.a.x, d.a.y);
    ctx.lineTo(d.a.x, y);
    ctx.lineTo(d.b.x, y);
    ctx.lineTo(d.b.x, d.b.y);
    ctx.stroke();
    arrow(ctx, d.a.x, y, 1);
    arrow(ctx, d.b.x, y, -1);
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(d.text, (d.a.x + d.b.x) / 2, y - 2);
  } else {
    const x = d.a.x + o;
    ctx.beginPath();
    ctx.moveTo(d.a.x, d.a.y);
    ctx.lineTo(x, d.a.y);
    ctx.lineTo(x, d.b.y);
    ctx.lineTo(d.b.x, d.b.y);
    ctx.stroke();
    arrowV(ctx, x, d.a.y, 1);
    arrowV(ctx, x, d.b.y, -1);
    ctx.save();
    ctx.translate(x - 4, (d.a.y + d.b.y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(d.text, 0, 0);
    ctx.restore();
  }
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * 6, y - 3);
  ctx.lineTo(x + dir * 6, y + 3);
  ctx.closePath();
  ctx.fill();
}

function arrowV(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 3, y + dir * 6);
  ctx.lineTo(x + 3, y + dir * 6);
  ctx.closePath();
  ctx.fill();
}

function paintCallout(
  ctx: CanvasRenderingContext2D,
  c: { at: { x: number; y: number }; text: string; kind?: string },
) {
  const lines = c.text.split("\n");
  ctx.font = "9px ui-sans-serif, system-ui";
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
  const th = lines.length * 12 + 8;
  const bx = c.at.x + 12;
  const by = c.at.y - th / 2;
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.rect(bx, by, tw + 12, th);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.at.x, c.at.y);
  ctx.lineTo(bx, by + th / 2);
  ctx.stroke();
  if (c.kind === "section") {
    ctx.beginPath();
    ctx.arc(c.at.x, c.at.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 4 + i * 12));
}

function paintTitleBlock(ctx: CanvasRenderingContext2D, layout: SheetLayout) {
  const x = layout.width - 190;
  const y = layout.height - 140;
  const w = 170;
  const h = 120;
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#f4f1ea";
  ctx.lineWidth = 1.2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  const rows = [
    { h: 22, label: "JOB", value: layout.jobNumber ?? "—" },
    { h: 28, label: "TITLE", value: layout.title },
    { h: 18, label: "DWG NO.", value: layout.number },
    { h: 18, label: "REV", value: layout.rev },
    { h: 18, label: "SCALE", value: layout.scaleLabel },
    { h: 16, label: "DETAILER", value: layout.detailer ?? "—" },
  ];
  let yy = y;
  for (const r of rows) {
    ctx.strokeRect(x, yy, w, r.h);
    ctx.fillStyle = "#64748b";
    ctx.font = "7px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(r.label, x + 4, yy + 2);
    ctx.fillStyle = "#0f172a";
    ctx.font =
      r.label === "TITLE"
        ? "bold 10px ui-sans-serif, system-ui"
        : "bold 11px ui-monospace, Menlo, monospace";
    const text = r.value.length > 28 ? r.value.slice(0, 26) + "…" : r.value;
    ctx.fillText(text, x + 4, yy + (r.label === "TITLE" ? 12 : 8));
    yy += r.h;
  }

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x, y - 18, w, 18);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 9px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SOUTHWEST FABRICATORS", x + w / 2, y - 9);
}

function paintBom(ctx: CanvasRenderingContext2D, layout: SheetLayout) {
  const bom = layout.bom.slice(0, 8);
  if (!bom.length) return;
  const x = 28;
  const y = layout.height - 140;
  const w = layout.width - 230;
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 0.9;
  ctx.strokeRect(x, y, Math.min(w, 420), 18 + bom.length * 14 + 4);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 9px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("BILL OF MATERIALS", x + 6, y + 10);
  ctx.font = "8px ui-monospace, Menlo, monospace";
  ctx.fillText("MARK", x + 6, y + 24);
  ctx.fillText("QTY", x + 70, y + 24);
  ctx.fillText("SECTION", x + 110, y + 24);
  ctx.fillText("LENGTH", x + 220, y + 24);
  bom.forEach((row, i) => {
    const yy = y + 36 + i * 14;
    ctx.fillStyle = i % 2 ? "rgba(0,0,0,0.04)" : "transparent";
    ctx.fillRect(x + 1, yy - 6, Math.min(w, 420) - 2, 14);
    ctx.fillStyle = "#1e293b";
    ctx.fillText(row.mark, x + 6, yy);
    ctx.fillText(String(row.qty), x + 70, yy);
    ctx.fillText(row.section, x + 110, yy);
    ctx.fillText(row.length, x + 220, yy);
  });
}

function paintNotes(ctx: CanvasRenderingContext2D, layout: SheetLayout) {
  const x = 28;
  const y = 28;
  ctx.fillStyle = "#334155";
  ctx.font = "8px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  layout.notes.slice(0, 2).forEach((n, i) => {
    ctx.fillText(n, x, y + i * 11);
  });
}

function paintNorth(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "#0f172a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + 7, y + 10);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x - 7, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.font = "bold 10px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.fillText("N", x, y - 22);
}

function paintScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
) {
  ctx.strokeStyle = "#0f172a";
  ctx.fillStyle = "#0f172a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 80, y);
  ctx.stroke();
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 20, y);
    ctx.lineTo(x + i * 20, y - (i % 2 === 0 ? 6 : 4));
    ctx.stroke();
  }
  ctx.font = "8px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y - 10);
}
