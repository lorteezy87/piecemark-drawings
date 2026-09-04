import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { JobScopeSelect } from "@/components/job-scope";
import {
  BallInCourtBadge,
  ChangeOrderStatusBadge,
  ChangeOrderTypeBadge,
} from "@/components/pm-badges";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useAppStore } from "@/lib/store";
import {
  BALL_IN_COURT_LABELS,
  CHANGE_ORDER_STATUS_LABELS,
  CHANGE_ORDER_TYPE_LABELS,
  type BallInCourt,
  type ChangeOrderStatus,
  type ChangeOrderType,
} from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/change-orders")({
  component: ChangeOrdersPage,
});

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

function ChangeOrdersPage() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const rfis = useAppStore((s) => s.rfis);
  const sequences = useAppStore((s) => s.sequences);
  const changeOrders = useAppStore((s) => s.changeOrders);
  const addChangeOrder = useAppStore((s) => s.addChangeOrder);
  const updateChangeOrder = useAppStore((s) => s.updateChangeOrder);
  const setChangeOrderStatus = useAppStore((s) => s.setChangeOrderStatus);
  const deleteChangeOrder = useAppStore((s) => s.deleteChangeOrder);
  const addTask = useAppStore((s) => s.addTask);

  const [scope, setScope] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ChangeOrderStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [projectId, setProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ChangeOrderType>("pco");
  const [amount, setAmount] = useState("");
  const [tonnageDelta, setTonnageDelta] = useState("");
  const [scheduleImpactDays, setScheduleImpactDays] = useState("");
  const [description, setDescription] = useState("");
  const [originRfiId, setOriginRfiId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [ballInCourt, setBallInCourt] = useState<BallInCourt>("internal");

  const jobLabel = (id: string) => projects.find((p) => p.id === id)?.jobNumber ?? "—";

  const rows = useMemo(
    () =>
      changeOrders
        .filter((c) => scope === "all" || c.projectId === scope)
        .filter((c) => statusFilter === "all" || c.status === statusFilter)
        .sort((a, b) => {
          const rank: Record<ChangeOrderStatus, number> = {
            pending_pricing: 0,
            draft: 1,
            submitted: 2,
            approved: 3,
            rejected: 4,
            void: 5,
          };
          const r = rank[a.status] - rank[b.status];
          if (r !== 0) return r;
          return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        }),
    [changeOrders, scope, statusFilter],
  );

  const stats = useMemo(() => {
    const scoped = changeOrders.filter((c) => scope === "all" || c.projectId === scope);
    const pending = scoped.filter(
      (c) => c.status !== "approved" && c.status !== "rejected" && c.status !== "void",
    );
    const approved = scoped.filter((c) => c.status === "approved");
    const backcharges = scoped.filter((c) => c.type === "backcharge");
    return {
      pendingCount: pending.length,
      pendingValue: pending.reduce((n, c) => n + (c.amount || 0), 0),
      approvedValue: approved.reduce((n, c) => n + (c.amount || 0), 0),
      backchargeValue: backcharges.reduce((n, c) => n + (c.amount || 0), 0),
      tonnageDelta: scoped.reduce((n, c) => n + (c.tonnageDelta ?? 0), 0),
      scheduleDays: pending.reduce((n, c) => n + (c.scheduleImpactDays ?? 0), 0),
    };
  }, [changeOrders, scope]);

  const projectRfis = rfis.filter((r) => r.projectId === projectId);

  function submitCreate() {
    if (!projectId || !title.trim() || !description.trim()) {
      toast.error("Job, title, and description are required");
      return;
    }
    addChangeOrder({
      projectId,
      title: title.trim(),
      type,
      amount: amount ? Number(amount) : 0,
      description: description.trim(),
      tonnageDelta: tonnageDelta ? Number(tonnageDelta) : undefined,
      scheduleImpactDays: scheduleImpactDays ? Number(scheduleImpactDays) : undefined,
      originRfiId: originRfiId || undefined,
      dueDate: dueDate || undefined,
      ballInCourt,
    });
    toast.success("Change order logged");
    setShowCreate(false);
    setTitle("");
    setDescription("");
    setAmount("");
    setTonnageDelta("");
    setScheduleImpactDays("");
    setDueDate("");
  }

  function exportCsv() {
    downloadCsv(
      `change-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        [
          "Job",
          "Number",
          "Title",
          "Type",
          "Status",
          "Amount",
          "Tons delta",
          "Schedule days",
          "Ball in court",
          "Due",
          "Submitted",
          "Approved",
          "Origin RFI",
          "Description",
        ],
        ...rows.map((c) => [
          jobLabel(c.projectId),
          c.number,
          c.title,
          CHANGE_ORDER_TYPE_LABELS[c.type],
          CHANGE_ORDER_STATUS_LABELS[c.status],
          c.amount,
          c.tonnageDelta ?? "",
          c.scheduleImpactDays ?? "",
          c.ballInCourt ? BALL_IN_COURT_LABELS[c.ballInCourt] : "",
          c.dueDate ?? "",
          c.submittedDate ?? "",
          c.approvedDate ?? "",
          rfis.find((r) => r.id === c.originRfiId)?.number ?? "",
          c.description,
        ]),
      ]),
    );
    toast.success("Change order log exported");
  }

  return (
    <AppShell
      title="Change Orders"
      subtitle="PCOs, COs, backcharges, and T&M — with the RFI or drawing rev that caused them"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showCreate ? "Cancel" : "New change"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Pending"
            value={stats.pendingCount}
            hint={money(stats.pendingValue)}
            tone="warn"
          />
          <StatCard label="Approved value" value={money(stats.approvedValue)} tone="success" />
          <StatCard
            label="Backcharge exposure"
            value={money(stats.backchargeValue)}
            tone={stats.backchargeValue !== 0 ? "danger" : "default"}
          />
          <StatCard
            label="Schedule impact"
            value={`${stats.scheduleDays} d`}
            hint={`${stats.tonnageDelta.toFixed(1)} tn added`}
            tone="info"
          />
        </div>

        {showCreate && (
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="font-medium">Log a change</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Tie it to the RFI answer or drawing revision that caused it — that link is your
                entitlement trail.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Job</label>
                <Select
                  aria-label="Job"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setOriginRfiId("");
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.jobNumber}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Title</label>
                <Input
                  aria-label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Added embeds at central plant CMU walls"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Type</label>
                <Select
                  aria-label="Type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ChangeOrderType)}
                >
                  {(Object.keys(CHANGE_ORDER_TYPE_LABELS) as ChangeOrderType[]).map((t) => (
                    <option key={t} value={t}>
                      {CHANGE_ORDER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Amount ($)</label>
                <Input
                  aria-label="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Tons added</label>
                <Input
                  aria-label="Tons delta"
                  type="number"
                  value={tonnageDelta}
                  onChange={(e) => setTonnageDelta(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Schedule impact (days)
                </label>
                <Input
                  aria-label="Schedule impact days"
                  type="number"
                  value={scheduleImpactDays}
                  onChange={(e) => setScheduleImpactDays(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Response due
                </label>
                <Input
                  aria-label="Due date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Origin RFI</label>
                <Select
                  aria-label="Origin RFI"
                  value={originRfiId}
                  onChange={(e) => setOriginRfiId(e.target.value)}
                >
                  <option value="">—</option>
                  {projectRfis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number} — {r.subject}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Ball in court
                </label>
                <Select
                  aria-label="Ball in court"
                  value={ballInCourt}
                  onChange={(e) => setBallInCourt(e.target.value as BallInCourt)}
                >
                  {(Object.keys(BALL_IN_COURT_LABELS) as BallInCourt[]).map((b) => (
                    <option key={b} value={b}>
                      {BALL_IN_COURT_LABELS[b]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Description / scope of change
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What changed, where, and why it is outside the bid scope…"
                  className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submitCreate}>Log change</Button>
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <JobScopeSelect value={scope} onChange={setScope} className="w-56" />
          <Select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ChangeOrderStatus | "all")}
            className="w-44"
          >
            <option value="all">All statuses</option>
            {(Object.keys(CHANGE_ORDER_STATUS_LABELS) as ChangeOrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {CHANGE_ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No change orders for this filter.
            </div>
          )}
          {rows.map((c) => {
            const due = daysUntil(c.dueDate);
            const overdue =
              due != null &&
              due < 0 &&
              c.status !== "approved" &&
              c.status !== "void" &&
              c.status !== "rejected";
            const isOpen = expanded === c.id;
            const originRfi = rfis.find((r) => r.id === c.originRfiId);
            const seqs = sequences.filter((s) => c.sequenceIds.includes(s.id));
            return (
              <article
                key={c.id}
                className={cn(
                  "panel overflow-hidden",
                  overdue && "border-[var(--color-danger)]/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-base font-semibold">{c.number}</span>
                      <ChangeOrderTypeBadge type={c.type} />
                      <ChangeOrderStatusBadge status={c.status} />
                      <BallInCourtBadge who={c.ballInCourt} />
                      {scope === "all" && (
                        <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                          {jobLabel(c.projectId)}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 font-medium">{c.title}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                      {c.dueDate && (
                        <span>
                          Due{" "}
                          <span
                            className={cn(
                              "font-mono-num",
                              overdue ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
                            )}
                          >
                            {formatDate(c.dueDate)}
                            {overdue ? " (overdue)" : ""}
                          </span>
                        </span>
                      )}
                      {c.scheduleImpactDays != null && (
                        <span className="font-mono-num">{c.scheduleImpactDays}d schedule</span>
                      )}
                      {c.tonnageDelta != null && (
                        <span className="font-mono-num">
                          {c.tonnageDelta > 0 ? "+" : ""}
                          {c.tonnageDelta} tn
                        </span>
                      )}
                      {originRfi && <span className="font-mono-num">from {originRfi.number}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        "font-mono-num text-lg font-semibold",
                        c.amount < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
                      )}
                    >
                      {money(c.amount)}
                    </div>
                    {seqs.length > 0 && (
                      <div className="mt-1 text-[11px] text-[var(--color-muted)]">
                        {seqs.map((s) => `Seq ${s.number}`).join(", ")}
                      </div>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                    <p className="text-sm leading-relaxed">{c.description}</p>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Status
                        </label>
                        <Select
                          aria-label="Status"
                          value={c.status}
                          onChange={(e) =>
                            setChangeOrderStatus(c.id, e.target.value as ChangeOrderStatus)
                          }
                        >
                          {(Object.keys(CHANGE_ORDER_STATUS_LABELS) as ChangeOrderStatus[]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {CHANGE_ORDER_STATUS_LABELS[s]}
                              </option>
                            ),
                          )}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Amount ($)
                        </label>
                        <Input
                          aria-label="Amount"
                          type="number"
                          value={String(c.amount)}
                          onChange={(e) =>
                            updateChangeOrder(c.id, {
                              amount: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Response due
                        </label>
                        <Input
                          aria-label="Due date"
                          type="date"
                          value={c.dueDate ?? ""}
                          onChange={(e) =>
                            updateChangeOrder(c.id, {
                              dueDate: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Ball in court
                        </label>
                        <Select
                          aria-label="Ball in court"
                          value={c.ballInCourt ?? ""}
                          onChange={(e) =>
                            updateChangeOrder(c.id, {
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
                    </div>

                    {c.notes && (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-muted)]">
                        {c.notes}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          addTask({
                            projectId: c.projectId,
                            title: `Follow up on ${c.number} — ${c.title}`,
                            category: "change_order",
                            priority: "hot",
                            ballInCourt: c.ballInCourt,
                            dueDate: c.dueDate,
                            links: { changeOrderId: c.id },
                          });
                          toast.success("Follow-up task added");
                        }}
                      >
                        Add follow-up task
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteChangeOrder(c.id);
                          toast.success("Change order deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
