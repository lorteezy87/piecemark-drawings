import { PDFDocument } from "pdf-lib";
import { destroyPdf, loadPdfjs } from "@/lib/pdfjs";
import { guessSheetCandidates, normalizeSheetNo } from "@/lib/sheet-match";
import {
  hasAnyRegion,
  pdfItemToTopLeftNorm,
  pointInNormRect,
  type TitleBlockMap,
} from "@/lib/title-block";

export type ExpandedPageFile = {
  file: File;
  pageIndex: number;
  pageTotal: number;
  sourceName: string;
  extractedTitle?: string | null;
  extractedSheetNo?: string | null;
  extractedRev?: string | null;
};

function isPdfFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    n.endsWith(".pdf") ||
    file.type === "application/x-pdf"
  );
}

type TextItem = {
  str: string;
  x: number;
  y: number;
  h: number;
};

type PageMeta = {
  title: string | null;
  sheetNo: string | null;
  rev: string | null;
};

type Line = {
  y: number;
  h: number;
  text: string;
  parts: TextItem[];
};

function clusterLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  const yTol = 3;
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(yTol, last.h * 0.4)) {
      last.parts.push(it);
      last.h = Math.max(last.h, it.h);
    } else {
      lines.push({ y: it.y, h: it.h, text: "", parts: [it] });
    }
  }
  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x);
    line.text = line.parts
      .map((p) => p.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return lines.filter((l) => l.text.length >= 1);
}

function textInRect(
  items: TextItem[],
  pageW: number,
  pageH: number,
  rect: { x: number; y: number; w: number; h: number } | null | undefined,
): string {
  if (!rect) return "";
  const inside = items.filter((it) => {
    const { nx, ny } = pdfItemToTopLeftNorm(it.x, it.y, pageW, pageH);
    return pointInNormRect(nx, ny, rect, 0.012);
  });
  if (inside.length === 0) return "";
  return clusterLines(inside)
    .map((l) => l.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(raw: string): string | null {
  let t = raw
    .replace(/^(drawing\s*title|title|sheet\s*title)\s*[:.\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 2) return null;
  if (t.length > 120) t = t.slice(0, 120).trim();
  return t;
}

function cleanSheetNo(raw: string): string | null {
  const cands = guessSheetCandidates(raw);
  const hit =
    cands.find((c) => /^[A-Z]{1,3}-\d{1,4}[A-Z]?$/i.test(c)) ??
    cands[0] ??
    null;
  if (hit) return normalizeSheetNo(hit);
  // whole field might be just "S-301" or "S 301"
  const m = raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .match(/([A-Z]{1,3})-?(\d{1,4}[A-Z]?)/);
  if (m) return normalizeSheetNo(`${m[1]}-${m[2]}`);
  const compact = raw.replace(/\s+/g, " ").trim();
  return compact.length >= 2 && compact.length <= 16 ? compact.toUpperCase() : null;
}

function cleanRev(raw: string): string | null {
  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(/^(rev(ision)?|rev\.?)\s*[:.\-]?\s*/i, "").trim();
  // Take first token that looks like a rev
  const m = t.match(/\b([A-Z]|[0-9]{1,3}|[A-Z][0-9]?)\b/i);
  if (m) return m[1].toUpperCase();
  if (t.length >= 1 && t.length <= 6) return t.toUpperCase();
  return null;
}

/** Fallback when no manual map: mild whole-page heuristics (not aggressive zones). */
function scoreAuto(items: TextItem[]): PageMeta {
  if (items.length === 0) return { title: null, sheetNo: null, rev: null };
  const lines = clusterLines(items);
  const full = lines.map((l) => l.text).join(" ");
  const sheetNo = cleanSheetNo(full);
  const revMatch = full.match(/\brev(?:ision)?\.?\s*[:\-]?\s*([A-Z0-9]{1,3})\b/i);
  const rev = revMatch ? revMatch[1].toUpperCase() : null;

  const ban =
    /^(sheet|dwg|drawing|rev|revision|date|scale|job|project|no\.?)$/i;
  const scored = lines
    .map((line) => {
      const t = line.text;
      if (t.length < 4 || t.length > 100) return null;
      if (ban.test(t)) return null;
      if (/^[A-Z]{1,3}[\s\-]?\d{1,4}[A-Z]?$/i.test(t)) return null;
      let score = Math.min(line.h, 20) + Math.min(t.length, 40) * 0.1;
      if (
        /plan|elevation|section|detail|framing|erection|anchor|embed|joist|deck|stair/i.test(
          t,
        )
      )
        score += 5;
      return { text: t, score };
    })
    .filter((x): x is { text: string; score: number } => !!x)
    .sort((a, b) => b.score - a.score);

  return {
    title: scored[0] ? cleanTitle(scored[0].text) : null,
    sheetNo,
    rev,
  };
}

function metaFromMap(
  items: TextItem[],
  pageW: number,
  pageH: number,
  map: TitleBlockMap,
): PageMeta {
  const titleRaw = textInRect(items, pageW, pageH, map.title);
  const sheetRaw = textInRect(items, pageW, pageH, map.sheetNo);
  const revRaw = textInRect(items, pageW, pageH, map.rev);
  return {
    title: titleRaw ? cleanTitle(titleRaw) : null,
    sheetNo: sheetRaw ? cleanSheetNo(sheetRaw) : null,
    rev: revRaw ? cleanRev(revRaw) : null,
  };
}

async function extractAllPageMeta(
  data: Uint8Array,
  map?: TitleBlockMap | null,
): Promise<PageMeta[]> {
  try {
    const pdfjs = await loadPdfjs();

    const copy = new Uint8Array(data.byteLength);
    copy.set(data);

    const loadingTask = pdfjs.getDocument({
      data: copy,
      useSystemFonts: true,
    });
    const out: PageMeta[] = [];
    const useMap = hasAnyRegion(map) ? map! : null;
    try {
      const doc = await loadingTask.promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const pageW = viewport.width;
        const pageH = viewport.height;
        const content = await page.getTextContent();
        const items: TextItem[] = [];
        for (const raw of content.items) {
          if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
          const it = raw as {
            str: string;
            transform?: number[];
            height?: number;
          };
          const str = (it.str || "").replace(/\s+/g, " ").trim();
          if (!str) continue;
          const t = it.transform || [1, 0, 0, 1, 0, 0];
          items.push({
            str,
            x: t[4] ?? 0,
            y: t[5] ?? 0,
            h: Math.abs(it.height || t[3] || 8),
          });
        }
        out.push(
          useMap
            ? metaFromMap(items, pageW, pageH, useMap)
            : scoreAuto(items),
        );
      }
    } finally {
      await destroyPdf(loadingTask);
    }
    return out;
  } catch (e) {
    console.warn("PDF text extract failed:", e);
    return [];
  }
}

export async function expandUploadFiles(
  files: File[],
  opts?: { titleBlockMap?: TitleBlockMap | null },
): Promise<{ pages: ExpandedPageFile[]; splitCount: number }> {
  const pages: ExpandedPageFile[] = [];
  let splitCount = 0;
  const map = opts?.titleBlockMap ?? null;

  for (const file of files) {
    if (!isPdfFile(file)) {
      pages.push({
        file,
        pageIndex: 1,
        pageTotal: 1,
        sourceName: file.name,
      });
      continue;
    }

    try {
      const bytes = await file.arrayBuffer();
      const srcBytes = new Uint8Array(bytes);
      const textBytes = srcBytes.slice();

      const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const total = src.getPageCount();
      const metas = await extractAllPageMeta(textBytes, map);

      if (total <= 1) {
        const meta = metas[0] ?? { title: null, sheetNo: null, rev: null };
        pages.push({
          file,
          pageIndex: 1,
          pageTotal: 1,
          sourceName: file.name,
          extractedTitle: meta.title,
          extractedSheetNo: meta.sheetNo,
          extractedRev: meta.rev,
        });
        continue;
      }

      splitCount += 1;
      const base = file.name.replace(/\.pdf$/i, "");

      for (let i = 0; i < total; i++) {
        const outDoc = await PDFDocument.create();
        const [copied] = await outDoc.copyPages(src, [i]);
        outDoc.addPage(copied);
        const outBytes = await outDoc.save();
        const copy = new Uint8Array(outBytes.byteLength);
        copy.set(outBytes);
        const pageFile = new File([copy], `${base}-p${i + 1}.pdf`, {
          type: "application/pdf",
          lastModified: file.lastModified,
        });
        const meta = metas[i] ?? { title: null, sheetNo: null, rev: null };
        pages.push({
          file: pageFile,
          pageIndex: i + 1,
          pageTotal: total,
          sourceName: file.name,
          extractedTitle: meta.title,
          extractedSheetNo: meta.sheetNo,
          extractedRev: meta.rev,
        });
      }
    } catch (e) {
      console.warn("PDF split failed, attaching whole file:", file.name, e);
      pages.push({
        file,
        pageIndex: 1,
        pageTotal: 1,
        sourceName: file.name,
      });
    }
  }

  return { pages, splitCount };
}
