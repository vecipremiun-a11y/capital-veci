import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  INVESTOR_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  OPERATION_STATUS_LABELS,
  RISK_LABELS,
} from "@/lib/constants";

type Variant = NonNullable<BadgeProps["variant"]>;

const STATUS_VARIANT: Record<string, Variant> = {
  // Inversionistas
  ACTIVE: "success",
  FINISHED: "muted",
  RISK: "danger",
  BLOCKED: "danger",
  // Contratos
  DRAFT: "muted",
  SIGNED: "gold",
  EXPIRED: "warning",
  CANCELLED: "muted",
  // Pagos
  PAID: "success",
  PENDING: "warning",
  OVERDUE: "danger",
  SCHEDULED: "outline",
  // Operaciones
  PAUSED: "warning",
};

const RISK_VARIANT: Record<string, Variant> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
};

const ALL_LABELS: Record<string, string> = {
  ...INVESTOR_STATUS_LABELS,
  ...CONTRACT_STATUS_LABELS,
  ...PAYMENT_STATUS_LABELS,
  ...OPERATION_STATUS_LABELS,
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "default"}>
      <span className="size-1.5 rounded-full bg-current" />
      {ALL_LABELS[status] ?? status}
    </Badge>
  );
}

export function RiskBadge({ level }: { level: string }) {
  return (
    <Badge variant={RISK_VARIANT[level] ?? "muted"}>
      {RISK_LABELS[level] ?? level}
    </Badge>
  );
}
