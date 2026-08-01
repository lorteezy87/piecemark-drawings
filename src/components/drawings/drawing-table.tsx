import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { DrawingStatusBadge } from "@/components/status-badges";
import {
  DRAWING_TYPE_LABELS,
  type Drawing,
  type Sequence,
} from "@/lib/types";
import { cn, formatDate, formatTons } from "@/lib/utils";

export function DrawingTable({
  drawings,
  sequences,
  compact,
}: {
  drawings: Drawing[];
  sequences: Sequence[];
  compact?: boolean;
}) {
  const seqMap = Object.fromEntries(sequences.map((s) => [s.id, s]));

  if (drawings.length === 0) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-sm font-medium text-[var(--color-fg)]">No drawings match</div>
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
          Adjust filters or clear the piece-mark search. Register is scoped to the active job.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th className="px-4 py-3 font-medium">Dwg #</th>
              <th className="px-4 py-3 font-medium">Title</th>
              {!compact && <th className="px-4 py-3 font-medium">Type</th>}
              <th className="px-4 py-3 font-medium">Rev</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {!compact && <th className="px-4 py-3 font-medium">Sequence</th>}
              <th className="px-4 py-3 font-medium">Pieces</th>
              {!compact && <th className="px-4 py-3 font-medium">Issued</th>}
              <th className="px-2 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {drawings.map((d) => {
              const seq = d.sequenceId ? seqMap[d.sequenceId] : undefined;
              return (
                <tr
                  key={d.id}
                  className={cn(
                    "border-b border-[var(--color-border)]/70 transition-colors hover:bg-[var(--color-surface-2)]/60",
                    d.status === "on_hold" && "bg-[var(--color-warn-bg)]/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/drawings/$drawingId"
                      params={{ drawingId: d.id }}
                      className="font-mono-num font-medium text-[var(--color-fg)] hover:underline"
                    >
                      {d.number}
                    </Link>
                    {d.status === "on_hold" && (
                      <AlertTriangle className="ml-1.5 inline size-3.5 text-[var(--color-warn)]" />
                    )}
                  </td>
                  <td className="max-w-[220px] px-4 py-3">
                    <div className="truncate font-medium">{d.title}</div>
                    {d.area && (
                      <div className="truncate text-xs text-[var(--color-muted)]">{d.area}</div>
                    )}
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {DRAWING_TYPE_LABELS[d.type]}
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono-num">{d.currentRev}</td>
                  <td className="px-4 py-3">
                    <DrawingStatusBadge status={d.status} />
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                      {seq ? `Seq ${seq.number}` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="font-mono-num text-xs text-[var(--color-muted)]">
                      {d.pieceMarks.slice(0, 3).join(", ") || "—"}
                      {d.pieceMarks.length > 3 && ` +${d.pieceMarks.length - 3}`}
                    </div>
                    {d.tonnage != null && (
                      <div className="text-[11px] text-[var(--color-subtle)]">
                        {formatTons(d.tonnage)}
                      </div>
                    )}
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                      {formatDate(d.issuedDate)}
                    </td>
                  )}
                  <td className="px-2 py-3">
                    <Link
                      to="/drawings/$drawingId"
                      params={{ drawingId: d.id }}
                      className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                      aria-label={`Open ${d.number}`}
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
