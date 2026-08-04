import { PDFDocument } from "pdf-lib";
import { guessSheetCandidates, normalizeSheetNo } from "@/lib/sheet-match";

export type ExpandedPageFile = {
  file: File;
  /** 1-based page index in the source PDF */
  pageIndex: number;
  /** Total pages in the source PDF */
  pageTotal: number;
  sourceName: string;
  /** Best title line found on the page (title block / header) */
  extractedTitle?: string | null;
  /** Sheet number token found in page text (e.g. S-301) */
  extractedSheetNo?: string | null;
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

type PageMeta = { title: string | null; sheetNo: string | null };

type Line = {
  y: number;
  h: number;
  x0: number;
  x1: number;
  text: string;
  parts: TextItem[];
  /** 0–1: how strongly this line sits in the title-block zone */
  zone: number;
};

/**
 * US structural/shop sheets: title block is almost always bottom-right
 * (sometimes bottom strip or right strip). PDF.js coords: origin bottom-left.
 */
function titleBlockZoneScore(
  x: number,
  y: number,
  pageW: number,
  pageH: number,
): number {
  if (pageW <= 0 || pageH <= 0) return 0;
  const nx = x / pageW; // 0 left → 1 right
  const ny = y / pageH; // 0 bottom → 1 top

  // Primary: bottom ~28% × right ~45%
  const inBottom = ny <= 0.28;
  const inRight = nx >= 0.55;
  if (inBottom && inRight) {
    // Closer to corner scores higher
    const bottomDepth = 1 - ny / 0.28;
    const rightDepth = (nx - 0.55) / 0.45;
    return 1.0 + 0.35 * bottomDepth + 0.25 * rightDepth;
  }

  // Secondary: bottom strip (full width, lower 18%) — long title rows
  if (ny <= 0.18) {
    return 0.55 + 0.2 * (1 - ny / 0.18);
  }

  // Tertiary: right strip (right 18%, mid/lower half) — vertical title blocks
  if (nx >= 0.82 && ny <= 0.55) {
    return 0.45;
  }

  return 0;
}

function clusterLines(items: TextItem[], pageW: number, pageH: number): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  const yTol = 3;
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(yTol, last.h * 0.35)) {
      last.parts.push(it);
      last.h = Math.max(last.h, it.h);
    } else {
      lines.push({
        y: it.y,
        h: it.h,
        x0: it.x,
        x1: it.x,
        text: "",
        parts: [it],
        zone: 0,
      });
    }
  }
  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x);
    line.x0 = line.parts[0]?.x ?? 0;
    line.x1 = line.parts[line.parts.length - 1]?.x ?? line.x0;
    line.text = line.parts
      .map((p) => p.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    // Zone from midpoint of the line
    const midX = (line.x0 + line.x1) / 2;
    line.zone = titleBlockZoneScore(midX, line.y, pageW, pageH);
  }
  return lines.filter((l) => l.text.length >= 2);
}

function scoreTitleFromItems(
  items: TextItem[],
  pageW: number,
  pageH: number,
): PageMeta {
  if (items.length === 0) return { title: null, sheetNo: null };

  // Prefer items that land in the title-block region
  const zoned = items
    .map((it) => ({
      it,
      z: titleBlockZoneScore(it.x, it.y, pageW, pageH),
    }))
    .filter((x) => x.z > 0);

  // If we found a clear title-block population, ignore the rest of the sheet
  const blockItems =
    zoned.length >= 3
      ? zoned.map((z) => z.it)
      : zoned.length > 0
        ? zoned.map((z) => z.it)
        : items; // last resort: whole page

  const lines = clusterLines(blockItems, pageW, pageH);
  if (lines.length === 0) return { title: null, sheetNo: null };

  // Sheet number: only from title-block lines (not body piece marks like B12)
  const blockText = lines
    .filter((l) => l.zone >= 0.45)
    .map((l) => l.text)
    .join(" ");
  const sheetCandidates = guessSheetCandidates(
    blockText || lines.map((l) => l.text).join(" "),
  );
  // Prefer classic drawing numbers over short tags
  const sheetNo =
    sheetCandidates.find((c) => /^[A-Z]{1,3}-\d{2,4}[A-Z]?$/i.test(c)) ??
    sheetCandidates.find((c) => /^[A-Z]{1,3}-\d{1,4}[A-Z]?$/i.test(c)) ??
    null;

  const banExact =
    /^(sheet|dwg|drawing|rev|revision|date|scale|job|project|no\.?|number|of|page|client|checked|drawn|approved|drawn by|checked by|engineer|architect|contractor|seal|north|true north)$/i;
  const banContains =
    /\b(scale\s*[:=]|drawn\s*by|checked\s*by|date\s*[:=]|job\s*no|project\s*no|sheet\s*no|dwg\s*no|revision|rev\s*[:=])\b/i;

  const scored = lines
    .map((line) => {
      const t = line.text;
      if (t.length < 4 || t.length > 100) return null;
      if (/^\d+([./]\d+)?$/.test(t)) return null;
      if (banExact.test(t)) return null;
      if (banContains.test(t)) return null;
      if (/^[A-Z]{1,3}[\s\-]?\d{1,4}[A-Z]?$/i.test(t)) return null;
      // Skip pure revision tokens
      if (/^rev\.?\s*[A-Z0-9]+$/i.test(t)) return null;

      let score = 0;
      // Title-block zone is the main filter
      score += line.zone * 20;
      // Slight boost for larger title-block type
      score += Math.min(line.h, 24) * 0.35;
      const wordCount = t.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 2) score += 3;
      if (wordCount >= 3 && wordCount <= 10) score += 3;
      if (wordCount > 14) score -= 4;
      if (
        /plan|elevation|section|detail|framing|erection|anchor|embed|joist|deck|stair|brace|beam|column|foundation|roof|floor|connection|weld|misc/i.test(
          t,
        )
      )
        score += 5;
      if ((t.match(/[A-Za-z]/g) || []).length < 3) score -= 10;
      // Demote long note strings with many commas/numbers (BOM notes, not title)
      if ((t.match(/\d/g) || []).length > 6) score -= 6;
      if (t.includes(";") || (t.match(/,/g) || []).length >= 3) score -= 4;

      // Require some title-block affinity unless we had no zone hits
      if (line.zone < 0.4 && zoned.length >= 3) score -= 12;

      return { text: t, score, zone: line.zone };
    })
    .filter((x): x is { text: string; score: number; zone: number } => !!x)
    .sort((a, b) => b.score - a.score);

  let title: string | null = scored[0]?.score && scored[0].score > 0
    ? scored[0].text
    : null;

  if (title) {
    title = title
      .replace(/^(drawing\s*title|title|sheet\s*title)\s*[:.\-]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title.length < 3) title = null;
  }

  // If best title still looks weak, try a title-block line that pairs with sheet no
  if ((!title || title.length < 6) && sheetNo) {
    const withNo = lines
      .filter((l) => l.zone >= 0.45)
      .find((l) => {
        const n = normalizeSheetNo(l.text);
        return (
          l.text.length > sheetNo.length + 4 &&
          (n.includes(normalizeSheetNo(sheetNo)) ||
            l.text.toUpperCase().includes(sheetNo.replace("-", "")))
        );
      });
    if (withNo) {
      const cleaned = withNo.text
        .replace(new RegExp(sheetNo.replace("-", "[-\\s]?"), "i"), "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length >= 3) title = cleaned;
    }
  }

  return { title, sheetNo: sheetNo ? normalizeSheetNo(sheetNo) : null };
}

/**
 * Extract title/sheet number for every page in a PDF (one load).
 * Restricted to the title-block region of each page.
 */
async function extractAllPageMeta(data: Uint8Array): Promise<PageMeta[]> {
  try {
    const pdfjs = await import("pdfjs-dist");
    if (typeof window !== "undefined") {
      const { GlobalWorkerOptions } = pdfjs;
      if (!GlobalWorkerOptions.workerSrc) {
        GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
      }
    }

    const copy = new Uint8Array(data.byteLength);
    copy.set(data);

    const loadingTask = pdfjs.getDocument({
      data: copy,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    const out: PageMeta[] = [];
    try {
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
          if (!str || str.length < 2) continue;
          const t = it.transform || [1, 0, 0, 1, 0, 0];
          items.push({
            str,
            x: t[4] ?? 0,
            y: t[5] ?? 0,
            h: Math.abs(it.height || t[3] || 8),
          });
        }
        out.push(scoreTitleFromItems(items, pageW, pageH));
      }
    } finally {
      try {
        doc.cleanup();
      } catch {
        /* ignore */
      }
    }
    return out;
  } catch (e) {
    console.warn("PDF text extract failed:", e);
    return [];
  }
}

/**
 * Split multi-page PDFs into one File per page and extract title / sheet no per page.
 */
export async function expandUploadFiles(
  files: File[],
): Promise<{ pages: ExpandedPageFile[]; splitCount: number }> {
  const pages: ExpandedPageFile[] = [];
  let splitCount = 0;

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
      const metas = await extractAllPageMeta(textBytes);

      if (total <= 1) {
        const meta = metas[0] ?? { title: null, sheetNo: null };
        pages.push({
          file,
          pageIndex: 1,
          pageTotal: 1,
          sourceName: file.name,
          extractedTitle: meta.title,
          extractedSheetNo: meta.sheetNo,
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
        const pageName = `${base}-p${i + 1}.pdf`;
        const pageFile = new File([copy], pageName, {
          type: "application/pdf",
          lastModified: file.lastModified,
        });
        const meta = metas[i] ?? { title: null, sheetNo: null };
        pages.push({
          file: pageFile,
          pageIndex: i + 1,
          pageTotal: total,
          sourceName: file.name,
          extractedTitle: meta.title,
          extractedSheetNo: meta.sheetNo,
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
