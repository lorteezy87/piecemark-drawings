import type { UserRole } from "@/lib/types";

/** Soft RBAC for pilot UI. Server still scopes data by auth user id. */
export type Permission =
  | "job.create"
  | "job.reset"
  | "job.delete"
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
  "job.delete",
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
  // Detailer is the primary pilot role — can manage jobs and demos on station
  detailer: [
    "job.create",
    "job.delete",
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
  fab: ["drawing.upload", "status.change", "rfi.create", "sync.push"],
  field: ["rfi.create", "drawing.upload", "sync.push"],
  pm: [
    "job.create",
    "job.reset",
    "job.delete",
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

export function permissionLabel(perm: Permission): string {
  const map: Record<Permission, string> = {
    "job.create": "create jobs",
    "job.reset": "reset demo data",
    "job.delete": "delete jobs",
    "drawing.edit": "edit drawings",
    "drawing.upload": "upload sheets",
    "status.change": "change status",
    "hold.manage": "manage holds",
    "rfi.create": "create RFIs",
    "rfi.answer": "answer RFIs",
    "submittal.manage": "manage submittals",
    "transmittal.issue": "issue transmittals",
    "sync.push": "push to cloud",
    "admin.settings": "admin settings",
  };
  return map[perm] ?? perm;
}
