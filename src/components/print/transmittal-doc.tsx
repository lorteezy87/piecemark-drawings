import type { Drawing, Project, Transmittal } from "@/lib/types";
import { TRANSMITTAL_KIND_LABELS, TRANSMITTAL_STATUS_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function TransmittalDoc({
  project,
  tr,
  drawings,
}: {
  project: Project;
  tr: Transmittal;
  drawings: Drawing[];
}) {
  const byId = new Map(drawings.map((d) => [d.id, d]));
  return (
    <article className="mx-auto max-w-[8.5in] bg-white p-8 text-black print:p-0">
      <header className="border-b-2 border-black pb-4">
        <div className="text-xs font-semibold tracking-[0.2em] uppercase">
          PieceMark · Steel Drawings Control
        </div>
        <h1 className="mt-2 text-2xl font-bold">Transmittal {tr.number}</h1>
        <p className="mt-1 text-sm">{tr.title}</p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase text-neutral-600">Job</dt>
          <dd>
            {project.jobNumber} — {project.name}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-neutral-600">Kind</dt>
          <dd>{TRANSMITTAL_KIND_LABELS[tr.kind]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-neutral-600">
            Recipient
          </dt>
          <dd>{tr.recipient || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-neutral-600">Status</dt>
          <dd>{TRANSMITTAL_STATUS_LABELS[tr.status]}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-neutral-600">
            Issued
          </dt>
          <dd>
            {tr.issuedDate ? formatDate(tr.issuedDate) : "—"} by {tr.issuedBy}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-neutral-600">
            Purpose
          </dt>
          <dd>{tr.purpose || "—"}</dd>
        </div>
      </dl>

      {tr.notes && (
        <p className="mt-4 text-sm">
          <strong>Notes:</strong> {tr.notes}
        </p>
      )}

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Drawing</th>
            <th className="py-2 pr-2">Title</th>
            <th className="py-2 pr-2">Rev</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {tr.items.map((it, i) => {
            const d = byId.get(it.drawingId);
            return (
              <tr key={`${it.drawingId}-${i}`} className="border-b border-neutral-300">
                <td className="py-2 pr-2 font-mono">{i + 1}</td>
                <td className="py-2 pr-2 font-mono">{d?.number ?? it.drawingId}</td>
                <td className="py-2 pr-2">{d?.title ?? "—"}</td>
                <td className="py-2 pr-2 font-mono">{it.rev}</td>
                <td className="py-2">{d?.status?.replace(/_/g, " ") ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <footer className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <div className="border-b border-black pb-8">Issued by</div>
          <div className="mt-1 text-xs text-neutral-600">{tr.issuedBy}</div>
        </div>
        <div>
          <div className="border-b border-black pb-8">Received by</div>
          <div className="mt-1 text-xs text-neutral-600">Signature / date</div>
        </div>
      </footer>

      <p className="mt-8 text-[10px] text-neutral-500">
        Generated {new Date().toLocaleString()} · Controlled document — destroy
        superseded copies
      </p>
    </article>
  );
}
