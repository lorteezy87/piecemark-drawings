import { PDFDocument } from "pdf-lib";

export type ExpandedPageFile = {
  file: File;
  /** 1-based page index in the source PDF */
  pageIndex: number;
  /** Total pages in the source PDF */
  pageTotal: number;
  sourceName: string;
};

function isPdfFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    file.type === "application/pdf" ||
    n.endsWith(".pdf") ||
    file.type === "application/x-pdf"
  );
}

/**
 * Split a multi-page PDF into one File per page (single-page PDFs).
 * Single-page PDFs and non-PDFs are returned as-is.
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
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const total = src.getPageCount();

      if (total <= 1) {
        pages.push({
          file,
          pageIndex: 1,
          pageTotal: 1,
          sourceName: file.name,
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
        // Copy into a fresh ArrayBuffer-backed Uint8Array for BlobPart typing
        const copy = new Uint8Array(outBytes.byteLength);
        copy.set(outBytes);
        const pageName = `${base}-p${i + 1}.pdf`;
        const pageFile = new File([copy], pageName, {
          type: "application/pdf",
          lastModified: file.lastModified,
        });
        pages.push({
          file: pageFile,
          pageIndex: i + 1,
          pageTotal: total,
          sourceName: file.name,
        });
      }
    } catch (e) {
      // Corrupt / encrypted PDF — keep original so user still gets one sheet
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
