import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ids")({
  component: IdsValidationPage,
});

type SpecRow = {
  name: string;
  description: string;
  status: "pass" | "fail";
  applicable: number;
  passed: number;
  failed: number;
};

type FailureRow = {
  expressId: number;
  globalId: string;
  ifcType: string;
  name: string;
  tag: string;
  description: string;
  objectType: string;
  specification: string;
  requirement: string;
  missingProperties: string[];
  status: string;
};

type ElementRow = {
  expressId: number;
  globalId: string;
  ifcType: string;
  name: string;
  tag: string;
  failedSpecifications: string[];
  missingProperties: string[];
  failCount: number;
};

type ValidationReport = {
  ids: {
    title?: string;
    version?: string;
    path: string;
    filename: string;
  };
  ifc: {
    path: string;
    filename: string;
    schema: string;
    project?: string | null;
  };
  summary: {
    totalSpecifications: number;
    specificationsPassed: number;
    specificationsFailed: number;
    totalFailureRows: number;
    uniqueElementsFailing: number;
    overallPass: boolean;
  };
  specifications: SpecRow[];
  failures: FailureRow[];
  elements: ElementRow[];
};

function IdsValidationPage() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [specFilter, setSpecFilter] = useState<string>("all");
  const [view, setView] = useState<"elements" | "failures" | "specs">("elements");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/ids/validation-results.json");
        if (!res.ok) throw new Error(`Could not load report (${res.status})`);
        const data = (await res.json()) as ValidationReport;
        if (!cancelled) setReport(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load IDS report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ifcTypes = useMemo(() => {
    if (!report) return [];
    return [...new Set(report.elements.map((e) => e.ifcType))].sort();
  }, [report]);

  const failedSpecs = useMemo(() => {
    if (!report) return [];
    return report.specifications.filter((s) => s.status === "fail");
  }, [report]);

  const filteredElements = useMemo(() => {
    if (!report) return [];
    return report.elements.filter((e) => {
      if (typeFilter !== "all" && e.ifcType !== typeFilter) return false;
      if (
        specFilter !== "all" &&
        !e.failedSpecifications.some((s) => s === specFilter)
      )
        return false;
      return true;
    });
  }, [report, typeFilter, specFilter]);

  const filteredFailures = useMemo(() => {
    if (!report) return [];
    return report.failures.filter((f) => {
      if (typeFilter !== "all" && f.ifcType !== typeFilter) return false;
      if (specFilter !== "all" && f.specification !== specFilter) return false;
      return true;
    });
  }, [report, typeFilter, specFilter]);

  return (
    <AppShell
      title="IDS Validation"
      subtitle="IFC model checked against steel fab & erection IDS"
      actions={
        <Button asChild size="sm" variant="secondary">
          <Link to="/viewer" search={{ mode: "ifc" }}>
            Open IFC viewer
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {loading && (
          <div className="panel flex items-center gap-2 px-5 py-8 text-sm text-[var(--color-muted)]">
            <Loader2 className="size-4 animate-spin" />
            Loading validation report…
          </div>
        )}

        {error && (
          <div className="panel border-[var(--color-danger)]/30 px-5 py-4 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {report && (
          <>
            {/* Summary */}
            <section className="panel p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="size-5 text-[var(--color-accent)]" />
                    <h2 className="text-lg font-semibold tracking-tight">
                      {report.ids.title ?? "IDS validation"}
                    </h2>
                    {report.summary.overallPass ? (
                      <BadgePass />
                    ) : (
                      <BadgeFail label="Non-compliant" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    <span className="font-mono-num">{report.ifc.filename}</span>
                    {" · "}
                    {report.ifc.schema}
                    {report.ifc.project ? ` · ${report.ifc.project}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-subtle)]">
                    IDS: {report.ids.filename}
                    {report.ids.version ? ` v${report.ids.version}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric
                    label="Specs pass"
                    value={`${report.summary.specificationsPassed}/${report.summary.totalSpecifications}`}
                    ok={report.summary.specificationsFailed === 0}
                  />
                  <Metric
                    label="Specs fail"
                    value={report.summary.specificationsFailed}
                    ok={report.summary.specificationsFailed === 0}
                    invert
                  />
                  <Metric
                    label="Elements fail"
                    value={report.summary.uniqueElementsFailing}
                    ok={report.summary.uniqueElementsFailing === 0}
                    invert
                  />
                  <Metric
                    label="Fail rows"
                    value={report.summary.totalFailureRows}
                    ok={report.summary.totalFailureRows === 0}
                    invert
                  />
                </div>
              </div>
            </section>

            {/* Failed specs strip */}
            {failedSpecs.length > 0 && (
              <section className="panel overflow-hidden">
                <div className="border-b border-[var(--color-border)] px-5 py-3">
                  <h3 className="flex items-center gap-2 font-medium">
                    <FileWarning className="size-4 text-[var(--color-warn)]" />
                    Failed specifications
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                        <th className="px-5 py-2.5 font-medium">Specification</th>
                        <th className="px-4 py-2.5 font-medium">Applicable</th>
                        <th className="px-4 py-2.5 font-medium">Failed</th>
                        <th className="px-4 py-2.5 font-medium">Pass rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failedSpecs.map((s) => (
                        <tr
                          key={s.name}
                          className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40"
                        >
                          <td className="px-5 py-2.5">
                            <button
                              type="button"
                              className="text-left font-medium hover:underline"
                              onClick={() => {
                                setSpecFilter(s.name);
                                setView("elements");
                              }}
                            >
                              {s.name}
                            </button>
                            {s.description && (
                              <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                                {s.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num">
                            {s.applicable}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num text-[var(--color-warn)]">
                            {s.failed}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num text-xs">
                            {s.applicable
                              ? `${Math.round((s.passed / s.applicable) * 100)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Filters + view toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] p-0.5">
                {(
                  [
                    ["elements", "Non-compliant elements"],
                    ["failures", "All failure rows"],
                    ["specs", "All specifications"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={view === id ? "secondary" : "ghost"}
                    className="h-8"
                    onClick={() => setView(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Select aria-label="Select field"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 w-40 text-xs"
                >
                  <option value="all">All IFC types</option>
                  {ifcTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <Select aria-label="Select field"
                  value={specFilter}
                  onChange={(e) => setSpecFilter(e.target.value)}
                  className="h-9 w-56 text-xs"
                >
                  <option value="all">All failed specs</option>
                  {failedSpecs.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {view === "elements" && (
              <section className="panel overflow-hidden">
                <div className="border-b border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-muted)]">
                  <AlertTriangle className="mr-1.5 inline size-3.5 text-[var(--color-warn)]" />
                  {filteredElements.length} non-compliant element
                  {filteredElements.length === 1 ? "" : "s"} (unique) with missing
                  properties
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                        <th className="px-5 py-2.5 font-medium">Express ID</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5 font-medium">Tag</th>
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Missing properties</th>
                        <th className="px-4 py-2.5 font-medium">Failed specs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredElements.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-10 text-center text-[var(--color-muted)]"
                          >
                            No non-compliant elements for this filter.
                          </td>
                        </tr>
                      )}
                      {filteredElements.map((e) => (
                        <tr
                          key={e.expressId}
                          className="border-b border-[var(--color-border)]/60 align-top hover:bg-[var(--color-surface-2)]/40"
                        >
                          <td className="px-5 py-2.5 font-mono-num text-xs">
                            #{e.expressId}
                          </td>
                          <td className="px-4 py-2.5 text-xs">{e.ifcType}</td>
                          <td className="px-4 py-2.5 font-mono-num font-medium">
                            {e.tag || "—"}
                          </td>
                          <td className="max-w-[180px] truncate px-4 py-2.5 text-[var(--color-muted)]">
                            {e.name || "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {e.missingProperties.map((m) => (
                                <span
                                  key={m}
                                  className="rounded-[var(--radius-sm)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-warn)]"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[var(--color-muted)]">
                            <span className="font-mono-num text-[var(--color-fg)]">
                              {e.failCount}
                            </span>
                            <ul className="mt-1 list-inside list-disc space-y-0.5">
                              {e.failedSpecifications.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {view === "failures" && (
              <section className="panel overflow-hidden">
                <div className="border-b border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-muted)]">
                  {filteredFailures.length} failure row
                  {filteredFailures.length === 1 ? "" : "s"} (element ×
                  specification)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                        <th className="px-5 py-2.5 font-medium">ID</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5 font-medium">Tag / Name</th>
                        <th className="px-4 py-2.5 font-medium">Specification</th>
                        <th className="px-4 py-2.5 font-medium">Missing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFailures.map((f, i) => (
                        <tr
                          key={`${f.expressId}-${f.specification}-${i}`}
                          className="border-b border-[var(--color-border)]/60 align-top hover:bg-[var(--color-surface-2)]/40"
                        >
                          <td className="px-5 py-2.5 font-mono-num text-xs">
                            #{f.expressId}
                          </td>
                          <td className="px-4 py-2.5 text-xs">{f.ifcType}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-mono-num font-medium">
                              {f.tag || "—"}
                            </div>
                            <div className="text-xs text-[var(--color-muted)]">
                              {f.name}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs">{f.specification}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {f.missingProperties.map((m) => (
                                <span
                                  key={m}
                                  className="rounded-[var(--radius-sm)] border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-1.5 py-0.5 text-[11px] text-[var(--color-warn)]"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {view === "specs" && (
              <section className="panel overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wider text-[var(--color-subtle)]">
                        <th className="px-5 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Specification</th>
                        <th className="px-4 py-2.5 font-medium">Pass</th>
                        <th className="px-4 py-2.5 font-medium">Fail</th>
                        <th className="px-4 py-2.5 font-medium">Applicable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.specifications.map((s) => (
                        <tr
                          key={s.name}
                          className="border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40"
                        >
                          <td className="px-5 py-2.5">
                            {s.status === "pass" ? (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
                                <CheckCircle2 className="size-3.5" /> Pass
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-[var(--color-warn)]">
                                <XCircle className="size-3.5" /> Fail
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{s.name}</div>
                            {s.description && (
                              <div className="text-xs text-[var(--color-muted)]">
                                {s.description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num">{s.passed}</td>
                          <td className="px-4 py-2.5 font-mono-num">{s.failed}</td>
                          <td className="px-4 py-2.5 font-mono-num">
                            {s.applicable}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  ok,
  invert,
}: {
  label: string;
  value: string | number;
  ok?: boolean;
  invert?: boolean;
}) {
  const warn = invert ? !ok : ok === false;
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5">
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

function BadgePass() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-success)]">
      <CheckCircle2 className="size-3" /> Pass
    </span>
  );
}

function BadgeFail({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-warn)]/30 bg-[var(--color-warn-bg)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-warn)]">
      <XCircle className="size-3" /> {label}
    </span>
  );
}
