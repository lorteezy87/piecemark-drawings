/**
 * Single entry point for pdf.js.
 *
 * Every PDF surface (sheet viewer, title-block mapper, upload page-splitter)
 * loads pdf.js through here so they all get the same worker build and the same
 * `Map.prototype.getOrInsertComputed` polyfill. Previously each call site set
 * `workerSrc` to `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`
 * — a bare specifier Vite does not resolve, so the worker 404'd and pdf.js fell
 * back to running on the main thread.
 *
 * `workerSrc` is a URL on purpose (not a shared `workerPort`): pdf.js then owns
 * one Worker per document and terminates it in `destroy()`. A port shared
 * across documents throws "PDFWorker.create - the worker is being destroyed"
 * whenever one document is torn down while another is opening. The flip side
 * is that every `getDocument()` here MUST be paired with `destroyPdf(task)` in a
 * `finally` (not just `doc.cleanup()`), or its worker thread and parsed PDF
 * stay alive.
 */
import { installMapUpsertPolyfill } from "@/lib/map-upsert-polyfill";
import pdfWorkerUrl from "@/lib/pdf-worker?worker&url";

installMapUpsertPolyfill();

type Pdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<Pdfjs> | null = null;

export function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist");
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

/**
 * Release a loading task — the parsed document AND its worker. Never throws.
 * Takes the task rather than the document so the failure path (corrupt or
 * encrypted file, `task.promise` rejected, no document ever existed) releases
 * the worker too.
 */
export async function destroyPdf(
  task: { destroy(): Promise<void> } | null | undefined,
): Promise<void> {
  if (!task) return;
  try {
    await task.destroy();
  } catch {
    /* already destroyed */
  }
}
