import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DrawingStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/permissions";
import { useAppStore } from "@/lib/store";
import {
  DRAWING_TYPE_LABELS,
  type Drawing,
  type DrawingSet,
  type Sequence,
} from "@/lib/types";
import { rolledSetStatus, sheetsForSet } from "@/lib/store";
import { cn, formatDate, formatTons } from "@/lib/utils";

export function SetRegister({
  sets,
  drawings,
  sequences,
  defaultExpanded,
}: {
  sets: DrawingSet[];
  drawings: Drawing[];
  sequences: Sequence[];
  defaultExpanded?: boolean;
}) {
  const seqMap = useMemo(
    () => Object.fromEntries(sequences.map((s) => [s.id, s])),
    [sequences],
  );
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    if (!defaultExpanded) return {};
    return Object.fromEntries(sets.map((s) => [s.id, true]));
  });
  const crewRole = useAppStore((s) => s.crewRole);
  const deleteDrawingSet = useAppStore((s) => s.deleteDrawingSet);
  const deleteDrawing = useAppStore((s) => s.deleteDrawing);
  const updateDrawingSet = useAppStore((s) => s.updateDrawingSet);
  const canEdit = can(crewRole, "drawing.edit");
  const canDelete =
    can(crewRole, "drawing.edit") || can(crewRole, "job.delete");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");

  function startEdit(set: DrawingSet) {
    setEditingId(set.id);
    setEditCode(set.code);
    setEditName(set.name);
  }

  function saveEdit(setId: string) {
    const ok = updateDrawingSet(setId, {
      code: editCode,
      name: editName,
    });
    if (ok) {
      toast.success("Drawing set updated");
      setEditingId(null);
    }
  }

  if (sets.length === 0) {
    return (
      <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-sm font-medium text-[var(--color-fg)]">
          No drawing sets match
        </div>
        <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
          Adjust filters or clear search. Sets are the parent packages; sheets live
          underneath each set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sets.map((set) => {
        const sheets = sheetsForSet(drawings, set.id);
        const effective = rolledSetStatus(sheets, set.status);
        const holds = sheets.filter((d) => d.status === "on_hold").length;
        const tons = sheets.reduce((sum, d) => sum + (d.tonnage ?? 0), 0);
        const seq = set.sequenceId ? seqMap[set.sequenceId] : undefined;
        const isOpen = open[set.id] ?? false;

        return (
          <article key={set.id} className="panel overflow-hidden">
            <div
              className={cn(
                "flex flex-col gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5",
                (effective === "on_hold" || holds > 0) && "bg-[var(--color-warn-bg)]/50",
              )}
            >
              <div className="flex min-w-0 items-start gap-2 sm:items-center">
                <button
                  type="button"
                  className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)] sm:mt-0"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Collapse sheets" : "Expand sheets"}
                  onClick={() =>
                    setOpen((prev) => ({ ...prev, [set.id]: !isOpen }))
                  }
                >
                  {isOpen ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  {editingId === set.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          id={`set-code-${set.id}`}
                          name={`setCode-${set.id}`}
                          aria-label="Set code"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="h-8 w-28 font-mono-num text-sm"
                          placeholder="SET-SHOP"
                        />
                        <Input
                          id={`set-name-${set.id}`}
                          name={`setName-${set.id}`}
                          aria-label="Set name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 min-w-[12rem] flex-1 text-sm"
                          placeholder="Shop drawings"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(set.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button
                          size="icon-sm"
                          variant="default"
                          aria-label="Save set name"
                          onClick={() => saveEdit(set.id)}
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Cancel rename"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-[var(--color-subtle)]">
                        Rename code and title (e.g. SET-SHOP · Level 1 Shop)
                      </p>
                    </div>
                  ) : (
                    <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/drawings/sets/$setId"
                      params={{ setId: set.id }}
                      className="font-mono-num text-sm font-semibold hover:underline"
                    >
                      {set.code}
                    </Link>
                    <DrawingStatusBadge status={effective} />
                    {(holds > 0 || effective === "on_hold") && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-warn)]">
                        <AlertTriangle className="size-3" />
                        {holds || 1} hold{(holds || 1) === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/drawings/sets/$setId"
                    params={{ setId: set.id }}
                    className="mt-0.5 block truncate font-medium hover:underline"
                  >
                    {set.name}
                  </Link>
                    </>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-muted)]">
                    <span>{DRAWING_TYPE_LABELS[set.type]}</span>
                    <span className="font-mono-num">Set rev {set.currentRev}</span>
                    {seq && <span>Seq {seq.number}</span>}
                    <span>
                      {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
                    </span>
                    {tons > 0 && (
                      <span className="font-mono-num">{formatTons(tons)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 pl-10 sm:pl-0">
                {canEdit && editingId !== set.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => startEdit(set)}
                  >
                    <Pencil className="size-3.5" />
                    Rename
                  </Button>
                )}
                <Link
                  to="/drawings/sets/$setId"
                  params={{ setId: set.id }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
                >
                  <Layers className="size-3.5" />
                  Open set
                </Link>
                {canDelete && (
                  <Button
                    size="sm"
                    variant="danger"
                    className="h-9"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete set ${set.code} and all ${sheets.length} sheet(s) under it? This cannot be undone.`,
                        )
                      ) {
                        const ok = deleteDrawingSet(set.id);
                        if (ok) toast.success(`Deleted set ${set.code}`);
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete set
                  </Button>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                      <th className="w-10 px-4 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Sheet</th>
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Rev</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Pieces</th>
                      <th className="px-3 py-2 font-medium">Issued</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-5 py-6 text-[var(--color-muted)]"
                        >
                          No sheets in this set yet.
                        </td>
                      </tr>
                    )}
                    {sheets.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          "border-b border-[var(--color-border)]/60 transition-colors hover:bg-[var(--color-surface-2)]/50",
                          d.status === "on_hold" && "bg-[var(--color-warn-bg)]/30",
                        )}
                      >
                        <td className="px-4 py-2.5 font-mono-num text-xs text-[var(--color-subtle)]">
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
                          {d.status === "on_hold" && (
                            <AlertTriangle className="ml-1.5 inline size-3.5 text-[var(--color-warn)]" />
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-[var(--color-muted)]">
                          {d.title}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[var(--color-muted)]">
                          {DRAWING_TYPE_LABELS[d.type]}
                        </td>
                        <td className="px-3 py-2.5 font-mono-num">{d.currentRev}</td>
                        <td className="px-3 py-2.5">
                          <DrawingStatusBadge status={d.status} />
                        </td>
                        <td className="px-3 py-2.5 font-mono-num text-xs text-[var(--color-muted)]">
                          {d.pieceMarks.slice(0, 3).join(", ") || "—"}
                          {d.pieceMarks.length > 3 && ` +${d.pieceMarks.length - 3}`}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[var(--color-muted)]">
                          {formatDate(d.issuedDate)}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center justify-end gap-0.5">
                            {canDelete && (
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                                aria-label={`Delete sheet ${d.number}`}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete sheet ${d.number}? Uploaded file and markups on this sheet are removed.`,
                                    )
                                  ) {
                                    const ok = deleteDrawing(d.id);
                                    if (ok)
                                      toast.success(`Deleted ${d.number}`);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                            <Link
                              to="/drawings/$drawingId"
                              params={{ drawingId: d.id }}
                              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                              aria-label={`Open sheet ${d.number}`}
                            >
                              <ChevronRight className="size-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
