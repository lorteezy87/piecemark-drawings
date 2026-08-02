import { createFileRoute, Link } from "@tanstack/react-router";
import { Hash, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DrawingStatusBadge } from "@/components/status-badges";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildPieceMarkIndex,
  useAppStore,
  useSelectedProject,
} from "@/lib/store";

export const Route = createFileRoute("/pieces")({
  component: PieceMarkIndexPage,
});

function PieceMarkIndexPage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const sequences = useAppStore((s) => s.sequences);
  const [query, setQuery] = useState("");
  const [holdOnly, setHoldOnly] = useState(false);
  const [seqFilter, setSeqFilter] = useState<string>("all");

  const projectSeqs = useMemo(
    () =>
      sequences
        .filter((s) => s.projectId === project?.id)
        .sort((a, b) => a.number - b.number),
    [sequences, project?.id],
  );

  const index = useMemo(
    () => buildPieceMarkIndex(drawings, drawingSets, project?.id),
    [drawings, drawingSets, project?.id],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return index.filter((row) => {
      if (holdOnly && !row.onHold) return false;
      if (seqFilter !== "all" && row.sequenceId !== seqFilter) return false;
      if (!q) return true;
      return (
        row.mark.toLowerCase().includes(q) ||
        row.drawingNumber.toLowerCase().includes(q) ||
        row.setCode.toLowerCase().includes(q) ||
        row.drawingTitle.toLowerCase().includes(q)
      );
    });
  }, [index, query, holdOnly, seqFilter]);

  // Group by mark so multi-sheet pieces are clear
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const list = map.get(row.mark) ?? [];
      list.push(row);
      map.set(row.mark, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <AppShell
      title="Piece Mark Index"
      subtitle={
        project
          ? `${project.jobNumber} · ${index.length} marks across ${drawings.filter((d) => d.projectId === project.id).length} sheets`
          : undefined
      }
    >
      <div className="space-y-4">
        <p className="max-w-3xl text-sm text-[var(--color-muted)]">
          Shop and field lookup by piece mark — columns, beams, braces, embeds.
          Each mark links to the controlling shop/erection sheet and parent drawing set.
        </p>

        <div className="panel grid gap-3 p-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Search mark / sheet
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-subtle)]" />
              <Input aria-label="BR-3, C6, G2…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="BR-3, C6, G2…"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
              Sequence
            </label>
            <Select aria-label="Select field"
              value={seqFilter}
              onChange={(e) => setSeqFilter(e.target.value)}
            >
              <option value="all">All sequences</option>
              {projectSeqs.map((s) => (
                <option key={s.id} value={s.id}>
                  Seq {s.number} — {s.area}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex h-10 cursor-pointer items-center gap-2 text-sm text-[var(--color-muted)]">
              <input aria-label="Toggle selection"
                type="checkbox"
                checked={holdOnly}
                onChange={(e) => setHoldOnly(e.target.checked)}
                className="size-4 rounded border-[var(--color-border)]"
              />
              Marks on held sheets only
            </label>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                  <th className="px-4 py-3 font-medium">Piece mark</th>
                  <th className="px-4 py-3 font-medium">Sheet</th>
                  <th className="px-4 py-3 font-medium">Drawing set</th>
                  <th className="px-4 py-3 font-medium">Rev</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Seq</th>
                </tr>
              </thead>
              <tbody>
                {grouped.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[var(--color-muted)]"
                    >
                      No piece marks match. Try a different mark or clear filters.
                    </td>
                  </tr>
                )}
                {grouped.map(([mark, rows]) =>
                  rows.map((row, i) => {
                    const seq = projectSeqs.find((s) => s.id === row.sequenceId);
                    return (
                      <tr
                        key={`${mark}-${row.drawingId}`}
                        className={
                          row.onHold
                            ? "border-b border-[var(--color-border)]/70 bg-[var(--color-warn-bg)]/40"
                            : "border-b border-[var(--color-border)]/70 hover:bg-[var(--color-surface-2)]/50"
                        }
                      >
                        <td className="px-4 py-2.5">
                          {i === 0 ? (
                            <span className="inline-flex items-center gap-1.5 font-mono-num font-semibold">
                              <Hash className="size-3.5 text-[var(--color-subtle)]" />
                              {mark}
                            </span>
                          ) : (
                            <span className="pl-5 text-xs text-[var(--color-subtle)]">
                              also on
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            to="/drawings/$drawingId"
                            params={{ drawingId: row.drawingId }}
                            className="font-mono-num font-medium hover:underline"
                          >
                            {row.drawingNumber}
                          </Link>
                          <div className="max-w-[200px] truncate text-xs text-[var(--color-muted)]">
                            {row.drawingTitle}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            to="/drawings/sets/$setId"
                            params={{ setId: row.setId }}
                            className="font-mono-num text-xs hover:underline"
                          >
                            {row.setCode}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 font-mono-num">{row.rev}</td>
                        <td className="px-4 py-2.5">
                          <DrawingStatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[var(--color-muted)]">
                          {seq ? `Seq ${seq.number}` : "—"}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
