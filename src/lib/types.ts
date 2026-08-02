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
  | "structural_steel"
  | "misc_metals"
  | "stairs"
  | "joists"
  | "deck"
  | "connections";

export type ProjectStatus =
  | "bidding"
  | "award"
  | "detailing"
  | "fab"
  | "erection"
  | "complete";

export type SequenceStatus =
  | "not_started"
  | "detailing"
  | "fab"
  | "ready"
  | "erecting"
  | "complete";

export type RfiStatus = "open" | "answered" | "closed" | "void";
export type RfiPriority = "low" | "normal" | "high" | "critical";

export type SubmittalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "aan"
  | "approved"
  | "rejected"
  | "resubmit";

export type SubmittalPackageType =
  | "shop_drawings"
  | "erection"
  | "anchor_bolts"
  | "misc"
  | "resubmittal";

export type MarkupType =
  | "redline"
  | "field_note"
  | "coordination"
  | "hold"
  | "as_built";

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

export const FIELD_READY_STATUSES: DrawingStatus[] = [
  "issued_for_erection",
  "aan",
  "approved",
];

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

export type TransmittalKind =
  | "to_field"
  | "to_shop"
  | "to_gc"
  | "to_eor"
  | "internal";

export type TransmittalStatus =
  | "draft"
  | "issued"
  | "acknowledged"
  | "superseded";

export type ActivityKind =
  | "status"
  | "revision"
  | "hold"
  | "release"
  | "rfi"
  | "transmittal"
  | "submittal"
  | "markup"
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

export const SHOP_QUEUE_STATUSES: DrawingStatus[] = [
  "approved",
  "aan",
  "issued_for_fab",
];

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
export type UserRole =
  | "admin"
  | "detailer"
  | "fab"
  | "field"
  | "pm"
  | "gc_view";

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
