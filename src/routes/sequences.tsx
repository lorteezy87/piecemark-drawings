import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DrawingStatusBadge, SequenceStatusBadge } from "@/components/status-badges";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/sequences")({
  component: SequencesPage,
});

function SequencesPage() {
  const project = useSelectedProject();
  const sequences = useAppStore((s) => s.sequences);
  const drawings = useAppStore((s) => s.drawings);

  const rows = useMemo(() => {
    return sequences
      .filter((s) => s.projectId === project?.id)
      .sort((a, b) => a.number - b.number)
      .map((seq) => {
        const seqDwgs = drawings
          .filter((d) => d.sequenceId === seq.id)
          .sort((a, b) => a.number.localeCompare(b.number));
        const ready = seqDwgs.filter((d) =>
          ["issued_for_fab", "issued_for_erection", "approved", "aan"].includes(
            d.status,
          ),
        ).length;
        const holds = seqDwgs.filter((d) => d.status === "on_hold").length;
        return { seq, seqDwgs, ready, holds };
      });
  }, [sequences, drawings, project?.id]);

  return (
    <AppShell
      title="Erection Sequences"
      subtitle={
        project
          ? `${project.jobNumber} · release order for detailing, fab, and field`
          : undefined
      }
    >
      <div className="space-y-4">
        <p className="max-w-3xl text-sm text-[var(--color-muted)]">
          Sequences mirror how steel actually leaves the shop and goes up in the air —
          not arbitrary work packages. Each sequence groups shop drawings, erection
          plans, and connection details that must clear together before the crane day.
        </p>

        {rows.length === 0 && (
          <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
            No sequences defined for this job.
          </div>
        )}

        {rows.map(({ seq, seqDwgs, ready, holds }) => (
          <article key={seq.id} className="panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">{seq.name}</h2>
                  <SequenceStatusBadge status={seq.status} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                  <span>Area: {seq.area}</span>
                  <span>Grids: {seq.grids}</span>
                  <span className="font-mono-num">{formatTons(seq.tonnage)}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--color-subtle)]">
                  Planned {formatDate(seq.plannedStart)} → {formatDate(seq.plannedEnd)}
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                  Sheets ready
                </div>
                <div className="font-mono-num text-xl font-semibold">
                  {ready}
                  <span className="text-sm font-normal text-[var(--color-muted)]">
                    /{seqDwgs.length}
                  </span>
                </div>
                {holds > 0 && (
                  <div className="mt-1 text-xs text-[var(--color-warn)]">
                    {holds} sheet{holds === 1 ? "" : "s"} on hold
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                    <th className="px-5 py-2.5 font-medium">Dwg</th>
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-4 py-2.5 font-medium">Rev</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Pieces</th>
                  </tr>
                </thead>
                <tbody>
                  {seqDwgs.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-6 text-[var(--color-muted)]"
                      >
                        No drawings assigned to this sequence yet.
                      </td>
                    </tr>
                  )}
                  {seqDwgs.map((d) => (
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
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-[var(--color-muted)]">
                        {d.title}
                      </td>
                      <td className="px-4 py-2.5 font-mono-num">{d.currentRev}</td>
                      <td className="px-4 py-2.5">
                        <DrawingStatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-2.5 font-mono-num text-xs text-[var(--color-muted)]">
                        {d.pieceMarks.slice(0, 4).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
