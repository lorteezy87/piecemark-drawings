import { fileToSheetAsset } from "@/components/viewer/real-sheet-viewer";
import {
  matchDrawingByFileName,
  normalizeSheetNo,
  suggestNumberFromFile,
} from "@/lib/sheet-match";
import { expandUploadFiles } from "@/lib/pdf-split";
import { useAppStore } from "@/lib/store";
import { uploadSheetToServer } from "@/lib/workspace-sync";

export type AttachResult = {
  /** Files successfully attached (matched or newly created). */
  attached: number;
  /** How many of those were new register rows. */
  created: number;
  /** How many multi-page source PDFs were split. */
  splitPdfs: number;
  failed: string[];
  /** Drawing ids that received a file (in order). */
  drawingIds: string[];
};

/**
 * Attach one or more PDF/image files.
 * Multi-page PDFs are split into one sheet per page inside the upload set.
 */
export async function attachSheetsFromFiles(opts: {
  files: File[];
  projectId: string;
  createIfMissing?: boolean;
  /** Prefer this set for newly created sheets (e.g. current set context). */
  preferSetId?: string;
}): Promise<AttachResult> {
  const createIfMissing = opts.createIfMissing !== false;
  let attached = 0;
  let created = 0;
  const failed: string[] = [];
  const drawingIds: string[] = [];
  const claimed = new Set<string>();

  const { pages: expanded, splitCount } = await expandUploadFiles(opts.files);

  const ensureUploadSet = (): string => {
    if (opts.preferSetId) {
      const hit = useAppStore
        .getState()
        .drawingSets.find(
          (s) => s.id === opts.preferSetId && s.projectId === opts.projectId,
        );
      if (hit) return hit.id;
    }
    const sets = useAppStore
      .getState()
      .drawingSets.filter((s) => s.projectId === opts.projectId);
    const existing = sets.find(
      (s) =>
        s.code.toUpperCase() === "SET-UPLOAD" ||
        s.code.toUpperCase() === "SET-IMPORT",
    );
    if (existing) return existing.id;
    return useAppStore.getState().createDrawingSet({
      projectId: opts.projectId,
      code: "SET-UPLOAD",
      name: "Uploaded sheets",
      type: "mixed",
    });
  };

  const createSheetForPage = (optsPage: {
    file: File;
    pageIndex: number;
    pageTotal: number;
    sourceName: string;
  }) => {
    const pool = useAppStore
      .getState()
      .drawings.filter((d) => d.projectId === opts.projectId);
    const used = new Set(pool.map((d) => normalizeSheetNo(d.number)));

    // Prefer sheet number from original multi-page name, then page suffix
    const sourceBase = optsPage.sourceName.replace(/\.[^.]+$/, "");
    let number: string;
    if (optsPage.pageTotal > 1) {
      const baseGuess =
        suggestNumberFromFile(optsPage.sourceName, new Set()) ||
        sourceBase
          .replace(/[^A-Za-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 20)
          .toUpperCase() ||
        "SHEET";
      number = `${baseGuess}-P${optsPage.pageIndex}`;
      if (used.has(normalizeSheetNo(number))) {
        number = `${baseGuess}-P${optsPage.pageIndex}-${Date.now().toString(36).slice(-3)}`;
      }
    } else {
      number = suggestNumberFromFile(optsPage.file.name, used);
      if (used.has(normalizeSheetNo(number))) {
        number = `${number}-${Date.now().toString(36).slice(-4)}`;
      }
    }

    const titleBase = sourceBase.replace(/[_]+/g, " ").trim();
    const title =
      optsPage.pageTotal > 1
        ? `${titleBase} · p.${optsPage.pageIndex}/${optsPage.pageTotal}`
        : titleBase || number;

    const setId = ensureUploadSet();
    const id = useAppStore.getState().createDrawing({
      projectId: opts.projectId,
      setId,
      number,
      title: title || number,
      type: "mixed",
    });
    return id;
  };

  for (const page of expanded) {
    try {
      const pool = useAppStore
        .getState()
        .drawings.filter((d) => d.projectId === opts.projectId);

      // Only exact-match first page of a multi-page split to an empty register row
      let hit =
        page.pageTotal === 1 || page.pageIndex === 1
          ? matchDrawingByFileName(pool, page.sourceName, { strict: true })
          : null;

      if (hit && claimed.has(hit.id)) hit = null;
      if (hit) {
        const existing = useAppStore.getState().sheetAssets[hit.id];
        if (existing?.url) hit = null;
      }

      if (!hit && createIfMissing) {
        const id = createSheetForPage(page);
        if (!id) {
          failed.push(`${page.file.name} (could not create sheet)`);
          continue;
        }
        hit =
          useAppStore.getState().drawings.find((d) => d.id === id) ?? null;
        if (!hit) {
          failed.push(`${page.file.name} (sheet missing after create)`);
          continue;
        }
        created += 1;
      }

      if (!hit) {
        failed.push(page.file.name);
        continue;
      }

      const asset = await fileToSheetAsset(hit.id, page.file);
      useAppStore.getState().setSheetAsset(hit.id, asset);
      claimed.add(hit.id);
      drawingIds.push(hit.id);

      try {
        await uploadSheetToServer({
          drawingId: hit.id,
          name: page.file.name,
          mime: asset.mime,
          blob: page.file,
        });
      } catch {
        /* local IDB still has the file */
      }

      attached += 1;
    } catch (e) {
      failed.push(
        `${page.file.name} (${e instanceof Error ? e.message : "error"})`,
      );
    }
  }

  return {
    attached,
    created,
    splitPdfs: splitCount,
    failed,
    drawingIds,
  };
}
