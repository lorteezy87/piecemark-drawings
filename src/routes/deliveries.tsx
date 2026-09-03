import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { JobScopeSelect } from "@/components/job-scope";
import { DeliveryStatusBadge } from "@/components/pm-badges";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useAppStore } from "@/lib/store";
import { DELIVERY_STATUS_LABELS, type DeliveryLine, type DeliveryStatus } from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/deliveries")({
  component: DeliveriesPage,
});

function DeliveriesPage() {
  const projects = useAppStore((s) => s.projects);
  const selectedProjectId = useAppStore((s) => s.selectedProjectId);
  const sequences = useAppStore((s) => s.sequences);
  const deliveries = useAppStore((s) => s.deliveries);
  const workPackages = useAppStore((s) => s.workPackages);
  const addDelivery = useAppStore((s) => s.addDelivery);
  const updateDelivery = useAppStore((s) => s.updateDelivery);
  const setDeliveryStatus = useAppStore((s) => s.setDeliveryStatus);
  const receiveDelivery = useAppStore((s) => s.receiveDelivery);
  const deleteDelivery = useAppStore((s) => s.deleteDelivery);

  const [scope, setScope] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [receiveDraft, setReceiveDraft] = useState<Record<string, number>>({});

  // Create form
  const [projectId, setProjectId] = useState(selectedProjectId ?? projects[0]?.id ?? "");
  const [sequenceId, setSequenceId] = useState("");
  const [workPackageId, setWorkPackageId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [destination, setDestination] = useState("");
  const [craneRequired, setCraneRequired] = useState(true);
  const [tonnage, setTonnage] = useState("");
  const [marksText, setMarksText] = useState("");

  const jobLabel = (id: string) => projects.find((p) => p.id === id)?.jobNumber ?? "—";
  const seqLabel = (id?: string) => (id ? (sequences.find((s) => s.id === id)?.name ?? "—") : "—");

  const rows = useMemo(
    () =>
      deliveries
        .filter((d) => scope === "all" || d.projectId === scope)
        .filter((d) => statusFilter === "all" || d.status === statusFilter)
        .sort((a, b) => {
          const ad = a.requiredDate ?? a.shipDate ?? "9999";
          const bd = b.requiredDate ?? b.shipDate ?? "9999";
          return ad.localeCompare(bd);
        }),
    [deliveries, scope, statusFilter],
  );

  const stats = useMemo(() => {
    const scoped = deliveries.filter((d) => scope === "all" || d.projectId === scope);
    const inbound = scoped.filter((d) => d.status !== "received" && d.status !== "exception");
    const next7 = inbound.filter((d) => {
      const n = daysUntil(d.requiredDate);
      return n != null && n >= 0 && n <= 7;
    });
    const late = inbound.filter((d) => {
      const n = daysUntil(d.requiredDate);
      return n != null && n < 0;
    });
    const exceptions = scoped.filter((d) => d.status === "exception");
    const tons = next7.reduce((n, d) => n + (d.tonnage ?? 0), 0);
    return {
      inbound: inbound.length,
      next7: next7.length,
      late: late.length,
      exceptions: exceptions.length,
      tons,
    };
  }, [deliveries, scope]);

  const projectSeqs = sequences.filter((s) => s.projectId === projectId);
  const projectWps = workPackages.filter((w) => w.projectId === projectId);

  function parseLines(text: string): DeliveryLine[] {
    // "B-204 x12 @1480" or "B-204, 12" — forgiving, field guys type fast
    return text
      .split(/[\n;]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = /^([^\s,x@]+)[\s,x]*(\d+)?[\s@]*(\d+)?/i.exec(line);
        return {
          mark: m?.[1] ?? line,
          qty: m?.[2] ? Number(m[2]) : 1,
          weightLbs: m?.[3] ? Number(m[3]) : undefined,
        };
      });
  }

  function submitCreate() {
    if (!projectId) {
      toast.error("Pick a job");
      return;
    }
    if (!requiredDate) {
      toast.error("Required-on-site date drives the field — set it");
      return;
    }
    addDelivery({
      projectId,
      sequenceId: sequenceId || undefined,
      workPackageId: workPackageId || undefined,
      carrier: carrier || undefined,
      shipDate: shipDate || undefined,
      requiredDate,
      destination: destination || undefined,
      craneRequired,
      tonnage: tonnage ? Number(tonnage) : undefined,
      lines: parseLines(marksText),
    });
    toast.success("Load planned");
    setShowCreate(false);
    setMarksText("");
    setCarrier("");
    setShipDate("");
    setRequiredDate("");
  }

  function exportCsv() {
    downloadCsv(
      `deliveries-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([
        [
          "Job",
          "Load",
          "Status",
          "Sequence",
          "Carrier",
          "Ship date",
          "Required on site",
          "Tons",
          "Crane",
          "Marks",
          "Issue",
        ],
        ...rows.map((d) => [
          jobLabel(d.projectId),
          d.loadNumber,
          DELIVERY_STATUS_LABELS[d.status],
          seqLabel(d.sequenceId),
          d.carrier ?? "",
          d.shipDate ?? "",
          d.requiredDate ?? "",
          d.tonnage ?? "",
          d.craneRequired ? "Yes" : "No",
          d.lines.map((l) => `${l.mark} x${l.qty}`).join(" / "),
          d.issue ?? "",
        ]),
      ]),
    );
    toast.success("Delivery log exported");
  }

  return (
    <AppShell
      title="Deliveries"
      subtitle="Load-level tracking by piece mark — ship date, required-on-site date, crane, and receiving"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showCreate ? "Cancel" : "Plan load"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Inbound loads" value={stats.inbound} />
          <StatCard
            label="Next 7 days"
            value={stats.next7}
            tone="info"
            hint={`${stats.tons.toLocaleString("en-US", { maximumFractionDigits: 1 })} tn`}
          />
          <StatCard
            label="Past required date"
            value={stats.late}
            tone={stats.late > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Short / damaged"
            value={stats.exceptions}
            tone={stats.exceptions > 0 ? "warn" : "default"}
          />
        </div>

        {showCreate && (
          <section className="panel space-y-4 p-5">
            <div>
              <h2 className="font-medium">Plan a load</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Required-on-site date is the one that drives erection — set it even if the ship date
                is still soft.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Job</label>
                <Select
                  aria-label="Job"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSequenceId("");
                    setWorkPackageId("");
                  }}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.jobNumber} — {p.name.split("—")[0].trim()}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Sequence</label>
                <Select
                  aria-label="Sequence"
                  value={sequenceId}
                  onChange={(e) => setSequenceId(e.target.value)}
                >
                  <option value="">—</option>
                  {projectSeqs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Work package
                </label>
                <Select
                  aria-label="Work package"
                  value={workPackageId}
                  onChange={(e) => setWorkPackageId(e.target.value)}
                >
                  <option value="">—</option>
                  {projectWps.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Carrier</label>
                <Input
                  aria-label="Carrier"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="Hauler"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Ship date</label>
                <Input
                  aria-label="Ship date"
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Required on site
                </label>
                <Input
                  aria-label="Required on site"
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                  Destination / laydown
                </label>
                <Input
                  aria-label="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Gate / laydown area"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[var(--color-muted)]">Tons</label>
                <Input
                  aria-label="Tons"
                  type="number"
                  value={tonnage}
                  onChange={(e) => setTonnage(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    checked={craneRequired}
                    onChange={(e) => setCraneRequired(e.target.checked)}
                    className="size-4"
                  />
                  Crane required to offload
                </label>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[var(--color-muted)]">
                Piece marks — one per line, e.g. B-204 x12 @1480
              </label>
              <textarea
                value={marksText}
                onChange={(e) => setMarksText(e.target.value)}
                rows={3}
                placeholder={"B-204 x12 @1480\nC-118 x8 @2260"}
                className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono-num text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={submitCreate}>Plan load</Button>
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <JobScopeSelect value={scope} onChange={setScope} className="w-56" />
          <Select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | "all")}
            className="w-44"
          >
            <option value="all">All statuses</option>
            {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
              <option key={s} value={s}>
                {DELIVERY_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="panel px-6 py-12 text-center text-sm text-[var(--color-muted)]">
              No loads for this filter.
            </div>
          )}
          {rows.map((d) => {
            const req = daysUntil(d.requiredDate);
            const late =
              req != null && req < 0 && d.status !== "received" && d.status !== "exception";
            const isOpen = expanded === d.id;
            const totalPieces = d.lines.reduce((n, l) => n + l.qty, 0);
            const shortLines = d.lines.filter((l) => l.received != null && l.received < l.qty);
            return (
              <article
                key={d.id}
                className={cn(
                  "panel overflow-hidden",
                  late && "border-[var(--color-danger)]/40",
                  d.status === "exception" && "border-[var(--color-warn)]/40",
                )}
              >
                <button
                  type="button"
                  className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-start sm:justify-between"
                  onClick={() => setExpanded(isOpen ? null : d.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Truck className="size-4 text-[var(--color-muted)]" />
                      <span className="font-mono-num text-base font-semibold">{d.loadNumber}</span>
                      <DeliveryStatusBadge status={d.status} />
                      {scope === "all" && (
                        <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                          {jobLabel(d.projectId)}
                        </span>
                      )}
                      {d.craneRequired && (
                        <span className="text-[11px] uppercase tracking-wide text-[var(--color-warn)]">
                          Crane
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-[var(--color-fg)]">
                      {seqLabel(d.sequenceId)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                      <span>
                        Ships{" "}
                        <span className="font-mono-num text-[var(--color-fg)]">
                          {formatDate(d.shipDate)}
                        </span>
                      </span>
                      <span>
                        Required{" "}
                        <span
                          className={cn(
                            "font-mono-num",
                            late ? "text-[var(--color-danger)]" : "text-[var(--color-fg)]",
                          )}
                        >
                          {formatDate(d.requiredDate)}
                          {late ? ` (${Math.abs(req!)}d late)` : ""}
                        </span>
                      </span>
                      <span className="font-mono-num">
                        {totalPieces} pcs
                        {d.tonnage ? ` · ${d.tonnage} tn` : ""}
                      </span>
                      {d.carrier && <span>{d.carrier}</span>}
                    </div>
                    {d.issue && (
                      <div className="mt-1 text-xs text-[var(--color-warn)]">{d.issue}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {d.lines.slice(0, 4).map((l) => (
                      <span
                        key={l.mark}
                        className={cn(
                          "rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono-num text-[11px]",
                          shortLines.some((s) => s.mark === l.mark)
                            ? "border-[var(--color-danger)]/50 text-[var(--color-danger)]"
                            : "border-[var(--color-border)]",
                        )}
                      >
                        {l.mark} ×{l.qty}
                      </span>
                    ))}
                    {d.lines.length > 4 && (
                      <span className="text-[11px] text-[var(--color-subtle)]">
                        +{d.lines.length - 4}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Status
                        </label>
                        <Select
                          aria-label="Status"
                          value={d.status}
                          onChange={(e) =>
                            setDeliveryStatus(d.id, e.target.value as DeliveryStatus)
                          }
                        >
                          {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {DELIVERY_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Ship date
                        </label>
                        <Input
                          aria-label="Ship date"
                          type="date"
                          value={d.shipDate ?? ""}
                          onChange={(e) =>
                            updateDelivery(d.id, {
                              shipDate: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Required on site
                        </label>
                        <Input
                          aria-label="Required on site"
                          type="date"
                          value={d.requiredDate ?? ""}
                          onChange={(e) =>
                            updateDelivery(d.id, {
                              requiredDate: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                          Truck #
                        </label>
                        <Input
                          aria-label="Truck number"
                          value={d.truckNumber ?? ""}
                          onChange={(e) =>
                            updateDelivery(d.id, {
                              truckNumber: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-subtle)]">
                        Load contents — enter received qty at the gate
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-sm">
                          <thead>
                            <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                              <th className="py-2 pr-3 font-medium">Mark</th>
                              <th className="py-2 pr-3 font-medium">Qty</th>
                              <th className="py-2 pr-3 font-medium">Lbs ea</th>
                              <th className="py-2 pr-3 font-medium">Received</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {d.lines.map((l) => {
                              const key = `${d.id}:${l.mark}`;
                              const val = receiveDraft[key] ?? l.received ?? l.qty;
                              const short = val < l.qty;
                              return (
                                <tr key={l.mark}>
                                  <td className="py-2 pr-3 font-mono-num">{l.mark}</td>
                                  <td className="py-2 pr-3 font-mono-num">{l.qty}</td>
                                  <td className="py-2 pr-3 font-mono-num text-[var(--color-muted)]">
                                    {l.weightLbs ?? "—"}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <Input
                                      aria-label={`Received ${l.mark}`}
                                      type="number"
                                      value={String(val)}
                                      onChange={(e) =>
                                        setReceiveDraft((prev) => ({
                                          ...prev,
                                          [key]: Number(e.target.value),
                                        }))
                                      }
                                      className={cn(
                                        "h-8 w-24 font-mono-num",
                                        short && "border-[var(--color-danger)]/50",
                                      )}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const received = d.lines.map((l) => {
                            const key = `${d.id}:${l.mark}`;
                            return {
                              mark: l.mark,
                              received: receiveDraft[key] ?? l.received ?? l.qty,
                            };
                          });
                          receiveDelivery(d.id, received);
                          toast.success(`${d.loadNumber} receiving recorded`);
                        }}
                      >
                        Record receiving
                      </Button>
                      {d.status !== "exception" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDeliveryStatus(
                              d.id,
                              "exception",
                              "Flagged short / damaged at the gate — see load contents.",
                            );
                            toast.success("Flagged — replacement task raised");
                          }}
                        >
                          Flag short / damaged
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          deleteDelivery(d.id);
                          toast.success("Load deleted");
                        }}
                      >
                        Delete
                      </Button>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                        Notes
                      </label>
                      <textarea
                        value={d.notes ?? ""}
                        onChange={(e) =>
                          updateDelivery(d.id, {
                            notes: e.target.value || undefined,
                          })
                        }
                        rows={2}
                        className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                      />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
