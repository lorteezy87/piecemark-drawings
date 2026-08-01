import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  FileStack,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import {
  DrawingStatusBadge,
  RfiPriorityBadge,
  RfiStatusBadge,
  SubmittalStatusBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  DISCIPLINE_LABELS,
  DRAWING_STATUS_LABELS,
  DRAWING_TYPE_LABELS,
  type DrawingStatus,
} from "@/lib/types";
import {
  rolledSetStatus,
  sheetsForSet,
  useAppStore,
} from "@/lib/store";
import { cn, formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/drawings/sets/$setId")({
  component: DrawingSetDetailPage,
});

function DrawingSetDetailPage() {
  const { setId } = Route.useParams();
  const navigate = useNavigate();
  const drawingSets = useAppStore((s) => s.drawingSets);
  const drawings = useAppStore((s) => s.drawings);
  const projects = useAppStore((s) => s.projects);
  const sequences = useAppStore((s) => s.sequences);
  const rfis = useAppStore((s) => s.rfis);
  const submittals = useAppStore((s) => s.submittals);
  const updateSetStatus = useAppStore((s) => s.updateSetStatus);

  const set = drawingSets.find((s) => s.id === setId);
  const project = projects.find((p) => p.id === set?.projectId);
  const sequence = sequences.find((s) => s.id === set?.sequenceId);
  const sheets = useMemo(
    () => (set ? sheetsForSet(drawings, set.id) : []),
    [drawings, set],
  );
  const effective = set ? rolledSetStatus(sheets, set.status) : "draft";
  const linkedRfis = rfis.filter((r) =>
    r.drawingIds.some((id) => sheets.some((s) => s.id === id)),
  );
  const linkedSubs = submittals.filter(
    (s) =>
      s.setIds?.includes(setId) ||
      s.drawingIds.some((id) => sheets.some((sh) => sh.id === id)),
  );

  const [status, setStatus] = useState<DrawingStatus | "">(set?.status ?? "");

  if (!set || !project) {
    return (
      <AppShell title="Drawing set not found">
        <div className="panel p-8 text-center">
          <p className="text-[var(--color-muted)]">This set is not in the register.</p>
          <Button className="mt-4" asChild variant="secondary">
            <Link to="/drawings">Back to register</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const tons = sheets.reduce((sum, d) => sum + (d.tonnage ?? 0), 0);
  const holds = sheets.filter((d) => d.status === "on_hold");

  return (
    <AppShell
      title={`${set.code} · ${set.name}`}
      subtitle={`${project.jobNumber} · ${sheets.length} sheets · set rev ${set.currentRev}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/drawings" })}>
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Register</span>
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-num text-xl font-semibold tracking-tight sm:text-2xl">
                  {set.code}
                </span>
                <DrawingStatusBadge status={effective} />
                {set.status !== effective && (
                  <span className="text-xs text-[var(--color-muted)]">
                    Set record: {DRAWING_STATUS_LABELS[set.status]} · sheets roll up to{" "}
                    {DRAWING_STATUS_LABELS[effective]}
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-medium">{set.name}</h2>
              {set.description && (
                <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                  {set.description}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-right">
              <Meta label="Type" value={DRAWING_TYPE_LABELS[set.type]} />
              <Meta label="Discipline" value={DISCIPLINE_LABELS[set.discipline]} />
              <Meta
                label="Sequence"
                value={sequence ? `Seq ${sequence.number} · ${sequence.area}` : "—"}
              />
              <Meta label="Tonnage (sheets)" value={formatTons(tons || undefined)} />
            </div>
          </div>

          {holds.length > 0 && (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-4 py-3 text-sm text-[var(--color-warn)]">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" />
                {holds.length} sheet{holds.length === 1 ? "" : "s"} on hold in this set
              </div>
              <ul className="mt-2 space-y-1 text-[var(--color-warn)]/90">
                {holds.map((h) => (
                  <li key={h.id}>
                    <Link
                      to="/drawings/$drawingId"
                      params={{ drawingId: h.id }}
                      className="font-mono-num underline-offset-2 hover:underline"
                    >
                      {h.number}
                    </Link>
                    {h.holdReason ? ` — ${h.holdReason}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {set.notes && (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-fg)]">Set notes: </span>
              {set.notes}
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaCard label="Detailer" value={set.detailer ?? "—"} />
            <MetaCard label="Checker" value={set.checker ?? "—"} />
            <MetaCard label="Submitted" value={formatDate(set.submittedDate)} />
            <MetaCard label="Issued" value={formatDate(set.issuedDate)} />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <section className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
                <FileStack className="size-4 text-[var(--color-muted)]" />
                <div>
                  <h3 className="font-medium">Sheets in this set</h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Child drawings tracked under {set.code}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                      <th className="px-5 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">Sheet</th>
                      <th className="px-3 py-2.5 font-medium">Title</th>
                      <th className="px-3 py-2.5 font-medium">Rev</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Pieces</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          "border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40",
                          d.status === "on_hold" && "bg-[var(--color-warn-bg)]/30",
                        )}
                      >
                        <td className="px-5 py-2.5 font-mono-num text-xs text-[var(--color-subtle)]">
                          {d.sheetIndex}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            to="/drawings/$drawingId"
                            params={{ drawingId: d.id }}
                            className="font-mono-num font-medium hover:underline"
                          >
                            {d.number}
                          </Link>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-[var(--color-muted)]">
                          {d.title}
                        </td>
                        <td className="px-3 py-2.5 font-mono-num">{d.currentRev}</td>
                        <td className="px-3 py-2.5">
                          <DrawingStatusBadge status={d.status} />
                        </td>
                        <td className="px-3 py-2.5 font-mono-num text-xs text-[var(--color-muted)]">
                          {d.pieceMarks.slice(0, 4).join(", ") || "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <Link
                            to="/drawings/$drawingId"
                            params={{ drawingId: d.id }}
                            className="inline-flex size-8 items-center justify-center text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <section className="panel p-5">
              <h3 className="font-medium">Update set status</h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Package-level status for the named set (sheets keep their own status)
              </p>
              <div className="mt-3 space-y-2">
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DrawingStatus)}
                >
                  {(Object.keys(DRAWING_STATUS_LABELS) as DrawingStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {DRAWING_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!status) return;
                    updateSetStatus(set.id, status);
                    toast.success(`Set status → ${DRAWING_STATUS_LABELS[status]}`);
                  }}
                >
                  Apply set status
                </Button>
              </div>
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-[var(--color-border)] px-5 py-3">
                <h3 className="font-medium">Linked RFIs</h3>
              </div>
              {linkedRfis.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[var(--color-muted)]">
                  No RFIs on sheets in this set.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]/70">
                  {linkedRfis.map((r) => (
                    <li key={r.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to="/rfis" className="font-mono-num font-medium hover:underline">
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
              {linkedSubs.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[var(--color-muted)]">
                  Not in a submittal package yet.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]/70">
                  {linkedSubs.map((s) => (
                    <li key={s.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-num font-medium">{s.number}</span>
                        <SubmittalStatusBadge status={s.status} />
                      </div>
                      <div className="mt-0.5 text-sm text-[var(--color-muted)]">{s.title}</div>
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
