import type { UserRole } from "@/lib/types";

/** Soft RBAC for pilot UI. Server still scopes data by auth user id. */
export type Permission =
  | "job.create"
  | "job.reset"
  | "drawing.edit"
  | "drawing.upload"
  | "status.change"
  | "hold.manage"
  | "rfi.create"
  | "rfi.answer"
  | "submittal.manage"
  | "transmittal.issue"
  | "sync.push"
  | "admin.settings";

const ALL: Permission[] = [
  "job.create",
  "job.reset",
  "drawing.edit",
  "drawing.upload",
  "status.change",
  "hold.manage",
  "rfi.create",
  "rfi.answer",
  "submittal.manage",
  "transmittal.issue",
  "sync.push",
  "admin.settings",
];

const ROLE_PERMS: Record<UserRole, Permission[]> = {
  admin: ALL,
  detailer: [
    "drawing.edit",
    "drawing.upload",
    "status.change",
    "hold.manage",
    "rfi.create",
    "rfi.answer",
    "submittal.manage",
    "transmittal.issue",
    "sync.push",
  ],
  fab: [
    "drawing.upload",
    "status.change",
    "rfi.create",
    "sync.push",
  ],
  field: ["rfi.create", "drawing.upload", "sync.push"],
  pm: [
    "job.create",
    "drawing.edit",
    "drawing.upload",
    "status.change",
    "hold.manage",
    "rfi.create",
    "rfi.answer",
    "submittal.manage",
    "transmittal.issue",
    "sync.push",
    "admin.settings",
  ],
  gc_view: [],
};

export function can(role: UserRole, perm: Permission): boolean {
  return ROLE_PERMS[role]?.includes(perm) ?? false;
}

export function roleSummary(role: UserRole): string {
  const n = ROLE_PERMS[role]?.length ?? 0;
  if (n === 0) return "View-only";
  if (n >= ALL.length) return "Full control";
  return `${n} permissions`;
}
