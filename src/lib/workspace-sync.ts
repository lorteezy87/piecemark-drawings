import { toast } from "sonner";
import type { JobPackage } from "@/lib/job-package";
import {
  getDrawingFile,
  listDrawingFiles,
  pullWorkspace,
  pushWorkspace,
  saveDrawingFile,
} from "@/lib/server/workspace";

const REV_KEY = "piecemark-workspace-revision";
const AUTO_KEY = "piecemark-auto-sync";
const SERVER_SHEETS_KEY = "piecemark-server-sheets";

export function getLocalRevision(): number {
  try {
    return Number(localStorage.getItem(REV_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

export function setLocalRevision(n: number) {
  try {
    localStorage.setItem(REV_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function isAutoSyncEnabled(): boolean {
  try {
    const v = localStorage.getItem(AUTO_KEY);
    // default ON for production pilot
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function setAutoSyncEnabled(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export async function syncPull(): Promise<JobPackage | null> {
  const res = await pullWorkspace();
  if (res.package) setLocalRevision(res.revision);
  return res.package;
}

export async function syncPush(
  pkg: JobPackage,
  opts?: { silent?: boolean },
): Promise<number> {
  const base = getLocalRevision();
  const res = await pushWorkspace({
    data: { package: pkg, baseRevision: base },
  });
  setLocalRevision(res.revision);
  if (res.conflict && !opts?.silent) {
    toast.message(
      "Cloud had a newer revision — overwrote with this device (last-write-wins).",
    );
  }
  return res.revision;
}

/** Debounced auto-push controller (module singleton). */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushErrorAt = 0;

export function scheduleAutoPush(getPackage: () => JobPackage) {
  if (!isAutoSyncEnabled()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void (async () => {
      try {
        await syncPush(getPackage(), { silent: true });
      } catch (e) {
        const now = Date.now();
        // Don't spam toasts (auth signed-out etc.)
        if (now - lastPushErrorAt > 60_000) {
          lastPushErrorAt = now;
          const msg = e instanceof Error ? e.message : "Auto-sync failed";
          if (/unauthorized/i.test(msg)) {
            toast.message("Auto-sync: sign in to push workspace to cloud");
          } else {
            toast.error(`Auto-sync: ${msg}`);
          }
        }
      }
    })();
  }, 2500);
}

export async function uploadSheetToServer(opts: {
  drawingId: string;
  name: string;
  mime: string;
  blob: Blob;
}): Promise<{ ok: true; size: number } | { ok: false; reason: string }> {
  try {
    if (opts.blob.size > 6 * 1024 * 1024) {
      return {
        ok: false,
        reason: "File > 6MB kept local only (IndexedDB). Cloud package still syncs metadata.",
      };
    }
    const buf = new Uint8Array(await opts.blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const contentB64 = btoa(binary);
    const res = await saveDrawingFile({
      data: {
        id: `file-${opts.drawingId}`,
        drawingId: opts.drawingId,
        name: opts.name,
        mime: opts.mime,
        contentB64,
        kind: "sheet",
      },
    });
    rememberServerSheet(opts.drawingId);
    return { ok: true, size: res.size };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Server upload failed",
    };
  }
}

function rememberServerSheet(drawingId: string) {
  try {
    const raw = localStorage.getItem(SERVER_SHEETS_KEY);
    const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    set.add(drawingId);
    localStorage.setItem(SERVER_SHEETS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function knownServerSheetIds(): string[] {
  try {
    const raw = localStorage.getItem(SERVER_SHEETS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function downloadSheetFromServer(
  drawingId: string,
): Promise<{ name: string; mime: string; blob: Blob } | null> {
  try {
    const row = await getDrawingFile({ data: { id: `file-${drawingId}` } });
    if (!row?.content_b64) return null;
    const bin = atob(row.content_b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: row.mime || "application/pdf" });
    return { name: row.name, mime: row.mime, blob };
  } catch {
    return null;
  }
}

export async function listRemoteSheets() {
  try {
    return await listDrawingFiles();
  } catch {
    return [];
  }
}
