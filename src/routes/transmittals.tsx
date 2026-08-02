import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAppStore, useSelectedProject } from "@/lib/store";
import {
  TRANSMITTAL_KIND_LABELS,
  TRANSMITTAL_STATUS_LABELS,
  type TransmittalKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transmittals")({
  component: TransmittalsPage,
});

function TransmittalsPage() {
  const project = useSelectedProject();
  const drawings = useAppStore((s) => s.drawings);
  const transmittals = useAppStore((s) => s.transmittals);
  const createTransmittal = useAppStore((s) => s.createTransmittal);
  const issueTransmittal = useAppStore((s) => s.issueTransmittal);
  const acknowledgeTransmittal = useAppStore((s) => s.acknowledgeTransmittal);

  const projectTr = useMemo(
    () =>
      transmittals
        .filter((t) => t.projectId === project?.id)
        .sort((a, b) => b.number.localeCompare(a.number)),
    [transmittals, project?.id],
  );
  const projectDwgs = useMemo(
    () => drawings.filter((d) => d.projectId === project?.id),
    [drawings, project?.id],
  );

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TransmittalKind>("to_field");
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selectedDwgs, setSelectedDwgs] = useState<string[]>([]);

  function toggleDwg(id: string) {
    setSelectedDwgs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function onCreate() {
    if (!project || !title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selectedDwgs.length === 0) {
      toast.error("Select at least one drawing");
      return;
    }
    const setIds = [
      ...new Set(
        projectDwgs
          .filter((d) => selectedDwgs.includes(d.id))
          .map((d) => d.setId),
      ),
    ];
    createTransmittal({
      projectId: project.id,
      title: title.trim(),
      kind,
      recipient: recipient.trim() || "Field / Shop",
      purpose: purpose.trim() || "Issued working set",
      issuedBy: "User",
      setIds,
      drawingIds: selectedDwgs,
      issueNow: true,
    });
    toast.success("Transmittal issued");
    setShowCreate(false);
    setTitle("");
    setSelectedDwgs([]);
  }

  return (
    <AppShell
      title="Transmittals"
      subtitle={
        project
          ? `${project.jobNumber} · controlled issue packages to field, shop, GC, EOR`
          : undefined
      }
      actions={
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {showCreate ? "Cancel" : "New transmittal"}
        </Button>
      }
    >
      <div className="space-y-4">
        {showCreate && project && (
          <div className="panel space-y-3 p-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as TransmittalKind)}
              >
                {Object.entries(TRANSMITTAL_KIND_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Input
                id="tr-recipient"
                name="recipient"
                aria-label="Recipient"
                placeholder="Recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <Input
                id="tr-purpose"
                name="purpose"
                aria-label="Purpose"
                placeholder="Purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded border border-[var(--color-border)] p-2">
              {projectDwgs.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                >
                  <input
                    id={`tr-dwg-${d.id}`}
                    name="drawingIds"
                    type="checkbox"
                    value={d.id}
                    checked={selectedDwgs.includes(d.id)}
                    onChange={() => toggleDwg(d.id)}
                    aria-label={`Include ${d.number}`}
                  />
                  <span className="font-mono-num">{d.number}</span>
                  <span className="truncate text-[var(--color-muted)]">
                    {d.title}
                  </span>
                </label>
              ))}
            </div>
            <Button size="sm" onClick={onCreate}>
              <Send className="size-3.5" />
              Issue package
            </Button>
          </div>
        )}

        <div className="panel overflow-hidden">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Sheets</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectTr.map((tr) => (
                <tr
                  key={tr.id}
                  className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40"
                >
                  <td className="px-4 py-2.5 font-mono-num font-medium">
                    {tr.number}
                  </td>
                  <td className="px-4 py-2.5">
                    <div>{tr.title}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {tr.recipient}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {TRANSMITTAL_KIND_LABELS[tr.kind]}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {TRANSMITTAL_STATUS_LABELS[tr.status]}
                  </td>
                  <td className="px-4 py-2.5 font-mono-num text-xs">
                    {tr.items.length}
                    {tr.setIds && tr.setIds.length > 0
                      ? ` · ${tr.setIds.length} set(s)`
                      : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {tr.status === "draft" && (
                        <Button
                          size="sm"
                          className="h-7"
                          onClick={() => {
                            issueTransmittal(tr.id);
                            toast.success(`${tr.number} issued`);
                          }}
                        >
                          Issue
                        </Button>
                      )}
                      {tr.status === "issued" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7"
                          onClick={() => {
                            acknowledgeTransmittal(tr.id);
                            toast.success(`${tr.number} acknowledged`);
                          }}
                        >
                          Ack
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" className="h-7">
                        <Link
                          to="/print/transmittal/$trId"
                          params={{ trId: tr.id }}
                        >
                          Print
                        </Link>
                      </Button>
                      {tr.items[0] && (
                        <Button asChild size="sm" variant="ghost" className="h-7">
                          <Link
                            to="/drawings/$drawingId"
                            params={{ drawingId: tr.items[0].drawingId }}
                          >
                            Open
                          </Link>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {projectTr.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--color-muted)]"
                  >
                    No transmittals for this job yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
