import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import {
  DrawingStatusBadge,
  RfiPriorityBadge,
  RfiStatusBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/holds")({
  component: HoldsBoardPage,
});

function HoldsBoardPage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const rfis = useAppStore((s) => s.rfis);
  const markups = useAppStore((s) => s.markups);
  const sequences = useAppStore((s) => s.sequences);
  const releaseHold = useAppStore((s) => s.releaseHold);
  const resolveMarkup = useAppStore((s) => s.resolveMarkup);

  const heldSheets = useMemo(
    () =>
      drawings.filter(
        (d) =>
          d.projectId === project?.id &&
          (d.status === "on_hold" || d.status === "revise_resubmit"),
      ),
    [drawings, project?.id],
  );

  const openRfis = useMemo(
    () =>
      rfis
        .filter((r) => r.projectId === project?.id && r.status === "open")
        .sort((a, b) => {
          const order = { critical: 0, high: 1, normal: 2, low: 3 };
          return order[a.priority] - order[b.priority];
        }),
    [rfis, project?.id],
  );

  const openHoldsMarkups = useMemo(
    () =>
      markups.filter(
        (m) =>
          !m.resolved &&
          m.type === "hold" &&
          drawings.some(
            (d) => d.id === m.drawingId && d.projectId === project?.id,
          ),
      ),
    [markups, drawings, project?.id],
  );

  return (
    <AppShell
      title="Holds & Blockers"
      subtitle={
        project
          ? `${project.jobNumber} · what is stopping fab or erection`
          : undefined
      }
    >
      <div className="space-y-5">
        <p className="max-w-3xl text-sm text-[var(--color-muted)]">
          Single board for sheet holds, R&R, open RFIs, and unresolved hold
          markups — the daily stand-up view for detailers, PMs, and shop leads.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Summary
            label="Sheets held / R&R"
            value={heldSheets.length}
            tone="warn"
          />
          <Summary label="Open RFIs" value={openRfis.length} tone="danger" />
          <Summary
            label="Open hold markups"
            value={openHoldsMarkups.length}
            tone="warn"
          />
        </div>

        <section className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
            <OctagonAlert className="size-4 text-[var(--color-warn)]" />
            <h2 className="font-medium">Sheet holds & revise-and-resubmit</h2>
          </div>
          {heldSheets.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
              No sheets on hold or R&R for this job.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/70">
              {heldSheets.map((d) => {
                const set = drawingSets.find((s) => s.id === d.setId);
                const seq = sequences.find((s) => s.id === d.sequenceId);
                const linked = openRfis.filter((r) =>
                  r.drawingIds.includes(d.id),
                );
                return (
                  <li key={d.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/drawings/$drawingId"
                            params={{ drawingId: d.id }}
                            className="font-mono-num text-base font-semibold hover:underline"
                          >
                            {d.number}
                          </Link>
                          <DrawingStatusBadge status={d.status} />
                          {set && (
                            <Link
                              to="/drawings/sets/$setId"
                              params={{ setId: set.id }}
                              className="font-mono-num text-xs text-[var(--color-muted)] hover:underline"
                            >
                              {set.code}
                            </Link>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-[var(--color-muted)]">
                          {d.title}
                          {seq ? ` · Seq ${seq.number}` : ""}
                        </div>
                        {(d.holdReason || d.notes) && (
                          <div className="mt-2 flex gap-1.5 text-sm text-[var(--color-warn)]">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                            <span>{d.holdReason || d.notes}</span>
                          </div>
                        )}
                        {d.pieceMarks.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {d.pieceMarks.map((pm) => (
                              <span
                                key={pm}
                                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 font-mono-num text-[11px]"
                              >
                                {pm}
                              </span>
                            ))}
                          </div>
                        )}
                        {linked.length > 0 && (
                          <div className="mt-2 text-xs text-[var(--color-muted)]">
                            Blocking RFI
                            {linked.length > 1 ? "s" : ""}:{" "}
                            {linked.map((r) => r.number).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.status === "on_hold" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                releaseHold(d.id, "issued_for_fab");
                                toast.success(
                                  `${d.number} released for fabrication`,
                                );
                              }}
                            >
                              Release to fab
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                releaseHold(d.id, "issued_for_erection");
                                toast.success(
                                  `${d.number} released for erection (IFC)`,
                                );
                              }}
                            >
                              Release to field
                            </Button>
                          </>
                        )}
                        {d.status === "revise_resubmit" && (
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to="/drawings/$drawingId"
                              params={{ drawingId: d.id }}
                            >
                              Issue revision
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {openHoldsMarkups.length > 0 && (
          <section className="panel overflow-hidden">
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <h2 className="font-medium">Unresolved hold markups</h2>
            </div>
            <ul className="divide-y divide-[var(--color-border)]/70">
              {openHoldsMarkups.map((m) => {
                const d = drawings.find((x) => x.id === m.drawingId);
                return (
                  <li
                    key={m.id}
                    className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {d && (
                          <Link
                            to="/drawings/$drawingId"
                            params={{ drawingId: d.id }}
                            className="font-mono-num font-medium hover:underline"
                          >
                            {d.number}
                          </Link>
                        )}
                        <span className="text-[var(--color-subtle)]">
                          Rev {m.rev} · {formatDate(m.date)} · {m.author}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{m.text}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        resolveMarkup(m.id);
                        toast.success("Hold markup resolved");
                      }}
                    >
                      Resolve
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
            <h2 className="font-medium">Open RFIs (blocking questions)</h2>
            <Link
              to="/rfis"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Full RFI log
            </Link>
          </div>
          {openRfis.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
              No open RFIs.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/70">
              {openRfis.map((r) => (
                <li key={r.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num font-semibold">{r.number}</span>
                    <RfiPriorityBadge priority={r.priority} />
                    <RfiStatusBadge status={r.status} />
                    <span className="text-xs text-[var(--color-subtle)]">
                      Due {formatDate(r.dueDate)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">{r.subject}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.drawingIds.map((id) => {
                      const d = drawings.find((x) => x.id === id);
                      if (!d) return null;
                      return (
                        <Link
                          key={id}
                          to="/drawings/$drawingId"
                          params={{ drawingId: id }}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-0.5 font-mono-num text-[11px] hover:border-[var(--color-border-strong)]"
                        >
                          {d.number}
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warn" | "danger";
}) {
  const color =
    tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-warn)]";
  return (
    <div className="panel p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className={`mt-1 font-mono-num text-2xl font-semibold ${color}`}>
        {value}
      </div>
    </div>
  );
}
