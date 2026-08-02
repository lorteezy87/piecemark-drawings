import { createFileRoute, Link } from "@tanstack/react-router";
import { Factory, Send } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import {
  DrawingStatusBadge,
  TransmittalStatusBadge,
} from "@/components/status-badges";
import { SHOP_QUEUE_STATUSES } from "@/lib/types";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/shop")({
  component: ShopPackagePage,
});

/**
 * Shop fab queue — sheets the fab shop should cut/fit today, partial releases,
 * and pieces excluded by holds.
 */
function ShopPackagePage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const sequences = useAppStore((s) => s.sequences);
  const transmittals = useAppStore((s) => s.transmittals);

  const queue = useMemo(() => {
    return drawings
      .filter(
        (d) =>
          d.projectId === project?.id && SHOP_QUEUE_STATUSES.includes(d.status),
      )
      .sort((a, b) => a.number.localeCompare(b.number));
  }, [drawings, project?.id]);

  const blocked = useMemo(() => {
    return drawings
      .filter(
        (d) =>
          d.projectId === project?.id &&
          (d.status === "on_hold" || d.status === "revise_resubmit"),
      )
      .sort((a, b) => a.number.localeCompare(b.number));
  }, [drawings, project?.id]);

  const shopTransmittals = useMemo(() => {
    return transmittals
      .filter(
        (t) =>
          t.projectId === project?.id &&
          t.kind === "to_shop" &&
          t.status !== "draft",
      )
      .sort((a, b) =>
        (b.issuedDate ?? "").localeCompare(a.issuedDate ?? ""),
      );
  }, [transmittals, project?.id]);

  const bySequence = useMemo(() => {
    const map = new Map<string, { label: string; sheets: typeof queue }>();
    for (const d of queue) {
      const seq = sequences.find((s) => s.id === d.sequenceId);
      const key = seq?.id ?? "unassigned";
      const label = seq
        ? `Seq ${seq.number} — ${seq.area}`
        : "Unassigned sequence";
      if (!map.has(key)) map.set(key, { label, sheets: [] });
      map.get(key)!.sheets.push(d);
    }
    return [...map.entries()];
  }, [queue, sequences]);

  const tonnage = queue.reduce((n, d) => n + (d.tonnage ?? 0), 0);
  const pieceCount = queue.reduce((n, d) => n + d.pieceMarks.length, 0);

  return (
    <AppShell
      title="Shop Package"
      subtitle={
        project
          ? `${project.jobNumber} · fab queue for ${project.fabShop}`
          : undefined
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/print/shop">Print / PDF shop package</Link>
        </Button>
      </div>
      <div className="space-y-5">
        <section className="panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 steel-grid opacity-25" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                <Factory className="size-3.5" />
                Fab shop working set
              </div>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                Sheets issued for fabrication (plus AAN/approved on marked sets).
                Holds and R&Rs stay off the cut list until released — match
                against the latest to-shop transmittal.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
              <Metric label="In queue" value={queue.length} />
              <Metric label="Pieces" value={pieceCount} />
              <Metric label="Tonnage" value={formatTons(tonnage)} />
            </div>
          </div>
        </section>

        {blocked.length > 0 && (
          <section className="panel border-[var(--color-warn)]/30 p-4 sm:p-5">
            <h2 className="font-medium text-[var(--color-warn)]">
              Do not fabricate — holds & R&R
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Keep these pieces off the mill order and fit-up tables.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {blocked.map((d) => (
                <Link
                  key={d.id}
                  to="/drawings/$drawingId"
                  params={{ drawingId: d.id }}
                  className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-2.5 py-1.5 text-xs"
                >
                  <span className="font-mono-num font-medium">{d.number}</span>
                  <DrawingStatusBadge status={d.status} />
                  <span className="max-w-[140px] truncate text-[var(--color-muted)]">
                    {d.pieceMarks.slice(0, 2).join(", ") || d.title}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">
            Fab queue by sequence
          </h2>
          {bySequence.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No sheets in the fab queue for this job.
            </div>
          )}
          {bySequence.map(([key, group]) => (
            <article key={key} className="panel overflow-hidden">
              <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-3">
                <h3 className="font-medium">{group.label}</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  {group.sheets.length} sheets ·{" "}
                  {formatTons(
                    group.sheets.reduce((n, d) => n + (d.tonnage ?? 0), 0),
                  )}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                      <th className="px-5 py-2.5 font-medium">Sheet</th>
                      <th className="px-4 py-2.5 font-medium">Set</th>
                      <th className="px-4 py-2.5 font-medium">Rev</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Piece marks</th>
                      <th className="px-4 py-2.5 font-medium">Tons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sheets.map((d) => {
                      const set = drawingSets.find((s) => s.id === d.setId);
                      return (
                        <tr
                          key={d.id}
                          className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40"
                        >
                          <td className="px-5 py-2.5">
                            <Link
                              to="/drawings/$drawingId"
                              params={{ drawingId: d.id }}
                              className="font-mono-num font-medium hover:underline"
                            >
                              {d.number}
                            </Link>
                            <div className="max-w-[220px] truncate text-xs text-[var(--color-muted)]">
                              {d.title}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {set ? (
                              <Link
                                to="/drawings/sets/$setId"
                                params={{ setId: set.id }}
                                className="font-mono-num text-xs hover:underline"
                              >
                                {set.code}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num">
                            {d.currentRev}
                          </td>
                          <td className="px-4 py-2.5">
                            <DrawingStatusBadge status={d.status} />
                          </td>
                          <td className="px-4 py-2.5 font-mono-num text-xs text-[var(--color-muted)]">
                            {d.pieceMarks.join(", ") || "—"}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num text-xs">
                            {formatTons(d.tonnage)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
            <div className="flex items-center gap-2">
              <Send className="size-4 text-[var(--color-muted)]" />
              <h2 className="font-medium">To-shop transmittals</h2>
            </div>
            <Link
              to="/transmittals"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              All transmittals
            </Link>
          </div>
          {shopTransmittals.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--color-muted)]">
              No shop issues yet for this job.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/70">
              {shopTransmittals.map((tr) => (
                <li key={tr.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num font-medium">{tr.number}</span>
                    <TransmittalStatusBadge status={tr.status} />
                    <span className="text-xs text-[var(--color-subtle)]">
                      {formatDate(tr.issuedDate)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm">{tr.title}</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                    {tr.recipient} · {tr.items.length} sheets
                    {tr.notes ? ` · ${tr.notes}` : ""}
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

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div className="font-mono-num text-lg font-semibold">{value}</div>
    </div>
  );
}
