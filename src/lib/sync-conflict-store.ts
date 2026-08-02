import { create } from "zustand";
import type { JobPackage } from "@/lib/job-package";

export type SyncConflictReason =
  | "stale_push"
  | "remote_newer"
  | "dirty_remote";

export type SyncConflictState = {
  open: boolean;
  reason: SyncConflictReason | null;
  localRevision: number;
  remoteRevision: number;
  remoteUpdatedAt: string | null;
  remotePackage: JobPackage | null;
  /** Set when auto-push hit a conflict */
  pendingLocalPackage: JobPackage | null;
  openConflict: (input: {
    reason: SyncConflictReason;
    localRevision: number;
    remoteRevision: number;
    remoteUpdatedAt?: string | null;
    remotePackage: JobPackage | null;
    pendingLocalPackage?: JobPackage | null;
  }) => void;
  close: () => void;
};

export const useSyncConflictStore = create<SyncConflictState>((set) => ({
  open: false,
  reason: null,
  localRevision: 0,
  remoteRevision: 0,
  remoteUpdatedAt: null,
  remotePackage: null,
  pendingLocalPackage: null,
  openConflict: (input) =>
    set({
      open: true,
      reason: input.reason,
      localRevision: input.localRevision,
      remoteRevision: input.remoteRevision,
      remoteUpdatedAt: input.remoteUpdatedAt ?? null,
      remotePackage: input.remotePackage,
      pendingLocalPackage: input.pendingLocalPackage ?? null,
    }),
  close: () =>
    set({
      open: false,
      reason: null,
      remotePackage: null,
      pendingLocalPackage: null,
    }),
}));

/** Non-hook access for workspace-sync module. */
export function raiseSyncConflict(
  input: Parameters<SyncConflictState["openConflict"]>[0],
) {
  useSyncConflictStore.getState().openConflict(input);
}
