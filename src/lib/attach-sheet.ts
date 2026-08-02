import { fileToSheetAsset } from "@/components/viewer/real-sheet-viewer";
import {
  matchDrawingByFileName,
  normalizeSheetNo,
  suggestNumberFromFile,
} from "@/lib/sheet-match";
import { useAppStore } from "@/lib/store";
import { uploadSheetToServer } from "@/lib/workspace-sync";

export type AttachResult = {
  /** Files successfully attached (matched or newly created). */
  attached: number;
  /** How many of those were new register rows. */
  created: number;
  failed: string[];
  /** Drawing ids that received a file (in order). */
  drawingIds: string[];
};

/**
 * Attach one or more PDF/image files — each file gets its own sheet when
 * there is no exact sheet-number match, so multi-select never collapses to one.
 */
export async function attachSheetsFromFiles(opts: {
  files: File[];
  projectId: string;
  createIfMissing?: boolean;
}): Promise<AttachResult> {
  const createIfMissing = opts.createIfMissing !== false;
  let attached = 0;
  let created = 0;
  const failed: string[] = [];
  const drawingIds: string[] = [];
  /** Drawings already claimed by a file in this batch — never overwrite. */
  const claimed = new Set<string>();

  const ensureUploadSet = (): string => {
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

  const createSheetForFile = (file: File) => {
    const pool = useAppStore
      .getState()
      .drawings.filter((d) => d.projectId === opts.projectId);
    const used = new Set(pool.map((d) => normalizeSheetNo(d.number)));
    // Disambiguate with index when basename collides
    let number = suggestNumberFromFile(file.name, used);
    if (used.has(normalizeSheetNo(number))) {
      number = `${number}-${Date.now().toString(36).slice(-4)}`;
    }
    const title = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_]+/g, " ")
      .trim();
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

  for (const file of opts.files) {
    try {
      const pool = useAppStore
        .getState()
        .drawings.filter((d) => d.projectId === opts.projectId);

      // Strict match only — exact sheet token in filename, not already claimed
      let hit = matchDrawingByFileName(pool, file.name, {
        strict: true,
      });
      if (hit && claimed.has(hit.id)) {
        hit = null;
      }
      // If that sheet already has an uploaded file, don't overwrite — new row
      if (hit) {
        const existing = useAppStore.getState().sheetAssets[hit.id];
        if (existing?.url) hit = null;
      }

      if (!hit && createIfMissing) {
        const id = createSheetForFile(file);
        if (!id) {
          failed.push(`${file.name} (could not create sheet)`);
          continue;
        }
        hit =
          useAppStore.getState().drawings.find((d) => d.id === id) ?? null;
        if (!hit) {
          failed.push(`${file.name} (sheet missing after create)`);
          continue;
        }
        created += 1;
      }

      if (!hit) {
        failed.push(file.name);
        continue;
      }

      const asset = await fileToSheetAsset(hit.id, file);
      useAppStore.getState().setSheetAsset(hit.id, asset);
      claimed.add(hit.id);
      drawingIds.push(hit.id);

      // Cloud is best-effort — never block local multi-file attach
      try {
        await uploadSheetToServer({
          drawingId: hit.id,
          name: file.name,
          mime: asset.mime,
          blob: file,
        });
      } catch {
        /* local IDB still has the file */
      }

      attached += 1;
    } catch (e) {
      failed.push(
        `${file.name} (${e instanceof Error ? e.message : "error"})`,
      );
    }
  }

  return { attached, created, failed, drawingIds };
}
