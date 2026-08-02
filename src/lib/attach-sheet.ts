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
};

/**
 * Attach one or more PDF/image files to the active job register.
 * Flexible filename matching; creates a sheet row when no match (optional).
 */
export async function attachSheetsFromFiles(opts: {
  files: File[];
  projectId: string;
  /** When false, skip creating rows for unmatched (default true). */
  createIfMissing?: boolean;
}): Promise<AttachResult> {
  const createIfMissing = opts.createIfMissing !== false;
  let attached = 0;
  let created = 0;
  const failed: string[] = [];

  const store = useAppStore.getState();
  let pool = store.drawings.filter((d) => d.projectId === opts.projectId);

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

  for (const file of opts.files) {
    try {
      // Refresh pool each file so newly created sheets can match later files
      pool = useAppStore
        .getState()
        .drawings.filter((d) => d.projectId === opts.projectId);

      let hit = matchDrawingByFileName(pool, file.name);
      if (!hit && createIfMissing) {
        const used = new Set(pool.map((d) => normalizeSheetNo(d.number)));
        const number = suggestNumberFromFile(file.name, used);
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
      await uploadSheetToServer({
        drawingId: hit.id,
        name: file.name,
        mime: asset.mime,
        blob: file,
      });
      attached += 1;
    } catch (e) {
      failed.push(
        `${file.name} (${e instanceof Error ? e.message : "error"})`,
      );
    }
  }

  return { attached, created, failed };
}
