import { toast } from "sonner";
import type { JobPackage } from "@/lib/job-package";
import { can } from "@/lib/permissions";
import { raiseSyncConflict } from "@/lib/sync-conflict-store";
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

/** Max single-part binary size (~6MB). Larger files use multi-part chunks. */
export const SERVER_FILE_PART_BYTES = 5.5 * 1024 * 1024;
/** Max total binary for chunked cloud store without external object storage. */
export const SERVER_FILE_MAX_BYTES = 28 * 1024 * 1024;

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
  return pullWorkspace();
}

export type SyncPushOpts = {
  silent?: boolean;
  force?: boolean;
  crewRole?: UserRole;
  /** When true, open multi-device conflict dialog on reject */
  raiseUi?: boolean;
};

export async function syncPush(
  pkg: JobPackage,
  opts?: SyncPushOpts,
): Promise<{
  revision: number;
  accepted: boolean;
  conflict: boolean;
  remotePackage?: JobPackage | null;
}> {
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
    if (opts?.raiseUi !== false) {
      raiseSyncConflict({
        reason: "stale_push",
        localRevision: base,
        remoteRevision: res.revision,
        remotePackage: res.package ?? null,
        pendingLocalPackage: pkg,
      });
    } else if (!opts?.silent) {
      toast.error(
        `Cloud is at rev ${res.revision} (this device ${base}). Open Settings to resolve.`,
      );
    }
    return {
      revision: res.revision,
      accepted: false,
      conflict: true,
      remotePackage: res.package ?? null,
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
      scheduleAutoPush(getPackage, opts);
      return;
    }
    void (async () => {
      pushInFlight = true;
      try {
        const pkg = getPackage();
        const res = await syncPush(pkg, {
          silent: true,
          crewRole: opts?.crewRole,
          raiseUi: true,
        });
        if (!res.accepted && res.conflict) {
          // dialog raised by syncPush
        }
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
 * One-shot auto-pull. Opens conflict UI when local is dirty and remote is newer.
 * Returns package when caller should importPackage(pkg, "replace") silently.
 */
export async function maybeAutoPull(): Promise<JobPackage | null> {
  if (pullOnceDone) return null;
  pullOnceDone = true;
  try {
    const remote = await pullWorkspace();
    if (!remote.package) return null;
    const local = getLocalRevision();
    if (remote.revision <= local) return null;
    if (isLocalDirty()) {
      raiseSyncConflict({
        reason: "dirty_remote",
        localRevision: local,
        remoteRevision: remote.revision,
        remoteUpdatedAt: remote.updatedAt,
        remotePackage: remote.package,
      });
      return null;
    }
    setLocalRevision(remote.revision);
    setLocalDirty(false);
    toast.success(`Synced cloud workspace (rev ${remote.revision})`);
    return remote.package;
  } catch {
    return null;
  }
}

export function resetAutoPullGuard() {
  pullOnceDone = false;
}

function bytesToB64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function uploadSheetToServer(opts: {
  drawingId: string;
  name: string;
  mime: string;
  blob: Blob;
}): Promise<{ ok: true; size: number; parts: number } | { ok: false; reason: string }> {
  try {
    if (opts.blob.size > SERVER_FILE_MAX_BYTES) {
      return {
        ok: false,
        reason: `File > ${Math.round(SERVER_FILE_MAX_BYTES / (1024 * 1024))}MB kept local only (IndexedDB). Metadata still syncs.`,
      };
    }
    const buf = new Uint8Array(await opts.blob.arrayBuffer());
    const partSize = Math.floor(SERVER_FILE_PART_BYTES);
    const parts = Math.max(1, Math.ceil(buf.length / partSize));

    for (let i = 0; i < parts; i++) {
      const slice = buf.subarray(i * partSize, Math.min(buf.length, (i + 1) * partSize));
      const contentB64 = bytesToB64(slice);
      const id =
        i === 0 ? `file-${opts.drawingId}` : `file-${opts.drawingId}-p${i}`;
      await saveDrawingFile({
        data: {
          id,
          drawingId: opts.drawingId,
          name: opts.name,
          mime: opts.mime,
          contentB64,
          kind: i === 0 ? "sheet" : "sheet_part",
          partIndex: i,
          partTotal: parts,
        },
      });
    }
    // Drop leftover parts if file shrank
    // (best-effort: list and delete is optional; orphan parts harmless)
    rememberServerSheet(opts.drawingId);
    return { ok: true, size: buf.length, parts };
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
    const head = await getDrawingFile({ data: { id: `file-${drawingId}` } });
    if (!head?.content_b64) return null;

    const partTotal =
      typeof head.part_total === "number" && head.part_total > 1
        ? head.part_total
        : 1;

    const chunks: Uint8Array[] = [b64ToBytes(head.content_b64)];
    for (let i = 1; i < partTotal; i++) {
      const part = await getDrawingFile({
        data: { id: `file-${drawingId}-p${i}` },
      });
      if (!part?.content_b64) break;
      chunks.push(b64ToBytes(part.content_b64));
    }

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const blob = new Blob([merged], {
      type: head.mime || "application/pdf",
    });
    return { name: head.name, mime: head.mime, blob };
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

export async function rememberAllRemoteSheets() {
  try {
    const rows = await listDrawingFiles();
    for (const r of rows) {
      if (r.drawing_id && (r.kind === "sheet" || !r.kind)) {
        rememberServerSheet(r.drawing_id);
      }
    }
  } catch {
    /* ignore */
  }
}
