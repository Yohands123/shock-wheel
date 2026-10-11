import { Badge, type BadgeProps } from "@mantine/core";
import type { ExceptionPriority, ExceptionStatus, SeverityLabel } from "../graphql";
import { sentence } from "../format";

const PRIORITY: Record<ExceptionPriority, Pick<BadgeProps, "color" | "variant">> = {
  CRITICAL: { color: "breach", variant: "filled" },
  HIGH: { color: "breach", variant: "light" },
  MEDIUM: { color: "brass", variant: "light" },
  LOW: { color: "steel", variant: "light" },
};

export function PriorityBadge({ priority }: { priority: ExceptionPriority }) {
  return <Badge {...PRIORITY[priority]}>{sentence(priority)}</Badge>;
}

const STATUS: Record<ExceptionStatus, string> = {
  OPEN: "brass",
  ASSIGNED: "steel",
  ESCALATED: "breach",
  RESOLVED: "cleared",
};

export function StatusBadge({ status }: { status: ExceptionStatus }) {
  return (
    <Badge variant="dot" color={STATUS[status]} c="ink.6" styles={{ root: { background: "transparent" } }}>
      {sentence(status)}
    </Badge>
  );
}

const SEVERITY: Record<SeverityLabel, Pick<BadgeProps, "color" | "variant">> = {
  MILD: { color: "steel", variant: "light" },
  SEVERE: { color: "breach", variant: "light" },
  TAIL: { color: "breach", variant: "filled" },
};

export function SeverityBadge({ label, multiplier }: { label: SeverityLabel; multiplier?: number }) {
  return (
    <Badge size="lg" {...SEVERITY[label]}>
      {sentence(label)}
      {multiplier !== undefined ? ` · ${multiplier}× shock` : ""}
    </Badge>
  );
}

export function SourceTag({ source }: { source: string }) {
  const isClaude = source.toLowerCase() === "claude";
  return (
    <Badge variant="outline" color={isClaude ? "brass" : "steel"} size="sm" c={isClaude ? "brass.8" : "steel.7"}>
      {isClaude ? "Claude" : "Template"}
    </Badge>
  );
}
