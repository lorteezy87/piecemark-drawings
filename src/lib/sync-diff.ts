import type { JobPackage } from "@/lib/job-package";

export type SyncDiffLine = {
  label: string;
  local: number | string;
  remote: number | string;
  changed: boolean;
};

/** Human-readable package comparison for conflict UI. */
export function summarizePackageDiff(
  local: JobPackage,
  remote: JobPackage,
): SyncDiffLine[] {
  const lines: SyncDiffLine[] = [
    {
      label: "Jobs",
      local: local.projects.length,
      remote: remote.projects.length,
      changed: local.projects.length !== remote.projects.length,
    },
    {
      label: "Sheets",
      local: local.drawings.length,
      remote: remote.drawings.length,
      changed: local.drawings.length !== remote.drawings.length,
    },
    {
      label: "Piece marks (total)",
      local: countMarks(local),
      remote: countMarks(remote),
      changed: countMarks(local) !== countMarks(remote),
    },
    {
      label: "RFIs",
      local: local.rfis.length,
      remote: remote.rfis.length,
      changed: local.rfis.length !== remote.rfis.length,
    },
    {
      label: "Holds",
      local: countHolds(local),
      remote: countHolds(remote),
      changed: countHolds(local) !== countHolds(remote),
    },
    {
      label: "Transmittals",
      local: local.transmittals.length,
      remote: remote.transmittals.length,
      changed: local.transmittals.length !== remote.transmittals.length,
    },
    {
      label: "Submittals",
      local: local.submittals.length,
      remote: remote.submittals.length,
      changed: local.submittals.length !== remote.submittals.length,
    },
    {
      label: "Sequences",
      local: local.sequences.length,
      remote: remote.sequences.length,
      changed: local.sequences.length !== remote.sequences.length,
    },
    {
      label: "Active job",
      local: jobLabel(local),
      remote: jobLabel(remote),
      changed: jobLabel(local) !== jobLabel(remote),
    },
  ];
  return lines;
}

function countMarks(pkg: JobPackage): number {
  return pkg.drawings.reduce((n, d) => n + (d.pieceMarks?.length ?? 0), 0);
}

function countHolds(pkg: JobPackage): number {
  return pkg.drawings.filter((d) => d.status === "on_hold").length;
}

function jobLabel(pkg: JobPackage): string {
  const id = pkg.selectedProjectId;
  const p = pkg.projects.find((x) => x.id === id) ?? pkg.projects[0];
  return p ? p.jobNumber : "—";
}
