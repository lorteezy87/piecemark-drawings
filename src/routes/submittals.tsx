import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { SubmittalStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  SUBMITTAL_STATUS_LABELS,
  SUBMITTAL_TYPE_LABELS,
  type SubmittalPackageType,
  type SubmittalStatus,
} from "@/lib/types";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { cn, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/submittals")({
  component: SubmittalsPage,
});

function SubmittalsPage() {
  const project = useSelectedProject();
  const submittals = useAppStore((s) => s.submittals);
  const drawings = useAppStore((s) => s.drawings);
  const createSubmittal = useAppStore((s) => s.createSubmittal);
  const updateSubmittalStatus = useAppStore((s) => s.updateSubmittalStatus);

  const [statusFilter, setStatusFilter] = useState<SubmittalStatus | "all">(
    "all",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [packageType, setPackageType] =
    useState<SubmittalPackageType>("shop_drawings");
  const [reviewer, setReviewer] = useState(project?.engineer ?? "");
  const [notes, setNotes] = useState("");
  const [selectedDwgs, setSelectedDwgs] = useState<string[]>([]);

  const projectDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.projectId === project?.id)
        .sort((a, b) => a.number.localeCompare(b.number)),
    [drawings, project?.id],
  );

  const rows = useMemo(() => {
    return submittals
      .filter((s) => s.projectId === project?.id)
      .filter((s) => statusFilter === "all" || s.status === statusFilter)
      .sort((a, b) =>
        (b.submittedDate ?? "").localeCompare(a.submittedDate ?? ""),
      );
  }, [submittals, project?.id, statusFilter]);

  const openCount = submittals.filter(
    (s) =>
      s.projectId === project?.id &&
      ["submitted", "under_review", "resubmit", "draft"].includes(s.status),
  ).length;

  function toggleDwg(id: string) {
    setSelectedDwgs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit() {
    if (!project || !title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selectedDwgs.length === 0) {
      toast.error("Select at least one sheet");
      return;
    }
    const setIds = [
      ...new Set(
        drawings
          .filter((d) => selectedDwgs.includes(d.id))
          .map((d) => d.setId),
      ),
    ];
    createSubmittal({
      projectId: project.id,
      title: title.trim(),
      packageType,
      drawingIds: selectedDwgs,
      setIds,
      reviewer: reviewer.trim() || project.engineer,
      notes: notes.trim() || undefined,
      submitNow: true,
    });
    toast.success("Submittal package submitted");
    setShowCreate(false);
    setTitle("");
    setSelectedDwgs([]);
    setNotes("");
  }

  return (
    <AppShell
      title="Submittal Log"
      subtitle={
        project
          ? `${project.jobNumber} · packages to ${project.engineer}`
          : undefined
      }
      actions={
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {showCreate ? "Cancel" : "New package"}
        </Button>
      }
    >
      <div className="space-y-4">
        {showCreate && project && (
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="font-medium">Build submittal package</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Shop drawings, erection, AB, or resubmittal — as the EOR reviews
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Title
                </label>
                <Input aria-label="Shop Drawings — Levels 3–4"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Shop Drawings — Levels 3–4"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Package type
                </label>
                <Select aria-label="Select field"
                  value={packageType}
                  onChange={(e) =>
                    setPackageType(e.target.value as SubmittalPackageType)
                  }
                >
                  {(
                    Object.keys(SUBMITTAL_TYPE_LABELS) as SubmittalPackageType[]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {SUBMITTAL_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Reviewer
                </label>
                <Input aria-label="Input field"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder={project.engineer}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Notes
                </label>
                <Input aria-label="Partial package, AAN carry-over…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Partial package, AAN carry-over…"
                />
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-[var(--color-muted)]">
                Sheets in package ({selectedDwgs.length})
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
                        "rounded-[var(--radius-sm)] border px-2 py-1 font-mono-num text-[11px]",
                        on
                          ? "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/15"
                          : "border-[var(--color-border)] text-[var(--color-muted)]",
                      )}
                    >
                      {d.number}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={submit}>Submit package</Button>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-2xl text-sm text-[var(--color-muted)]">
            Track shop drawing packages, erection sets, and resubmittals the way
            the GC and EOR actually review them — not as a generic document list.
          </p>
          <div className="flex items-center gap-3">
            <div className="text-xs text-[var(--color-muted)]">
              <span className="font-mono-num text-[var(--color-warn)]">
                {openCount}
              </span>{" "}
              open packages
            </div>
            <Select aria-label="Select field"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as SubmittalStatus | "all")
              }
              className="w-44"
            >
              <option value="all">All statuses</option>
              {(Object.keys(SUBMITTAL_STATUS_LABELS) as SubmittalStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {SUBMITTAL_STATUS_LABELS[s]}
                  </option>
                ),
              )}
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No submittals match this filter.
            </div>
          )}
          {rows.map((sub) => {
            const sheets = drawings.filter((d) =>
              sub.drawingIds.includes(d.id),
            );
            return (
              <article key={sub.id} className="panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num text-lg font-semibold">
                        {sub.number}
                      </span>
                      <SubmittalStatusBadge status={sub.status} />
                      <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
                        {SUBMITTAL_TYPE_LABELS[sub.packageType]}
                      </span>
                    </div>
                    <h2 className="mt-1 font-medium">{sub.title}</h2>
                    <div className="mt-1 text-xs text-[var(--color-muted)]">
                      Reviewer: {sub.reviewer ?? "—"} · Submitted{" "}
                      {formatDate(sub.submittedDate)}
                      {sub.returnedDate
                        ? ` · Returned ${formatDate(sub.returnedDate)}`
                        : ""}
                    </div>
                  </div>
                  <div className="font-mono-num text-sm text-[var(--color-subtle)]">
                    {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
                  </div>
                </div>

                {sub.notes && (
                  <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-muted)]">
                    {sub.notes}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {sheets.map((d) => (
                    <Link
                      key={d.id}
                      to="/drawings/$drawingId"
                      params={{ drawingId: d.id }}
                      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-xs hover:border-[var(--color-border-strong)]"
                    >
                      <span className="font-mono-num font-medium">
                        {d.number}
                      </span>
                      <span className="text-[var(--color-subtle)]">
                        Rev {d.currentRev}
                      </span>
                    </Link>
                  ))}
                </div>

                {(sub.status === "submitted" ||
                  sub.status === "under_review" ||
                  sub.status === "draft") && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
                    {sub.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          updateSubmittalStatus(sub.id, "submitted");
                          toast.success(`${sub.number} submitted`);
                        }}
                      >
                        Submit
                      </Button>
                    )}
                    {(sub.status === "submitted" ||
                      sub.status === "under_review") && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            updateSubmittalStatus(sub.id, "approved");
                            toast.success(`${sub.number} approved`);
                          }}
                        >
                          Approved
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            updateSubmittalStatus(sub.id, "aan");
                            toast.success(`${sub.number} AAN`);
                          }}
                        >
                          AAN
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            updateSubmittalStatus(
                              sub.id,
                              "resubmit",
                              "Returned for revise & resubmit",
                            );
                            toast.success(`${sub.number} returned R&R`);
                          }}
                        >
                          Revise & resubmit
                        </Button>
                      </>
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
