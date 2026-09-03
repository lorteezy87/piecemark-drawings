export type DrawingType =
  | "erection"
  | "shop"
  | "anchor_bolt"
  | "embed"
  | "connection_detail"
  | "joist"
  | "deck"
  | "misc_metals"
  | "stair"
  | "weld_map"
  | "general_notes"
  | "mixed";

export type DrawingStatus =
  | "draft"
  | "internal_review"
  | "submitted"
  | "aan"
  | "approved"
  | "revise_resubmit"
  | "issued_for_fab"
  | "issued_for_erection"
  | "superseded"
  | "void"
  | "on_hold";

export type Discipline =
  "structural_steel" | "misc_metals" | "stairs" | "joists" | "deck" | "connections";

export type ProjectStatus = "bidding" | "award" | "detailing" | "fab" | "erection" | "complete";

export type SequenceStatus =
  "not_started" | "detailing" | "fab" | "ready" | "erecting" | "complete";

export type RfiStatus = "open" | "answered" | "closed" | "void";
export type RfiPriority = "low" | "normal" | "high" | "critical";

export type SubmittalStatus =
  "draft" | "submitted" | "under_review" | "aan" | "approved" | "rejected" | "resubmit";

export type SubmittalPackageType =
  "shop_drawings" | "erection" | "anchor_bolts" | "misc" | "resubmittal";

export type MarkupType = "redline" | "field_note" | "coordination" | "hold" | "as_built";

export interface Project {
  id: string;
  name: string;
  jobNumber: string;
  client: string;
  engineer: string;
  location: string;
  tonnage: number;
  status: ProjectStatus;
  startDate: string;
  targetComplete: string;
  detailerFirm: string;
  fabShop: string;
  description: string;
}

export interface Sequence {
  id: string;
  projectId: string;
  number: number;
  name: string;
  area: string;
  grids: string;
  plannedStart?: string;
  plannedEnd?: string;
  status: SequenceStatus;
  tonnage: number;
  notes?: string;
}

/** Parent package — named drawing set that owns child sheets */
export interface DrawingSet {
  id: string;
  projectId: string;
  /** Short set ID used in the register (e.g. SET-AB-01) */
  code: string;
  /** Human-readable set name (primary tracking label) */
  name: string;
  type: DrawingType;
  discipline: Discipline;
  sequenceId?: string;
  currentRev: string;
  status: DrawingStatus;
  description?: string;
  detailer?: string;
  checker?: string;
  issuedDate?: string;
  submittedDate?: string;
  approvedDate?: string;
  notes?: string;
}

/** Child sheet within a drawing set */
export interface Drawing {
  id: string;
  projectId: string;
  /** Parent drawing set */
  setId: string;
  number: string;
  title: string;
  type: DrawingType;
  discipline: Discipline;
  sequenceId?: string;
  area?: string;
  currentRev: string;
  status: DrawingStatus;
  sheetSize: "11x17" | "22x34" | "24x36" | "30x42";
  detailer?: string;
  checker?: string;
  issuedDate?: string;
  submittedDate?: string;
  approvedDate?: string;
  pages: number;
  pieceMarks: string[];
  tonnage?: number;
  notes?: string;
  holdReason?: string;
  tags: string[];
  /** Sort order within the set */
  sheetIndex: number;
  /** Original filename when a real PDF/image is attached (session asset in store) */
  sheetUploadName?: string;
  sheetUploadMime?: string;
}

export interface Revision {
  id: string;
  drawingId: string;
  rev: string;
  date: string;
  description: string;
  status: DrawingStatus;
  issuedBy: string;
}

export interface RFI {
  id: string;
  projectId: string;
  number: string;
  subject: string;
  status: RfiStatus;
  priority: RfiPriority;
  drawingIds: string[];
  question: string;
  answer?: string;
  raisedBy: string;
  raisedDate: string;
  dueDate?: string;
  answeredDate?: string;
  discipline: Discipline;
}

export interface Submittal {
  id: string;
  projectId: string;
  number: string;
  title: string;
  packageType: SubmittalPackageType;
  status: SubmittalStatus;
  submittedDate?: string;
  returnedDate?: string;
  drawingIds: string[];
  /** Optional link to drawing set(s) this package covers */
  setIds?: string[];
  reviewer?: string;
  /** Date the reviewed package is due back — drives the look ahead */
  dueDate?: string;
  ballInCourt?: BallInCourt;
  notes?: string;
}

export interface Markup {
  id: string;
  drawingId: string;
  rev: string;
  author: string;
  date: string;
  type: MarkupType;
  text: string;
  resolved: boolean;
}

export const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  erection: "Erection",
  shop: "Shop Drawing",
  anchor_bolt: "Anchor Bolt",
  embed: "Embed Plan",
  connection_detail: "Connection Detail",
  joist: "Joist Plan",
  deck: "Deck Plan",
  misc_metals: "Misc Metals",
  stair: "Stair / Rail",
  weld_map: "Weld Map",
  general_notes: "General Notes",
  mixed: "Mixed Package",
};

export const DRAWING_STATUS_LABELS: Record<DrawingStatus, string> = {
  draft: "Draft",
  internal_review: "Internal Review",
  submitted: "Submitted",
  aan: "Approved as Noted",
  approved: "Approved",
  revise_resubmit: "Revise & Resubmit",
  issued_for_fab: "Issued for Fab",
  issued_for_erection: "Issued for Erection",
  superseded: "Superseded",
  void: "Void",
  on_hold: "On Hold",
};

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  structural_steel: "Structural Steel",
  misc_metals: "Misc Metals",
  stairs: "Stairs",
  joists: "Joists",
  deck: "Deck",
  connections: "Connections",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  bidding: "Bidding",
  award: "Awarded",
  detailing: "Detailing",
  fab: "Fabrication",
  erection: "Erection",
  complete: "Complete",
};

export const SEQUENCE_STATUS_LABELS: Record<SequenceStatus, string> = {
  not_started: "Not Started",
  detailing: "Detailing",
  fab: "In Fab",
  ready: "Ready to Erect",
  erecting: "Erecting",
  complete: "Complete",
};

export const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  open: "Open",
  answered: "Answered",
  closed: "Closed",
  void: "Void",
};

export const RFI_PRIORITY_LABELS: Record<RfiPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};

export const SUBMITTAL_STATUS_LABELS: Record<SubmittalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  aan: "AAN",
  approved: "Approved",
  rejected: "Rejected",
  resubmit: "Resubmit",
};

export const SUBMITTAL_TYPE_LABELS: Record<SubmittalPackageType, string> = {
  shop_drawings: "Shop Drawings",
  erection: "Erection Package",
  anchor_bolts: "Anchor Bolts",
  misc: "Misc Metals",
  resubmittal: "Resubmittal",
};

export const MARKUP_TYPE_LABELS: Record<MarkupType, string> = {
  redline: "Redline",
  field_note: "Field Note",
  coordination: "Coordination",
  hold: "Hold",
  as_built: "As-Built",
};

/** Statuses that mean the shop/field can act on the sheet */
export const FAB_READY_STATUSES: DrawingStatus[] = [
  "approved",
  "aan",
  "issued_for_fab",
  "issued_for_erection",
];

export const FIELD_READY_STATUSES: DrawingStatus[] = ["issued_for_erection", "aan", "approved"];

/** Worst-first status for set rollups from child sheets */
export const STATUS_SEVERITY: Record<DrawingStatus, number> = {
  on_hold: 0,
  revise_resubmit: 1,
  void: 2,
  draft: 3,
  internal_review: 4,
  submitted: 5,
  aan: 6,
  approved: 7,
  issued_for_fab: 8,
  issued_for_erection: 9,
  superseded: 10,
};

export type TransmittalKind = "to_field" | "to_shop" | "to_gc" | "to_eor" | "internal";

export type TransmittalStatus = "draft" | "issued" | "acknowledged" | "superseded";

export type ActivityKind =
  | "status"
  | "revision"
  | "hold"
  | "release"
  | "rfi"
  | "transmittal"
  | "submittal"
  | "markup"
  | "task"
  | "delivery"
  | "change_order"
  | "workpackage"
  | "roadblock"
  | "system";

export interface TransmittalItem {
  drawingId: string;
  rev: string;
}

export interface Transmittal {
  id: string;
  projectId: string;
  number: string;
  title: string;
  kind: TransmittalKind;
  status: TransmittalStatus;
  issuedDate?: string;
  issuedBy: string;
  recipient?: string;
  sequenceId?: string;
  setIds?: string[];
  items: TransmittalItem[];
  purpose?: string;
  notes?: string;
}

export interface ActivityEvent {
  id: string;
  projectId: string;
  at: string;
  kind: ActivityKind;
  actor: string;
  summary: string;
  detail?: string;
  drawingId?: string;
  rfiId?: string;
  transmittalId?: string;
  submittalId?: string;
  taskId?: string;
  deliveryId?: string;
  changeOrderId?: string;
  workPackageId?: string;
  roadblockId?: string;
}

/** Session-only uploaded sheet (PDF / image) bound to a drawing id */
export interface SheetAsset {
  drawingId: string;
  name: string;
  mime: string;
  /** Object URL or data URL for viewing */
  url: string;
  size: number;
  uploadedAt: string;
}

export const TRANSMITTAL_KIND_LABELS: Record<TransmittalKind, string> = {
  to_field: "To Field",
  to_shop: "To Shop",
  to_gc: "To GC",
  to_eor: "To EOR",
  internal: "Internal",
};

export const TRANSMITTAL_STATUS_LABELS: Record<TransmittalStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  acknowledged: "Acknowledged",
  superseded: "Superseded",
};

export const SHOP_QUEUE_STATUSES: DrawingStatus[] = ["approved", "aan", "issued_for_fab"];

/** Bump A → B → C … AA */
export function nextRevision(current: string): string {
  const c = (current || "A").trim().toUpperCase();
  if (!c) return "A";
  // numeric revs
  if (/^\d+$/.test(c)) return String(Number(c) + 1);
  // single/multi letter
  const chars = c.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== "Z") {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
    i -= 1;
  }
  return "A" + chars.join("");
}

/** Crew role for soft RBAC in the pilot (client-enforced + audit label). */
export type UserRole = "admin" | "detailer" | "fab" | "field" | "pm" | "gc_view";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin / Document control",
  detailer: "Detailer",
  fab: "Fab shop",
  field: "Field / Ironworker",
  pm: "Project manager",
  gc_view: "GC / Owner (view)",
};

export interface OrgProfile {
  id: string;
  name: string;
  /** Optional contact for RFI mailto routing */
  defaultRfiTo?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   PM TRACKER — tasks, change orders, deliveries, work packages, roadblocks
   Multi-job tracking layered over the existing drawings/RFI/submittal control.
   ──────────────────────────────────────────────────────────────────────────── */

/** Who you are waiting on. Half a PM's list is items they cannot close alone. */
export type BallInCourt =
  | "internal"
  | "gc"
  | "eor"
  | "architect"
  | "owner"
  | "detailer"
  | "fabricator"
  | "vendor"
  | "erector";

export const BALL_IN_COURT_LABELS: Record<BallInCourt, string> = {
  internal: "Internal",
  gc: "GC",
  eor: "EOR",
  architect: "Architect",
  owner: "Owner",
  detailer: "Detailer",
  fabricator: "Fab Shop",
  vendor: "Vendor / Mill",
  erector: "Erector",
};

export type TaskCategory =
  | "rfi"
  | "submittal"
  | "change_order"
  | "procurement"
  | "delivery"
  | "fabrication"
  | "erection"
  | "detailing"
  | "billing"
  | "safety"
  | "coordination"
  | "other";

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  rfi: "RFI",
  submittal: "Submittal",
  change_order: "Change Order",
  procurement: "Procurement",
  delivery: "Delivery",
  fabrication: "Fabrication",
  erection: "Erection",
  detailing: "Detailing",
  billing: "Billing",
  safety: "Safety",
  coordination: "Coordination",
  other: "Other",
};

export type TaskStatus = "open" | "in_progress" | "blocked" | "done";
export type TaskPriority = "hot" | "normal" | "low";
export type TaskRecurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  hot: "Hot",
  normal: "Normal",
  low: "Low",
};

export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: "One-off",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

/** Every task can point back at the record it came from. */
export interface TaskLink {
  drawingId?: string;
  setId?: string;
  rfiId?: string;
  submittalId?: string;
  changeOrderId?: string;
  deliveryId?: string;
  workPackageId?: string;
  roadblockId?: string;
  sequenceId?: string;
  /** Free text pointer, e.g. "S-301 Rev C, detail 4" */
  ref?: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes?: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  owner?: string;
  ballInCourt?: BallInCourt;
  /** YYYY-MM-DD */
  dueDate?: string;
  /** Hidden from active views until this date */
  snoozedUntil?: string;
  createdAt: string;
  completedAt?: string;
  subtasks: Subtask[];
  links: TaskLink;
  recurrence: TaskRecurrence;
  /** Set on auto-generated tasks so the same source never spawns duplicates */
  autoKey?: string;
}

/* ── Change orders ───────────────────────────────────────────────────────── */

export type ChangeOrderType = "pco" | "co" | "backcharge" | "tm" | "credit";
export type ChangeOrderStatus =
  "draft" | "pending_pricing" | "submitted" | "approved" | "rejected" | "void";

export const CHANGE_ORDER_TYPE_LABELS: Record<ChangeOrderType, string> = {
  pco: "PCO",
  co: "Change Order",
  backcharge: "Backcharge",
  tm: "T&M Ticket",
  credit: "Credit",
};

export const CHANGE_ORDER_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
  draft: "Draft",
  pending_pricing: "Pending Pricing",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  void: "Void",
};

export interface ChangeOrder {
  id: string;
  projectId: string;
  number: string;
  title: string;
  type: ChangeOrderType;
  status: ChangeOrderStatus;
  /** Dollars. Negative for credits. */
  amount: number;
  /** Tons added (or removed) by the change */
  tonnageDelta?: number;
  scheduleImpactDays?: number;
  description: string;
  /** Entitlement trail — the RFI answer or drawing rev that caused it */
  originRfiId?: string;
  drawingIds: string[];
  sequenceIds: string[];
  pricedDate?: string;
  submittedDate?: string;
  approvedDate?: string;
  dueDate?: string;
  ballInCourt?: BallInCourt;
  raisedBy?: string;
  notes?: string;
}

/* ── Deliveries / loads ──────────────────────────────────────────────────── */

export type DeliveryStatus =
  "planned" | "released" | "loaded" | "in_transit" | "delivered" | "received" | "exception";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: "Planned",
  released: "Released to Ship",
  loaded: "Loaded",
  in_transit: "In Transit",
  delivered: "Delivered",
  received: "Received & Verified",
  exception: "Short / Damaged",
};

export interface DeliveryLine {
  mark: string;
  qty: number;
  weightLbs?: number;
  /** Filled at receiving; short when < qty */
  received?: number;
}

export interface Delivery {
  id: string;
  projectId: string;
  loadNumber: string;
  status: DeliveryStatus;
  sequenceId?: string;
  workPackageId?: string;
  carrier?: string;
  truckNumber?: string;
  /** Date it leaves the shop */
  shipDate?: string;
  /** Date the field needs it on site — the date that actually drives erection */
  requiredDate?: string;
  deliveredDate?: string;
  receivedDate?: string;
  destination?: string;
  offloadBy?: string;
  craneRequired: boolean;
  tonnage?: number;
  lines: DeliveryLine[];
  /** Short / damage note when status is exception */
  issue?: string;
  notes?: string;
}

/* ── Work packages (fabrication + erection tracking) ─────────────────────── */

export type WorkPackageType =
  "detailing" | "procurement" | "fabrication" | "paint_galv" | "shipping" | "erection" | "misc";

export type WorkPackageStatus = "not_started" | "in_progress" | "blocked" | "complete";

export const WORK_PACKAGE_TYPE_LABELS: Record<WorkPackageType, string> = {
  detailing: "Detailing",
  procurement: "Procurement",
  fabrication: "Fabrication",
  paint_galv: "Paint / Galv",
  shipping: "Shipping",
  erection: "Erection",
  misc: "Misc",
};

export const WORK_PACKAGE_STATUS_LABELS: Record<WorkPackageStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  complete: "Complete",
};

export interface WorkPackage {
  id: string;
  projectId: string;
  code: string;
  name: string;
  type: WorkPackageType;
  status: WorkPackageStatus;
  sequenceId?: string;
  area?: string;
  grids?: string;
  owner?: string;
  tonnage?: number;
  pieceCount?: number;
  percentComplete: number;
  drawingSetIds: string[];
  /** Fabrication timeline — the dates that drive the shop */
  releaseToFabDate?: string;
  fabStartDate?: string;
  fabDueDate?: string;
  fabCompleteDate?: string;
  paintOutDate?: string;
  paintBackDate?: string;
  shipDate?: string;
  onSiteDate?: string;
  /** Erection timeline */
  erectStartDate?: string;
  erectEndDate?: string;
  erectedPct?: number;
  craneDays?: number;
  crewSize?: number;
  notes?: string;
}

/** Shop hours between fab start and fab due, for load planning. */
export function fabDurationDays(wp: WorkPackage): number | null {
  if (!wp.fabStartDate || !wp.fabDueDate) return null;
  const a = new Date(wp.fabStartDate + "T12:00:00").getTime();
  const b = new Date(wp.fabDueDate + "T12:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* ── Roadblocks ──────────────────────────────────────────────────────────── */

export type RoadblockCategory =
  | "design"
  | "approval"
  | "material"
  | "fabrication"
  | "access"
  | "manpower"
  | "equipment"
  | "weather"
  | "coordination"
  | "other";

export type RoadblockSeverity = "low" | "medium" | "high" | "critical";
export type RoadblockStatus = "open" | "mitigating" | "resolved";

export const ROADBLOCK_CATEGORY_LABELS: Record<RoadblockCategory, string> = {
  design: "Design / EOR",
  approval: "Approval",
  material: "Material",
  fabrication: "Fabrication",
  access: "Site Access",
  manpower: "Manpower",
  equipment: "Crane / Equipment",
  weather: "Weather",
  coordination: "Trade Coordination",
  other: "Other",
};

export const ROADBLOCK_SEVERITY_LABELS: Record<RoadblockSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const ROADBLOCK_STATUS_LABELS: Record<RoadblockStatus, string> = {
  open: "Open",
  mitigating: "Mitigating",
  resolved: "Resolved",
};

export interface Roadblock {
  id: string;
  projectId: string;
  number: string;
  title: string;
  description: string;
  category: RoadblockCategory;
  severity: RoadblockSeverity;
  status: RoadblockStatus;
  raisedDate: string;
  raisedBy: string;
  owner?: string;
  ballInCourt?: BallInCourt;
  targetResolution?: string;
  resolvedDate?: string;
  resolution?: string;
  scheduleImpactDays?: number;
  costImpact?: number;
  mitigation?: string;
  drawingIds: string[];
  sequenceIds: string[];
  workPackageIds: string[];
  rfiIds: string[];
  deliveryIds: string[];
  notes?: string;
}
