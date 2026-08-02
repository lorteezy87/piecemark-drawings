import { toast } from "sonner";
import type { JobPackage } from "@/lib/job-package";
import { can } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
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
const DIRTY_KEY = "piecemark-local-dirty";

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

export function isLocalDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLocalDirty(dirty: boolean) {
  try {
    if (dirty) localStorage.setItem(DIRTY_KEY, "1");
    else localStorage.removeItem(DIRTY_KEY);
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

export async function syncPull(): Promise<{
  package: JobPackage | null;
  revision: number;
  updatedAt: string | null;
}> {
  const res = await pullWorkspace();
  return res;
}

export type SyncPushOpts = {
  silent?: boolean;
  force?: boolean;
  crewRole?: UserRole;
};

export async function syncPush(
  pkg: JobPackage,
  opts?: SyncPushOpts,
): Promise<{ revision: number; accepted: boolean; conflict: boolean }> {
  if (opts?.crewRole && !can(opts.crewRole, "sync.push")) {
    if (!opts.silent) toast.error("Your station role cannot push to cloud");
    return { revision: getLocalRevision(), accepted: false, conflict: false };
  }
  const base = getLocalRevision();
  const res = await pushWorkspace({
    data: {
      package: pkg,
      baseRevision: base,
      force: opts?.force === true,
    },
  });

  if (!res.accepted) {
    if (!opts?.silent) {
      toast.error(
        `Cloud is at rev ${res.revision} (this device ${base}). Pull first, or Force push from Settings.`,
      );
    }
    return {
      revision: res.revision,
      accepted: false,
      conflict: true,
    };
  }

  setLocalRevision(res.revision);
  setLocalDirty(false);
  if (res.conflict && !opts?.silent) {
    toast.message("Force-pushed over a newer cloud revision.");
  }
  return {
    revision: res.revision,
    accepted: true,
    conflict: !!res.conflict,
  };
}

/** Debounced auto-push controller (module singleton). */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushErrorAt = 0;
let pushInFlight = false;
let pullOnceDone = false;

export function scheduleAutoPush(
  getPackage: () => JobPackage,
  opts?: { crewRole?: UserRole },
) {
  if (!isAutoSyncEnabled()) return;
  if (opts?.crewRole && !can(opts.crewRole, "sync.push")) return;
  setLocalDirty(true);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (pushInFlight) {
      // re-schedule after in-flight push
      scheduleAutoPush(getPackage, opts);
      return;
    }
    void (async () => {
      pushInFlight = true;
      try {
        await syncPush(getPackage(), {
          silent: true,
          crewRole: opts?.crewRole,
        });
      } catch (e) {
        const now = Date.now();
        if (now - lastPushErrorAt > 60_000) {
          lastPushErrorAt = now;
          const msg = e instanceof Error ? e.message : "Auto-sync failed";
          if (/unauthorized/i.test(msg)) {
            toast.message("Auto-sync: sign in to push workspace to cloud");
          } else {
            toast.error(`Auto-sync: ${msg}`);
          }
        }
      } finally {
        pushInFlight = false;
      }
    })();
  }, 2500);
}

/**
 * One-shot: if cloud is newer and local isn't dirty, pull automatically.
 * Returns package when caller should importPackage(pkg, "replace").
 */
export async function maybeAutoPull(opts?: {
  forceConfirmDirty?: boolean;
}): Promise<JobPackage | null> {
  if (pullOnceDone) return null;
  pullOnceDone = true;
  try {
    const remote = await pullWorkspace();
    if (!remote.package) return null;
    const local = getLocalRevision();
    if (remote.revision <= local) return null;
    if (isLocalDirty() && !opts?.forceConfirmDirty) {
      toast.message(
        `Cloud rev ${remote.revision} is newer. Pull from Settings when ready (local has unsaved changes).`,
      );
      return null;
    }
    setLocalRevision(remote.revision);
    setLocalDirty(false);
    toast.success(`Synced cloud workspace (rev ${remote.revision})`);
    return remote.package;
  } catch {
    // signed out / offline — ignore
    return null;
  }
}

/** Reset pull-once guard (e.g. after sign-in). */
export function resetAutoPullGuard() {
  pullOnceDone = false;
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
        reason:
          "File > 6MB kept local only (IndexedDB). Cloud package still syncs metadata.",
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

/** After pull: mark all remote sheet files as known for hydrate. */
export async function rememberAllRemoteSheets() {
  try {
    const rows = await listDrawingFiles();
    for (const r of rows) {
      if (r.drawing_id) rememberServerSheet(r.drawing_id);
    }
  } catch {
    /* ignore */
  }
}
