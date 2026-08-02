import {
  Cloud,
  CloudDownload,
  CloudUpload,
  GitMerge,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { JobPackage } from "@/lib/job-package";
import { can } from "@/lib/permissions";
import { summarizePackageDiff } from "@/lib/sync-diff";
import { useSyncConflictStore } from "@/lib/sync-conflict-store";
import { useAppStore } from "@/lib/store";
import {
  getLocalRevision,
  rememberAllRemoteSheets,
  setLocalDirty,
  setLocalRevision,
  syncPush,
} from "@/lib/workspace-sync";
import { cn } from "@/lib/utils";

const REASON_COPY = {
  stale_push: {
    title: "Cloud has a newer revision",
    body: "Another station pushed while you were working. Choose how to resolve before continuing.",
  },
  remote_newer: {
    title: "Cloud is ahead of this station",
    body: "Pull cloud data, keep your local copy, or merge both packages.",
  },
  dirty_remote: {
    title: "Local changes vs newer cloud",
    body: "This station has unsent edits and the cloud is also newer. Resolve before they overwrite each other.",
  },
} as const;

/**
 * Multi-device conflict resolver — pull cloud, force local, or merge packages.
 * Mount once in AppShell.
 */
export function SyncConflictDialog() {
  const open = useSyncConflictStore((s) => s.open);
  const reason = useSyncConflictStore((s) => s.reason);
  const localRevision = useSyncConflictStore((s) => s.localRevision);
  const remoteRevision = useSyncConflictStore((s) => s.remoteRevision);
  const remoteUpdatedAt = useSyncConflictStore((s) => s.remoteUpdatedAt);
  const remotePackage = useSyncConflictStore((s) => s.remotePackage);
  const close = useSyncConflictStore((s) => s.close);

  const exportPackage = useAppStore((s) => s.exportPackage);
  const importPackage = useAppStore((s) => s.importPackage);
  const crewRole = useAppStore((s) => s.crewRole);

  const [busy, setBusy] = useState<"cloud" | "mine" | "merge" | null>(null);
  const [snapshot, setSnapshot] = useState<JobPackage | null>(null);

  useEffect(() => {
    if (open) {
      setSnapshot(exportPackage());
    } else {
      setSnapshot(null);
      setBusy(null);
    }
  }, [open, exportPackage]);

  const diff = useMemo(() => {
    if (!snapshot || !remotePackage) return [];
    return summarizePackageDiff(snapshot, remotePackage);
  }, [snapshot, remotePackage]);

  if (!open || !reason) return null;

  const copy = REASON_COPY[reason];
  const canPush = can(crewRole, "sync.push");

  async function useCloud() {
    if (!remotePackage) {
      toast.error("No cloud package available");
      return;
    }
    setBusy("cloud");
    try {
      importPackage(remotePackage, "replace");
      setLocalRevision(remoteRevision);
      setLocalDirty(false);
      await rememberAllRemoteSheets();
      toast.success(`Loaded cloud rev ${remoteRevision}`);
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply cloud");
    } finally {
      setBusy(null);
    }
  }

  async function keepMine() {
    if (!canPush) {
      toast.error("Your station role cannot force-push");
      return;
    }
    setBusy("mine");
    try {
      const res = await syncPush(exportPackage(), {
        force: true,
        crewRole,
        raiseUi: false,
      });
      if (res.accepted) {
        toast.success(`Force-pushed as rev ${res.revision}`);
        close();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Force push failed");
    } finally {
      setBusy(null);
    }
  }

  async function mergeBoth() {
    if (!remotePackage || !snapshot) {
      toast.error("No packages to merge");
      return;
    }
    setBusy("merge");
    try {
      // Local first, then overlay remote entities by id (remote fills gaps + updates shared ids)
      importPackage(snapshot, "replace");
      importPackage(remotePackage, "merge");
      setLocalRevision(remoteRevision);
      setLocalDirty(true);
      if (canPush) {
        const res = await syncPush(exportPackage(), {
          force: true,
          crewRole,
          raiseUi: false,
        });
        if (res.accepted) {
          toast.success(`Merged & pushed rev ${res.revision}`);
        } else {
          toast.message("Merged locally — push when ready");
        }
      } else {
        toast.success("Merged cloud into this station (view-only role)");
      }
      await rememberAllRemoteSheets();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Merge failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Dismiss backdrop"
        onClick={() => !busy && close()}
      />
      <div className="relative z-10 flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-panel)]">
        <div className="flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)]">
            <Cloud className="size-5 text-[var(--color-warn)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="sync-conflict-title"
              className="text-base font-semibold tracking-tight"
            >
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{copy.body}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono-num text-xs text-[var(--color-subtle)]">
              <span>
                This station: rev {localRevision || getLocalRevision()}
              </span>
              <span>Cloud: rev {remoteRevision}</span>
              {remoteUpdatedAt && (
                <span>
                  Cloud updated{" "}
                  {new Date(remoteUpdatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!!busy}
            onClick={() => close()}
            aria-label="Close conflict dialog"
          >
            <X className="size-4" />
          </Button>
        </div>

        {diff.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
              Package comparison
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                  <th className="pb-2 font-medium">Field</th>
                  <th className="pb-2 font-medium">This station</th>
                  <th className="pb-2 font-medium">Cloud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/60">
                {diff.map((row) => (
                  <tr
                    key={row.label}
                    className={cn(row.changed && "bg-[var(--color-warn-bg)]/40")}
                  >
                    <td className="py-1.5 text-[var(--color-muted)]">
                      {row.label}
                    </td>
                    <td className="py-1.5 font-mono-num">{row.local}</td>
                    <td className="py-1.5 font-mono-num">{row.remote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2 px-4 py-4 sm:px-5">
          <Button
            className="w-full justify-start"
            disabled={!!busy || !remotePackage}
            onClick={() => void useCloud()}
          >
            {busy === "cloud" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudDownload className="size-4" />
            )}
            Use cloud (replace this station)
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            disabled={!!busy || !remotePackage}
            onClick={() => void mergeBoth()}
          >
            {busy === "merge" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitMerge className="size-4" />
            )}
            Merge both (by entity id)
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled={!!busy || !canPush}
            onClick={() => void keepMine()}
          >
            {busy === "mine" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudUpload className="size-4" />
            )}
            Keep mine (force push over cloud)
          </Button>
          <p className="pt-1 text-[11px] leading-relaxed text-[var(--color-subtle)]">
            Merge starts from this station, then overlays cloud entities by id.
            Shared ids take the cloud version. Force push overwrites the cloud
            with this station only.
          </p>
        </div>
      </div>
    </div>
  );
}
