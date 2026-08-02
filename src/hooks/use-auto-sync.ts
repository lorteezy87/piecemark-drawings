import { useEffect, useRef } from "react";
import { isAutoSyncEnabled, scheduleAutoPush } from "@/lib/workspace-sync";
import { useAppStore } from "@/lib/store";

/**
 * Debounced cloud push when the drawings register changes.
 * Mount once near the app shell. Skips the first hydration tick.
 */
export function useAutoSync() {
  const exportPackage = useAppStore((s) => s.exportPackage);
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

  useEffect(() => {
    if (!isAutoSyncEnabled()) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    scheduleAutoPush(() => exportPackage());
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
  ]);
}
