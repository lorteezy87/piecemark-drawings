/**
 * Cloud persistence for the Zustand store — Supabase edition.
 *
 * Replaces the old "push the whole job package as one JSON blob with a
 * revision counter" sync (and its conflict dialog). Now every record is its
 * own row and the store is written through:
 *
 *   sign-in  → load the user's rows; if the cloud is empty, seed it from this
 *              device; otherwise the cloud replaces local state
 *   change   → 1.2 s after the last edit, diff the store against the last
 *              synced snapshot and upsert / delete only the rows that changed
 *
 * Row-level: last write wins. Multi-device editing of the *same row* at the
 * same second is the only case that loses data, which is the trade the app
 * made when it dropped conflict handling. `reloadFromCloud()` pulls fresh.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { JOB_PACKAGE_VERSION, type JobPackage } from "@/lib/job-package";
import { useAppStore } from "@/lib/store";
import { errorMessage, getSupabase } from "@/lib/supabase/client";
import type { TitleBlockMap } from "@/lib/title-block";
import type { UserRole } from "@/lib/types";

/* ── which store collections map to which tables ───────────────────────── */

type AnyRec = Record<string, unknown> & { id: string };
type Spec = { table: string; lift: (r: AnyRec) => Record<string, unknown> };

const proj = (r: AnyRec) => ({ project_id: r.projectId });
const projStatus = (r: AnyRec) => ({ project_id: r.projectId, status: r.status });

const COLLECTIONS = {
  projects: {
    table: "projects",
    lift: (r) => ({ job_number: r.jobNumber, name: r.name, status: r.status }),
  },
  sequences: { table: "sequences", lift: proj },
  drawingSets: {
    table: "drawing_sets",
    lift: (r) => ({ project_id: r.projectId, code: r.code, status: r.status }),
  },
  drawings: {
    table: "drawings",
    lift: (r) => ({
      project_id: r.projectId,
      set_id: r.setId,
      number: r.number,
      status: r.status,
    }),
  },
  revisions: { table: "revisions", lift: (r) => ({ drawing_id: r.drawingId }) },
  rfis: {
    table: "rfis",
    lift: (r) => ({ project_id: r.projectId, number: r.number, status: r.status }),
  },
  submittals: {
    table: "submittals",
    lift: (r) => ({ project_id: r.projectId, number: r.number, status: r.status }),
  },
  markups: { table: "markups", lift: (r) => ({ drawing_id: r.drawingId }) },
  transmittals: {
    table: "transmittals",
    lift: (r) => ({ project_id: r.projectId, number: r.number, status: r.status }),
  },
  activities: {
    table: "activities",
    lift: (r) => ({ project_id: r.projectId, at: r.at }),
  },
  tasks: { table: "tasks", lift: projStatus },
  changeOrders: { table: "change_orders", lift: projStatus },
  deliveries: { table: "deliveries", lift: projStatus },
  workPackages: { table: "work_packages", lift: projStatus },
  roadblocks: { table: "roadblocks", lift: projStatus },
} satisfies Record<string, Spec>;

type Key = keyof typeof COLLECTIONS;
const KEYS = Object.keys(COLLECTIONS) as Key[];

type StoreState = ReturnType<typeof useAppStore.getState>;

/* ── status (for Settings / shell) ─────────────────────────────────────── */

export type CloudStatus = {
  state: "off" | "loading" | "idle" | "saving" | "error";
  lastSavedAt: string | null;
  error: string | null;
};

let status: CloudStatus = { state: "off", lastSavedAt: null, error: null };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<CloudStatus>) {
  status = { ...status, ...patch };
  for (const l of statusListeners) l();
}
export function getCloudStatus(): CloudStatus {
  return status;
}
export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => status,
  );
}

/* ── snapshots ─────────────────────────────────────────────────────────── */

type Snapshot = Record<Key, Map<string, string>>;

function snapshotOf(s: StoreState): Snapshot {
  const out = {} as Snapshot;
  for (const k of KEYS) {
    const m = new Map<string, string>();
    for (const item of s[k] as unknown as AnyRec[]) m.set(item.id, JSON.stringify(item));
    out[k] = m;
  }
  return out;
}
function emptySnapshot(): Snapshot {
  const out = {} as Snapshot;
  for (const k of KEYS) out[k] = new Map();
  return out;
}

type SettingsRow = {
  crew_role: string;
  org_name: string;
  org_rfi_email: string;
  session_actor: string;
  selected_project_id: string | null;
};
function settingsOf(s: StoreState): SettingsRow {
  return {
    crew_role: s.crewRole,
    org_name: s.orgName,
    org_rfi_email: s.orgRfiEmail,
    session_actor: s.sessionActor,
    selected_project_id: s.selectedProjectId,
  };
}
function mapsOf(s: StoreState): Map<string, string> {
  const m = new Map<string, string>();
  for (const [pid, map] of Object.entries(s.titleBlockMaps)) {
    if (map) m.set(pid, JSON.stringify(map));
  }
  return m;
}

/* ── load ──────────────────────────────────────────────────────────────── */

export type CloudLoad = {
  pkg: JobPackage;
  titleBlockMaps: Record<string, TitleBlockMap>;
  settings: SettingsRow | null;
  empty: boolean;
};

export async function loadCloud(): Promise<CloudLoad> {
  const sb = getSupabase();
  const reads = KEYS.map(async (k) => {
    let q = sb.from(COLLECTIONS[k].table).select("data");
    if (k === "activities") q = q.order("at", { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) throw error;
    return [k, (data ?? []).map((r: { data: unknown }) => r.data)] as const;
  });
  const [rows, settingsRes, mapsRes] = await Promise.all([
    Promise.all(reads),
    sb.from("user_settings").select("*").maybeSingle(),
    sb.from("title_block_maps").select("project_id,data"),
  ]);
  if (settingsRes.error) throw settingsRes.error;
  if (mapsRes.error) throw mapsRes.error;

  const byKey = Object.fromEntries(rows) as Record<Key, unknown[]>;
  const settings = (settingsRes.data as SettingsRow | null) ?? null;
  const pkg = {
    version: JOB_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    app: "piecemark" as const,
    projects: byKey.projects,
    sequences: byKey.sequences,
    drawingSets: byKey.drawingSets,
    drawings: byKey.drawings,
    revisions: byKey.revisions,
    rfis: byKey.rfis,
    submittals: byKey.submittals,
    markups: byKey.markups,
    transmittals: byKey.transmittals,
    activities: byKey.activities,
    tasks: byKey.tasks,
    changeOrders: byKey.changeOrders,
    deliveries: byKey.deliveries,
    workPackages: byKey.workPackages,
    roadblocks: byKey.roadblocks,
    selectedProjectId: settings?.selected_project_id ?? null,
    orgName: settings?.org_name,
    orgRfiEmail: settings?.org_rfi_email,
    crewRole: settings?.crew_role as UserRole | undefined,
  } as JobPackage;
  const titleBlockMaps: Record<string, TitleBlockMap> = {};
  for (const r of (mapsRes.data ?? []) as { project_id: string; data: TitleBlockMap }[]) {
    titleBlockMaps[r.project_id] = r.data;
  }
  return { pkg, titleBlockMaps, settings, empty: pkg.projects.length === 0 };
}

/* ── write-through ─────────────────────────────────────────────────────── */

const DEBOUNCE_MS = 1200;
const RETRY_MS = 10_000;
const CHUNK = 200;

let activeUserId: string | null = null;
let lastSynced: Snapshot | null = null;
let lastSettings = "";
let lastMaps = new Map<string, string>();
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let dirty = false;
let lastErrorToastAt = 0;

function schedule(ms = DEBOUNCE_MS) {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

function chunks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
}

async function flush(): Promise<void> {
  if (!activeUserId || !lastSynced) return;
  if (flushing) {
    dirty = true;
    return;
  }
  flushing = true;
  dirty = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  setStatus({ state: "saving" });
  const uid = activeUserId;
  try {
    const sb = getSupabase();
    const state = useAppStore.getState();
    const next = snapshotOf(state);

    for (const k of KEYS) {
      const prev = lastSynced[k];
      const cur = next[k];
      const upserts: Record<string, unknown>[] = [];
      for (const item of state[k] as unknown as AnyRec[]) {
        if (prev.get(item.id) !== cur.get(item.id)) {
          upserts.push({
            id: item.id,
            user_id: uid,
            ...COLLECTIONS[k].lift(item),
            data: item,
          });
        }
      }
      const deletes = [...prev.keys()].filter((id) => !cur.has(id));
      for (const part of chunks(upserts)) {
        const { error } = await sb
          .from(COLLECTIONS[k].table)
          .upsert(part, { onConflict: "id" });
        if (error) throw error;
      }
      for (const part of chunks(deletes)) {
        const { error } = await sb
          .from(COLLECTIONS[k].table)
          .delete()
          .in("id", part);
        if (error) throw error;
      }
      // Commit per collection so a later failure doesn't re-send this one.
      lastSynced[k] = cur;
    }

    const settings = settingsOf(state);
    const settingsKey = JSON.stringify(settings);
    if (settingsKey !== lastSettings) {
      const { error } = await sb
        .from("user_settings")
        .upsert({ user_id: uid, ...settings }, { onConflict: "user_id" });
      if (error) throw error;
      lastSettings = settingsKey;
    }

    const maps = mapsOf(state);
    const mapUpserts = [...maps.entries()]
      .filter(([pid, json]) => lastMaps.get(pid) !== json)
      .map(([pid]) => ({
        user_id: uid,
        project_id: pid,
        data: state.titleBlockMaps[pid],
      }));
    const mapDeletes = [...lastMaps.keys()].filter((pid) => !maps.has(pid));
    if (mapUpserts.length) {
      const { error } = await sb
        .from("title_block_maps")
        .upsert(mapUpserts, { onConflict: "user_id,project_id" });
      if (error) throw error;
    }
    if (mapDeletes.length) {
      const { error } = await sb
        .from("title_block_maps")
        .delete()
        .in("project_id", mapDeletes);
      if (error) throw error;
    }
    lastMaps = maps;

    setStatus({ state: "idle", lastSavedAt: new Date().toISOString(), error: null });
  } catch (e) {
    const msg = errorMessage(e, "Cloud save failed");
    setStatus({ state: "error", error: msg });
    if (Date.now() - lastErrorToastAt > 30_000) {
      lastErrorToastAt = Date.now();
      toast.error(`Cloud save failed — will retry. ${msg}`);
    }
    dirty = true;
    schedule(RETRY_MS);
  } finally {
    flushing = false;
    if (dirty && !timer) schedule();
  }
}

const WATCHED: (keyof StoreState)[] = [
  ...KEYS,
  "crewRole",
  "orgName",
  "orgRfiEmail",
  "sessionActor",
  "selectedProjectId",
  "titleBlockMaps",
];

function onVisibilityChange() {
  if (document.visibilityState === "hidden" && dirty) void flush();
}

function applyCloud(load: CloudLoad) {
  const store = useAppStore.getState();
  store.importPackage(load.pkg, "replace");
  const settings = load.settings;
  useAppStore.setState({
    titleBlockMaps: load.titleBlockMaps,
    ...(settings
      ? {
          crewRole: settings.crew_role as UserRole,
          orgName: settings.org_name,
          orgRfiEmail: settings.org_rfi_email,
          sessionActor: settings.session_actor || store.sessionActor,
        }
      : {}),
  });
  const after = useAppStore.getState();
  const wanted = settings?.selected_project_id;
  if (wanted && after.projects.some((p) => p.id === wanted)) {
    after.setSelectedProjectId(wanted);
  }
}

function resnapshot() {
  const s = useAppStore.getState();
  lastSynced = snapshotOf(s);
  lastSettings = JSON.stringify(settingsOf(s));
  lastMaps = mapsOf(s);
}

/**
 * Bind the store to the cloud for this user. Idempotent per user id.
 * Empty cloud → this device's data becomes the cloud copy (first sign-in).
 * Otherwise the cloud replaces local state.
 */
export async function startCloudPersist(userId: string): Promise<void> {
  if (activeUserId === userId) return;
  stopCloudPersist();
  activeUserId = userId;
  setStatus({ state: "loading", error: null });
  try {
    const load = await loadCloud();
    if (activeUserId !== userId) return; // user changed mid-load
    if (load.empty) {
      lastSynced = emptySnapshot();
      lastSettings = "";
      lastMaps = new Map();
      dirty = true;
    } else {
      applyCloud(load);
      resnapshot();
      dirty = false;
    }
    unsubscribe = useAppStore.subscribe((s, prev) => {
      for (const k of WATCHED) {
        if (s[k] !== prev[k]) {
          schedule();
          return;
        }
      }
    });
    document.addEventListener("visibilitychange", onVisibilityChange);
    setStatus({ state: "idle" });
    if (dirty) {
      schedule(0);
      toast.message("First sign-in on this device — uploading its jobs to the cloud.");
    }
  } catch (e) {
    const msg = errorMessage(e, "Could not load cloud data");
    setStatus({ state: "error", error: msg });
    toast.error(`Cloud load failed: ${msg}`);
    activeUserId = null;
  }
}

export function stopCloudPersist() {
  unsubscribe?.();
  unsubscribe = null;
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  if (timer) clearTimeout(timer);
  timer = null;
  activeUserId = null;
  lastSynced = null;
  lastSettings = "";
  lastMaps = new Map();
  dirty = false;
  setStatus({ state: "off", error: null });
}

/** Pull the cloud copy and replace local state with it. */
export async function reloadFromCloud(): Promise<CloudLoad> {
  if (!activeUserId) throw new Error("Not signed in");
  setStatus({ state: "loading" });
  const load = await loadCloud();
  if (!load.empty) applyCloud(load);
  resnapshot();
  dirty = false;
  setStatus({ state: "idle", error: null });
  return load;
}

/** Force every local row up (merge into the cloud by id). Recovery tool. */
export async function pushAllLocal(): Promise<void> {
  if (!activeUserId) throw new Error("Not signed in");
  lastSynced = emptySnapshot();
  lastSettings = "";
  lastMaps = new Map();
  await flush();
}

/** Flush pending edits now (e.g. before sign-out). */
export async function flushCloud(): Promise<void> {
  if (dirty) await flush();
}
