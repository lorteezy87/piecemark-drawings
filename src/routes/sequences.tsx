import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DrawingStatusBadge, SequenceStatusBadge } from "@/components/status-badges";
import { useAppStore, useSelectedProject } from "@/lib/store";
import { cn, formatDate, formatTons } from "@/lib/utils";

export const Route = createFileRoute("/sequences")({
  component: SequencesPage,
});

function SequencesPage() {
  const project = useSelectedProject();
  const createSequence = useAppStore((s) => s.createSequence);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [grids, setGrids] = useState("");

  const sequences = useAppStore((s) => s.sequences);
  const drawings = useAppStore((s) => s.drawings);
  const rfis = useAppStore((s) => s.rfis);

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
        const rr = seqDwgs.filter((d) => d.status === "revise_resubmit").length;
        const fieldReady = seqDwgs.filter(
          (d) => d.status === "issued_for_erection",
        ).length;
        const openRfis = rfis.filter(
          (r) =>
            r.projectId === project?.id &&
            r.status === "open" &&
            r.drawingIds.some((id) => seqDwgs.some((d) => d.id === id)),
        ).length;
        const gates = [
          {
            id: "sheets",
            label: "Sheets assigned",
            ok: seqDwgs.length > 0,
            detail: `${seqDwgs.length} sheets`,
          },
          {
            id: "released",
            label: "Released for fab/field",
            ok: seqDwgs.length > 0 && ready === seqDwgs.length,
            detail: `${ready}/${seqDwgs.length || 0}`,
          },
          {
            id: "holds",
            label: "No open holds",
            ok: holds === 0,
            detail: holds ? `${holds} held` : "Clear",
          },
          {
            id: "rr",
            label: "No R&R outstanding",
            ok: rr === 0,
            detail: rr ? `${rr} R&R` : "Clear",
          },
          {
            id: "rfi",
            label: "No open RFIs on sequence",
            ok: openRfis === 0,
            detail: openRfis ? `${openRfis} open` : "Clear",
          },
        ];
        const gatePass = gates.every((g) => g.ok);
        return {
          seq,
          seqDwgs,
          ready,
          holds,
          fieldReady,
          openRfis,
          gates,
          gatePass,
        };
      });
  }, [sequences, drawings, rfis, project?.id]);

  return (
    <AppShell
      actions={
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          New sequence
        </Button>
      }
      title="Erection Sequences"
      subtitle={
        project
          ? `${project.jobNumber} · release order for detailing, fab, and field`
          : undefined
      }
    >
      <div className="space-y-4">
        {showAdd && project && (
          <div className="panel space-y-2 p-4">
            <Input aria-label="Sequence name" placeholder="Sequence name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input aria-label="Area" placeholder="Area" value={area} onChange={(e) => setArea(e.target.value)} />
              <Input aria-label="Grids" placeholder="Grids" value={grids} onChange={(e) => setGrids(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => {
              if (!name.trim()) { toast.error("Name required"); return; }
              createSequence({ projectId: project.id, name: name.trim(), area, grids });
              toast.success("Sequence created");
              setShowAdd(false); setName(""); setArea(""); setGrids("");
            }}>Create</Button>
          </div>
        )}

        <p className="max-w-3xl text-sm text-[var(--color-muted)]">
          Sequences mirror how steel leaves the shop and goes up — not arbitrary
          work packages. Gates show whether a sequence is clear for crane day.
        </p>

        {rows.length === 0 && (
          <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
            No sequences defined for this job.
          </div>
        )}

        {rows.map(
          ({
            seq,
            seqDwgs,
            ready,
            holds,
            fieldReady,
            openRfis,
            gates,
            gatePass,
          }) => (
            <article key={seq.id} className="panel overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {seq.name}
                    </h2>
                    <SequenceStatusBadge status={seq.status} />
                    {gatePass ? (
                      <span className="rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-success)]">
                        Gates clear
                      </span>
                    ) : (
                      <span className="rounded-full border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-warn)]">
                        Gates blocked
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                    <span>Area: {seq.area}</span>
                    <span>Grids: {seq.grids}</span>
                    <span className="font-mono-num">
                      {formatTons(seq.tonnage)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-subtle)]">
                    Planned {formatDate(seq.plannedStart)} →{" "}
                    {formatDate(seq.plannedEnd)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <MiniStat
                    label="Released"
                    value={`${ready}/${seqDwgs.length}`}
                  />
                  <MiniStat label="IFC field" value={fieldReady} />
                  <MiniStat
                    label="Blockers"
                    value={holds + openRfis}
                    warn={holds + openRfis > 0}
                  />
                </div>
              </div>

              <div className="grid gap-2 border-b border-[var(--color-border)] px-5 py-3 sm:grid-cols-5">
                {gates.map((g) => (
                  <div
                    key={g.id}
                    className={cn(
                      "flex items-start gap-2 rounded-[var(--radius-md)] border px-2.5 py-2 text-xs",
                      g.ok
                        ? "border-[var(--color-border)] bg-[var(--color-bg-elevated)]"
                        : "border-[var(--color-warn)]/25 bg-[var(--color-warn-bg)]",
                    )}
                  >
                    {g.ok ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warn)]" />
                    )}
                    <div>
                      <div className="font-medium">{g.label}</div>
                      <div className="text-[var(--color-muted)]">{g.detail}</div>
                    </div>
                  </div>
                ))}
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
                        <td className="px-4 py-2.5 font-mono-num">
                          {d.currentRev}
                        </td>
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
          ),
        )}
      </div>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
        {label}
      </div>
      <div
        className={cn(
          "font-mono-num text-lg font-semibold",
          warn && "text-[var(--color-warn)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
