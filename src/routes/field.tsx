import { createFileRoute, Link } from "@tanstack/react-router";
import { HardHat, Send } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import {
  DrawingStatusBadge,
  TransmittalStatusBadge,
} from "@/components/status-badges";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/field")({
  component: FieldPackagePage,
});

/**
 * Field package = what the ironworkers should be working from today:
 * sheets issued for erection + the latest to-field transmittals that delivered them.
 */
function FieldPackagePage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const drawingSets = useAppStore((s) => s.drawingSets);
  const sequences = useAppStore((s) => s.sequences);
  const transmittals = useAppStore((s) => s.transmittals);

  const fieldSheets = useMemo(() => {
    return drawings
      .filter(
        (d) =>
          d.projectId === project?.id &&
          (d.status === "issued_for_erection" ||
            (d.status === "aan" && d.tags.includes("field"))),
      )
      .sort((a, b) => a.number.localeCompare(b.number));
  }, [drawings, project?.id]);

  const fieldTransmittals = useMemo(() => {
    return transmittals
      .filter(
        (t) =>
          t.projectId === project?.id &&
          t.kind === "to_field" &&
          t.status !== "draft",
      )
      .sort((a, b) =>
        (b.issuedDate ?? "").localeCompare(a.issuedDate ?? ""),
      );
  }, [transmittals, project?.id]);

  const bySequence = useMemo(() => {
    const map = new Map<
      string,
      { label: string; sheets: typeof fieldSheets }
    >();
    for (const d of fieldSheets) {
      const seq = sequences.find((s) => s.id === d.sequenceId);
      const key = seq?.id ?? "unassigned";
      const label = seq
        ? `Seq ${seq.number} — ${seq.area}`
        : "Unassigned sequence";
      if (!map.has(key)) map.set(key, { label, sheets: [] });
      map.get(key)!.sheets.push(d);
    }
    return [...map.entries()];
  }, [fieldSheets, sequences]);

  const tonnage = fieldSheets.reduce((n, d) => n + (d.tonnage ?? 0), 0);

  return (
    <AppShell
      title="Field Package"
      subtitle={
        project
          ? `${project.jobNumber} · current IFC sheets for erection`
          : undefined
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/print/field">Print / PDF field package</Link>
        </Button>
      </div>
      <div className="space-y-5">
        <section className="panel relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 steel-grid opacity-25" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-subtle)]">
                <HardHat className="size-3.5" />
                Working field set
              </div>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
                Sheets marked Issued for Erection (IFC) and the to-field
                transmittals that delivered them. Check rev drift against the
                last transmittal before steel goes up.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[200px]">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
                  IFC sheets
                </div>
                <div className="font-mono-num text-xl font-semibold">
                  {fieldSheets.length}
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
                  Field tonnage
                </div>
                <div className="font-mono-num text-xl font-semibold">
                  {formatTons(tonnage)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-muted)]">
            By erection sequence
          </h2>
          {bySequence.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No sheets issued for erection on this job yet.
            </div>
          )}
          {bySequence.map(([key, group]) => (
            <article key={key} className="panel overflow-hidden">
              <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-3">
                <h3 className="font-medium">{group.label}</h3>
                <p className="text-xs text-[var(--color-muted)]">
                  {group.sheets.length} sheet
                  {group.sheets.length === 1 ? "" : "s"} ·{" "}
                  {formatTons(
                    group.sheets.reduce((n, d) => n + (d.tonnage ?? 0), 0),
                  )}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                      <th className="px-5 py-2.5 font-medium">Sheet</th>
                      <th className="px-4 py-2.5 font-medium">Set</th>
                      <th className="px-4 py-2.5 font-medium">Rev</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium">Pieces</th>
                      <th className="px-4 py-2.5 font-medium">Issued</th>
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
                            {d.pieceMarks.slice(0, 4).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[var(--color-muted)]">
                            {formatDate(d.issuedDate)}
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
              <h2 className="font-medium">To-field transmittals</h2>
            </div>
            <Link
              to="/transmittals"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              All transmittals
            </Link>
          </div>
          {fieldTransmittals.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--color-muted)]">
              No to-field issues yet for this job.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/70">
              {fieldTransmittals.map((tr) => (
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
                    {tr.recipient} · {tr.items.length} sheets · {tr.purpose}
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
