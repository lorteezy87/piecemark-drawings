import { fileToSheetAsset } from "@/components/viewer/real-sheet-viewer";
import {
  matchDrawingByFileName,
  normalizeSheetNo,
  suggestNumberFromFile,
} from "@/lib/sheet-match";
import { expandUploadFiles, type ExpandedPageFile } from "@/lib/pdf-split";
import { useAppStore } from "@/lib/store";
import { uploadSheetToServer } from "@/lib/workspace-sync";

export type AttachResult = {
  attached: number;
  created: number;
  splitPdfs: number;
  failed: string[];
  drawingIds: string[];
};

/**
 * Attach PDFs/images. Multi-page PDFs split to one sheet per page.
 * Page titles/sheet numbers are read from PDF text when present.
 */
export async function attachSheetsFromFiles(opts: {
  files: File[];
  projectId: string;
  createIfMissing?: boolean;
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

  const resolveNumberAndTitle = (page: ExpandedPageFile, used: Set<string>) => {
    const sourceBase = page.sourceName.replace(/\.[^.]+$/, "");
    const fileGuess = suggestNumberFromFile(page.file.name, used);

    // Sheet number priority: page text → filename → generated
    let number: string | null = null;
    if (
      page.extractedSheetNo &&
      !used.has(normalizeSheetNo(page.extractedSheetNo))
    ) {
      number = page.extractedSheetNo;
    } else if (fileGuess && !used.has(normalizeSheetNo(fileGuess))) {
      // For multi-page, avoid applying the same parent sheet no to every page
      if (page.pageTotal <= 1) {
        number = fileGuess;
      } else if (
        page.extractedSheetNo &&
        normalizeSheetNo(fileGuess) !== normalizeSheetNo(page.extractedSheetNo)
      ) {
        number = fileGuess;
      }
    }

    if (!number) {
      const base =
        page.extractedSheetNo ||
        suggestNumberFromFile(page.sourceName, new Set()) ||
        sourceBase
          .replace(/[^A-Za-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 18)
          .toUpperCase() ||
        "SHEET";
      if (page.pageTotal > 1) {
        number = `${base}-P${page.pageIndex}`;
      } else {
        number = base;
      }
      if (used.has(normalizeSheetNo(number))) {
        number = `${number}-${Date.now().toString(36).slice(-3)}`;
      }
    }

    // Title priority: extracted page title → cleaned source name + page
    let title =
      (page.extractedTitle && page.extractedTitle.trim()) ||
      null;
    if (title && page.extractedSheetNo) {
      // Avoid title that is only the sheet number
      if (normalizeSheetNo(title) === normalizeSheetNo(page.extractedSheetNo)) {
        title = null;
      }
    }
    if (!title) {
      const fallback = sourceBase.replace(/[_]+/g, " ").trim();
      title =
        page.pageTotal > 1
          ? `${fallback} · p.${page.pageIndex}/${page.pageTotal}`
          : fallback || number;
    }

    return { number, title };
  };

  const createSheetForPage = (page: ExpandedPageFile) => {
    const pool = useAppStore
      .getState()
      .drawings.filter((d) => d.projectId === opts.projectId);
    const used = new Set(pool.map((d) => normalizeSheetNo(d.number)));
    const { number, title } = resolveNumberAndTitle(page, used);
    const setId = ensureUploadSet();
    return useAppStore.getState().createDrawing({
      projectId: opts.projectId,
      setId,
      number,
      title,
      type: "mixed",
    });
  };

  for (const page of expanded) {
    try {
      const pool = useAppStore
        .getState()
        .drawings.filter((d) => d.projectId === opts.projectId);

      // Match empty register row by extracted sheet no or filename
      let hit: (typeof pool)[number] | null = null;
      if (page.extractedSheetNo) {
        const want = normalizeSheetNo(page.extractedSheetNo);
        hit =
          pool.find(
            (d) =>
              normalizeSheetNo(d.number) === want && !claimed.has(d.id),
          ) ?? null;
        if (hit) {
          const existing = useAppStore.getState().sheetAssets[hit.id];
          if (existing?.url) hit = null;
        }
      }
      if (!hit && (page.pageTotal === 1 || page.pageIndex === 1)) {
        hit = matchDrawingByFileName(pool, page.sourceName, { strict: true });
        if (hit && claimed.has(hit.id)) hit = null;
        if (hit) {
          const existing = useAppStore.getState().sheetAssets[hit.id];
          if (existing?.url) hit = null;
        }
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
      } else if (hit && page.extractedTitle) {
        // Refresh title on matched empty sheet when we read a better title from the PDF
        const title = page.extractedTitle.trim();
        if (title && title !== hit.title) {
          useAppStore.setState((s) => ({
            drawings: s.drawings.map((d) =>
              d.id === hit!.id ? { ...d, title } : d,
            ),
          }));
        }
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
        /* local only */
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
