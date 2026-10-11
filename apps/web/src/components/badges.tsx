import { Badge, Group, Text, type BadgeProps } from "@mantine/core";
import type { ReactNode } from "react";
import { tokens } from "../theme";
import type { ExceptionPriority, ExceptionStatus, SeverityLabel } from "../graphql";
import { sentence } from "../format";

// Table cells can squeeze a badge below its text width; keep the full label instead
const NO_TRUNCATE = { root: { minWidth: "max-content", flexShrink: 0 }, label: { overflow: "visible" } };

const PRIORITY: Record<ExceptionPriority, Pick<BadgeProps, "color" | "variant">> = {
  CRITICAL: { color: "breach", variant: "filled" },
  HIGH: { color: "breach", variant: "light" },
  MEDIUM: { color: "brass", variant: "light" },
  LOW: { color: "steel", variant: "light" },
};

export function PriorityBadge({ priority }: { priority: ExceptionPriority }) {
  return (
    <Badge {...PRIORITY[priority]} styles={NO_TRUNCATE}>
      {sentence(priority)}
    </Badge>
  );
}

const STATUS_DOT: Record<ExceptionStatus, string> = {
  OPEN: tokens.brass,
  ASSIGNED: tokens.steel,
  ESCALATED: tokens.breach,
  RESOLVED: tokens.cleared,
};

/** Status is a 6px dot plus text, no box. Pass children to say more ("Assigned to Theo"). */
export function StatusBadge({ status, children }: { status: ExceptionStatus; children?: ReactNode }) {
  return (
    <Group gap={8} wrap="nowrap" component="span" style={{ display: "inline-flex" }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: STATUS_DOT[status], flexShrink: 0 }} aria-hidden />
      <Text span fz={15} c="inherit" style={{ whiteSpace: "nowrap" }}>
        {children ?? sentence(status)}
      </Text>
    </Group>
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
  return (
    <Badge color="steel" variant="light">
      {source.toLowerCase() === "claude" ? "Claude" : "Template"}
    </Badge>
  );
}
