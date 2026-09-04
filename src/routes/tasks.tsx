import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BufferedInput, BufferedTextarea } from "@/components/buffered-field";
import { AppShell } from "@/components/layout/app-shell";
import { JobScopeSelect } from "@/components/job-scope";
import {
  BallInCourtBadge,
  TaskCategoryBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/pm-badges";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  TASK_VIEW_LABELS,
  filterTasks,
  taskAgeDays,
  useAppStore,
  type TaskView,
  type TaskViewFilters,
} from "@/lib/store";
import {
  BALL_IN_COURT_LABELS,
  TASK_CATEGORY_LABELS,
  TASK_RECURRENCE_LABELS,
  TASK_STATUS_LABELS,
  type BallInCourt,
  type Task,
  type TaskCategory,
  type TaskPriority,
  type TaskRecurrence,
  type TaskStatus,
} from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

type GroupBy = "none" | "job" | "owner" | "due" | "category" | "ball";

const GROUP_LABELS: Record<GroupBy, string> = {
  none: "No grouping",
  job: "By job",
  owner: "By owner",
  due: "By due date",
  category: "By category",
  ball: "By ball in court",
};

function dueLabel(dueDate?: string): { text: string; tone: string } {
  const d = daysUntil(dueDate);
  if (d == null) return { text: "No date", tone: "text-[var(--color-subtle)]" };
  if (d < 0)
    return {
      text: `${Math.abs(d)}d overdue`,
      tone: "text-[var(--color-danger)] font-medium",
    };
  if (d === 0) return { text: "Today", tone: "text-[var(--color-warn)] font-medium" };
  if (d === 1) return { text: "Tomorrow", tone: "text-[var(--color-fg)]" };
  return { text: formatDate(dueDate), tone: "text-[var(--color-muted)]" };
}

function TasksPage() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const tasks = useAppStore((s) => s.tasks);
  const rfis = useAppStore((s) => s.rfis);
  const drawings = useAppStore((s) => s.drawings);
  const submittals = useAppStore((s) => s.submittals);
  const deliveries = useAppStore((s) => s.deliveries);
  const changeOrders = useAppStore((s) => s.changeOrders);
  const workPackages = useAppStore((s) => s.workPackages);
  const roadblocks = useAppStore((s) => s.roadblocks);

  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const toggleTaskDone = useAppStore((s) => s.toggleTaskDone);
  const setTaskStatus = useAppStore((s) => s.setTaskStatus);
  const snoozeTask = useAppStore((s) => s.snoozeTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const addSubtask = useAppStore((s) => s.addSubtask);
  const toggleSubtask = useAppStore((s) => s.toggleSubtask);
  const removeSubtask = useAppStore((s) => s.removeSubtask);

  const [scope, setScope] = useState<string | "all">("all");
  const [view, setView] = useState<TaskView>("open");
  const [groupBy, setGroupBy] = useState<GroupBy>("job");
  const [category, setCategory] = useState<TaskCategory | "all">("all");
  const [ball, setBall] = useState<BallInCourt | "all">("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState("");

  // Quick add — one field, Enter to save. Anything slower does not get used.
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProject, setQuickProject] = useState(selectedProjectId ?? projects[0]?.id ?? "");
  const [quickCategory, setQuickCategory] = useState<TaskCategory>("other");
  const [quickDue, setQuickDue] = useState("");
  const [quickPriority, setQuickPriority] = useState<TaskPriority>("normal");

  const filters: TaskViewFilters = {
    view,
    projectId: scope,
    category,
    ballInCourt: ball,
    owner: "all",
    query,
  };

  const rows = useMemo(
    () => filterTasks(tasks, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, view, scope, category, ball, query],
  );

  const counts = useMemo(() => {
    const scoped = tasks.filter((t) => scope === "all" || t.projectId === scope);
    const open = scoped.filter((t) => t.status !== "done");
    const overdue = open.filter((t) => {
      const d = daysUntil(t.dueDate);
      return d != null && d < 0;
    });
    const today = open.filter((t) => daysUntil(t.dueDate) === 0);
    const waiting = open.filter((t) => t.ballInCourt && t.ballInCourt !== "internal");
    return {
      open: open.length,
      overdue: overdue.length,
      today: today.length,
      waiting: waiting.length,
    };
  }, [tasks, scope]);

  const jobLabel = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.jobNumber ?? "—";

  function linkLabel(t: Task): string | null {
    const l = t.links;
    if (l.ref) return l.ref;
    if (l.rfiId) return rfis.find((r) => r.id === l.rfiId)?.number ?? null;
    if (l.submittalId) return submittals.find((x) => x.id === l.submittalId)?.number ?? null;
    if (l.changeOrderId) return changeOrders.find((c) => c.id === l.changeOrderId)?.number ?? null;
    if (l.deliveryId) return deliveries.find((d) => d.id === l.deliveryId)?.loadNumber ?? null;
    if (l.workPackageId) return workPackages.find((w) => w.id === l.workPackageId)?.code ?? null;
    if (l.roadblockId) return roadblocks.find((r) => r.id === l.roadblockId)?.number ?? null;
    if (l.drawingId) return drawings.find((d) => d.id === l.drawingId)?.number ?? null;
    return null;
  }

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "", label: "", items: rows }];
    const map = new Map<string, Task[]>();
    for (const t of rows) {
      let key: string;
      if (groupBy === "job") key = jobLabel(t.projectId);
      else if (groupBy === "owner") key = t.owner || "Unassigned";
      else if (groupBy === "category") key = TASK_CATEGORY_LABELS[t.category];
      else if (groupBy === "ball")
        key = t.ballInCourt ? BALL_IN_COURT_LABELS[t.ballInCourt] : "Unassigned";
      else key = dueLabel(t.dueDate).text;
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()].map(([label, items]) => ({
      key: label,
      label,
      items,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy, projects]);

  function submitQuickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    if (!quickProject) {
      toast.error("Pick a job first");
      return;
    }
    addTask({
      projectId: quickProject,
      title,
      category: quickCategory,
      priority: quickPriority,
      dueDate: quickDue || undefined,
    });
    setQuickTitle("");
    setQuickDue("");
    toast.success("Task added");
  }

  function exportCsv() {
    const csv = toCsv([
      [
        "Job",
        "Task",
        "Category",
        "Status",
        "Priority",
        "Owner",
        "Ball in court",
        "Due",
        "Age (days)",
        "Linked",
        "Notes",
      ],
      ...rows.map((t) => [
        jobLabel(t.projectId),
        t.title,
        TASK_CATEGORY_LABELS[t.category],
        TASK_STATUS_LABELS[t.status],
        t.priority,
        t.owner ?? "",
        t.ballInCourt ? BALL_IN_COURT_LABELS[t.ballInCourt] : "",
        t.dueDate ?? "",
        taskAgeDays(t),
        linkLabel(t) ?? "",
        t.notes ?? "",
      ]),
    ]);
    downloadCsv(
      `tasks-${TASK_VIEW_LABELS[view].toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
    toast.success("Task list exported");
  }

  return (
    <AppShell
      title="Task List"
      subtitle="Every open action across every job — auto-fed by RFIs, holds, submittals, and deliveries"
      actions={
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-3.5" />
          Export
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Open"
            value={counts.open}
            hint={scope === "all" ? "All jobs" : jobLabel(scope)}
          />
          <StatCard
            label="Overdue"
            value={counts.overdue}
            tone={counts.overdue > 0 ? "danger" : "success"}
            hint="Past due date"
          />
          <StatCard
            label="Due today"
            value={counts.today}
            tone={counts.today > 0 ? "warn" : "default"}
          />
          <StatCard
            label="Waiting on others"
            value={counts.waiting}
            tone="info"
            hint="Ball in someone else's court"
          />
        </div>

        {/* Quick add */}
        <section className="panel space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="New task"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitQuickAdd();
              }}
              placeholder="Add a task and press Enter — e.g. Chase EOR on embed conflict at CP-C"
              className="flex-1"
            />
            <Button onClick={submitQuickAdd}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select
              aria-label="Job"
              value={quickProject}
              onChange={(e) => setQuickProject(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.jobNumber}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Category"
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value as TaskCategory)}
            >
              {(Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                <option key={c} value={c}>
                  {TASK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Priority"
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
            >
              <option value="hot">Hot</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
            <Input
              aria-label="Due date"
              type="date"
              value={quickDue}
              onChange={(e) => setQuickDue(e.target.value)}
            />
          </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {(Object.keys(TASK_VIEW_LABELS) as TaskView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-[var(--radius-md)] border px-3 py-1.5 text-xs transition-colors",
                  view === v
                    ? "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 text-[var(--color-fg)]"
                    : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]",
                )}
              >
                {TASK_VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <JobScopeSelect value={scope} onChange={setScope} className="w-44" />
            <Select
              aria-label="Group by"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="w-36"
            >
              {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Category filter"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory | "all")}
              className="w-36"
            >
              <option value="all">All categories</option>
              {(Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                <option key={c} value={c}>
                  {TASK_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Ball in court filter"
              value={ball}
              onChange={(e) => setBall(e.target.value as BallInCourt | "all")}
              className="w-40"
            >
              <option value="all">Anyone's court</option>
              {(Object.keys(BALL_IN_COURT_LABELS) as BallInCourt[]).map((b) => (
                <option key={b} value={b}>
                  {BALL_IN_COURT_LABELS[b]}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Search tasks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-40"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              Nothing in this view. Clear list — or change the filter.
            </div>
          )}

          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              {groupBy !== "none" && (
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                    {group.label}
                  </h2>
                  <span className="font-mono-num text-[11px] text-[var(--color-subtle)]">
                    {group.items.length}
                  </span>
                </div>
              )}
              <div className="panel divide-y divide-[var(--color-border)] overflow-hidden">
                {group.items.map((t) => {
                  const due = dueLabel(t.dueDate);
                  const isOpen = expanded === t.id;
                  const link = linkLabel(t);
                  const doneSubs = t.subtasks.filter((s) => s.done).length;
                  return (
                    <div key={t.id}>
                      <div className="flex items-start gap-3 px-4 py-3">
                        <button
                          type="button"
                          aria-label={t.status === "done" ? "Reopen task" : "Complete task"}
                          onClick={() => toggleTaskDone(t.id)}
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-colors",
                            t.status === "done"
                              ? "border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]"
                              : "border-[var(--color-border-strong)] hover:border-[var(--color-primary)]",
                          )}
                        >
                          {t.status === "done" && <Check className="size-3.5" />}
                        </button>

                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setExpanded(isOpen ? null : t.id)}
                        >
                          <div
                            className={cn(
                              "text-sm",
                              t.status === "done" && "text-[var(--color-subtle)] line-through",
                            )}
                          >
                            {t.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted)]">
                            <span className="font-mono-num">{jobLabel(t.projectId)}</span>
                            <span className={due.tone}>{due.text}</span>
                            {t.owner && <span>{t.owner}</span>}
                            {t.status !== "done" && (
                              <span className="text-[var(--color-subtle)]">
                                {taskAgeDays(t)}d open
                              </span>
                            )}
                            {link && (
                              <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 font-mono-num">
                                {link}
                              </span>
                            )}
                            {t.subtasks.length > 0 && (
                              <span className="font-mono-num">
                                {doneSubs}/{t.subtasks.length}
                              </span>
                            )}
                            {t.recurrence !== "none" && (
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="size-3" />
                                {TASK_RECURRENCE_LABELS[t.recurrence]}
                              </span>
                            )}
                            {t.autoKey && <span className="text-[var(--color-subtle)]">auto</span>}
                          </div>
                        </button>

                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          <TaskPriorityBadge priority={t.priority} />
                          <TaskCategoryBadge category={t.category} />
                          <BallInCourtBadge who={t.ballInCourt} />
                          {t.status === "blocked" && <TaskStatusBadge status={t.status} />}
                          {isOpen ? (
                            <ChevronDown className="size-4 text-[var(--color-subtle)]" />
                          ) : (
                            <ChevronRight className="size-4 text-[var(--color-subtle)]" />
                          )}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="space-y-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                Due
                              </label>
                              <Input
                                aria-label="Due date"
                                type="date"
                                value={t.dueDate ?? ""}
                                onChange={(e) =>
                                  updateTask(t.id, {
                                    dueDate: e.target.value || undefined,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                Status
                              </label>
                              <Select
                                aria-label="Status"
                                value={t.status}
                                onChange={(e) => setTaskStatus(t.id, e.target.value as TaskStatus)}
                              >
                                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((st) => (
                                  <option key={st} value={st}>
                                    {TASK_STATUS_LABELS[st]}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                Priority
                              </label>
                              <Select
                                aria-label="Priority"
                                value={t.priority}
                                onChange={(e) =>
                                  updateTask(t.id, {
                                    priority: e.target.value as TaskPriority,
                                  })
                                }
                              >
                                <option value="hot">Hot</option>
                                <option value="normal">Normal</option>
                                <option value="low">Low</option>
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                Owner
                              </label>
                              <BufferedInput
                                aria-label="Owner"
                                value={t.owner ?? ""}
                                onCommit={(v) => updateTask(t.id, { owner: v || undefined })}
                                placeholder="Who owns it"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                Ball in court
                              </label>
                              <Select
                                aria-label="Ball in court"
                                value={t.ballInCourt ?? ""}
                                onChange={(e) =>
                                  updateTask(t.id, {
                                    ballInCourt: (e.target.value as BallInCourt) || undefined,
                                  })
                                }
                              >
                                <option value="">—</option>
                                {(Object.keys(BALL_IN_COURT_LABELS) as BallInCourt[]).map((b) => (
                                  <option key={b} value={b}>
                                    {BALL_IN_COURT_LABELS[b]}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                Repeats
                              </label>
                              <Select
                                aria-label="Recurrence"
                                value={t.recurrence}
                                onChange={(e) =>
                                  updateTask(t.id, {
                                    recurrence: e.target.value as TaskRecurrence,
                                  })
                                }
                              >
                                {(Object.keys(TASK_RECURRENCE_LABELS) as TaskRecurrence[]).map(
                                  (r) => (
                                    <option key={r} value={r}>
                                      {TASK_RECURRENCE_LABELS[r]}
                                    </option>
                                  ),
                                )}
                              </Select>
                            </div>
                          </div>

                          <div>
                            <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                              Notes
                            </label>
                            <BufferedTextarea
                              aria-label="Notes"
                              value={t.notes ?? ""}
                              onCommit={(v) => updateTask(t.id, { notes: v || undefined })}
                              rows={2}
                              placeholder="Detail the field or shop needs — sheet, detail, grid line…"
                            />
                          </div>

                          <div>
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                              Checklist
                            </div>
                            <div className="space-y-1.5">
                              {t.subtasks.map((st) => (
                                <div key={st.id} className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    aria-label="Toggle checklist item"
                                    onClick={() => toggleSubtask(t.id, st.id)}
                                    className={cn(
                                      "flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
                                      st.done
                                        ? "border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]"
                                        : "border-[var(--color-border-strong)]",
                                    )}
                                  >
                                    {st.done && <Check className="size-3" />}
                                  </button>
                                  <span
                                    className={cn(
                                      "flex-1 text-xs",
                                      st.done && "text-[var(--color-subtle)] line-through",
                                    )}
                                  >
                                    {st.text}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="Remove checklist item"
                                    onClick={() => removeSubtask(t.id, st.id)}
                                    className="text-[var(--color-subtle)] hover:text-[var(--color-danger)]"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <Input
                                  aria-label="New checklist item"
                                  value={expanded === t.id ? subtaskDraft : ""}
                                  onChange={(e) => setSubtaskDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && subtaskDraft.trim()) {
                                      addSubtask(t.id, subtaskDraft);
                                      setSubtaskDraft("");
                                    }
                                  }}
                                  placeholder="Add a step, press Enter"
                                  className="h-8 flex-1 text-xs"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 1);
                                const iso = d.toISOString().slice(0, 10);
                                snoozeTask(t.id, iso);
                                updateTask(t.id, { dueDate: iso });
                                toast.success("Snoozed to tomorrow");
                              }}
                            >
                              <Clock className="size-3.5" />
                              Snooze 1 day
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 7);
                                const iso = d.toISOString().slice(0, 10);
                                snoozeTask(t.id, iso);
                                updateTask(t.id, { dueDate: iso });
                                toast.success("Snoozed one week");
                              }}
                            >
                              <Clock className="size-3.5" />
                              Snooze 1 week
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                deleteTask(t.id);
                                toast.success("Task deleted");
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
