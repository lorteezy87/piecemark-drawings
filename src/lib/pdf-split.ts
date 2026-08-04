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

function scoreTitleFromItems(items: TextItem[]): PageMeta {
  if (items.length === 0) return { title: null, sheetNo: null };

  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; h: number; text: string; parts: TextItem[] }[] = [];
  const yTol = 3;
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(yTol, last.h * 0.35)) {
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

  const fullText = lines.map((l) => l.text).join("\n");
  const sheetCandidates = guessSheetCandidates(fullText.replace(/\n/g, " "));
  const sheetNo =
    sheetCandidates.find((c) => /^[A-Z]{1,3}-\d{1,4}[A-Z]?$/i.test(c)) ??
    sheetCandidates[0] ??
    null;

  const ban =
    /^(sheet|dwg|drawing|rev|revision|date|scale|job|project|no\.?|number|of|page|client|checked|drawn|approved)$/i;
  const scored = lines
    .map((line) => {
      const t = line.text;
      if (t.length < 4 || t.length > 120) return null;
      if (/^\d+$/.test(t)) return null;
      if (ban.test(t)) return null;
      if (/^[A-Z]{1,3}[\s\-]?\d{1,4}[A-Z]?$/i.test(t)) return null;
      let score = line.h * 2 + Math.min(t.length, 40) * 0.15;
      const wordCount = t.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 2) score += 4;
      if (wordCount >= 3) score += 2;
      if (
        /plan|elevation|section|detail|framing|erection|anchor|embed|joist|deck|stair|brace|beam|column/i.test(
          t,
        )
      )
        score += 6;
      if ((t.match(/[A-Za-z]/g) || []).length < 3) score -= 8;
      return { text: t, score };
    })
    .filter((x): x is { text: string; score: number } => !!x)
    .sort((a, b) => b.score - a.score);

  let title: string | null = scored[0]?.text ?? null;
  if (title) {
    title = title
      .replace(/^(drawing\s*title|title|sheet\s*title)\s*[:.\-]\s*/i, "")
      .trim();
    if (title.length < 3) title = null;
  }

  if ((!title || title.length < 8) && sheetNo) {
    const withNo = lines.find((l) => {
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
 */
async function extractAllPageMeta(
  data: Uint8Array,
): Promise<PageMeta[]> {
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

    // Copy buffer — pdf.js may transfer ownership
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
        out.push(scoreTitleFromItems(items));
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
      // Separate copy for pdf.js text pass
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
        const out = await PDFDocument.create();
        const [copied] = await out.copyPages(src, [i]);
        out.addPage(copied);
        const outBytes = await out.save();
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
