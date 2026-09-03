import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  activities as seedActivities,
  drawingSets as seedDrawingSets,
  drawings as seedDrawings,
  markups as seedMarkups,
  projects as seedProjects,
  revisions as seedRevisions,
  rfis as seedRfis,
  sequences as seedSequences,
  submittals as seedSubmittals,
  transmittals as seedTransmittals,
} from "@/data/seed";
import {
  changeOrders as seedChangeOrders,
  deliveries as seedDeliveries,
  roadblocks as seedRoadblocks,
  tasks as seedTasks,
  workPackages as seedWorkPackages,
} from "@/data/seed-pm";
import type {
  ActivityEvent,
  BallInCourt,
  ChangeOrder,
  ChangeOrderStatus,
  Delivery,
  DeliveryLine,
  DeliveryStatus,
  Discipline,
  Drawing,
  DrawingSet,
  DrawingStatus,
  DrawingType,
  Markup,
  Project,
  ProjectStatus,
  Revision,
  RFI,
  Roadblock,
  RoadblockStatus,
  Sequence,
  SheetAsset,
  Submittal,
  SubmittalPackageType,
  SubmittalStatus,
  Subtask,
  Task,
  TaskCategory,
  TaskLink,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  Transmittal,
  TransmittalKind,
  UserRole,
  WorkPackage,
  WorkPackageStatus,
  WorkPackageType,
} from "@/lib/types";
import { idbDeleteFile, idbPutFile, sheetAssetKey } from "@/lib/idb-files";
import { newId } from "@/lib/ids";
import type { JobPackage } from "@/lib/job-package";
import type { TitleBlockMap } from "@/lib/title-block";
import { JOB_PACKAGE_VERSION } from "@/lib/job-package";
import { can, type Permission } from "@/lib/permissions";
import { toast } from "sonner";
import {
  DRAWING_STATUS_LABELS,
  FAB_READY_STATUSES,
  SHOP_QUEUE_STATUSES,
  STATUS_SEVERITY,
  nextRevision,
} from "@/lib/types";

export interface DrawingFilters {
  query: string;
  type: DrawingType | "all";
  status: DrawingStatus | "all";
  sequenceId: string | "all";
  setId: string | "all";
  holdsOnly: boolean;
}

export interface PieceMarkRow {
  mark: string;
  drawingId: string;
  drawingNumber: string;
  drawingTitle: string;
  setId: string;
  setCode: string;
  setName: string;
  projectId: string;
  sequenceId?: string;
  status: DrawingStatus;
  rev: string;
  tonnage?: number;
  onHold: boolean;
}

interface AppState {
  /** Soft RBAC role for this browser / crew station */
  crewRole: UserRole;
  orgName: string;
  orgRfiEmail: string;
  /** Display name for activity log (from auth). */
  sessionActor: string;
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
  tasks: Task[];
  changeOrders: ChangeOrder[];
  deliveries: Delivery[];
  workPackages: WorkPackage[];
  roadblocks: Roadblock[];
  sheetAssets: Record<string, SheetAsset>;
  /** Per-job manual title-block field regions for PDF upload extraction */
  titleBlockMaps: Record<string, TitleBlockMap>;
  selectedProjectId: string | null;
  filters: DrawingFilters;
  setSelectedProjectId: (id: string | null) => void;
  setFilters: (partial: Partial<DrawingFilters>) => void;
  resetFilters: () => void;
  updateDrawingStatus: (id: string, status: DrawingStatus, note?: string) => void;
  updateSetStatus: (id: string, status: DrawingStatus) => void;
  placeHold: (drawingId: string, reason: string, actor?: string) => void;
  releaseHold: (drawingId: string, newStatus?: DrawingStatus, actor?: string) => void;
  issueRevision: (
    drawingId: string,
    description: string,
    status: DrawingStatus,
    issuedBy: string,
  ) => void;
  addMarkup: (markup: Omit<Markup, "id">) => void;
  resolveMarkup: (id: string) => void;
  updateRfiStatus: (
    id: string,
    status: RFI["status"],
    answer?: string,
    options?: { releaseLinkedHolds?: boolean; releaseToStatus?: DrawingStatus },
  ) => void;
  addRfi: (
    rfi: Omit<RFI, "id" | "number" | "raisedDate" | "status"> & {
      number?: string;
    },
  ) => string;
  createTransmittal: (input: {
    projectId: string;
    title: string;
    kind: TransmittalKind;
    recipient: string;
    purpose: string;
    issuedBy: string;
    sequenceId?: string;
    setIds: string[];
    drawingIds: string[];
    notes?: string;
    issueNow?: boolean;
  }) => string;
  acknowledgeTransmittal: (id: string) => void;
  issueTransmittal: (id: string) => void;
  createSubmittal: (input: {
    projectId: string;
    title: string;
    packageType: SubmittalPackageType;
    drawingIds: string[];
    setIds?: string[];
    reviewer?: string;
    notes?: string;
    submitNow?: boolean;
  }) => string;
  updateSubmittalStatus: (id: string, status: SubmittalStatus, notes?: string) => void;
  resetDemoData: () => void;
  deleteProject: (projectId: string) => boolean;
  clearDemoProjects: () => number;
  setCrewRole: (role: UserRole) => void;
  setSessionActor: (name: string) => void;
  setOrgProfile: (input: { orgName?: string; orgRfiEmail?: string }) => void;
  setSheetAsset: (drawingId: string, asset: SheetAsset) => void;
  clearSheetAsset: (drawingId: string) => void;
  setTitleBlockMap: (map: TitleBlockMap) => void;
  clearTitleBlockMap: (projectId: string) => void;
  createProject: (input: {
    name: string;
    jobNumber: string;
    client: string;
    engineer: string;
    location: string;
    tonnage?: number;
    detailerFirm?: string;
    fabShop?: string;
    description?: string;
    status?: ProjectStatus;
  }) => string;
  createDrawingSet: (input: {
    projectId: string;
    code: string;
    name: string;
    type: DrawingType;
    discipline?: Discipline;
    sequenceId?: string;
  }) => string;
  deleteDrawing: (drawingId: string) => boolean;
  deleteDrawingSet: (setId: string) => boolean;
  updateDrawingSet: (
    setId: string,
    patch: { code?: string; name?: string; type?: DrawingType },
  ) => boolean;
  createDrawing: (input: {
    projectId: string;
    setId: string;
    number: string;
    title: string;
    type: DrawingType;
    discipline?: Discipline;
    sequenceId?: string;
    pieceMarks?: string[];
    sheetSize?: Drawing["sheetSize"];
  }) => string;
  exportPackage: () => JobPackage;
  importPackage: (pkg: JobPackage, mode?: "replace" | "merge") => void;
  mergePieceMarks: (drawingId: string, marks: string[]) => void;
  createSequence: (input: {
    projectId: string;
    name: string;
    area?: string;
    grids?: string;
    tonnage?: number;
  }) => string;
  upsertDrawingMarks: (
    projectId: string,
    entries: { mark: string; drawingNumber?: string; title?: string; setCode?: string }[],
  ) => { sheetsCreated: number; marksAdded: number };

  /* ── PM tracker ──────────────────────────────────────────────────────── */
  addTask: (input: {
    projectId: string;
    title: string;
    notes?: string;
    category?: TaskCategory;
    priority?: TaskPriority;
    status?: TaskStatus;
    owner?: string;
    ballInCourt?: BallInCourt;
    dueDate?: string;
    recurrence?: TaskRecurrence;
    links?: TaskLink;
    subtasks?: Subtask[];
    autoKey?: string;
  }) => string;
  updateTask: (id: string, patch: Partial<Omit<Task, "id" | "projectId">>) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  toggleTaskDone: (id: string) => void;
  snoozeTask: (id: string, until: string) => void;
  deleteTask: (id: string) => void;
  addSubtask: (taskId: string, text: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  removeSubtask: (taskId: string, subtaskId: string) => void;

  addChangeOrder: (input: {
    projectId: string;
    title: string;
    type: ChangeOrder["type"];
    amount: number;
    description: string;
    number?: string;
    status?: ChangeOrderStatus;
    tonnageDelta?: number;
    scheduleImpactDays?: number;
    originRfiId?: string;
    drawingIds?: string[];
    sequenceIds?: string[];
    dueDate?: string;
    ballInCourt?: BallInCourt;
    raisedBy?: string;
    notes?: string;
  }) => string;
  updateChangeOrder: (id: string, patch: Partial<Omit<ChangeOrder, "id" | "projectId">>) => void;
  setChangeOrderStatus: (id: string, status: ChangeOrderStatus) => void;
  deleteChangeOrder: (id: string) => void;

  addDelivery: (input: {
    projectId: string;
    loadNumber?: string;
    sequenceId?: string;
    workPackageId?: string;
    carrier?: string;
    truckNumber?: string;
    shipDate?: string;
    requiredDate?: string;
    destination?: string;
    offloadBy?: string;
    craneRequired?: boolean;
    tonnage?: number;
    lines?: DeliveryLine[];
    notes?: string;
  }) => string;
  updateDelivery: (id: string, patch: Partial<Omit<Delivery, "id" | "projectId">>) => void;
  setDeliveryStatus: (id: string, status: DeliveryStatus, issue?: string) => void;
  receiveDelivery: (
    id: string,
    received: { mark: string; received: number }[],
    issue?: string,
  ) => void;
  deleteDelivery: (id: string) => void;

  addWorkPackage: (input: {
    projectId: string;
    name: string;
    type: WorkPackageType;
    code?: string;
    status?: WorkPackageStatus;
    sequenceId?: string;
    area?: string;
    grids?: string;
    owner?: string;
    tonnage?: number;
    pieceCount?: number;
    percentComplete?: number;
    drawingSetIds?: string[];
    releaseToFabDate?: string;
    fabStartDate?: string;
    fabDueDate?: string;
    paintOutDate?: string;
    paintBackDate?: string;
    shipDate?: string;
    onSiteDate?: string;
    erectStartDate?: string;
    erectEndDate?: string;
    craneDays?: number;
    crewSize?: number;
    notes?: string;
  }) => string;
  updateWorkPackage: (id: string, patch: Partial<Omit<WorkPackage, "id" | "projectId">>) => void;
  deleteWorkPackage: (id: string) => void;

  addRoadblock: (input: {
    projectId: string;
    title: string;
    description: string;
    category: Roadblock["category"];
    severity: Roadblock["severity"];
    number?: string;
    status?: RoadblockStatus;
    owner?: string;
    raisedBy?: string;
    ballInCourt?: BallInCourt;
    targetResolution?: string;
    scheduleImpactDays?: number;
    costImpact?: number;
    mitigation?: string;
    drawingIds?: string[];
    sequenceIds?: string[];
    workPackageIds?: string[];
    rfiIds?: string[];
    deliveryIds?: string[];
    notes?: string;
  }) => string;
  updateRoadblock: (id: string, patch: Partial<Omit<Roadblock, "id" | "projectId">>) => void;
  resolveRoadblock: (id: string, resolution?: string) => void;
  deleteRoadblock: (id: string) => void;
}

const defaultFilters: DrawingFilters = {
  query: "",
  type: "all",
  status: "all",
  sequenceId: "all",
  setId: "all",
  holdsOnly: false,
};

function seedState() {
  return {
    crewRole: "detailer" as UserRole,
    orgName: "PieceMark Demo Fab",
    orgRfiEmail: "",
    sessionActor: "Station",
    projects: seedProjects,
    sequences: seedSequences,
    drawingSets: seedDrawingSets,
    drawings: seedDrawings,
    revisions: seedRevisions,
    rfis: seedRfis,
    submittals: seedSubmittals,
    markups: seedMarkups,
    transmittals: seedTransmittals,
    activities: seedActivities,
    tasks: seedTasks,
    changeOrders: seedChangeOrders,
    deliveries: seedDeliveries,
    workPackages: seedWorkPackages,
    roadblocks: seedRoadblocks,
    selectedProjectId: seedProjects[0]?.id ?? null,
    filters: { ...defaultFilters },
  };
}

function makeActivity(partial: Omit<ActivityEvent, "id" | "at"> & { at?: string }): ActivityEvent {
  return {
    id: newId("act"),
    at: partial.at ?? new Date().toISOString(),
    projectId: partial.projectId,
    kind: partial.kind,
    actor: partial.actor,
    summary: partial.summary,
    detail: partial.detail,
    drawingId: partial.drawingId,
    rfiId: partial.rfiId,
    transmittalId: partial.transmittalId,
    submittalId: partial.submittalId,
    taskId: partial.taskId,
    deliveryId: partial.deliveryId,
    changeOrderId: partial.changeOrderId,
    workPackageId: partial.workPackageId,
    roadblockId: partial.roadblockId,
  };
}

function pushActivity(s: { activities: ActivityEvent[] }, event: ActivityEvent): ActivityEvent[] {
  return [event, ...s.activities].slice(0, 200);
}

const today = () => new Date().toISOString().slice(0, 10);

/** Shift a YYYY-MM-DD date by whole days without tripping over DST. */
function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Next occurrence for a recurring task, rolled forward from its own due date. */
function nextRecurrenceDate(due: string | undefined, rec: TaskRecurrence): string | undefined {
  if (rec === "none") return undefined;
  const base = due ?? today();
  if (rec === "daily") return addDaysIso(base, 1);
  if (rec === "weekly") return addDaysIso(base, 7);
  if (rec === "biweekly") return addDaysIso(base, 14);
  const d = new Date(base + "T12:00:00");
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** CO-001, LOAD-004, RB-002 … continues from the highest number already used. */
function nextSeqNumber(prefix: string, existing: string[]): string {
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)\s*$/.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function makeTask(input: Partial<Task> & { projectId: string; title: string }): Task {
  return {
    id: input.id ?? newId("task"),
    projectId: input.projectId,
    title: input.title,
    notes: input.notes,
    category: input.category ?? "other",
    status: input.status ?? "open",
    priority: input.priority ?? "normal",
    owner: input.owner,
    ballInCourt: input.ballInCourt,
    dueDate: input.dueDate,
    snoozedUntil: input.snoozedUntil,
    createdAt: input.createdAt ?? today(),
    completedAt: input.completedAt,
    subtasks: input.subtasks ?? [],
    links: input.links ?? {},
    recurrence: input.recurrence ?? "none",
    autoKey: input.autoKey,
  };
}

/**
 * Auto-generated follow-ups (RFI opened, hold placed, submittal returned).
 * Keyed so the same source record never spawns the task twice — a duplicate
 * follow-up is the fastest way to get a PM to stop trusting the list.
 */
function upsertAutoTask(tasks: Task[], task: Task): Task[] {
  if (task.autoKey && tasks.some((t) => t.autoKey === task.autoKey)) {
    return tasks;
  }
  return [task, ...tasks];
}

function actorName(s: { sessionActor: string }, fallback?: string): string {
  return (fallback && fallback !== "User" ? fallback : null) || s.sessionActor || "Station";
}

function deny(role: UserRole, perm: Permission): boolean {
  if (can(role, perm)) return false;
  toast.error(`Not allowed: ${perm} (role: ${role})`);
  return true;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedState(),
      sheetAssets: {},
      titleBlockMaps: {},
      setCrewRole: (role) => set({ crewRole: role }),
      setSessionActor: (name) => set({ sessionActor: name.trim() || "Station" }),
      setOrgProfile: (input) =>
        set((s) => {
          if (!can(s.crewRole, "admin.settings") && !can(s.crewRole, "drawing.edit")) {
            toast.error("Not allowed: update org profile");
            return s;
          }
          return {
            orgName: input.orgName ?? s.orgName,
            orgRfiEmail: input.orgRfiEmail ?? s.orgRfiEmail,
          };
        }),
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
      setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),

      updateDrawingStatus: (id, status, note) =>
        set((s) => {
          if (deny(s.crewRole, "status.change")) return s;
          const d = s.drawings.find((x) => x.id === id);
          return {
            drawings: s.drawings.map((x) =>
              x.id === id
                ? {
                    ...x,
                    status,
                    holdReason: status === "on_hold" ? note : undefined,
                    notes: note && status !== "on_hold" ? note : x.notes,
                    issuedDate:
                      status === "issued_for_fab" || status === "issued_for_erection"
                        ? (x.issuedDate ?? today())
                        : x.issuedDate,
                  }
                : x,
            ),
            activities: d
              ? pushActivity(
                  s,
                  makeActivity({
                    projectId: d.projectId,
                    kind: status === "on_hold" ? "hold" : "status",
                    actor: actorName(s),
                    summary: `${d.number} → ${DRAWING_STATUS_LABELS[status]}`,
                    detail: note,
                    drawingId: d.id,
                  }),
                )
              : s.activities,
          };
        }),

      updateSetStatus: (id, status) =>
        set((s) => {
          if (deny(s.crewRole, "status.change")) return s;
          return {
            drawingSets: s.drawingSets.map((ds) =>
              ds.id === id
                ? {
                    ...ds,
                    status,
                    issuedDate:
                      status === "issued_for_fab" || status === "issued_for_erection"
                        ? (ds.issuedDate ?? today())
                        : ds.issuedDate,
                  }
                : ds,
            ),
          };
        }),

      placeHold: (drawingId, reason, actor = "User") =>
        set((s) => {
          if (deny(s.crewRole, "hold.manage")) return s;
          const d = s.drawings.find((x) => x.id === drawingId);
          if (!d) return s;
          actor = actorName(s, actor);
          return {
            drawings: s.drawings.map((x) =>
              x.id === drawingId ? { ...x, status: "on_hold" as const, holdReason: reason } : x,
            ),
            // A hold blocks fab — it gets a dated clear-hold task immediately
            tasks: upsertAutoTask(
              s.tasks,
              makeTask({
                projectId: d.projectId,
                title: `Clear hold on ${d.number} — ${d.title}`,
                notes: reason,
                category: "detailing",
                priority: "hot",
                owner: actor,
                dueDate: addDaysIso(today(), 3),
                links: { drawingId: d.id, setId: d.setId, ref: `${d.number} Rev ${d.currentRev}` },
                autoKey: `hold:${d.id}`,
              }),
            ),
            activities: pushActivity(
              s,
              makeActivity({
                projectId: d.projectId,
                kind: "hold",
                actor,
                summary: `${d.number} placed on hold`,
                detail: reason,
                drawingId: d.id,
              }),
            ),
          };
        }),

      releaseHold: (drawingId, newStatus = "issued_for_fab", actor = "User") =>
        set((s) => {
          if (deny(s.crewRole, "hold.manage")) return s;
          const d = s.drawings.find((x) => x.id === drawingId);
          if (!d) return s;
          actor = actorName(s, actor);
          return {
            drawings: s.drawings.map((x) =>
              x.id === drawingId
                ? {
                    ...x,
                    status: newStatus,
                    holdReason: undefined,
                    issuedDate:
                      newStatus === "issued_for_fab" || newStatus === "issued_for_erection"
                        ? (x.issuedDate ?? today())
                        : x.issuedDate,
                  }
                : x,
            ),
            activities: pushActivity(
              s,
              makeActivity({
                projectId: d.projectId,
                kind: "release",
                actor,
                summary: `${d.number} hold released → ${DRAWING_STATUS_LABELS[newStatus]}`,
                drawingId: d.id,
              }),
            ),
          };
        }),

      issueRevision: (drawingId, description, status, issuedBy) =>
        set((s) => {
          if (deny(s.crewRole, "status.change")) return s;
          const d = s.drawings.find((x) => x.id === drawingId);
          if (!d) return s;
          const rev = nextRevision(d.currentRev);
          const revision: Revision = {
            id: newId("rev"),
            drawingId,
            rev,
            date: today(),
            description,
            status,
            issuedBy,
          };
          return {
            drawings: s.drawings.map((x) =>
              x.id === drawingId
                ? {
                    ...x,
                    currentRev: rev,
                    status,
                    issuedDate: today(),
                    holdReason: status === "on_hold" ? x.holdReason : undefined,
                  }
                : x,
            ),
            revisions: [revision, ...s.revisions],
            activities: pushActivity(
              s,
              makeActivity({
                projectId: d.projectId,
                kind: "revision",
                actor: issuedBy,
                summary: `${d.number} Rev ${rev} issued`,
                detail: description,
                drawingId: d.id,
              }),
            ),
          };
        }),

      addMarkup: (markup) =>
        set((s) => {
          if (deny(s.crewRole, "drawing.edit")) return s;
          return {
            markups: [{ ...markup, id: newId("mk") }, ...s.markups],
          };
        }),

      resolveMarkup: (id) =>
        set((s) => ({
          markups: s.markups.map((m) => (m.id === id ? { ...m, resolved: true } : m)),
        })),

      updateRfiStatus: (id, status, answer, options) =>
        set((s) => {
          if (deny(s.crewRole, "rfi.answer")) return s;
          const rfi = s.rfis.find((r) => r.id === id);
          if (!rfi) return s;
          let drawings = s.drawings;
          if (options?.releaseLinkedHolds) {
            const to = options.releaseToStatus ?? "issued_for_fab";
            drawings = s.drawings.map((d) =>
              rfi.drawingIds.includes(d.id) && d.status === "on_hold"
                ? {
                    ...d,
                    status: to,
                    holdReason: undefined,
                    issuedDate: d.issuedDate ?? today(),
                  }
                : d,
            );
          }
          return {
            drawings,
            rfis: s.rfis.map((r) =>
              r.id === id
                ? {
                    ...r,
                    status,
                    answer: answer ?? r.answer,
                    answeredDate:
                      status === "answered" || status === "closed"
                        ? (r.answeredDate ?? today())
                        : r.answeredDate,
                  }
                : r,
            ),
            activities: pushActivity(
              s,
              makeActivity({
                projectId: rfi.projectId,
                kind: "rfi",
                actor: actorName(s),
                summary: `${rfi.number} → ${status}${
                  options?.releaseLinkedHolds ? " (holds released)" : ""
                }`,
                detail: answer,
                rfiId: rfi.id,
              }),
            ),
          };
        }),

      addRfi: (input) => {
        if (deny(get().crewRole, "rfi.create")) return "";
        const id = newId("rfi");
        const projectRfis = get().rfis.filter((r) => r.projectId === input.projectId);
        const num = input.number ?? `RFI-${String(projectRfis.length + 1).padStart(3, "0")}`;
        const rfi: RFI = {
          id,
          projectId: input.projectId,
          number: num,
          subject: input.subject,
          status: "open",
          priority: input.priority,
          drawingIds: input.drawingIds,
          question: input.question,
          raisedBy: input.raisedBy,
          raisedDate: today(),
          dueDate: input.dueDate,
          discipline: input.discipline,
        };
        set((s) => ({
          rfis: [rfi, ...s.rfis],
          // An RFI with nobody chasing it is just a note. Auto follow-up task.
          tasks: upsertAutoTask(
            s.tasks,
            makeTask({
              projectId: input.projectId,
              title: `Follow up on ${num} — ${input.subject}`,
              category: "rfi",
              priority:
                input.priority === "critical" || input.priority === "high" ? "hot" : "normal",
              ballInCourt: "eor",
              owner: input.raisedBy,
              dueDate: input.dueDate ?? addDaysIso(today(), 7),
              links: { rfiId: id, drawingId: input.drawingIds[0] },
              autoKey: `rfi-followup:${id}`,
            }),
          ),
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "rfi",
              actor: input.raisedBy,
              summary: `Opened ${num} — ${input.subject}`,
              rfiId: id,
              drawingId: input.drawingIds[0],
            }),
          ),
        }));
        return id;
      },

      createTransmittal: (input) => {
        if (deny(get().crewRole, "transmittal.issue")) return "";
        const id = newId("tr");
        const count = get().transmittals.filter((t) => t.projectId === input.projectId).length;
        const number = `TR-${String(count + 1).padStart(3, "0")}`;
        const items = input.drawingIds.map((drawingId) => {
          const d = get().drawings.find((x) => x.id === drawingId);
          return { drawingId, rev: d?.currentRev ?? "A" };
        });
        const tr: Transmittal = {
          id,
          projectId: input.projectId,
          number,
          title: input.title,
          kind: input.kind,
          status: input.issueNow ? "issued" : "draft",
          issuedDate: input.issueNow ? today() : undefined,
          issuedBy: input.issuedBy,
          recipient: input.recipient,
          sequenceId: input.sequenceId,
          setIds: input.setIds,
          items,
          purpose: input.purpose,
          notes: input.notes,
        };
        set((s) => ({
          transmittals: [tr, ...s.transmittals],
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "transmittal",
              actor: input.issuedBy,
              summary: `${input.issueNow ? "Issued" : "Drafted"} ${number} — ${input.title}`,
              transmittalId: id,
            }),
          ),
        }));
        return id;
      },

      acknowledgeTransmittal: (id) =>
        set((s) => ({
          transmittals: s.transmittals.map((t) =>
            t.id === id ? { ...t, status: "acknowledged" as const } : t,
          ),
        })),

      issueTransmittal: (id) =>
        set((s) => {
          if (deny(s.crewRole, "transmittal.issue")) return s;
          const tr = s.transmittals.find((t) => t.id === id);
          return {
            transmittals: s.transmittals.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status: "issued" as const,
                    issuedDate: t.issuedDate ?? today(),
                  }
                : t,
            ),
            activities: tr
              ? pushActivity(
                  s,
                  makeActivity({
                    projectId: tr.projectId,
                    kind: "transmittal",
                    actor: tr.issuedBy,
                    summary: `Issued ${tr.number}`,
                    transmittalId: tr.id,
                  }),
                )
              : s.activities,
          };
        }),

      createSubmittal: (input) => {
        if (deny(get().crewRole, "submittal.manage")) return "";
        const id = newId("sub");
        const count = get().submittals.filter((x) => x.projectId === input.projectId).length;
        const number = `SUB-${String(count + 1).padStart(3, "0")}`;
        const sub: Submittal = {
          id,
          projectId: input.projectId,
          number,
          title: input.title,
          packageType: input.packageType,
          status: input.submitNow ? "submitted" : "draft",
          submittedDate: input.submitNow ? today() : undefined,
          drawingIds: input.drawingIds,
          setIds: input.setIds,
          reviewer: input.reviewer,
          notes: input.notes,
        };
        set((s) => ({
          submittals: [sub, ...s.submittals],
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "submittal",
              actor: actorName(get()),
              summary: `${input.submitNow ? "Submitted" : "Drafted"} ${number} — ${input.title}`,
              submittalId: id,
            }),
          ),
        }));
        return id;
      },

      updateSubmittalStatus: (id, status, notes) =>
        set((s) => {
          if (deny(s.crewRole, "submittal.manage")) return s;
          const sub = s.submittals.find((x) => x.id === id);
          return {
            submittals: s.submittals.map((x) =>
              x.id === id
                ? {
                    ...x,
                    status,
                    notes: notes ?? x.notes,
                    returnedDate:
                      status === "approved" ||
                      status === "aan" ||
                      status === "rejected" ||
                      status === "resubmit"
                        ? (x.returnedDate ?? today())
                        : x.returnedDate,
                    submittedDate:
                      status === "submitted" ? (x.submittedDate ?? today()) : x.submittedDate,
                  }
                : x,
            ),
            // Returned AAN / rejected / resubmit means work comes back to us
            tasks:
              sub && (status === "aan" || status === "rejected" || status === "resubmit")
                ? upsertAutoTask(
                    s.tasks,
                    makeTask({
                      projectId: sub.projectId,
                      title:
                        status === "aan"
                          ? `Incorporate review comments on ${sub.number}`
                          : `Revise & resubmit ${sub.number} — ${sub.title}`,
                      notes,
                      category: "submittal",
                      priority: "hot",
                      ballInCourt: "detailer",
                      dueDate: addDaysIso(today(), 5),
                      links: { submittalId: sub.id },
                      autoKey: `submittal-return:${sub.id}:${status}`,
                    }),
                  )
                : s.tasks,
            activities: sub
              ? pushActivity(
                  s,
                  makeActivity({
                    projectId: sub.projectId,
                    kind: "submittal",
                    actor: actorName(s),
                    summary: `${sub.number} → ${status.replace(/_/g, " ")}`,
                    detail: notes,
                    submittalId: sub.id,
                  }),
                )
              : s.activities,
          };
        }),

      setSheetAsset: (drawingId, asset) => {
        // Persist binary to IndexedDB (async) when source is a blob URL we can re-fetch
        void (async () => {
          try {
            const res = await fetch(asset.url);
            const blob = await res.blob();
            await idbPutFile(sheetAssetKey(drawingId), blob);
          } catch {
            /* IDB optional */
          }
        })();
        set((s) => {
          const prev = s.sheetAssets[drawingId];
          if (prev?.url?.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(prev.url);
            } catch {
              /* ignore */
            }
          }
          return {
            sheetAssets: { ...s.sheetAssets, [drawingId]: asset },
            drawings: s.drawings.map((d) =>
              d.id === drawingId
                ? {
                    ...d,
                    sheetUploadName: asset.name,
                    sheetUploadMime: asset.mime,
                  }
                : d,
            ),
          };
        });
      },

      clearSheetAsset: (drawingId) => {
        void idbDeleteFile(sheetAssetKey(drawingId));
        set((s) => {
          const prev = s.sheetAssets[drawingId];
          if (prev?.url?.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(prev.url);
            } catch {
              /* ignore */
            }
          }
          const next = { ...s.sheetAssets };
          delete next[drawingId];
          return {
            sheetAssets: next,
            drawings: s.drawings.map((d) =>
              d.id === drawingId
                ? {
                    ...d,
                    sheetUploadName: undefined,
                    sheetUploadMime: undefined,
                  }
                : d,
            ),
          };
        });
      },

      setTitleBlockMap: (map) => {
        const role = get().crewRole;
        if (!can(role, "drawing.edit") && !can(role, "drawing.upload")) {
          toast.error("Not allowed: edit title-block map");
          return;
        }
        set((s) => ({
          titleBlockMaps: {
            ...s.titleBlockMaps,
            [map.projectId]: {
              ...map,
              updatedAt: new Date().toISOString(),
            },
          },
        }));
      },

      clearTitleBlockMap: (projectId) => {
        set((s) => {
          const next = { ...s.titleBlockMaps };
          delete next[projectId];
          return { titleBlockMaps: next };
        });
      },

      createProject: (input) => {
        if (deny(get().crewRole, "job.create")) return "";
        const id = newId("proj");
        const project: Project = {
          id,
          name: input.name,
          jobNumber: input.jobNumber,
          client: input.client,
          engineer: input.engineer,
          location: input.location,
          tonnage: input.tonnage ?? 0,
          status: input.status ?? "detailing",
          startDate: today(),
          targetComplete: today(),
          detailerFirm: input.detailerFirm ?? "",
          fabShop: input.fabShop ?? "",
          description: input.description ?? "",
        };
        set((s) => ({
          projects: [project, ...s.projects],
          selectedProjectId: id,
          activities: pushActivity(
            s,
            makeActivity({
              projectId: id,
              kind: "system",
              actor: actorName(get()),
              summary: `Created job ${project.jobNumber}`,
            }),
          ),
        }));
        return id;
      },

      createDrawingSet: (input) => {
        if (deny(get().crewRole, "drawing.edit")) return "";
        const id = newId("set");
        const drawingSet: DrawingSet = {
          id,
          projectId: input.projectId,
          code: input.code,
          name: input.name,
          type: input.type,
          discipline: input.discipline ?? "structural_steel",
          sequenceId: input.sequenceId,
          currentRev: "A",
          status: "draft",
        };
        set((s) => ({
          drawingSets: [drawingSet, ...s.drawingSets],
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "system",
              actor: actorName(get()),
              summary: `Created set ${input.code}`,
            }),
          ),
        }));
        return id;
      },

      updateDrawingSet: (setId, patch) => {
        if (deny(get().crewRole, "drawing.edit")) return false;
        const ds = get().drawingSets.find((x) => x.id === setId);
        if (!ds) return false;
        const code = patch.code?.trim();
        const name = patch.name?.trim();
        if (code !== undefined && !code) {
          toast.error("Set code is required");
          return false;
        }
        if (name !== undefined && !name) {
          toast.error("Set name is required");
          return false;
        }
        set((s) => ({
          drawingSets: s.drawingSets.map((x) =>
            x.id === setId
              ? {
                  ...x,
                  ...(code !== undefined ? { code } : {}),
                  ...(name !== undefined ? { name } : {}),
                  ...(patch.type !== undefined ? { type: patch.type } : {}),
                }
              : x,
          ),
          activities: pushActivity(
            s,
            makeActivity({
              projectId: ds.projectId,
              kind: "system",
              actor: actorName(get()),
              summary: `Renamed set ${code ?? ds.code}${
                name && name !== ds.name ? ` → ${name}` : ""
              }`,
            }),
          ),
        }));
        return true;
      },

      createDrawing: (input) => {
        if (deny(get().crewRole, "drawing.edit")) return "";
        const id = newId("dwg");
        const sheets = get().drawings.filter((d) => d.setId === input.setId);
        const drawing: Drawing = {
          id,
          projectId: input.projectId,
          setId: input.setId,
          number: input.number,
          title: input.title,
          type: input.type,
          discipline: input.discipline ?? "structural_steel",
          sequenceId: input.sequenceId,
          currentRev: "A",
          status: "draft",
          sheetSize: input.sheetSize ?? "22x34",
          pages: 1,
          pieceMarks: input.pieceMarks ?? [],
          tags: [],
          sheetIndex: sheets.length + 1,
        };
        set((s) => ({
          drawings: [drawing, ...s.drawings],
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "status",
              actor: actorName(get()),
              summary: `Added sheet ${input.number}`,
              drawingId: id,
            }),
          ),
        }));
        return id;
      },

      deleteDrawing: (drawingId) => {
        if (!can(get().crewRole, "drawing.edit") && !can(get().crewRole, "job.delete")) {
          toast.error("Not allowed: delete sheet");
          return false;
        }
        const d = get().drawings.find((x) => x.id === drawingId);
        if (!d) return false;
        void get().clearSheetAsset(drawingId);
        set((s) => ({
          drawings: s.drawings.filter((x) => x.id !== drawingId),
          revisions: s.revisions.filter((r) => r.drawingId !== drawingId),
          markups: s.markups.filter((m) => m.drawingId !== drawingId),
          rfis: s.rfis.map((r) =>
            r.drawingIds?.includes(drawingId)
              ? {
                  ...r,
                  drawingIds: r.drawingIds.filter((id) => id !== drawingId),
                }
              : r,
          ),
          transmittals: s.transmittals.map((tr) => ({
            ...tr,
            items: tr.items.filter((it) => it.drawingId !== drawingId),
          })),
          activities: pushActivity(
            s,
            makeActivity({
              projectId: d.projectId,
              kind: "system",
              actor: actorName(get()),
              summary: `Deleted sheet ${d.number}`,
            }),
          ),
        }));
        return true;
      },

      deleteDrawingSet: (setId) => {
        if (!can(get().crewRole, "drawing.edit") && !can(get().crewRole, "job.delete")) {
          toast.error("Not allowed: delete drawing set");
          return false;
        }
        const ds = get().drawingSets.find((x) => x.id === setId);
        if (!ds) return false;
        const sheetIds = get()
          .drawings.filter((d) => d.setId === setId)
          .map((d) => d.id);
        for (const id of sheetIds) {
          void get().clearSheetAsset(id);
        }
        const sheetSet = new Set(sheetIds);
        set((s) => ({
          drawingSets: s.drawingSets.filter((x) => x.id !== setId),
          drawings: s.drawings.filter((d) => d.setId !== setId),
          revisions: s.revisions.filter((r) => !sheetSet.has(r.drawingId)),
          markups: s.markups.filter((m) => !sheetSet.has(m.drawingId)),
          rfis: s.rfis.map((r) =>
            r.drawingIds?.some((id) => sheetSet.has(id))
              ? {
                  ...r,
                  drawingIds: r.drawingIds.filter((id) => !sheetSet.has(id)),
                }
              : r,
          ),
          submittals: s.submittals.map((sub) => ({
            ...sub,
            setIds: sub.setIds?.filter((id) => id !== setId),
          })),
          transmittals: s.transmittals.map((tr) => ({
            ...tr,
            items: tr.items.filter((it) => !sheetSet.has(it.drawingId)),
          })),
          activities: pushActivity(
            s,
            makeActivity({
              projectId: ds.projectId,
              kind: "system",
              actor: actorName(get()),
              summary: `Deleted set ${ds.code} (${sheetIds.length} sheet(s))`,
            }),
          ),
        }));
        return true;
      },

      /* ── PM tracker: tasks ─────────────────────────────────────────── */

      addTask: (input) => {
        if (deny(get().crewRole, "task.manage")) return "";
        const task = makeTask({
          projectId: input.projectId,
          title: input.title.trim(),
          notes: input.notes,
          category: input.category,
          priority: input.priority,
          status: input.status,
          owner: input.owner,
          ballInCourt: input.ballInCourt,
          dueDate: input.dueDate,
          recurrence: input.recurrence,
          links: input.links,
          subtasks: input.subtasks,
          autoKey: input.autoKey,
        });
        set((s) => ({
          tasks: upsertAutoTask(s.tasks, task),
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "task",
              actor: actorName(s),
              summary: `Task added — ${task.title}`,
              taskId: task.id,
            }),
          ),
        }));
        return task.id;
      },

      updateTask: (id, patch) =>
        set((s) => {
          if (deny(s.crewRole, "task.manage")) return s;
          return {
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          };
        }),

      setTaskStatus: (id, status) =>
        set((s) => {
          if (deny(s.crewRole, "task.manage")) return s;
          return {
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    status,
                    completedAt: status === "done" ? today() : undefined,
                  }
                : t,
            ),
          };
        }),

      toggleTaskDone: (id) =>
        set((s) => {
          if (deny(s.crewRole, "task.manage")) return s;
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return s;
          const done = t.status !== "done";
          let tasks = s.tasks.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: (done ? "done" : "open") as TaskStatus,
                  completedAt: done ? today() : undefined,
                }
              : x,
          );
          // A completed recurring task immediately spawns its next occurrence
          if (done && t.recurrence !== "none") {
            const nextDue = nextRecurrenceDate(t.dueDate, t.recurrence);
            tasks = [
              makeTask({
                projectId: t.projectId,
                title: t.title,
                notes: t.notes,
                category: t.category,
                priority: t.priority,
                owner: t.owner,
                ballInCourt: t.ballInCourt,
                dueDate: nextDue,
                links: t.links,
                recurrence: t.recurrence,
                subtasks: t.subtasks.map((st) => ({ ...st, done: false })),
              }),
              ...tasks,
            ];
          }
          return {
            tasks,
            activities: done
              ? pushActivity(
                  s,
                  makeActivity({
                    projectId: t.projectId,
                    kind: "task",
                    actor: actorName(s),
                    summary: `Task done — ${t.title}`,
                    taskId: t.id,
                  }),
                )
              : s.activities,
          };
        }),

      snoozeTask: (id, until) =>
        set((s) => {
          if (deny(s.crewRole, "task.manage")) return s;
          return {
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, snoozedUntil: until } : t)),
          };
        }),

      deleteTask: (id) =>
        set((s) => {
          if (deny(s.crewRole, "task.manage")) return s;
          return { tasks: s.tasks.filter((t) => t.id !== id) };
        }),

      addSubtask: (taskId, text) =>
        set((s) => {
          if (deny(s.crewRole, "task.manage")) return s;
          const clean = text.trim();
          if (!clean) return s;
          return {
            tasks: s.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    subtasks: [...t.subtasks, { id: newId("st"), text: clean, done: false }],
                  }
                : t,
            ),
          };
        }),

      toggleSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((st) =>
                    st.id === subtaskId ? { ...st, done: !st.done } : st,
                  ),
                }
              : t,
          ),
        })),

      removeSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== subtaskId) }
              : t,
          ),
        })),

      /* ── PM tracker: change orders ─────────────────────────────────── */

      addChangeOrder: (input) => {
        if (deny(get().crewRole, "change_order.manage")) return "";
        const id = newId("co");
        const existing = get()
          .changeOrders.filter((c) => c.projectId === input.projectId)
          .map((c) => c.number);
        const prefix =
          input.type === "backcharge"
            ? "BC"
            : input.type === "tm"
              ? "TM"
              : input.type === "pco"
                ? "PCO"
                : "CO";
        const number =
          input.number ??
          nextSeqNumber(
            prefix,
            existing.filter((n) => n.startsWith(prefix)),
          );
        const co: ChangeOrder = {
          id,
          projectId: input.projectId,
          number,
          title: input.title.trim(),
          type: input.type,
          status: input.status ?? "draft",
          amount: input.amount,
          tonnageDelta: input.tonnageDelta,
          scheduleImpactDays: input.scheduleImpactDays,
          description: input.description,
          originRfiId: input.originRfiId,
          drawingIds: input.drawingIds ?? [],
          sequenceIds: input.sequenceIds ?? [],
          dueDate: input.dueDate,
          ballInCourt: input.ballInCourt,
          raisedBy: input.raisedBy ?? get().sessionActor,
          notes: input.notes,
        };
        set((s) => ({
          changeOrders: [co, ...s.changeOrders],
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "change_order",
              actor: actorName(s),
              summary: `${number} raised — ${co.title}`,
              detail: `$${Math.round(co.amount).toLocaleString("en-US")}`,
              changeOrderId: id,
            }),
          ),
        }));
        return id;
      },

      updateChangeOrder: (id, patch) =>
        set((s) => {
          if (deny(s.crewRole, "change_order.manage")) return s;
          return {
            changeOrders: s.changeOrders.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          };
        }),

      setChangeOrderStatus: (id, status) =>
        set((s) => {
          if (deny(s.crewRole, "change_order.manage")) return s;
          const co = s.changeOrders.find((c) => c.id === id);
          return {
            changeOrders: s.changeOrders.map((c) =>
              c.id === id
                ? {
                    ...c,
                    status,
                    submittedDate:
                      status === "submitted" ? (c.submittedDate ?? today()) : c.submittedDate,
                    approvedDate:
                      status === "approved" ? (c.approvedDate ?? today()) : c.approvedDate,
                  }
                : c,
            ),
            activities: co
              ? pushActivity(
                  s,
                  makeActivity({
                    projectId: co.projectId,
                    kind: "change_order",
                    actor: actorName(s),
                    summary: `${co.number} → ${status.replace(/_/g, " ")}`,
                    changeOrderId: co.id,
                  }),
                )
              : s.activities,
          };
        }),

      deleteChangeOrder: (id) =>
        set((s) => {
          if (deny(s.crewRole, "change_order.manage")) return s;
          return { changeOrders: s.changeOrders.filter((c) => c.id !== id) };
        }),

      /* ── PM tracker: deliveries ────────────────────────────────────── */

      addDelivery: (input) => {
        if (deny(get().crewRole, "delivery.manage")) return "";
        const id = newId("del");
        const existing = get()
          .deliveries.filter((d) => d.projectId === input.projectId)
          .map((d) => d.loadNumber);
        const loadNumber = input.loadNumber ?? nextSeqNumber("LOAD", existing);
        const lines = input.lines ?? [];
        const del: Delivery = {
          id,
          projectId: input.projectId,
          loadNumber,
          status: "planned",
          sequenceId: input.sequenceId,
          workPackageId: input.workPackageId,
          carrier: input.carrier,
          truckNumber: input.truckNumber,
          shipDate: input.shipDate,
          requiredDate: input.requiredDate,
          destination: input.destination,
          offloadBy: input.offloadBy,
          craneRequired: input.craneRequired ?? false,
          tonnage: input.tonnage,
          lines,
          notes: input.notes,
        };
        set((s) => {
          // A truck with a required-on-site date always gets a confirmation
          // task the day before — crane and laydown are the usual misses.
          const tasks =
            del.requiredDate && del.craneRequired
              ? upsertAutoTask(
                  s.tasks,
                  makeTask({
                    projectId: del.projectId,
                    title: `Confirm crane and laydown for ${loadNumber}`,
                    category: "delivery",
                    priority: "hot",
                    dueDate: addDaysIso(del.requiredDate, -1),
                    links: { deliveryId: id, sequenceId: del.sequenceId },
                    autoKey: `delivery-crane:${id}`,
                  }),
                )
              : s.tasks;
          return {
            deliveries: [del, ...s.deliveries],
            tasks,
            activities: pushActivity(
              s,
              makeActivity({
                projectId: input.projectId,
                kind: "delivery",
                actor: actorName(s),
                summary: `${loadNumber} planned`,
                detail: del.requiredDate ? `Required on site ${del.requiredDate}` : undefined,
                deliveryId: id,
              }),
            ),
          };
        });
        return id;
      },

      updateDelivery: (id, patch) =>
        set((s) => {
          if (deny(s.crewRole, "delivery.manage")) return s;
          return {
            deliveries: s.deliveries.map((d) => (d.id === id ? { ...d, ...patch } : d)),
          };
        }),

      setDeliveryStatus: (id, status, issue) =>
        set((s) => {
          if (deny(s.crewRole, "delivery.manage")) return s;
          const del = s.deliveries.find((d) => d.id === id);
          if (!del) return s;
          const deliveries = s.deliveries.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status,
                  issue: issue ?? d.issue,
                  deliveredDate:
                    status === "delivered" || status === "received" || status === "exception"
                      ? (d.deliveredDate ?? today())
                      : d.deliveredDate,
                  receivedDate:
                    status === "received" ? (d.receivedDate ?? today()) : d.receivedDate,
                }
              : d,
          );
          // A short or damaged load is a fab problem — raise the replacement task
          const tasks =
            status === "exception"
              ? upsertAutoTask(
                  s.tasks,
                  makeTask({
                    projectId: del.projectId,
                    title: `Resolve short / damage on ${del.loadNumber}`,
                    notes: issue,
                    category: "fabrication",
                    priority: "hot",
                    ballInCourt: "fabricator",
                    dueDate: addDaysIso(today(), 1),
                    links: { deliveryId: id, sequenceId: del.sequenceId },
                    autoKey: `delivery-exception:${id}`,
                  }),
                )
              : s.tasks;
          return {
            deliveries,
            tasks,
            activities: pushActivity(
              s,
              makeActivity({
                projectId: del.projectId,
                kind: "delivery",
                actor: actorName(s),
                summary: `${del.loadNumber} → ${status.replace(/_/g, " ")}`,
                detail: issue,
                deliveryId: id,
              }),
            ),
          };
        }),

      receiveDelivery: (id, received, issue) =>
        set((s) => {
          if (deny(s.crewRole, "delivery.manage")) return s;
          const del = s.deliveries.find((d) => d.id === id);
          if (!del) return s;
          const byMark = new Map(received.map((r) => [r.mark, r.received]));
          const lines = del.lines.map((l) => ({
            ...l,
            received: byMark.has(l.mark) ? byMark.get(l.mark) : l.received,
          }));
          const short = lines.some((l) => (l.received ?? 0) < l.qty);
          const status: DeliveryStatus = short ? "exception" : "received";
          const tasks = short
            ? upsertAutoTask(
                s.tasks,
                makeTask({
                  projectId: del.projectId,
                  title: `Resolve short / damage on ${del.loadNumber}`,
                  notes:
                    issue ??
                    lines
                      .filter((l) => (l.received ?? 0) < l.qty)
                      .map((l) => `${l.mark}: ${l.received ?? 0} of ${l.qty}`)
                      .join(", "),
                  category: "fabrication",
                  priority: "hot",
                  ballInCourt: "fabricator",
                  dueDate: addDaysIso(today(), 1),
                  links: { deliveryId: id, sequenceId: del.sequenceId },
                  autoKey: `delivery-exception:${id}`,
                }),
              )
            : s.tasks;
          return {
            deliveries: s.deliveries.map((d) =>
              d.id === id
                ? {
                    ...d,
                    lines,
                    status,
                    issue: issue ?? d.issue,
                    deliveredDate: d.deliveredDate ?? today(),
                    receivedDate: today(),
                  }
                : d,
            ),
            tasks,
            activities: pushActivity(
              s,
              makeActivity({
                projectId: del.projectId,
                kind: "delivery",
                actor: actorName(s),
                summary: short
                  ? `${del.loadNumber} received SHORT`
                  : `${del.loadNumber} received and verified`,
                detail: issue,
                deliveryId: id,
              }),
            ),
          };
        }),

      deleteDelivery: (id) =>
        set((s) => {
          if (deny(s.crewRole, "delivery.manage")) return s;
          return { deliveries: s.deliveries.filter((d) => d.id !== id) };
        }),

      /* ── PM tracker: work packages ─────────────────────────────────── */

      addWorkPackage: (input) => {
        if (deny(get().crewRole, "workpackage.manage")) return "";
        const id = newId("wp");
        const project = get().projects.find((p) => p.id === input.projectId);
        const existing = get()
          .workPackages.filter((w) => w.projectId === input.projectId)
          .map((w) => w.code);
        const prefix = `WP-${(project?.jobNumber ?? "JOB")
          .replace(/[^A-Z0-9]/gi, "")
          .slice(-4)
          .toUpperCase()}`;
        const code = input.code ?? nextSeqNumber(prefix, existing);
        const wp: WorkPackage = {
          id,
          projectId: input.projectId,
          code,
          name: input.name.trim(),
          type: input.type,
          status: input.status ?? "not_started",
          sequenceId: input.sequenceId,
          area: input.area,
          grids: input.grids,
          owner: input.owner,
          tonnage: input.tonnage,
          pieceCount: input.pieceCount,
          percentComplete: input.percentComplete ?? 0,
          drawingSetIds: input.drawingSetIds ?? [],
          releaseToFabDate: input.releaseToFabDate,
          fabStartDate: input.fabStartDate,
          fabDueDate: input.fabDueDate,
          paintOutDate: input.paintOutDate,
          paintBackDate: input.paintBackDate,
          shipDate: input.shipDate,
          onSiteDate: input.onSiteDate,
          erectStartDate: input.erectStartDate,
          erectEndDate: input.erectEndDate,
          craneDays: input.craneDays,
          crewSize: input.crewSize,
          notes: input.notes,
        };
        set((s) => ({
          workPackages: [wp, ...s.workPackages],
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "workpackage",
              actor: actorName(s),
              summary: `${code} created — ${wp.name}`,
              workPackageId: id,
            }),
          ),
        }));
        return id;
      },

      updateWorkPackage: (id, patch) =>
        set((s) => {
          if (deny(s.crewRole, "workpackage.manage")) return s;
          return {
            workPackages: s.workPackages.map((w) =>
              w.id === id
                ? {
                    ...w,
                    ...patch,
                    fabCompleteDate:
                      patch.status === "complete"
                        ? (w.fabCompleteDate ?? today())
                        : w.fabCompleteDate,
                  }
                : w,
            ),
          };
        }),

      deleteWorkPackage: (id) =>
        set((s) => {
          if (deny(s.crewRole, "workpackage.manage")) return s;
          return { workPackages: s.workPackages.filter((w) => w.id !== id) };
        }),

      /* ── PM tracker: roadblocks ────────────────────────────────────── */

      addRoadblock: (input) => {
        if (deny(get().crewRole, "roadblock.manage")) return "";
        const id = newId("rb");
        const existing = get()
          .roadblocks.filter((r) => r.projectId === input.projectId)
          .map((r) => r.number);
        const number = input.number ?? nextSeqNumber("RB", existing);
        const rb: Roadblock = {
          id,
          projectId: input.projectId,
          number,
          title: input.title.trim(),
          description: input.description,
          category: input.category,
          severity: input.severity,
          status: input.status ?? "open",
          raisedDate: today(),
          raisedBy: input.raisedBy ?? get().sessionActor,
          owner: input.owner,
          ballInCourt: input.ballInCourt,
          targetResolution: input.targetResolution,
          scheduleImpactDays: input.scheduleImpactDays,
          costImpact: input.costImpact,
          mitigation: input.mitigation,
          drawingIds: input.drawingIds ?? [],
          sequenceIds: input.sequenceIds ?? [],
          workPackageIds: input.workPackageIds ?? [],
          rfiIds: input.rfiIds ?? [],
          deliveryIds: input.deliveryIds ?? [],
          notes: input.notes,
        };
        set((s) => ({
          roadblocks: [rb, ...s.roadblocks],
          // Every roadblock gets an owner and a chase task, or it just sits
          tasks: upsertAutoTask(
            s.tasks,
            makeTask({
              projectId: rb.projectId,
              title: `Clear roadblock ${number} — ${rb.title}`,
              category: "coordination",
              priority: rb.severity === "critical" || rb.severity === "high" ? "hot" : "normal",
              owner: rb.owner,
              ballInCourt: rb.ballInCourt,
              dueDate: rb.targetResolution ?? addDaysIso(today(), 2),
              links: { roadblockId: id },
              autoKey: `roadblock:${id}`,
            }),
          ),
          activities: pushActivity(
            s,
            makeActivity({
              projectId: input.projectId,
              kind: "roadblock",
              actor: actorName(s),
              summary: `${number} raised — ${rb.title}`,
              detail: input.description,
              roadblockId: id,
            }),
          ),
        }));
        return id;
      },

      updateRoadblock: (id, patch) =>
        set((s) => {
          if (deny(s.crewRole, "roadblock.manage")) return s;
          return {
            roadblocks: s.roadblocks.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          };
        }),

      resolveRoadblock: (id, resolution) =>
        set((s) => {
          if (deny(s.crewRole, "roadblock.manage")) return s;
          const rb = s.roadblocks.find((r) => r.id === id);
          if (!rb) return s;
          return {
            roadblocks: s.roadblocks.map((r) =>
              r.id === id
                ? {
                    ...r,
                    status: "resolved" as RoadblockStatus,
                    resolvedDate: today(),
                    resolution: resolution ?? r.resolution,
                  }
                : r,
            ),
            // Close out the chase task that came with the roadblock
            tasks: s.tasks.map((t) =>
              t.links.roadblockId === id && t.status !== "done"
                ? { ...t, status: "done" as TaskStatus, completedAt: today() }
                : t,
            ),
            activities: pushActivity(
              s,
              makeActivity({
                projectId: rb.projectId,
                kind: "roadblock",
                actor: actorName(s),
                summary: `${rb.number} resolved`,
                detail: resolution,
                roadblockId: id,
              }),
            ),
          };
        }),

      deleteRoadblock: (id) =>
        set((s) => {
          if (deny(s.crewRole, "roadblock.manage")) return s;
          return {
            roadblocks: s.roadblocks.filter((r) => r.id !== id),
            tasks: s.tasks.filter((t) => t.links.roadblockId !== id),
          };
        }),

      exportPackage: () => {
        const s = get();
        return {
          version: JOB_PACKAGE_VERSION,
          exportedAt: new Date().toISOString(),
          app: "piecemark" as const,
          projects: s.projects,
          sequences: s.sequences,
          drawingSets: s.drawingSets,
          drawings: s.drawings,
          revisions: s.revisions,
          rfis: s.rfis,
          submittals: s.submittals,
          markups: s.markups,
          transmittals: s.transmittals,
          activities: s.activities,
          tasks: s.tasks,
          changeOrders: s.changeOrders,
          deliveries: s.deliveries,
          workPackages: s.workPackages,
          roadblocks: s.roadblocks,
          selectedProjectId: s.selectedProjectId,
          orgName: s.orgName,
          orgRfiEmail: s.orgRfiEmail,
          crewRole: s.crewRole,
        };
      },

      importPackage: (pkg, mode = "replace") => {
        if (mode === "replace") {
          // A package written before v3 carries no PM tracker collections.
          // Replacing with [] would silently wipe every task, delivery,
          // change order, work package and roadblock on this station, so
          // older packages leave those collections alone.
          const carriesPmData = (pkg.version ?? 0) >= 3;
          set((s) => ({
            projects: pkg.projects,
            sequences: pkg.sequences,
            drawingSets: pkg.drawingSets,
            drawings: pkg.drawings,
            revisions: pkg.revisions,
            rfis: pkg.rfis,
            submittals: pkg.submittals,
            markups: pkg.markups,
            transmittals: pkg.transmittals,
            activities: pkg.activities,
            tasks: carriesPmData ? (pkg.tasks ?? []) : s.tasks,
            changeOrders: carriesPmData ? (pkg.changeOrders ?? []) : s.changeOrders,
            deliveries: carriesPmData ? (pkg.deliveries ?? []) : s.deliveries,
            workPackages: carriesPmData ? (pkg.workPackages ?? []) : s.workPackages,
            roadblocks: carriesPmData ? (pkg.roadblocks ?? []) : s.roadblocks,
            selectedProjectId: pkg.selectedProjectId ?? pkg.projects[0]?.id ?? null,
            sheetAssets: {},
            ...(pkg.orgName !== undefined ? { orgName: pkg.orgName } : {}),
            ...(pkg.orgRfiEmail !== undefined ? { orgRfiEmail: pkg.orgRfiEmail } : {}),
            ...(pkg.crewRole !== undefined ? { crewRole: pkg.crewRole } : {}),
          }));
          return;
        }
        set((s) => {
          const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
            const map = new Map(a.map((x) => [x.id, x]));
            for (const x of b) map.set(x.id, x);
            return [...map.values()];
          };
          return {
            projects: mergeById(s.projects, pkg.projects),
            sequences: mergeById(s.sequences, pkg.sequences),
            drawingSets: mergeById(s.drawingSets, pkg.drawingSets),
            drawings: mergeById(s.drawings, pkg.drawings),
            revisions: mergeById(s.revisions, pkg.revisions),
            rfis: mergeById(s.rfis, pkg.rfis),
            submittals: mergeById(s.submittals, pkg.submittals),
            markups: mergeById(s.markups, pkg.markups),
            transmittals: mergeById(s.transmittals, pkg.transmittals),
            tasks: mergeById(s.tasks, pkg.tasks ?? []),
            changeOrders: mergeById(s.changeOrders, pkg.changeOrders ?? []),
            deliveries: mergeById(s.deliveries, pkg.deliveries ?? []),
            workPackages: mergeById(s.workPackages, pkg.workPackages ?? []),
            roadblocks: mergeById(s.roadblocks, pkg.roadblocks ?? []),
            activities: [...pkg.activities, ...s.activities].slice(0, 200),
            selectedProjectId: pkg.selectedProjectId ?? s.selectedProjectId,
            ...(pkg.orgName !== undefined ? { orgName: pkg.orgName } : {}),
            ...(pkg.orgRfiEmail !== undefined ? { orgRfiEmail: pkg.orgRfiEmail } : {}),
          };
        });
      },

      mergePieceMarks: (drawingId, marks) =>
        set((s) => ({
          drawings: s.drawings.map((d) => {
            if (d.id !== drawingId) return d;
            const next = new Set([...d.pieceMarks, ...marks.map((m) => m.trim()).filter(Boolean)]);
            return {
              ...d,
              pieceMarks: [...next].sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true }),
              ),
            };
          }),
        })),

      createSequence: (input) => {
        if (deny(get().crewRole, "drawing.edit")) return "";
        const existing = get().sequences.filter((x) => x.projectId === input.projectId);
        const number = existing.reduce((m, x) => Math.max(m, x.number), 0) + 1;
        const id = newId("seq");
        const seq: Sequence = {
          id,
          projectId: input.projectId,
          number,
          name: input.name,
          area: input.area ?? "",
          grids: input.grids ?? "",
          status: "not_started",
          tonnage: input.tonnage ?? 0,
        };
        set((s) => ({ sequences: [...s.sequences, seq] }));
        return id;
      },

      upsertDrawingMarks: (projectId, entries) => {
        if (deny(get().crewRole, "drawing.edit")) {
          return { sheetsCreated: 0, marksAdded: 0 };
        }
        let sheetsCreated = 0;
        let marksAdded = 0;
        set((s) => {
          let drawings = [...s.drawings];
          let drawingSets = [...s.drawingSets];
          for (const e of entries) {
            const mark = e.mark.trim();
            if (!mark) continue;
            const dwgNo = (e.drawingNumber || "").trim();
            if (!dwgNo) {
              const hit = drawings.find(
                (d) => d.projectId === projectId && d.pieceMarks.includes(mark),
              );
              if (hit) continue;
              let setId = drawingSets.find(
                (x) => x.projectId === projectId && x.code === "SET-IMPORT",
              )?.id;
              if (!setId) {
                setId = newId("set-import");
                drawingSets = [
                  {
                    id: setId,
                    projectId,
                    code: "SET-IMPORT",
                    name: "Imported pieces",
                    type: "shop" as const,
                    discipline: "structural_steel" as const,
                    currentRev: "A",
                    status: "draft" as const,
                  },
                  ...drawingSets,
                ];
              }
              let importDwg = drawings.find(
                (d) => d.projectId === projectId && d.number === "IMPORT-PIECES",
              );
              if (!importDwg) {
                importDwg = {
                  id: newId("dwg-import"),
                  projectId,
                  setId,
                  number: "IMPORT-PIECES",
                  title: "Imported piece marks",
                  type: "shop" as const,
                  discipline: "structural_steel" as const,
                  currentRev: "A",
                  status: "draft" as const,
                  sheetSize: "22x34" as const,
                  pages: 1,
                  pieceMarks: [mark],
                  tags: [],
                  sheetIndex: 1,
                };
                drawings = [importDwg, ...drawings];
                sheetsCreated += 1;
                marksAdded += 1;
              } else if (!importDwg.pieceMarks.includes(mark)) {
                drawings = drawings.map((d) =>
                  d.id === importDwg!.id ? { ...d, pieceMarks: [...d.pieceMarks, mark] } : d,
                );
                marksAdded += 1;
              }
              continue;
            }
            let d = drawings.find(
              (x) => x.projectId === projectId && x.number.toLowerCase() === dwgNo.toLowerCase(),
            );
            if (!d) {
              const code = e.setCode?.trim() || "SET-IMPORT";
              let setId = drawingSets.find(
                (x) => x.projectId === projectId && x.code.toLowerCase() === code.toLowerCase(),
              )?.id;
              if (!setId) {
                setId = newId("set");
                drawingSets = [
                  {
                    id: setId,
                    projectId,
                    code,
                    name: code,
                    type: "shop" as const,
                    discipline: "structural_steel" as const,
                    currentRev: "A",
                    status: "draft" as const,
                  },
                  ...drawingSets,
                ];
              }
              d = {
                id: newId("dwg"),
                projectId,
                setId,
                number: dwgNo,
                title: e.title || dwgNo,
                type: "shop" as const,
                discipline: "structural_steel" as const,
                currentRev: "A",
                status: "draft" as const,
                sheetSize: "22x34" as const,
                pages: 1,
                pieceMarks: [mark],
                tags: [],
                sheetIndex: drawings.filter((x) => x.setId === setId).length + 1,
              };
              drawings = [d, ...drawings];
              sheetsCreated += 1;
              marksAdded += 1;
            } else if (!d.pieceMarks.includes(mark)) {
              drawings = drawings.map((x) =>
                x.id === d!.id ? { ...x, pieceMarks: [...x.pieceMarks, mark] } : x,
              );
              marksAdded += 1;
            }
          }
          return { drawings, drawingSets };
        });
        return { sheetsCreated, marksAdded };
      },

      deleteProject: (projectId) => {
        const role = get().crewRole;
        if (!can(role, "job.delete") && !can(role, "job.reset")) {
          toast.error("Not allowed: delete job");
          return false;
        }
        const s = get();
        const project = s.projects.find((p) => p.id === projectId);
        if (!project) return false;
        if (s.projects.length <= 1) {
          toast.error("Keep at least one job, or use Reset demo / New job first.");
          return false;
        }
        const drawingIds = new Set(
          s.drawings.filter((d) => d.projectId === projectId).map((d) => d.id),
        );
        // Clear sheet blobs for this job
        for (const id of drawingIds) {
          void get().clearSheetAsset(id);
        }
        const nextProjects = s.projects.filter((p) => p.id !== projectId);
        const nextSelected =
          s.selectedProjectId === projectId ? (nextProjects[0]?.id ?? null) : s.selectedProjectId;
        set({
          projects: nextProjects,
          sequences: s.sequences.filter((x) => x.projectId !== projectId),
          drawingSets: s.drawingSets.filter((x) => x.projectId !== projectId),
          drawings: s.drawings.filter((d) => d.projectId !== projectId),
          revisions: s.revisions.filter((r) => !drawingIds.has(r.drawingId)),
          rfis: s.rfis.filter((r) => r.projectId !== projectId),
          submittals: s.submittals.filter((x) => x.projectId !== projectId),
          markups: s.markups.filter((m) => !drawingIds.has(m.drawingId)),
          transmittals: s.transmittals.filter((x) => x.projectId !== projectId),
          activities: [
            {
              id: newId("act"),
              at: new Date().toISOString(),
              projectId: nextSelected ?? projectId,
              kind: "system" as const,
              actor: actorName(s),
              summary: `Deleted job ${project.jobNumber} — ${project.name}`,
            },
            ...s.activities.filter((a) => a.projectId !== projectId),
          ].slice(0, 200),
          selectedProjectId: nextSelected,
        });
        return true;
      },

      clearDemoProjects: () => {
        const role = get().crewRole;
        if (!can(role, "job.delete") && !can(role, "job.reset")) {
          toast.error("Not allowed: remove demo jobs");
          return 0;
        }
        const DEMO_IDS = new Set(["proj-pmc", "proj-dlw", "proj-sot"]);
        const toRemove = get().projects.filter((p) => DEMO_IDS.has(p.id));
        if (toRemove.length === 0) {
          toast.message("No built-in demo jobs left to remove.");
          return 0;
        }
        // Temporarily allow deleting last demo by ensuring a real job remains
        const nonDemo = get().projects.filter((p) => !DEMO_IDS.has(p.id));
        if (nonDemo.length === 0) {
          // Create a blank production shell first so deleteProject won't refuse last job
          get().createProject({
            name: "New production job",
            jobNumber: "JOB-001",
            client: "TBD",
            engineer: "TBD",
            location: "TBD",
            description: "Empty job — replace demo data.",
          });
        }
        let n = 0;
        for (const p of toRemove) {
          if (get().deleteProject(p.id)) n += 1;
        }
        return n;
      },

      resetDemoData: () => {
        if (deny(get().crewRole, "job.reset")) return;
        set({ ...seedState(), sheetAssets: {}, titleBlockMaps: {} });
      },
    }),
    {
      name: "piecemark-drawings-v5",
      // v1 adds the PM tracker collections. Stations that already hold real
      // job data get empty lists rather than the demo seed.
      version: 1,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        const arr = (k: string) => (Array.isArray(p[k]) ? p[k] : []);
        return {
          ...p,
          tasks: arr("tasks"),
          changeOrders: arr("changeOrders"),
          deliveries: arr("deliveries"),
          workPackages: arr("workPackages"),
          roadblocks: arr("roadblocks"),
        };
      },
      // Tracking Prevention / private mode may block localStorage in the preview iframe.
      // Fall back to in-memory so the app still works (session-only when blocked).
      storage: createJSONStorage(() => {
        try {
          const k = "__piecemark_storage_probe__";
          window.localStorage.setItem(k, "1");
          window.localStorage.removeItem(k);
          return window.localStorage;
        } catch {
          const mem = new Map<string, string>();
          return {
            getItem: (name: string) => mem.get(name) ?? null,
            setItem: (name: string, value: string) => {
              mem.set(name, value);
            },
            removeItem: (name: string) => {
              mem.delete(name);
            },
          };
        }
      }),
      partialize: (s) => ({
        crewRole: s.crewRole,
        orgName: s.orgName,
        orgRfiEmail: s.orgRfiEmail,
        sessionActor: s.sessionActor,
        projects: s.projects,
        sequences: s.sequences,
        drawings: s.drawings,
        drawingSets: s.drawingSets,
        revisions: s.revisions,
        markups: s.markups,
        rfis: s.rfis,
        transmittals: s.transmittals,
        submittals: s.submittals,
        activities: s.activities,
        tasks: s.tasks,
        changeOrders: s.changeOrders,
        deliveries: s.deliveries,
        workPackages: s.workPackages,
        roadblocks: s.roadblocks,
        selectedProjectId: s.selectedProjectId,
        filters: s.filters,
        titleBlockMaps: s.titleBlockMaps,
        // sheetAssets intentionally omitted (blob URLs) — restored via IDB/cloud
      }),
    },
  ),
);

export function useSelectedProject() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  return projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null;
}

export function sheetsForSet(drawings: Drawing[], setId: string) {
  return drawings.filter((d) => d.setId === setId);
}

export function pieceMarkRows(projectId: string): PieceMarkRow[] {
  const state = useAppStore.getState();
  const drawings = state.drawings.filter((d) => d.projectId === projectId);
  const sets = new Map(state.drawingSets.map((s) => [s.id, s]));
  const rows: PieceMarkRow[] = [];
  for (const d of drawings) {
    const set = sets.get(d.setId);
    for (const mark of d.pieceMarks) {
      rows.push({
        mark,
        drawingId: d.id,
        drawingNumber: d.number,
        drawingTitle: d.title,
        setId: d.setId,
        setCode: set?.code ?? "",
        setName: set?.name ?? "",
        projectId: d.projectId,
        sequenceId: d.sequenceId,
        status: d.status,
        rev: d.currentRev,
        tonnage: d.tonnage,
        onHold: d.status === "on_hold",
      });
    }
  }
  return rows.sort((a, b) => a.mark.localeCompare(b.mark, undefined, { numeric: true }));
}

export function projectMetrics(projectId: string) {
  const state = useAppStore.getState();
  const drawings = state.drawings.filter((d) => d.projectId === projectId);
  const drawingSets = state.drawingSets.filter((d) => d.projectId === projectId);
  const rfis = state.rfis.filter((r) => r.projectId === projectId);
  const submittals = state.submittals.filter((s) => s.projectId === projectId);
  const sequences = state.sequences.filter((s) => s.projectId === projectId);
  const transmittals = state.transmittals.filter((t) => t.projectId === projectId);

  const total = drawings.length;
  const fabReady = drawings.filter((d) => FAB_READY_STATUSES.includes(d.status)).length;
  const onHold = drawings.filter((d) => d.status === "on_hold").length;
  const revise = drawings.filter((d) => d.status === "revise_resubmit").length;
  const inReview = drawings.filter((d) =>
    ["submitted", "internal_review"].includes(d.status),
  ).length;
  const openRfis = rfis.filter((r) => r.status === "open").length;
  const openSubs = submittals.filter((s) =>
    ["submitted", "under_review", "resubmit"].includes(s.status),
  ).length;
  const unresolvedMarkups = state.markups.filter(
    (m) => !m.resolved && drawings.some((d) => d.id === m.drawingId),
  ).length;
  const setsOnHold = drawingSets.filter((s) => {
    const sheets = sheetsForSet(drawings, s.id);
    return s.status === "on_hold" || sheets.some((d) => d.status === "on_hold");
  }).length;
  const pieceCount = drawings.reduce((n, d) => n + d.pieceMarks.length, 0);
  const openTransmittals = transmittals.filter((t) =>
    ["draft", "issued"].includes(t.status),
  ).length;
  const fieldSheets = drawings.filter((d) => d.status === "issued_for_erection").length;
  const shopSheets = drawings.filter((d) => SHOP_QUEUE_STATUSES.includes(d.status)).length;
  const activities = state.activities.filter((a) => a.projectId === projectId).slice(0, 12);

  return {
    total,
    setCount: drawingSets.length,
    setsOnHold,
    fabReady,
    fabReadyPct: total ? Math.round((fabReady / total) * 100) : 0,
    onHold,
    revise,
    inReview,
    openRfis,
    openSubs,
    unresolvedMarkups,
    pieceCount,
    openTransmittals,
    fieldSheets,
    shopSheets,
    activities,
    sequences,
    drawings,
    drawingSets,
    rfis,
    submittals,
    transmittals,
  };
}

export function rolledSetStatus(sheets: Drawing[], setStatus: DrawingStatus): DrawingStatus {
  if (sheets.length === 0) return setStatus;
  let worst: DrawingStatus = sheets[0]!.status;
  let score = STATUS_SEVERITY[worst] ?? 99;
  for (const s of sheets) {
    const sc = STATUS_SEVERITY[s.status] ?? 99;
    if (sc < score) {
      score = sc;
      worst = s.status;
    }
  }
  // hold on any sheet wins
  if (sheets.some((s) => s.status === "on_hold")) return "on_hold";
  return worst;
}

export function filterDrawingSets(
  sets: DrawingSet[],
  drawings: Drawing[],
  filters: DrawingFilters,
  projectId?: string,
): DrawingSet[] {
  return sets
    .filter((set) => {
      if (projectId && set.projectId !== projectId) return false;
      if (filters.setId !== "all" && set.id !== filters.setId) return false;
      if (filters.type !== "all" && set.type !== filters.type) return false;
      if (filters.sequenceId !== "all" && set.sequenceId !== filters.sequenceId) return false;
      const sheets = sheetsForSet(drawings, set.id);
      const effective = rolledSetStatus(sheets, set.status);
      if (filters.status !== "all" && effective !== filters.status && set.status !== filters.status)
        return false;
      if (filters.holdsOnly) {
        const held =
          effective === "on_hold" ||
          set.status === "on_hold" ||
          sheets.some((d) => d.status === "on_hold");
        if (!held) return false;
      }
      if (filters.query.trim()) {
        const q = filters.query.trim().toLowerCase();
        const hit =
          set.code.toLowerCase().includes(q) ||
          set.name.toLowerCase().includes(q) ||
          sheets.some(
            (d) =>
              d.number.toLowerCase().includes(q) ||
              d.title.toLowerCase().includes(q) ||
              d.pieceMarks.some((m) => m.toLowerCase().includes(q)),
          );
        if (!hit) return false;
      }
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function buildPieceMarkIndex(
  drawings: Drawing[],
  drawingSets: DrawingSet[],
  projectId?: string,
): PieceMarkRow[] {
  const sets = new Map(drawingSets.map((s) => [s.id, s]));
  const rows: PieceMarkRow[] = [];
  for (const d of drawings) {
    if (projectId && d.projectId !== projectId) continue;
    const set = sets.get(d.setId);
    for (const mark of d.pieceMarks) {
      rows.push({
        mark,
        drawingId: d.id,
        drawingNumber: d.number,
        drawingTitle: d.title,
        setId: d.setId,
        setCode: set?.code ?? "",
        setName: set?.name ?? "",
        projectId: d.projectId,
        sequenceId: d.sequenceId,
        status: d.status,
        rev: d.currentRev,
        tonnage: d.tonnage,
        onHold: d.status === "on_hold",
      });
    }
  }
  return rows.sort((a, b) => a.mark.localeCompare(b.mark, undefined, { numeric: true }));
}

/* ── PM tracker selectors ─────────────────────────────────────────────────── */

export type TaskView = "today" | "week" | "overdue" | "open" | "waiting" | "done" | "all";

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  today: "Today",
  week: "This Week",
  overdue: "Overdue",
  open: "All Open",
  waiting: "Waiting On",
  done: "Completed",
  all: "Everything",
};

export interface TaskViewFilters {
  view: TaskView;
  projectId: string | "all";
  category: TaskCategory | "all";
  ballInCourt: BallInCourt | "all";
  owner: string | "all";
  query: string;
}

function daysOut(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(t.getTime())) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86400000);
}

/** True while a snoozed task should stay out of the active views. */
export function isSnoozed(t: Task): boolean {
  if (!t.snoozedUntil) return false;
  const d = daysOut(t.snoozedUntil);
  return d != null && d > 0;
}

export function filterTasks(tasks: Task[], f: TaskViewFilters): Task[] {
  const q = f.query.trim().toLowerCase();
  return tasks
    .filter((t) => {
      if (f.projectId !== "all" && t.projectId !== f.projectId) return false;
      if (f.category !== "all" && t.category !== f.category) return false;
      if (f.ballInCourt !== "all" && t.ballInCourt !== f.ballInCourt) return false;
      if (f.owner !== "all" && (t.owner ?? "") !== f.owner) return false;
      if (q) {
        const hit =
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          (t.links.ref ?? "").toLowerCase().includes(q) ||
          t.subtasks.some((st) => st.text.toLowerCase().includes(q));
        if (!hit) return false;
      }

      const d = daysOut(t.dueDate);
      switch (f.view) {
        case "done":
          return t.status === "done";
        case "all":
          return true;
        case "overdue":
          return t.status !== "done" && d != null && d < 0;
        case "today":
          if (t.status === "done" || isSnoozed(t)) return false;
          return d != null && d <= 0;
        case "week":
          if (t.status === "done" || isSnoozed(t)) return false;
          return d != null && d <= 7;
        case "waiting":
          return t.status !== "done" && t.ballInCourt != null && t.ballInCourt !== "internal";
        case "open":
        default:
          return t.status !== "done" && !isSnoozed(t);
      }
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      const ad = daysOut(a.dueDate);
      const bd = daysOut(b.dueDate);
      if (ad == null && bd != null) return 1;
      if (bd == null && ad != null) return -1;
      if (ad != null && bd != null && ad !== bd) return ad - bd;
      const rank = { hot: 0, normal: 1, low: 2 } as const;
      return rank[a.priority] - rank[b.priority];
    });
}

/** Days a task has been sitting open — the number that makes stale work visible. */
export function taskAgeDays(t: Task): number {
  const d = daysOut(t.createdAt);
  return d == null ? 0 : Math.abs(d);
}

/** Portfolio roll-up across every job, or one job when scoped. */
export function pmMetrics(projectId: string | "all") {
  const s = useAppStore.getState();
  const scope = <T extends { projectId: string }>(rows: T[]) =>
    projectId === "all" ? rows : rows.filter((r) => r.projectId === projectId);

  const tasks = scope(s.tasks);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => {
    const d = daysOut(t.dueDate);
    return d != null && d < 0;
  });
  const dueToday = openTasks.filter((t) => daysOut(t.dueDate) === 0);
  const waitingOn = openTasks.filter((t) => t.ballInCourt && t.ballInCourt !== "internal");

  const roadblocks = scope(s.roadblocks).filter((r) => r.status !== "resolved");
  const criticalRoadblocks = roadblocks.filter(
    (r) => r.severity === "critical" || r.severity === "high",
  );

  const deliveries = scope(s.deliveries);
  const inboundDeliveries = deliveries.filter(
    (d) => d.status !== "received" && d.status !== "exception",
  );
  const deliveryExceptions = deliveries.filter((d) => d.status === "exception");

  const workPackages = scope(s.workPackages);
  const activeFab = workPackages.filter(
    (w) => w.type === "fabrication" && w.status === "in_progress",
  );
  const lateFab = workPackages.filter((w) => {
    if (w.status === "complete") return false;
    const d = daysOut(w.fabDueDate);
    return d != null && d < 0;
  });
  const erectionPackages = workPackages.filter((w) => w.type === "erection");

  const changeOrders = scope(s.changeOrders);
  const pendingCos = changeOrders.filter(
    (c) => c.status !== "approved" && c.status !== "void" && c.status !== "rejected",
  );
  const pendingCoValue = pendingCos.reduce((n, c) => n + (c.amount || 0), 0);
  const approvedCoValue = changeOrders
    .filter((c) => c.status === "approved")
    .reduce((n, c) => n + (c.amount || 0), 0);

  const rfis = scope(s.rfis).filter((r) => r.status === "open");
  const submittals = scope(s.submittals).filter((x) =>
    ["submitted", "under_review", "resubmit"].includes(x.status),
  );

  const erectedTons = erectionPackages.reduce(
    (n, w) => n + ((w.tonnage ?? 0) * (w.erectedPct ?? 0)) / 100,
    0,
  );

  return {
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    dueToday: dueToday.length,
    waitingOn: waitingOn.length,
    openRoadblocks: roadblocks.length,
    criticalRoadblocks: criticalRoadblocks.length,
    inboundDeliveries: inboundDeliveries.length,
    deliveryExceptions: deliveryExceptions.length,
    activeFabPackages: activeFab.length,
    lateFabPackages: lateFab.length,
    pendingCos: pendingCos.length,
    pendingCoValue,
    approvedCoValue,
    openRfis: rfis.length,
    openSubmittals: submittals.length,
    erectedTons,
    erectionPackages: erectionPackages.length,
  };
}
