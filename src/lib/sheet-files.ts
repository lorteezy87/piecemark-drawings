/**
 * Uploaded sheet files (PDF / image per drawing) in Supabase Storage.
 *
 * Bytes live in the private `sheets` bucket at `<user_id>/<drawing_id>/<name>`;
 * a `sheet_files` row per drawing carries name/mime/size/path. Storage
 * policies and RLS both key on the signed-in user, so nothing here needs a
 * server. The browser keeps an IndexedDB copy (see idb-files.ts) so a sheet
 * opens instantly after the first download.
 */
import { errorMessage, getSupabase } from "@/lib/supabase/client";

const BUCKET = "sheets";

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
  return (cleaned || "sheet").slice(0, 120);
}

export type SheetUploadResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

export async function uploadSheetFile(opts: {
  drawingId: string;
  blob: Blob;
  name: string;
  mime: string;
}): Promise<SheetUploadResult> {
  try {
    const sb = getSupabase();
    const uid = await currentUserId();
    const path = `${uid}/${opts.drawingId}/${safeName(opts.name)}`;

    // A re-upload under a different filename must not leave the old object behind.
    const prev = await sb
      .from("sheet_files")
      .select("storage_path")
      .eq("drawing_id", opts.drawingId)
      .maybeSingle();
    if (prev.data?.storage_path && prev.data.storage_path !== path) {
      await sb.storage.from(BUCKET).remove([prev.data.storage_path]);
    }

    const up = await sb.storage
      .from(BUCKET)
      .upload(path, opts.blob, { upsert: true, contentType: opts.mime });
    if (up.error) throw up.error;

    const row = await sb.from("sheet_files").upsert(
      {
        user_id: uid,
        drawing_id: opts.drawingId,
        name: opts.name,
        mime: opts.mime,
        size_bytes: opts.blob.size,
        storage_path: path,
      },
      { onConflict: "user_id,drawing_id" },
    );
    if (row.error) throw row.error;
    return { ok: true, path };
  } catch (e) {
    return { ok: false, reason: errorMessage(e, "Upload failed") };
  }
}

export async function downloadSheetFile(
  drawingId: string,
): Promise<{ name: string; mime: string; blob: Blob } | null> {
  try {
    const sb = getSupabase();
    const { data: row } = await sb
      .from("sheet_files")
      .select("name,mime,storage_path")
      .eq("drawing_id", drawingId)
      .maybeSingle();
    if (!row) return null;
    const dl = await sb.storage.from(BUCKET).download(row.storage_path);
    if (dl.error || !dl.data) return null;
    return {
      name: row.name,
      mime: row.mime || dl.data.type || "application/pdf",
      blob: dl.data,
    };
  } catch {
    return null;
  }
}

export async function deleteSheetFile(drawingId: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: row } = await sb
      .from("sheet_files")
      .select("storage_path")
      .eq("drawing_id", drawingId)
      .maybeSingle();
    if (row?.storage_path) {
      await sb.storage.from(BUCKET).remove([row.storage_path]);
    }
    await sb.from("sheet_files").delete().eq("drawing_id", drawingId);
  } catch {
    /* best effort */
  }
}

/** Drawing ids that have a file in the cloud for the signed-in user. */
export async function listSheetFileIds(): Promise<string[]> {
  try {
    const { data } = await getSupabase().from("sheet_files").select("drawing_id");
    return (data ?? []).map((r: { drawing_id: string }) => r.drawing_id);
  } catch {
    return [];
  }
}
