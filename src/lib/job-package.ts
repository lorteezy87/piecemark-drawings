import type {
  ActivityEvent,
  Drawing,
  DrawingSet,
  Markup,
  Project,
  Revision,
  RFI,
  Sequence,
  Submittal,
  Transmittal,
  UserRole,
} from "@/lib/types";

/** Package schema version — v2 adds org profile fields. */
export const JOB_PACKAGE_VERSION = 2 as const;

export type JobPackage = {
  version: number;
  exportedAt: string;
  app: "piecemark";
  projects: Project[];
  sequences: Sequence[];
  drawingSets: DrawingSet[];
  drawings: Drawing[];
  revisions: Revision[];
  rfis: RFI[];
  submittals: Submittal[];
  markups: Markup[];
  transmittals: Transmittal[];
  activities: ActivityEvent[];
  selectedProjectId: string | null;
  /** v2: company / station defaults (optional for v1 imports) */
  orgName?: string;
  orgRfiEmail?: string;
  crewRole?: UserRole;
};

export function downloadJobPackage(pkg: JobPackage, filename?: string) {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `piecemark-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseJobPackage(raw: unknown): JobPackage {
  if (!raw || typeof raw !== "object") throw new Error("Invalid package file");
  const o = raw as Record<string, unknown>;
  if (o.app !== "piecemark") throw new Error("Not a PieceMark package");
  if (typeof o.version !== "number") throw new Error("Missing package version");
  if (!Array.isArray(o.projects) || !Array.isArray(o.drawings)) {
    throw new Error("Package missing projects or drawings");
  }
  return o as unknown as JobPackage;
}
