import { Badge } from "@/components/ui/badge";
import {
  BALL_IN_COURT_LABELS,
  CHANGE_ORDER_STATUS_LABELS,
  CHANGE_ORDER_TYPE_LABELS,
  DELIVERY_STATUS_LABELS,
  ROADBLOCK_SEVERITY_LABELS,
  ROADBLOCK_STATUS_LABELS,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  WORK_PACKAGE_STATUS_LABELS,
  WORK_PACKAGE_TYPE_LABELS,
  type BallInCourt,
  type ChangeOrderStatus,
  type ChangeOrderType,
  type DeliveryStatus,
  type RoadblockSeverity,
  type RoadblockStatus,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
  type WorkPackageStatus,
  type WorkPackageType,
} from "@/lib/types";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const variant =
    status === "done"
      ? "success"
      : status === "blocked"
        ? "danger"
        : status === "in_progress"
          ? "info"
          : "default";
  return <Badge variant={variant}>{TASK_STATUS_LABELS[status]}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "normal") return null;
  return (
    <Badge variant={priority === "hot" ? "danger" : "default"}>
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function TaskCategoryBadge({ category }: { category: TaskCategory }) {
  return <Badge>{TASK_CATEGORY_LABELS[category]}</Badge>;
}

export function BallInCourtBadge({ who }: { who?: BallInCourt }) {
  if (!who) return null;
  return (
    <Badge variant={who === "internal" ? "primary" : "warn"}>
      {who === "internal" ? "Ours" : `Waiting: ${BALL_IN_COURT_LABELS[who]}`}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const variant =
    status === "received"
      ? "success"
      : status === "exception"
        ? "danger"
        : status === "in_transit" || status === "delivered"
          ? "info"
          : status === "released" || status === "loaded"
            ? "primary"
            : "default";
  return <Badge variant={variant}>{DELIVERY_STATUS_LABELS[status]}</Badge>;
}

export function ChangeOrderStatusBadge({ status }: { status: ChangeOrderStatus }) {
  const variant =
    status === "approved"
      ? "success"
      : status === "rejected" || status === "void"
        ? "danger"
        : status === "submitted"
          ? "info"
          : status === "pending_pricing"
            ? "warn"
            : "default";
  return <Badge variant={variant}>{CHANGE_ORDER_STATUS_LABELS[status]}</Badge>;
}

export function ChangeOrderTypeBadge({ type }: { type: ChangeOrderType }) {
  return (
    <Badge variant={type === "backcharge" ? "warn" : "primary"}>
      {CHANGE_ORDER_TYPE_LABELS[type]}
    </Badge>
  );
}

export function WorkPackageStatusBadge({ status }: { status: WorkPackageStatus }) {
  const variant =
    status === "complete"
      ? "success"
      : status === "blocked"
        ? "danger"
        : status === "in_progress"
          ? "info"
          : "default";
  return <Badge variant={variant}>{WORK_PACKAGE_STATUS_LABELS[status]}</Badge>;
}

export function WorkPackageTypeBadge({ type }: { type: WorkPackageType }) {
  return <Badge>{WORK_PACKAGE_TYPE_LABELS[type]}</Badge>;
}

export function RoadblockSeverityBadge({ severity }: { severity: RoadblockSeverity }) {
  const variant =
    severity === "critical"
      ? "danger"
      : severity === "high"
        ? "warn"
        : severity === "medium"
          ? "info"
          : "default";
  return <Badge variant={variant}>{ROADBLOCK_SEVERITY_LABELS[severity]}</Badge>;
}

export function RoadblockStatusBadge({ status }: { status: RoadblockStatus }) {
  const variant = status === "resolved" ? "success" : status === "mitigating" ? "info" : "warn";
  return <Badge variant={variant}>{ROADBLOCK_STATUS_LABELS[status]}</Badge>;
}
