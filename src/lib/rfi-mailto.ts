import type { Project, RFI } from "@/lib/types";
import { RFI_PRIORITY_LABELS, RFI_STATUS_LABELS } from "@/lib/types";

/** Build a mailto: link so RFI can leave the app without an email server. */
export function buildRfiMailto(opts: {
  rfi: RFI;
  project: Project;
  to?: string;
  drawings?: { number: string; title: string }[];
}): string {
  const { rfi, project, to, drawings } = opts;
  const subject = encodeURIComponent(
    `[RFI ${rfi.number}] ${project.jobNumber} — ${rfi.subject}`,
  );
  const dwgLines =
    drawings && drawings.length
      ? drawings.map((d) => `  - ${d.number}: ${d.title}`).join("\n")
      : "  (see drawing register)";
  const body = encodeURIComponent(
    [
      `Job: ${project.jobNumber} — ${project.name}`,
      `Location: ${project.location}`,
      `RFI: ${rfi.number}`,
      `Priority: ${RFI_PRIORITY_LABELS[rfi.priority]}`,
      `Status: ${RFI_STATUS_LABELS[rfi.status]}`,
      `Raised by: ${rfi.raisedBy}`,
      `Date: ${rfi.raisedDate}`,
      "",
      "Question:",
      rfi.question,
      "",
      "Related drawings:",
      dwgLines,
      "",
      rfi.answer ? `Answer:\n${rfi.answer}` : "Answer: (pending)",
      "",
      "— Sent from PieceMark drawings control",
    ].join("\n"),
  );
  const addr = to?.trim() || "";
  return `mailto:${addr}?subject=${subject}&body=${body}`;
}
