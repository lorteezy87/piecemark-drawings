import type { Drawing, Project, Sequence } from "@/lib/types";
import {
  DRAWING_STATUS_LABELS,
  DRAWING_TYPE_LABELS,
  SHOP_QUEUE_STATUSES,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function ShopPackageDoc({
  project,
  drawings,
  sequences,
}: {
  project: Project;
  drawings: Drawing[];
  sequences: Sequence[];
}) {
  const shop = drawings
    .filter((d) => SHOP_QUEUE_STATUSES.includes(d.status) || d.type === "shop")
    .sort((a, b) => a.number.localeCompare(b.number));
  const seqMap = new Map(sequences.map((s) => [s.id, s]));

  return (
    <article className="mx-auto max-w-[8.5in] bg-white p-8 text-black print:p-0">
      <header className="border-b-2 border-black pb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em]">
          Fab shop package
        </div>
        <h1 className="mt-2 text-2xl font-bold">
          {project.jobNumber} — Shop release set
        </h1>
        <p className="mt-1 text-sm">
          {project.name} · {project.fabShop || "Fab shop TBD"}
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Printed {formatDate(new Date().toISOString().slice(0, 10))} · Issued /
          fab-ready sheets
        </p>
      </header>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs uppercase">
            <th className="py-2">Sheet</th>
            <th className="py-2">Title</th>
            <th className="py-2">Rev</th>
            <th className="py-2">Type</th>
            <th className="py-2">Seq</th>
            <th className="py-2">Status</th>
            <th className="py-2">Pieces</th>
          </tr>
        </thead>
        <tbody>
          {shop.map((d) => (
            <tr key={d.id} className="border-b border-neutral-300">
              <td className="py-2 font-mono font-semibold">{d.number}</td>
              <td className="py-2">{d.title}</td>
              <td className="py-2 font-mono">{d.currentRev}</td>
              <td className="py-2">{DRAWING_TYPE_LABELS[d.type]}</td>
              <td className="py-2">
                {d.sequenceId
                  ? (seqMap.get(d.sequenceId)?.name ?? d.sequenceId)
                  : "—"}
              </td>
              <td className="py-2">{DRAWING_STATUS_LABELS[d.status]}</td>
              <td className="py-2 font-mono">{d.pieceMarks.length}</td>
            </tr>
          ))}
          {shop.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-neutral-500">
                No fab-queue sheets in this job yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide">
          Piece marks (shop sheets)
        </h2>
        <div className="mt-2 columns-3 gap-4 text-xs font-mono">
          {shop.flatMap((d) =>
            d.pieceMarks.map((m) => (
              <div key={`${d.id}-${m}`}>
                {m} · {d.number} · {d.currentRev}
              </div>
            )),
          )}
        </div>
      </section>
    </article>
  );
}
