import type { Drawing, DrawingType, Markup } from "@/lib/types";

export type SheetPoint = { x: number; y: number };

export type SheetMember = {
  id: string;
  kind:
    | "column"
    | "beam"
    | "brace"
    | "anchor"
    | "embed"
    | "plate"
    | "weld"
    | "joist"
    | "deck";
  mark: string;
  section?: string;
  from: SheetPoint;
  to: SheetPoint;
  onHold?: boolean;
};

export type DimLine = {
  a: SheetPoint;
  b: SheetPoint;
  text: string;
  offset: number;
  side: "h" | "v";
};

export type Callout = {
  at: SheetPoint;
  text: string;
  kind?: "section" | "note" | "detail";
};

export type SheetLayout = {
  width: number;
  height: number;
  scaleLabel: string;
  gridsX: { label: string; x: number }[];
  gridsY: { label: string; y: number }[];
  members: SheetMember[];
  dims: DimLine[];
  callouts: Callout[];
  notes: string[];
  bom: { mark: string; qty: number; section: string; length: string }[];
  title: string;
  number: string;
  rev: string;
  sheetSize: string;
  type: DrawingType;
  jobNumber?: string;
  detailer?: string;
  /** Drawing style for painter */
  style: "plan" | "elevation" | "detail" | "anchor" | "notes";
};

const GRID_X = ["A", "B", "C", "D"];
const GRID_Y = ["1", "2", "3", "4"];

function sectionsFor(mark: string, type: DrawingType): string {
  if (mark.startsWith("C")) return "W14×90";
  if (mark.startsWith("B") || mark.startsWith("G")) return "W21×44";
  if (mark.startsWith("BR")) return "HSS6×6×3/8";
  if (mark.startsWith("AB")) return "1¼\" Ø F1554 Gr.55";
  if (mark.startsWith("EM")) return "PL ¾\" embed";
  if (type === "joist") return "28K9";
  if (type === "deck") return "3\"×20ga composite";
  return "See schedule";
}

export function buildSheetLayout(
  drawing: Drawing,
  pieceStatus: Record<string, { onHold: boolean }> = {},
  jobNumber?: string,
): SheetLayout {
  const [w, h] =
    drawing.sheetSize === "30x42"
      ? [1400, 1000]
      : drawing.sheetSize === "24x36"
        ? [1200, 800]
        : drawing.sheetSize === "22x34"
          ? [1100, 740]
          : [900, 600];

  const margin = 80;
  const plotR = w - 220; // leave title block
  const plotB = h - 160;
  const usableW = plotR - margin;
  const usableH = plotB - margin - 30;

  const gridsX = GRID_X.map((label, i) => ({
    label,
    x: margin + 30 + (usableW * i) / (GRID_X.length - 1),
  }));
  const gridsY = GRID_Y.map((label, i) => ({
    label,
    y: margin + 20 + (usableH * i) / (GRID_Y.length - 1),
  }));

  const marks = drawing.pieceMarks.length
    ? drawing.pieceMarks
    : ["M1", "M2", "M3"];
  const hold = (m: string) => pieceStatus[m]?.onHold ?? false;
  const colAt = (gi: number, gj: number) => ({
    x: gridsX[gi]!.x,
    y: gridsY[gj]!.y,
  });

  const members: SheetMember[] = [];
  const dims: DimLine[] = [];
  const callouts: Callout[] = [];
  let style: SheetLayout["style"] = "plan";
  let scaleLabel = '1/8" = 1\'-0"';

  if (
    drawing.type === "erection" ||
    drawing.type === "shop" ||
    drawing.type === "mixed"
  ) {
    style = "plan";
    // Full column grid
    let ci = 0;
    const colMarks = marks.filter((m) => m.startsWith("C"));
    for (let i = 0; i < gridsX.length; i++) {
      for (let j = 0; j < gridsY.length; j++) {
        const mark =
          colMarks[ci] ??
          (i === 0 && j === 0
            ? "C1"
            : i === 1 && j === 0
              ? "C2"
              : i === 2 && j === 0
                ? "C3"
                : `C${i + 1}${j + 1}`);
        ci++;
        members.push({
          id: `c-${i}-${j}`,
          kind: "column",
          mark,
          section: sectionsFor(mark, drawing.type),
          from: colAt(i, j),
          to: colAt(i, j),
          onHold: hold(mark),
        });
      }
    }
    // Primary beams X
    const beamMarks = marks.filter(
      (m) => m.startsWith("B") || m.startsWith("G"),
    );
    let bi = 0;
    for (let j = 0; j < gridsY.length; j++) {
      for (let i = 0; i < gridsX.length - 1; i++) {
        const mark =
          beamMarks[bi] ??
          marks.find((m) => m.startsWith("B")) ??
          `B${j + 1}${i + 1}`;
        bi++;
        members.push({
          id: `bx-${i}-${j}`,
          kind: "beam",
          mark,
          section: sectionsFor(mark, drawing.type),
          from: colAt(i, j),
          to: colAt(i + 1, j),
          onHold: hold(mark),
        });
      }
    }
    // Secondary beams Y (every other)
    for (let i = 0; i < gridsX.length; i++) {
      for (let j = 0; j < gridsY.length - 1; j++) {
        if ((i + j) % 2 === 0) continue;
        const mark = `BY${i + 1}${j + 1}`;
        members.push({
          id: `by-${i}-${j}`,
          kind: "beam",
          mark,
          section: "W16×26",
          from: colAt(i, j),
          to: colAt(i, j + 1),
          onHold: hold(mark),
        });
      }
    }
    // Braces
    for (const mark of marks.filter((m) => m.startsWith("BR"))) {
      const idx = marks.filter((m) => m.startsWith("BR")).indexOf(mark);
      members.push({
        id: `br-${idx}`,
        kind: "brace",
        mark,
        section: sectionsFor(mark, drawing.type),
        from: colAt(idx % 3, 0),
        to: colAt((idx % 3) + 1, 1),
        onHold: hold(mark),
      });
    }

    // Dimension strings — bay spacing 25'-0"
    dims.push({
      a: { x: gridsX[0]!.x, y: gridsY[0]!.y },
      b: { x: gridsX[1]!.x, y: gridsY[0]!.y },
      text: "25'-0\"",
      offset: -28,
      side: "h",
    });
    dims.push({
      a: { x: gridsX[0]!.x, y: gridsY[0]!.y },
      b: { x: gridsX[gridsX.length - 1]!.x, y: gridsY[0]!.y },
      text: "75'-0\"",
      offset: -48,
      side: "h",
    });
    dims.push({
      a: { x: gridsX[0]!.x, y: gridsY[0]!.y },
      b: { x: gridsX[0]!.x, y: gridsY[1]!.y },
      text: "25'-0\"",
      offset: -28,
      side: "v",
    });
    dims.push({
      a: { x: gridsX[0]!.x, y: gridsY[0]!.y },
      b: { x: gridsX[0]!.x, y: gridsY[gridsY.length - 1]!.y },
      text: "75'-0\"",
      offset: -48,
      side: "v",
    });

    callouts.push({
      at: {
        x: (gridsX[1]!.x + gridsX[2]!.x) / 2,
        y: (gridsY[1]!.y + gridsY[2]!.y) / 2,
      },
      text: "TYP. MOMENT CONN.\nSEE CD-12",
      kind: "detail",
    });
    callouts.push({
      at: { x: gridsX[0]!.x - 10, y: gridsY[0]!.y - 10 },
      text: "A/E-101",
      kind: "section",
    });
  } else if (drawing.type === "connection_detail") {
    style = "detail";
    scaleLabel = '1 1/2" = 1\'-0"';
    // Detail: column + beam + bolts
    const cx = w * 0.38;
    const cy = h * 0.42;
    const mark = marks.find((m) => m.startsWith("BR")) ?? marks[0]!;
    const colMark = marks.find((m) => m.startsWith("C")) ?? "C6";
    members.push({
      id: "det-col",
      kind: "column",
      mark: colMark,
      section: "W14×90",
      from: { x: cx, y: cy - 160 },
      to: { x: cx, y: cy + 160 },
      onHold: hold(colMark),
    });
    members.push({
      id: "det-beam",
      kind: "beam",
      mark: marks.find((m) => m.startsWith("B")) ?? "B12",
      section: "W21×44",
      from: { x: cx, y: cy },
      to: { x: cx + 220, y: cy },
      onHold: false,
    });
    members.push({
      id: "det-brace",
      kind: "brace",
      mark,
      section: "HSS6×6×3/8",
      from: { x: cx + 20, y: cy + 20 },
      to: { x: cx + 140, y: cy + 140 },
      onHold: hold(mark),
    });
    members.push({
      id: "gusset",
      kind: "plate",
      mark: "GP-1",
      section: "PL 5/8\"",
      from: { x: cx + 8, y: cy + 8 },
      to: { x: cx + 70, y: cy + 70 },
      onHold: hold(mark),
    });
    dims.push({
      a: { x: cx + 20, y: cy + 40 },
      b: { x: cx + 20, y: cy + 100 },
      text: "3\"",
      offset: 18,
      side: "v",
    });
    dims.push({
      a: { x: cx + 40, y: cy },
      b: { x: cx + 100, y: cy },
      text: "3\" GAUGE",
      offset: -22,
      side: "h",
    });
    callouts.push({
      at: { x: cx + 160, y: cy + 80 },
      text: "8-¾\"Ø A325-N\nSC BOLTS TYP.",
      kind: "note",
    });
    callouts.push({
      at: { x: cx - 40, y: cy - 100 },
      text: "CJP WELD\nCOL FLANGE",
      kind: "note",
    });
  } else if (drawing.type === "anchor_bolt") {
    style = "anchor";
    scaleLabel = '1/4" = 1\'-0"';
    marks.forEach((mark, i) => {
      const gi = i % gridsX.length;
      const gj = Math.floor(i / gridsX.length) % gridsY.length;
      const p = colAt(gi, gj);
      members.push({
        id: `ab-${i}`,
        kind: "anchor",
        mark,
        section: sectionsFor(mark, drawing.type),
        from: p,
        to: p,
        onHold: hold(mark),
      });
      // pattern square
      callouts.push({
        at: { x: p.x + 36, y: p.y - 24 },
        text: "4-BOLT\nPATTERN",
        kind: "note",
      });
    });
    // full column grid ghost for reference
    for (let i = 0; i < gridsX.length; i++) {
      for (let j = 0; j < gridsY.length; j++) {
        if (members.some((m) => m.from.x === gridsX[i]!.x && m.from.y === gridsY[j]!.y))
          continue;
        members.push({
          id: `ghost-${i}-${j}`,
          kind: "column",
          mark: "",
          from: colAt(i, j),
          to: colAt(i, j),
        });
      }
    }
    dims.push({
      a: colAt(0, 0),
      b: colAt(1, 0),
      text: "25'-0\"",
      offset: -36,
      side: "h",
    });
  } else if (drawing.type === "embed") {
    style = "plan";
    marks.forEach((mark, i) => {
      const gi = (i + 1) % (gridsX.length - 1);
      const gj = (i + 1) % (gridsY.length - 1);
      const a = colAt(gi, gj);
      const b = colAt(gi + 1, gj);
      members.push({
        id: `em-${i}`,
        kind: "embed",
        mark,
        section: "PL ¾×8×1'-4\"",
        from: { x: (a.x + b.x) / 2 - 30, y: a.y - 12 },
        to: { x: (a.x + b.x) / 2 + 30, y: a.y + 12 },
        onHold: hold(mark),
      });
    });
  } else if (drawing.type === "weld_map") {
    style = "elevation";
    scaleLabel = '3/4" = 1\'-0"';
    // Elevation of weld map
    const baseY = plotB - 40;
    const topY = margin + 80;
    members.push({
      id: "wm-col",
      kind: "column",
      mark: marks[0] ?? "C3",
      section: "W14×90",
      from: { x: w * 0.35, y: topY },
      to: { x: w * 0.35, y: baseY },
    });
    members.push({
      id: "wm-beam",
      kind: "beam",
      mark: marks[1] ?? "B2",
      section: "W21×44",
      from: { x: w * 0.35, y: (topY + baseY) / 2 },
      to: { x: w * 0.55, y: (topY + baseY) / 2 },
    });
    members.push({
      id: "wm-weld",
      kind: "weld",
      mark: "W1",
      from: { x: w * 0.35, y: (topY + baseY) / 2 },
      to: { x: w * 0.35 + 40, y: (topY + baseY) / 2 },
    });
    callouts.push({
      at: { x: w * 0.42, y: (topY + baseY) / 2 - 30 },
      text: "CJP — 100% UT",
      kind: "note",
    });
  } else if (drawing.type === "stair" || drawing.type === "misc_metals") {
    style = "elevation";
    scaleLabel = '1/2" = 1\'-0"';
    for (let i = 0; i < 8; i++) {
      const y0 = margin + 100 + i * 42;
      members.push({
        id: `tr-${i}`,
        kind: "plate",
        mark: marks[i % marks.length]!,
        section: "MC12×10.6",
        from: { x: margin + 80 + i * 28, y: y0 },
        to: { x: margin + 200 + i * 28, y: y0 + 36 },
        onHold: hold(marks[i % marks.length]!),
      });
    }
  } else if (drawing.type === "joist" || drawing.type === "deck") {
    style = "plan";
    for (let j = 0; j < gridsY.length; j++) {
      for (let i = 0; i < gridsX.length - 1; i++) {
        const mark = marks[i % marks.length]!;
        members.push({
          id: `j-${i}-${j}`,
          kind: drawing.type === "deck" ? "deck" : "joist",
          mark,
          section: sectionsFor(mark, drawing.type),
          from: colAt(i, j),
          to: colAt(i + 1, j),
          onHold: hold(mark),
        });
      }
    }
  } else {
    style = "notes";
    callouts.push({
      at: { x: w * 0.35, y: h * 0.4 },
      text: drawing.title,
      kind: "note",
    });
  }

  // BOM from members with marks
  const bomMap = new Map<string, { mark: string; qty: number; section: string; length: string }>();
  for (const m of members) {
    if (!m.mark) continue;
    const prev = bomMap.get(m.mark);
    if (prev) prev.qty += 1;
    else
      bomMap.set(m.mark, {
        mark: m.mark,
        qty: 1,
        section: m.section ?? "—",
        length:
          m.kind === "column"
            ? "14'-0\""
            : m.kind === "beam"
              ? "25'-0\""
              : m.kind === "brace"
                ? "28'-4\""
                : "—",
      });
  }
  const bom = [...bomMap.values()].slice(0, 12);

  const notes = [
    drawing.holdReason
      ? `HOLD — ${drawing.holdReason}`
      : "FABRICATE PER AISC CODE OF STANDARD PRACTICE",
    "ALL BOLTS A325-N SC UNLESS NOTED  ·  WELDS E70XX",
    `AREA: ${drawing.area ?? "—"}  ·  VERIFY FIELD DIMENSIONS BEFORE FAB`,
    drawing.notes ?? "SEE GENERAL NOTES SHEET FOR MATERIAL SPECS",
  ];

  return {
    width: w,
    height: h,
    scaleLabel,
    gridsX,
    gridsY,
    members,
    dims,
    callouts,
    notes,
    bom,
    title: drawing.title,
    number: drawing.number,
    rev: drawing.currentRev,
    sheetSize: drawing.sheetSize,
    type: drawing.type,
    jobNumber,
    detailer: drawing.detailer,
    style,
  };
}

export function markupPositions(
  layout: SheetLayout,
  markups: Markup[],
): { markup: Markup; x: number; y: number }[] {
  return markups.map((m, i) => {
    const mem = layout.members.filter((x) => x.mark)[i % Math.max(layout.members.length, 1)];
    if (!mem) {
      return {
        markup: m,
        x: layout.width * 0.3 + i * 40,
        y: layout.height * 0.3 + i * 30,
      };
    }
    return {
      markup: m,
      x: (mem.from.x + mem.to.x) / 2 + (i % 3) * 14,
      y: (mem.from.y + mem.to.y) / 2 - 22 - (i % 2) * 16,
    };
  });
}
