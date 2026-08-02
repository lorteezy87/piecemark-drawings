import { buildRfiMailto } from "@/lib/rfi-mailto";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { RfiPriorityBadge, RfiStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DISCIPLINE_LABELS,
  RFI_STATUS_LABELS,
  type Discipline,
  type RfiPriority,
  type RfiStatus,
} from "@/lib/types";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/rfis")({
  component: RfisPage,
});

function RfisPage() {
  const project = useSelectedProject();
  const orgRfiEmail = useAppStore((s) => s.orgRfiEmail);
  const rfis = useAppStore((s) => s.rfis);
  const drawings = useAppStore((s) => s.drawings);
  const updateRfiStatus = useAppStore((s) => s.updateRfiStatus);
  const addRfi = useAppStore((s) => s.addRfi);
  const [statusFilter, setStatusFilter] = useState<RfiStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [raisedBy, setRaisedBy] = useState("Detailer");
  const [priority, setPriority] = useState<RfiPriority>("normal");
  const [discipline, setDiscipline] = useState<Discipline>("structural_steel");
  const [dueDate, setDueDate] = useState("");
  const [selectedDwgs, setSelectedDwgs] = useState<string[]>([]);

  const projectDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.projectId === project?.id)
        .sort((a, b) => a.number.localeCompare(b.number)),
    [drawings, project?.id],
  );

  const rows = useMemo(() => {
    return rfis
      .filter((r) => r.projectId === project?.id)
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => {
        if (a.status === "open" && b.status !== "open") return -1;
        if (b.status === "open" && a.status !== "open") return 1;
        const order = { critical: 0, high: 1, normal: 2, low: 3 };
        return order[a.priority] - order[b.priority];
      });
  }, [rfis, project?.id, statusFilter]);

  function toggleDwg(id: string) {
    setSelectedDwgs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submitRfi() {
    if (!project || !subject.trim() || !question.trim()) {
      toast.error("Subject and question are required");
      return;
    }
    if (selectedDwgs.length === 0) {
      toast.error("Link at least one drawing");
      return;
    }
    const id = addRfi({
      projectId: project.id,
      subject: subject.trim(),
      question: question.trim(),
      raisedBy: raisedBy.trim() || "User",
      priority,
      discipline,
      drawingIds: selectedDwgs,
      dueDate: dueDate || undefined,
    });
    toast.success("RFI created");
    setShowCreate(false);
    setSubject("");
    setQuestion("");
    setSelectedDwgs([]);
    setExpanded(id);
  }

  return (
    <AppShell
      title="RFI Log"
      subtitle={
        project
          ? `${project.jobNumber} · questions holding detailing, fab, or erection`
          : undefined
      }
      actions={
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {showCreate ? "Cancel" : "New RFI"}
        </Button>
      }
    >
      <div className="space-y-4">
        {showCreate && project && (
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="font-medium">Raise new RFI</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Link the sheets (and piece marks) the answer will unlock
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Subject
                </label>
                <Input aria-label="e.g. HSS brace wall thickness at BR-3"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. HSS brace wall thickness at BR-3"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Question
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  placeholder="Describe the conflict and options…"
                  className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Raised by
                </label>
                <Input aria-label="Input field" value={raisedBy} onChange={(e) => setRaisedBy(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Due date
                </label>
                <Input aria-label="Input field"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Priority
                </label>
                <Select aria-label="Select field"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RfiPriority)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Discipline
                </label>
                <Select aria-label="Select field"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as Discipline)}
                >
                  {(Object.keys(DISCIPLINE_LABELS) as Discipline[]).map((d) => (
                    <option key={d} value={d}>
                      {DISCIPLINE_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-[var(--color-muted)]">
                Linked drawings ({selectedDwgs.length} selected)
              </div>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
                {projectDrawings.map((d) => {
                  const on = selectedDwgs.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDwg(d.id)}
                      className={cn(
                        "rounded-[var(--radius-sm)] border px-2 py-1 font-mono-num text-[11px] transition-colors",
                        on
                          ? "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15 text-[var(--color-fg)]"
                          : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]",
                      )}
                    >
                      {d.number}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submitRfi}>Create RFI</Button>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-[var(--color-muted)]">
            RFIs are linked to drawings and piece marks so the shop and field know
            exactly which sheets are blocked — critical for connection holds and
            sequence releases.
          </p>
          <Select aria-label="Select field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RfiStatus | "all")}
            className="w-40"
          >
            <option value="all">All statuses</option>
            {(Object.keys(RFI_STATUS_LABELS) as RfiStatus[]).map((s) => (
              <option key={s} value={s}>
                {RFI_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No RFIs for this filter.
            </div>
          )}
          {rows.map((rfi) => {
            const linked = drawings.filter((d) => rfi.drawingIds.includes(d.id));
            const heldLinked = linked.filter((d) => d.status === "on_hold");
            const due = daysUntil(rfi.dueDate);
            const isOpen = expanded === rfi.id;
            const overdue = rfi.status === "open" && due != null && due < 0;

            return (
              <article
                key={rfi.id}
                className={cn(
                  "panel overflow-hidden",
                  overdue && "border-[var(--color-danger)]/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpanded(isOpen ? null : rfi.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-base font-semibold">
                        {rfi.number}
                      </span>
                      <RfiStatusBadge status={rfi.status} />
                      <RfiPriorityBadge priority={rfi.priority} />
                      <span className="text-[11px] uppercase tracking-wide text-[var(--color-subtle)]">
                        {DISCIPLINE_LABELS[rfi.discipline]}
                      </span>
                    </div>
                    <h2 className="mt-1 font-medium">{rfi.subject}</h2>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">
                      Raised {formatDate(rfi.raisedDate)} by {rfi.raisedBy}
                      {rfi.dueDate && (
                        <>
                          {" "}
                          · Due{" "}
                          <span
                            className={cn(
                              "font-mono-num",
                              overdue
                                ? "text-[var(--color-danger)]"
                                : "text-[var(--color-fg)]",
                            )}
                          >
                            {formatDate(rfi.dueDate)}
                            {overdue && " (overdue)"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {linked.map((d) => (
                      <span
                        key={d.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 font-mono-num text-[11px]"
                      >
                        {d.number}
                      </span>
                    ))}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        Question
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg)]">
                        {rfi.question}
                      </p>
                    </div>
                    {rfi.answer && (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/25 bg-[var(--color-success-bg)] px-4 py-3">
                        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-success)]">
                          Answer
                          {rfi.answeredDate
                            ? ` · ${formatDate(rfi.answeredDate)}`
                            : ""}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed">{rfi.answer}</p>
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        Affected drawings
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {linked.map((d) => (
                          <Link
                            key={d.id}
                            to="/drawings/$drawingId"
                            params={{ drawingId: d.id }}
                            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs hover:border-[var(--color-border-strong)]"
                          >
                            <span className="font-mono-num font-medium">
                              {d.number}
                            </span>
                            <span className="mt-0.5 block max-w-[180px] truncate text-[var(--color-muted)]">
                              {d.title}
                              {d.status === "on_hold" ? " · ON HOLD" : ""}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    {project && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={buildRfiMailto({
                              rfi,
                              project,
                              to: orgRfiEmail || undefined,
                              drawings: linked.map((d) => ({
                                number: d.number,
                                title: d.title,
                              })),
                            })}
                          >
                            <Mail className="size-3.5" />
                            Email RFI
                          </a>
                        </Button>
                      </div>
                    )}
                    {rfi.status === "open" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateRfiStatus(
                              rfi.id,
                              "answered",
                              rfi.answer ??
                                "Answer recorded — update detailing and release holds as required.",
                            );
                            toast.success(`${rfi.number} marked answered`);
                          }}
                        >
                          Mark answered
                        </Button>
                        {heldLinked.length > 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              updateRfiStatus(
                                rfi.id,
                                "answered",
                                rfi.answer ??
                                  "Answer recorded. Linked sheet holds released for fab.",
                                {
                                  releaseLinkedHolds: true,
                                  releaseToStatus: "issued_for_fab",
                                },
                              );
                              toast.success(
                                `${rfi.number} answered · ${heldLinked.length} hold(s) released to fab`,
                              );
                            }}
                          >
                            Answer & release holds
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            updateRfiStatus(rfi.id, "closed");
                            toast.success(`${rfi.number} closed`);
                          }}
                        >
                          Close RFI
                        </Button>
                      </div>
                    )}
                    {rfi.status === "answered" && (
                      <div className="flex flex-wrap gap-2">
                        {heldLinked.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => {
                              updateRfiStatus(rfi.id, "closed", undefined, {
                                releaseLinkedHolds: true,
                                releaseToStatus: "issued_for_fab",
                              });
                              toast.success(
                                `${rfi.number} closed · holds released`,
                              );
                            }}
                          >
                            Close & release holds
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            updateRfiStatus(rfi.id, "closed");
                            toast.success(`${rfi.number} closed`);
                          }}
                        >
                          Close RFI
                        </Button>
                      </div>
                    )}
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
