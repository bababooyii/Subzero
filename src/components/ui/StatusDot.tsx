import { cn } from "@/helpers/classname-helper";
import { statusDot, statusDotMark } from "@/lib/ui";

export type StatusKey =
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "paused"
  | "partial"
  | "overdue"
  | "paid"
  | "closed"
  | "cancelled";

const STATUS: Record<StatusKey, { color: string; label: string; ring?: boolean }> = {
  draft: { color: "#6b6a66", label: "Draft" },
  quotation: { color: "#9a9994", label: "Quotation", ring: true },
  confirmed: { color: "#ececea", label: "Confirmed" },
  active: { color: "#34d399", label: "Active" },
  paused: { color: "#fbbf24", label: "Paused" },
  partial: { color: "#fbbf24", label: "Partially paid" },
  overdue: { color: "#f43f5e", label: "Overdue" },
  paid: { color: "#34d399", label: "Paid" },
  closed: { color: "#4a4a48", label: "Closed" },
  cancelled: { color: "#4a4a48", label: "Cancelled" },
};

type Props = {
  status: StatusKey;
  /** Override the label text. */
  label?: string;
  /** Use the primary text colour for the label (a record's own page). */
  strong?: boolean;
  className?: string;
};

/** 6px dot plus a muted label. Only the dot is coloured. */
export function StatusDot({ status, label, strong, className }: Props) {
  const s = STATUS[status];
  return (
    <span className={cn(statusDot, strong && "text-text", className)}>
      <span
        aria-hidden="true"
        className={statusDotMark}
        style={s.ring ? { boxShadow: `inset 0 0 0 1.25px ${s.color}` } : { background: s.color }}
      />
      {label ?? s.label}
    </span>
  );
}

export function statusLabel(status: StatusKey): string {
  return STATUS[status].label;
}
