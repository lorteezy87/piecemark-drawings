import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  isAutoSyncEnabled,
  maybeAutoPull,
  resetAutoPullGuard,
  scheduleAutoPush,
} from "@/lib/workspace-sync";
import { useAppStore } from "@/lib/store";

/**
 * Debounced cloud push when the drawings register changes.
 * Also auto-pulls once when signed in and cloud is newer.
 * Mount once near the app shell. Skips the first hydration tick for push.
 */
export function useAutoSync() {
  const exportPackage = useAppStore((s) => s.exportPackage);
  const importPackage = useAppStore((s) => s.importPackage);
  const crewRole = useAppStore((s) => s.crewRole);
  const projects = useAppStore((s) => s.projects);
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const rfis = useAppStore((s) => s.rfis);
  const revisions = useAppStore((s) => s.revisions);
  const submittals = useAppStore((s) => s.submittals);
  const transmittals = useAppStore((s) => s.transmittals);
  const sequences = useAppStore((s) => s.sequences);
  const markups = useAppStore((s) => s.markups);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const skipFirst = useRef(true);
  const { user, isPending } = useCurrentUserState();

  // Auto-pull when session ready
  useEffect(() => {
    if (isPending) return;
    // auth off uses dev user; auth on needs a user
    if (!user) {
      resetAutoPullGuard();
      return;
    }
    void (async () => {
      const pkg = await maybeAutoPull();
      if (pkg) importPackage(pkg, "replace");
    })();
  }, [user, isPending, importPackage]);

  useEffect(() => {
    if (!isAutoSyncEnabled()) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    scheduleAutoPush(() => exportPackage(), { crewRole });
  }, [
    projects,
    drawings,
    drawingSets,
    rfis,
    revisions,
    submittals,
    transmittals,
    sequences,
    markups,
    selectedProjectId,
    exportPackage,
    crewRole,
  ]);
}
