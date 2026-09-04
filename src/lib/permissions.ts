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
  | "admin.settings"
  | "task.manage"
  | "delivery.manage"
  | "change_order.manage"
  | "workpackage.manage"
  | "roadblock.manage";

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
  "task.manage",
  "delivery.manage",
  "change_order.manage",
  "workpackage.manage",
  "roadblock.manage",
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
    "task.manage",
    "delivery.manage",
    "change_order.manage",
    "workpackage.manage",
    "roadblock.manage",
  ],
  fab: [
    "drawing.upload",
    "status.change",
    "rfi.create",
    "sync.push",
    "task.manage",
    "delivery.manage",
    "workpackage.manage",
    "roadblock.manage",
  ],
  field: [
    "rfi.create",
    "drawing.upload",
    "sync.push",
    "task.manage",
    "delivery.manage",
    "roadblock.manage",
  ],
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
    "task.manage",
    "delivery.manage",
    "change_order.manage",
    "workpackage.manage",
    "roadblock.manage",
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
    "task.manage": "manage tasks",
    "delivery.manage": "manage deliveries",
    "change_order.manage": "manage change orders",
    "workpackage.manage": "manage work packages",
    "roadblock.manage": "manage roadblocks",
  };
  return map[perm] ?? perm;
}
