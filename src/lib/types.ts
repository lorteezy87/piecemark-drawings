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
