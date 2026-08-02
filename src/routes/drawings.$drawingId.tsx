import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  CircleDot,
  FileImage,
  Hand,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import {
  DrawingStatusBadge,
  RfiPriorityBadge,
  RfiStatusBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  DISCIPLINE_LABELS,
  DRAWING_STATUS_LABELS,
  DRAWING_TYPE_LABELS,
  MARKUP_TYPE_LABELS,
  nextRevision,
  type DrawingStatus,
  type MarkupType,
} from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn, formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/drawings/$drawingId")({
  component: DrawingDetailPage,
});

function DrawingDetailPage() {
  const { drawingId } = Route.useParams();
  const navigate = useNavigate();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const projects = useAppStore((s) => s.projects);
  const sequences = useAppStore((s) => s.sequences);
  const revisions = useAppStore((s) => s.revisions);
  const rfis = useAppStore((s) => s.rfis);
  const submittals = useAppStore((s) => s.submittals);
  const markups = useAppStore((s) => s.markups);
  const updateDrawingStatus = useAppStore((s) => s.updateDrawingStatus);
  const issueRevision = useAppStore((s) => s.issueRevision);
  const placeHold = useAppStore((s) => s.placeHold);
  const releaseHold = useAppStore((s) => s.releaseHold);
  const addMarkup = useAppStore((s) => s.addMarkup);
  const resolveMarkup = useAppStore((s) => s.resolveMarkup);

  const drawing = drawings.find((d) => d.id === drawingId);
  const parentSet = drawingSets.find((s) => s.id === drawing?.setId);
  const project = projects.find((p) => p.id === drawing?.projectId);
  const sequence = sequences.find((s) => s.id === drawing?.sequenceId);
  const dwgRevs = useMemo(
    () =>
      revisions
        .filter((r) => r.drawingId === drawingId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [revisions, drawingId],
  );
  const dwgRfis = rfis.filter((r) => r.drawingIds.includes(drawingId));
  const dwgSubs = submittals.filter((s) => s.drawingIds.includes(drawingId));
  const dwgMarkups = markups
    .filter((m) => m.drawingId === drawingId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const [status, setStatus] = useState<DrawingStatus | "">(drawing?.status ?? "");
  const [markupText, setMarkupText] = useState("");
  const [markupType, setMarkupType] = useState<MarkupType>("field_note");
  const [author, setAuthor] = useState("Shop / Field");
  const [revDesc, setRevDesc] = useState("");
  const [revStatus, setRevStatus] = useState<DrawingStatus>("issued_for_fab");
  const [revBy, setRevBy] = useState("Project Manager");
  const [holdReasonInput, setHoldReasonInput] = useState("");

  if (!drawing || !project) {
    return (
      <AppShell title="Drawing not found">
        <div className="panel p-8 text-center">
          <p className="text-[var(--color-muted)]">This sheet is not in the register.</p>
          <Button className="mt-4" asChild variant="secondary">
            <Link to="/drawings">Back to register</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  function applyStatus() {
    if (!status || !drawing) return;
    updateDrawingStatus(drawing.id, status);
    toast.success(`Status set to ${DRAWING_STATUS_LABELS[status]}`);
  }

  function submitMarkup() {
    if (!drawing || !markupText.trim()) return;
    addMarkup({
      drawingId: drawing.id,
      rev: drawing.currentRev,
      author: author.trim() || "User",
      date: new Date().toISOString().slice(0, 10),
      type: markupType,
      text: markupText.trim(),
      resolved: false,
    });
    setMarkupText("");
    toast.success("Markup recorded on current revision");
  }

  function submitRevision() {
    if (!drawing || !revDesc.trim()) {
      toast.error("Describe the revision change");
      return;
    }
    const next = nextRevision(drawing.currentRev);
    issueRevision(drawing.id, revDesc.trim(), revStatus, revBy.trim() || "User");
    setRevDesc("");
    setStatus(revStatus);
    toast.success(`Issued Rev ${next}`);
  }

  return (
    <AppShell
      title={`${drawing.number} · Rev ${drawing.currentRev}`}
      subtitle={drawing.title}
      actions={
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
            <Link
              to="/viewer"
              search={{ mode: "sheet", drawingId: drawing.id }}
            >
              <FileImage className="size-3.5" />
              Sheet
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
            <Link
              to="/viewer"
              search={{ mode: "ifc", drawingId: drawing.id }}
            >
              <Box className="size-3.5" />
              IFC
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/drawings" })}>
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Register</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-num text-2xl font-semibold tracking-tight">
                  {drawing.number}
                </span>
                <DrawingStatusBadge status={drawing.status} />
              </div>
              <h2 className="mt-1 text-lg text-[var(--color-fg)]">{drawing.title}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {project.jobNumber} · {project.name.split("—")[0].trim()}
              </p>
              {parentSet && (
                <Link
                  to="/drawings/sets/$setId"
                  params={{ setId: parentSet.id }}
                  className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-xs hover:border-[var(--color-border-strong)]"
                >
                  <span className="text-[var(--color-subtle)]">Drawing set</span>
                  <span className="font-mono-num font-medium text-[var(--color-fg)]">
                    {parentSet.code}
                  </span>
                  <span className="text-[var(--color-muted)]">{parentSet.name}</span>
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-right">
              <Meta label="Type" value={DRAWING_TYPE_LABELS[drawing.type]} />
              <Meta label="Discipline" value={DISCIPLINE_LABELS[drawing.discipline]} />
              <Meta label="Sheet" value={`${drawing.sheetSize} · ${drawing.pages} pg`} />
              <Meta label="Tonnage" value={formatTons(drawing.tonnage)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link
                to="/viewer"
                search={{ mode: "sheet", drawingId: drawing.id }}
              >
                <FileImage className="size-3.5" />
                Open sheet viewer
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link
                to="/viewer"
                search={{ mode: "ifc", drawingId: drawing.id, mark: drawing.pieceMarks[0] }}
              >
                <Box className="size-3.5" />
                View in IFC model
              </Link>
            </Button>
          </div>

          {drawing.status === "on_hold" && drawing.holdReason && (
            <div className="mt-4 flex gap-2 rounded-[var(--radius-lg)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-4 py-3 text-sm text-[var(--color-warn)]">
              <Hand className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-medium">Fab / field hold</div>
                <div className="mt-0.5 opacity-90">{drawing.holdReason}</div>
              </div>
            </div>
          )}

          {drawing.notes && (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-fg)]">Notes: </span>
              {drawing.notes}
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaCard label="Detailer" value={drawing.detailer ?? "—"} />
            <MetaCard label="Checker" value={drawing.checker ?? "—"} />
            <MetaCard
              label="Sequence"
              value={sequence ? `Seq ${sequence.number} · ${sequence.area}` : "Unassigned"}
            />
            <MetaCard label="Area / grids" value={drawing.area ?? sequence?.grids ?? "—"} />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                Piece marks on this sheet
              </div>
              <Link
                to="/pieces"
                className="text-[11px] text-[var(--color-accent)] hover:underline"
              >
                Open piece index
              </Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {drawing.pieceMarks.length === 0 && (
                <span className="text-sm text-[var(--color-muted)]">No piece marks</span>
              )}
              {drawing.pieceMarks.map((pm) => (
                <Link
                  key={pm}
                  to="/pieces"
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1 font-mono-num text-xs hover:border-[var(--color-border-strong)]"
                >
                  {pm}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <section className="panel overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-5 py-3">
                <h3 className="font-medium">Revision history</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Current working revision:{" "}
                  <span className="font-mono-num text-[var(--color-fg)]">
                    {drawing.currentRev}
                  </span>
                  {" · "}
                  Next would be{" "}
                  <span className="font-mono-num">
                    {nextRevision(drawing.currentRev)}
                  </span>
                </p>
              </div>
              {dwgRevs.length === 0 ? (
                <div className="px-5 py-8 text-sm text-[var(--color-muted)]">
                  No revision trail recorded yet. Current rev is the initial issue.
                </div>
              ) : (
                <ol className="divide-y divide-[var(--color-border)]/70">
                  {dwgRevs.map((rev, i) => (
                    <li key={rev.id} className="flex gap-3 px-5 py-3.5">
                      <div className="mt-0.5">
                        {i === 0 ? (
                          <CircleDot className="size-4 text-[var(--color-success)]" />
                        ) : (
                          <div className="mx-auto mt-1 size-2 rounded-full bg-[var(--color-border-strong)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-num font-medium">Rev {rev.rev}</span>
                          <DrawingStatusBadge status={rev.status} />
                          <span className="text-xs text-[var(--color-subtle)]">
                            {formatDate(rev.date)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                          {rev.description}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-subtle)]">
                          Issued by {rev.issuedBy}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-5 py-3">
                <h3 className="font-medium">Markups & field notes</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  Redlines, holds, coordination, and as-builts tied to a rev
                </p>
              </div>
              <div className="space-y-3 border-b border-[var(--color-border)] px-5 py-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select aria-label="Select field"
                    value={markupType}
                    onChange={(e) => setMarkupType(e.target.value as MarkupType)}
                  >
                    {(Object.keys(MARKUP_TYPE_LABELS) as MarkupType[]).map((t) => (
                      <option key={t} value={t}>
                        {MARKUP_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Author"
                  />
                  <Button onClick={submitMarkup} className="sm:w-full">
                    <StickyNote className="size-3.5" />
                    Add note
                  </Button>
                </div>
                <textarea
                  value={markupText}
                  onChange={(e) => setMarkupText(e.target.value)}
                  rows={2}
                  placeholder="Describe the markup, hold, or field condition…"
                  className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </div>
              <ul className="divide-y divide-[var(--color-border)]/70">
                {dwgMarkups.length === 0 && (
                  <li className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
                    No markups on this sheet yet.
                  </li>
                )}
                {dwgMarkups.map((m) => (
                  <li
                    key={m.id}
                    className={cn("px-5 py-3.5", m.resolved && "opacity-60")}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 uppercase tracking-wide text-[var(--color-muted)]">
                        {MARKUP_TYPE_LABELS[m.type]}
                      </span>
                      <span className="font-mono-num text-[var(--color-subtle)]">
                        Rev {m.rev}
                      </span>
                      <span className="text-[var(--color-subtle)]">
                        {formatDate(m.date)} · {m.author}
                      </span>
                      {m.resolved && (
                        <span className="inline-flex items-center gap-1 text-[var(--color-success)]">
                          <CheckCircle2 className="size-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm">{m.text}</p>
                    {!m.resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => {
                          resolveMarkup(m.id);
                          toast.success("Markup marked resolved");
                        }}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <section className="panel p-5">
              <h3 className="font-medium">Issue new revision</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Bumps rev letter, logs history, and sets release status (shop practice)
              </p>
              <div className="mt-3 space-y-2">
                <Input aria-label="What changed on this rev?"
                  value={revDesc}
                  onChange={(e) => setRevDesc(e.target.value)}
                  placeholder="What changed on this rev?"
                />
                <Select aria-label="Select field"
                  value={revStatus}
                  onChange={(e) => setRevStatus(e.target.value as DrawingStatus)}
                >
                  {(
                    [
                      "submitted",
                      "aan",
                      "approved",
                      "revise_resubmit",
                      "issued_for_fab",
                      "issued_for_erection",
                      "on_hold",
                    ] as DrawingStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {DRAWING_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Input aria-label="Issued by"
                  value={revBy}
                  onChange={(e) => setRevBy(e.target.value)}
                  placeholder="Issued by"
                />
                <Button className="w-full" onClick={submitRevision}>
                  Issue Rev {nextRevision(drawing.currentRev)}
                </Button>
              </div>
            </section>


            <section className="panel p-5">
              <h3 className="font-medium">Fab / field hold</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Stops cut list and field work until released
              </p>
              {drawing.status === "on_hold" ? (
                <div className="mt-3 space-y-2">
                  {drawing.holdReason && (
                    <p className="rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-3 py-2 text-sm text-[var(--color-warn)]">
                      {drawing.holdReason}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => {
                      releaseHold(drawing.id, "issued_for_fab");
                      setStatus("issued_for_fab");
                      toast.success(`${drawing.number} released to fab`);
                    }}
                  >
                    Release to fab
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => {
                      releaseHold(drawing.id, "issued_for_erection");
                      setStatus("issued_for_erection");
                      toast.success(`${drawing.number} released to field`);
                    }}
                  >
                    Release to field
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <Input aria-label="Hold reason (RFI, coordination…)"
                    value={holdReasonInput}
                    onChange={(e) => setHoldReasonInput(e.target.value)}
                    placeholder="Hold reason (RFI, coordination…)"
                  />
                  <Button
                    className="w-full"
                    variant="danger"
                    onClick={() => {
                      if (!holdReasonInput.trim()) {
                        toast.error("Enter a hold reason");
                        return;
                      }
                      placeHold(drawing.id, holdReasonInput.trim());
                      setStatus("on_hold");
                      setHoldReasonInput("");
                      toast.success(`Hold placed on ${drawing.number}`);
                    }}
                  >
                    Place hold
                  </Button>
                </div>
              )}
            </section>

            <section className="panel p-5">
              <h3 className="font-medium">Update status</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Status only — no rev change
              </p>
              <div className="mt-3 space-y-2">
                <Select aria-label="Select field"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DrawingStatus)}
                >
                  {(Object.keys(DRAWING_STATUS_LABELS) as DrawingStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {DRAWING_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Button className="w-full" variant="secondary" onClick={applyStatus}>
                  Apply status
                </Button>
              </div>
              <dl className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm">
                <Row label="Submitted" value={formatDate(drawing.submittedDate)} />
                <Row label="Approved" value={formatDate(drawing.approvedDate)} />
                <Row label="Issued" value={formatDate(drawing.issuedDate)} />
              </dl>
            </section>

            <section className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
                <MessageSquare className="size-4 text-[var(--color-muted)]" />
                <h3 className="font-medium">Linked RFIs</h3>
              </div>
              {dwgRfis.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[var(--color-muted)]">
                  No RFIs reference this drawing.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]/70">
                  {dwgRfis.map((r) => (
                    <li key={r.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/rfis"
                          className="font-mono-num font-medium hover:underline"
                        >
                          {r.number}
                        </Link>
                        <RfiStatusBadge status={r.status} />
                        <RfiPriorityBadge priority={r.priority} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{r.subject}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-5 py-3">
                <h3 className="font-medium">Submittal packages</h3>
              </div>
              {dwgSubs.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[var(--color-muted)]">
                  Not included in a package yet.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]/70">
                  {dwgSubs.map((s) => (
                    <li key={s.id} className="px-5 py-3">
                      <div className="font-mono-num font-medium">{s.number}</div>
                      <div className="mt-0.5 text-sm text-[var(--color-muted)]">{s.title}</div>
                      <div className="mt-1 text-xs text-[var(--color-subtle)]">
                        {formatDate(s.submittedDate)}
                        {s.returnedDate ? ` → returned ${formatDate(s.returnedDate)}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className="text-[var(--color-fg)]">{value}</div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="font-mono-num text-[var(--color-fg)]">{value}</dd>
    </div>
  );
}
