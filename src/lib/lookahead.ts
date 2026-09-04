import { toCsv } from "@/lib/csv";
import type {
  BallInCourt,
  ChangeOrder,
  Delivery,
  Project,
  Roadblock,
  RFI,
  Sequence,
  Submittal,
  Task,
  WorkPackage,
} from "@/lib/types";

/**
 * Unified look-ahead across every tracked record on every job.
 *
 * A 48-hour and 10-day look ahead is only useful if it pulls from ALL the
 * date-bearing records at once — tasks, RFI due dates, submittal returns,
 * change-order pricing, truck ship/required dates, fab milestones, erection
 * starts, and roadblock target dates. Anything that lives on its own page and
 * not in this list will get missed in the Monday huddle.
 */

export type LookaheadKind =
  | "task"
  | "rfi_due"
  | "submittal_due"
  | "change_order_due"
  | "delivery_ship"
  | "delivery_required"
  | "release_to_fab"
  | "fab_start"
  | "fab_due"
  | "paint_out"
  | "paint_back"
  | "wp_ship"
  | "wp_on_site"
  | "erect_start"
  | "erect_end"
  | "roadblock_target"
  | "sequence_start"
  | "sequence_end";

export const LOOKAHEAD_KIND_LABELS: Record<LookaheadKind, string> = {
  task: "Task",
  rfi_due: "RFI due",
  submittal_due: "Submittal due",
  change_order_due: "Change order",
  delivery_ship: "Truck ships",
  delivery_required: "Required on site",
  release_to_fab: "Release to fab",
  fab_start: "Fab start",
  fab_due: "Fab due",
  paint_out: "Paint / galv out",
  paint_back: "Paint / galv back",
  wp_ship: "Package ships",
  wp_on_site: "Package on site",
  erect_start: "Erection start",
  erect_end: "Erection complete",
  roadblock_target: "Roadblock target",
  sequence_start: "Sequence start",
  sequence_end: "Sequence complete",
};

/** Route each look-ahead row links to. Literal union keeps typed router links working. */
export type LookaheadRoute =
  | "/tasks"
  | "/rfis"
  | "/submittals"
  | "/change-orders"
  | "/deliveries"
  | "/work-packages"
  | "/roadblocks"
  | "/sequences";

export type LookaheadSeverity = "critical" | "high" | "normal" | "low";

export interface LookaheadItem {
  id: string;
  sourceId: string;
  projectId: string;
  jobNumber: string;
  projectName: string;
  /** YYYY-MM-DD */
  date: string;
  daysOut: number;
  overdue: boolean;
  kind: LookaheadKind;
  title: string;
  detail?: string;
  severity: LookaheadSeverity;
  owner?: string;
  ballInCourt?: BallInCourt;
  to: LookaheadRoute;
}

export interface LookaheadWindow {
  id: "48h" | "10d";
  label: string;
  /** Inclusive upper bound on daysOut. 1 = today + tomorrow. */
  maxDaysOut: number;
}

export const LOOKAHEAD_WINDOWS: LookaheadWindow[] = [
  { id: "48h", label: "48-Hour", maxDaysOut: 1 },
  { id: "10d", label: "10-Day", maxDaysOut: 10 },
];

export interface LookaheadSource {
  projects: Project[];
  tasks: Task[];
  rfis: RFI[];
  submittals: Submittal[];
  changeOrders: ChangeOrder[];
  deliveries: Delivery[];
  workPackages: WorkPackage[];
  roadblocks: Roadblock[];
  sequences: Sequence[];
}

export interface LookaheadOptions {
  /** Single job id, or "all" for the whole portfolio */
  projectId?: string | "all";
  /** Inclusive upper bound on daysOut */
  maxDaysOut: number;
  /** Include items already past due (default true) */
  includeOverdue?: boolean;
  /**
   * How far back past-due items are pulled in, in days (default 30).
   * A look ahead swamped by six-month-old dates is unreadable — anything
   * older than the lookback is a stale date to clean up in its own log,
   * not work to plan around this week. Pass a large number to show all.
   */
  overdueLookbackDays?: number;
}

function dayDiff(iso?: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function dateKey(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export function buildLookahead(src: LookaheadSource, opts: LookaheadOptions): LookaheadItem[] {
  const includeOverdue = opts.includeOverdue !== false;
  const lookback = opts.overdueLookbackDays ?? 30;
  const scope = opts.projectId ?? "all";
  const projectById = new Map(src.projects.map((p) => [p.id, p]));
  const seqById = new Map(src.sequences.map((s) => [s.id, s]));
  const items: LookaheadItem[] = [];

  const inScope = (projectId: string) => (scope === "all" ? true : projectId === scope);

  function push(input: {
    sourceId: string;
    projectId: string;
    date?: string;
    kind: LookaheadKind;
    title: string;
    detail?: string;
    severity?: LookaheadSeverity;
    owner?: string;
    ballInCourt?: BallInCourt;
    to: LookaheadRoute;
    /**
     * Drop the item once its date has passed. Used for milestones that the
     * work has demonstrably moved past — a fab-start date in the past on a
     * package already in the shop is not a miss, it is history.
     */
    skipIfOverdue?: boolean;
  }) {
    if (!input.date) return;
    if (!inScope(input.projectId)) return;
    const daysOut = dayDiff(input.date);
    if (daysOut == null) return;
    if (daysOut > opts.maxDaysOut) return;
    if (daysOut < 0 && !includeOverdue) return;
    if (daysOut < 0 && daysOut < -lookback) return;
    if (daysOut < 0 && input.skipIfOverdue) return;
    const project = projectById.get(input.projectId);
    if (!project) return;
    const overdue = daysOut < 0;
    items.push({
      id: `${input.kind}:${input.sourceId}`,
      sourceId: input.sourceId,
      projectId: input.projectId,
      jobNumber: project.jobNumber,
      projectName: project.name,
      date: dateKey(input.date),
      daysOut,
      overdue,
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      severity: overdue ? "critical" : (input.severity ?? "normal"),
      owner: input.owner,
      ballInCourt: input.ballInCourt,
      to: input.to,
    });
  }

  // Tasks — snoozed tasks stay out of the look ahead until they wake up
  for (const t of src.tasks) {
    if (t.status === "done") continue;
    if (t.snoozedUntil) {
      const snooze = dayDiff(t.snoozedUntil);
      if (snooze != null && snooze > 0) continue;
    }
    push({
      sourceId: t.id,
      projectId: t.projectId,
      date: t.dueDate,
      kind: "task",
      title: t.title,
      detail: t.links.ref,
      severity: t.priority === "hot" ? "high" : t.priority === "low" ? "low" : "normal",
      owner: t.owner,
      ballInCourt: t.ballInCourt,
      to: "/tasks",
    });
  }

  for (const r of src.rfis) {
    if (r.status === "closed" || r.status === "void") continue;
    push({
      sourceId: r.id,
      projectId: r.projectId,
      date: r.dueDate,
      kind: "rfi_due",
      title: `${r.number} — ${r.subject}`,
      detail: `Raised by ${r.raisedBy}`,
      severity: r.priority === "critical" ? "critical" : r.priority === "high" ? "high" : "normal",
      to: "/rfis",
    });
  }

  for (const s of src.submittals) {
    if (s.status === "approved") continue;
    push({
      sourceId: s.id,
      projectId: s.projectId,
      date: s.dueDate,
      kind: "submittal_due",
      title: `${s.number} — ${s.title}`,
      detail: s.reviewer ? `Reviewer: ${s.reviewer}` : undefined,
      severity: "high",
      ballInCourt: s.ballInCourt,
      to: "/submittals",
    });
  }

  for (const co of src.changeOrders) {
    if (co.status === "approved" || co.status === "void") continue;
    push({
      sourceId: co.id,
      projectId: co.projectId,
      date: co.dueDate,
      kind: "change_order_due",
      title: `${co.number} — ${co.title}`,
      detail: co.amount != null ? `$${Math.round(co.amount).toLocaleString("en-US")}` : undefined,
      severity: "high",
      ballInCourt: co.ballInCourt,
      to: "/change-orders",
    });
  }

  for (const d of src.deliveries) {
    const seq = d.sequenceId ? seqById.get(d.sequenceId) : undefined;
    const seqLabel = seq ? `Seq ${seq.number} · ${seq.name}` : undefined;
    // Once a truck has physically landed, its ship and required dates are
    // history — even if it came in short and is still open as an exception.
    const arrived =
      d.status === "received" ||
      d.status === "delivered" ||
      d.status === "exception" ||
      Boolean(d.deliveredDate);
    if (!arrived) {
      push({
        sourceId: d.id,
        projectId: d.projectId,
        date: d.shipDate,
        kind: "delivery_ship",
        title: `${d.loadNumber} ships${d.carrier ? ` · ${d.carrier}` : ""}`,
        detail: seqLabel,
        severity: "normal",
        to: "/deliveries",
      });
      push({
        sourceId: d.id,
        projectId: d.projectId,
        date: d.requiredDate,
        kind: "delivery_required",
        title: `${d.loadNumber} required on site`,
        detail: [seqLabel, d.craneRequired ? "Crane required" : null].filter(Boolean).join(" · "),
        severity: "high",
        to: "/deliveries",
      });
    }
  }

  for (const wp of src.workPackages) {
    if (wp.status === "complete") continue;
    const started = wp.status === "in_progress";
    const erecting = (wp.erectedPct ?? 0) > 0;
    const base = {
      sourceId: wp.id,
      projectId: wp.projectId,
      owner: wp.owner,
      to: "/work-packages" as const,
    };
    push({
      ...base,
      date: wp.releaseToFabDate,
      kind: "release_to_fab",
      title: `${wp.code} — release to fab`,
      detail: wp.name,
      severity: "high",
      skipIfOverdue: started,
    });
    push({
      ...base,
      date: wp.fabStartDate,
      kind: "fab_start",
      title: `${wp.code} — fab start`,
      detail: wp.name,
      skipIfOverdue: started,
    });
    push({
      ...base,
      date: wp.fabDueDate,
      kind: "fab_due",
      title: `${wp.code} — fab due`,
      detail: `${wp.name}${wp.percentComplete ? ` · ${wp.percentComplete}% complete` : ""}`,
      severity: "high",
    });
    push({
      ...base,
      date: wp.paintOutDate,
      kind: "paint_out",
      title: `${wp.code} — paint / galv out`,
      detail: wp.name,
    });
    push({
      ...base,
      date: wp.paintBackDate,
      kind: "paint_back",
      title: `${wp.code} — paint / galv back`,
      detail: wp.name,
    });
    push({
      ...base,
      date: wp.shipDate,
      kind: "wp_ship",
      title: `${wp.code} — ships`,
      detail: wp.name,
    });
    push({
      ...base,
      date: wp.onSiteDate,
      kind: "wp_on_site",
      title: `${wp.code} — on site`,
      detail: wp.name,
      severity: "high",
    });
    push({
      ...base,
      date: wp.erectStartDate,
      kind: "erect_start",
      title: `${wp.code} — erection start`,
      detail: [
        wp.name,
        wp.crewSize ? `${wp.crewSize}-man crew` : null,
        wp.craneDays ? `${wp.craneDays} crane days` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      severity: "high",
      skipIfOverdue: erecting,
    });
    push({
      ...base,
      date: wp.erectEndDate,
      kind: "erect_end",
      title: `${wp.code} — erection complete`,
      detail: wp.name,
    });
  }

  for (const rb of src.roadblocks) {
    if (rb.status === "resolved") continue;
    push({
      sourceId: rb.id,
      projectId: rb.projectId,
      date: rb.targetResolution,
      kind: "roadblock_target",
      title: `${rb.number} — ${rb.title}`,
      detail: rb.mitigation,
      severity:
        rb.severity === "critical" ? "critical" : rb.severity === "high" ? "high" : "normal",
      owner: rb.owner,
      ballInCourt: rb.ballInCourt,
      to: "/roadblocks",
    });
  }

  for (const seq of src.sequences) {
    if (seq.status === "complete") continue;
    push({
      sourceId: seq.id,
      projectId: seq.projectId,
      date: seq.plannedStart,
      kind: "sequence_start",
      title: `Seq ${seq.number} — ${seq.name} starts`,
      detail: seq.grids ? `Grids ${seq.grids}` : seq.area,
      to: "/sequences",
    });
    push({
      sourceId: seq.id,
      projectId: seq.projectId,
      date: seq.plannedEnd,
      kind: "sequence_end",
      title: `Seq ${seq.number} — ${seq.name} complete`,
      detail: seq.grids ? `Grids ${seq.grids}` : seq.area,
      to: "/sequences",
    });
  }

  const sevRank: Record<LookaheadSeverity, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  return items.sort((a, b) => {
    // Overdue first, most recently missed at the top — those are the ones
    // still worth chasing. Upcoming work then runs forward in date order.
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.date !== b.date) {
      return a.overdue ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    }
    const s = sevRank[a.severity] - sevRank[b.severity];
    if (s !== 0) return s;
    return a.title.localeCompare(b.title);
  });
}

export interface LookaheadDay {
  date: string;
  daysOut: number;
  label: string;
  items: LookaheadItem[];
}

/** Day label a foreman reads without doing arithmetic. */
export function dayLabel(daysOut: number, date: string): string {
  if (daysOut < 0) return `Overdue · ${Math.abs(daysOut)}d`;
  if (daysOut === 0) return "Today";
  if (daysOut === 1) return "Tomorrow";
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function groupByDay(items: LookaheadItem[]): LookaheadDay[] {
  const map = new Map<string, LookaheadItem[]>();
  for (const it of items) {
    const list = map.get(it.date);
    if (list) list.push(it);
    else map.set(it.date, [it]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      date,
      daysOut: list[0]!.daysOut,
      label: dayLabel(list[0]!.daysOut, date),
      items: list,
    }));
}

/** CSV for pasting into the Monday huddle agenda or emailing the GC. */
export function lookaheadToCsv(items: LookaheadItem[]): string {
  return toCsv([
    ["Date", "Days out", "Job", "Type", "Item", "Detail", "Owner", "Ball in court", "Status"],
    ...items.map((i) => [
      i.date,
      i.daysOut,
      i.jobNumber,
      LOOKAHEAD_KIND_LABELS[i.kind],
      i.title,
      i.detail ?? "",
      i.owner ?? "",
      i.ballInCourt ?? "",
      i.overdue ? "OVERDUE" : "Scheduled",
    ]),
  ]);
}
