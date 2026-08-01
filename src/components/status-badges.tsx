import { Badge } from "@/components/ui/badge";
import {
  DRAWING_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RFI_PRIORITY_LABELS,
  RFI_STATUS_LABELS,
  SEQUENCE_STATUS_LABELS,
  SUBMITTAL_STATUS_LABELS,
  type DrawingStatus,
  type ProjectStatus,
  type RfiPriority,
  type RfiStatus,
  type SequenceStatus,
  type SubmittalStatus,
} from "@/lib/types";

function drawingVariant(status: DrawingStatus) {
  switch (status) {
    case "issued_for_erection":
    case "issued_for_fab":
    case "approved":
      return "success" as const;
    case "aan":
      return "info" as const;
    case "submitted":
    case "internal_review":
      return "primary" as const;
    case "revise_resubmit":
    case "on_hold":
      return "warn" as const;
    case "void":
    case "superseded":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

export function DrawingStatusBadge({ status }: { status: DrawingStatus }) {
  return (
    <Badge variant={drawingVariant(status)}>{DRAWING_STATUS_LABELS[status]}</Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const variant =
    status === "complete"
      ? "success"
      : status === "erection" || status === "fab"
        ? "info"
        : status === "detailing"
          ? "primary"
          : "default";
  return <Badge variant={variant}>{PROJECT_STATUS_LABELS[status]}</Badge>;
}

export function SequenceStatusBadge({ status }: { status: SequenceStatus }) {
  const variant =
    status === "complete"
      ? "success"
      : status === "erecting" || status === "ready"
        ? "info"
        : status === "fab"
          ? "primary"
          : status === "detailing"
            ? "warn"
            : "default";
  return <Badge variant={variant}>{SEQUENCE_STATUS_LABELS[status]}</Badge>;
}

export function RfiStatusBadge({ status }: { status: RfiStatus }) {
  const variant =
    status === "open"
      ? "warn"
      : status === "answered"
        ? "info"
        : status === "closed"
          ? "success"
          : "default";
  return <Badge variant={variant}>{RFI_STATUS_LABELS[status]}</Badge>;
}

export function RfiPriorityBadge({ priority }: { priority: RfiPriority }) {
  const variant =
    priority === "critical"
      ? "danger"
      : priority === "high"
        ? "warn"
        : priority === "normal"
          ? "default"
          : "default";
  return <Badge variant={variant}>{RFI_PRIORITY_LABELS[priority]}</Badge>;
}

export function SubmittalStatusBadge({ status }: { status: SubmittalStatus }) {
  const variant =
    status === "approved"
      ? "success"
      : status === "aan"
        ? "info"
        : status === "under_review" || status === "submitted"
          ? "primary"
          : status === "resubmit" || status === "rejected"
            ? "warn"
            : "default";
  return <Badge variant={variant}>{SUBMITTAL_STATUS_LABELS[status]}</Badge>;
}
