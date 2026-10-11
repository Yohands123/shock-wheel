import { Badge, Box, Chip, Group, MultiSelect, SegmentedControl, Switch, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import { age, money, sentence } from "../format";
import type { ExceptionPriority, ExceptionRow, ExceptionStatus } from "../graphql";
import { tokens } from "../theme";

export interface TableOptionProps {
  rows: ExceptionRow[];
}

const PRIORITY_BADGE: Record<ExceptionPriority, { color: string; variant: "filled" | "light" }> = {
  CRITICAL: { color: "breach", variant: "filled" },
  HIGH: { color: "breach", variant: "light" },
  MEDIUM: { color: "brass", variant: "light" },
  LOW: { color: "steel", variant: "light" },
};
const PRIORITY_RULE: Record<ExceptionPriority, string> = {
  CRITICAL: tokens.breach,
  HIGH: "#D9877D",
  MEDIUM: tokens.brass,
  LOW: tokens.line,
};
const STATUS_DOT: Record<ExceptionStatus, string> = {
  OPEN: tokens.brass,
  ASSIGNED: tokens.steel,
  ESCALATED: tokens.breach,
  RESOLVED: tokens.cleared,
};

function PriorityBadge({ p }: { p: ExceptionPriority }) {
  return (
    <Badge {...PRIORITY_BADGE[p]} styles={{ root: { minWidth: "max-content" }, label: { overflow: "visible" } }}>
      {sentence(p)}
    </Badge>
  );
}

function StatusDot({ s, children }: { s: ExceptionStatus; children?: ReactNode }) {
  return (
    <Group gap={8} wrap="nowrap">
      <span style={{ width: 6, height: 6, borderRadius: 3, background: STATUS_DOT[s], flexShrink: 0 }} aria-hidden />
      <Text fz={15} c="inherit" style={{ whiteSpace: "nowrap" }}>
        {children ?? sentence(s)}
      </Text>
    </Group>
  );
}

const th = (align: "left" | "right" = "left"): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: 600,
  color: tokens.steel,
  textAlign: align,
  padding: "0 12px",
  height: 40,
  borderBottom: `1px solid ${tokens.line}`,
  position: "sticky",
  top: 0,
  background: tokens.surface,
  whiteSpace: "nowrap",
});
const td = (align: "left" | "right" = "left"): React.CSSProperties => ({
  padding: "0 12px",
  height: 52,
  textAlign: align,
  borderBottom: `1px solid ${tokens.line}`,
  fontSize: 15,
  whiteSpace: "nowrap",
});
const rowColor = (r: ExceptionRow) => (r.status === "RESOLVED" ? tokens.steel : tokens.ink);

function Account({ r, meta }: { r: ExceptionRow; meta?: string }) {
  return (
    <div style={{ lineHeight: 1.25 }}>
      <Text fz={15} fw={600} c="inherit" truncate maw={190}>
        {r.account.name}
      </Text>
      <Text fz={13} c={tokens.steel} className="num">
        {meta ?? r.account.id}
      </Text>
    </div>
  );
}

function Money({ n, strong }: { n: number; strong?: boolean }) {
  return (
    <Text span fz={strong ? 16 : 15} fw={strong ? 650 : 400} className="num" c={n < 0 || strong ? (n > 0 || n < 0 ? tokens.breach : "inherit") : "inherit"}>
      {money(n)}
    </Text>
  );
}

/* ---------- A: Classic columns with a single toolbar ---------- */

export function TableClassic({ rows }: TableOptionProps) {
  return (
    <Box>
      <Group gap={10} px={16} py={16} wrap="nowrap" align="center" style={{ borderBottom: `1px solid ${tokens.line}` }}>
        <TextInput aria-label="Search" placeholder="Search accounts" leftSection={<IconSearch size={16} />} w={200} />
        <MultiSelect aria-label="Status" placeholder="Status" data={["Open", "Assigned", "Escalated", "Resolved"]} w={140} />
        <MultiSelect aria-label="Priority" placeholder="Priority" data={["Critical", "High", "Medium", "Low"]} w={140} />
        <SegmentedControl data={["All", "Sweep", "Scenario"]} />
        <Switch label="This run only" styles={{ label: { whiteSpace: "nowrap" } }} />
      </Group>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th()}>Account</th>
            <th style={th()}>Priority</th>
            <th style={th()}>Status</th>
            <th style={th()}>Source</th>
            <th style={th("right")}>Deficit</th>
            <th style={th("right")}>Equity</th>
            <th style={th()}>Assignee</th>
            <th style={th("right")}>Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="lab-row" style={{ color: rowColor(r) }}>
              <td style={td()}>
                <Account r={r} />
              </td>
              <td style={td()}>
                <PriorityBadge p={r.priority} />
              </td>
              <td style={td()}>
                <StatusDot s={r.status} />
              </td>
              <td style={td()}>{sentence(r.source)}</td>
              <td style={td("right")}>
                <Text span fz={15} fw={600} className="num" c={r.status === "RESOLVED" ? tokens.steel : tokens.breach}>
                  {money(r.deficit)}
                </Text>
              </td>
              <td style={td("right")}>
                <Money n={r.equity} />
              </td>
              <td style={td()}>
                <Text span fz={15} c={r.assignee ? "inherit" : tokens.steel}>
                  {r.assignee?.name ?? "Unassigned"}
                </Text>
              </td>
              <td style={td("right")}>
                <Text span fz={15} c={tokens.steel} className="num">
                  {age(r.createdAt)}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

/* ---------- B: Money first, priority as a rule, saved views instead of filters ---------- */

export function TableMoneyFirst({ rows }: TableOptionProps) {
  const [view, setView] = useState("open");
  return (
    <Box>
      <Group justify="space-between" px={20} py={16} wrap="wrap" gap={12} style={{ borderBottom: `1px solid ${tokens.line}` }}>
        <SegmentedControl
          value={view}
          onChange={setView}
          data={[
            { value: "open", label: "Needs action" },
            { value: "mine", label: "Assigned to me" },
            { value: "escalated", label: "Escalated" },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All" },
          ]}
        />
        <Group gap={12} wrap="nowrap">
          <TextInput aria-label="Search" placeholder="Search" leftSection={<IconSearch size={16} />} w={200} />
          <UnstyledButton fz={15} fw={600} c={tokens.ink} px={12} h={40} style={{ border: `1px solid ${tokens.line}`, borderRadius: 6 }}>
            <Group gap={6} wrap="nowrap">
              More filters <IconChevronDown size={16} aria-hidden />
            </Group>
          </UnstyledButton>
        </Group>
      </Group>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th("right"), width: 150 }}>Deficit</th>
            <th style={th()}>Account</th>
            <th style={th()}>Owner and status</th>
            <th style={th("right")}>Equity</th>
            <th style={th("right")}>Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="lab-row" style={{ color: rowColor(r), boxShadow: `inset 3px 0 0 ${PRIORITY_RULE[r.priority]}` }}>
              <td style={td("right")}>
                <div style={{ lineHeight: 1.25 }}>
                  <Text fz={16} fw={650} className="num" c={r.status === "RESOLVED" ? tokens.steel : tokens.breach}>
                    {money(r.deficit)}
                  </Text>
                  <Text fz={13} c={tokens.steel}>
                    {sentence(r.priority)} priority
                  </Text>
                </div>
              </td>
              <td style={td()}>
                <Account r={r} meta={`${r.account.id}, from ${r.source === "SWEEP" ? "the sweep" : "a scenario run"}`} />
              </td>
              <td style={td()}>
                <StatusDot s={r.status}>
                  {r.status === "OPEN" ? "Unassigned" : r.status === "RESOLVED" ? "Resolved" : `${sentence(r.status)} to ${r.assignee?.name ?? "nobody"}`}
                </StatusDot>
              </td>
              <td style={td("right")}>
                <Money n={r.equity} />
              </td>
              <td style={td("right")}>
                <Text span fz={15} c={tokens.steel} className="num">
                  {age(r.createdAt)}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

/* ---------- C: Grouped by priority, chip filters ---------- */

const PRIORITY_ORDER: ExceptionPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function TableGrouped({ rows }: TableOptionProps) {
  const groups = PRIORITY_ORDER.map((p) => ({ p, rows: rows.filter((r) => r.priority === p) })).filter((g) => g.rows.length);
  return (
    <Box>
      <Group gap={8} px={20} py={16} wrap="wrap" style={{ borderBottom: `1px solid ${tokens.line}` }}>
        <TextInput aria-label="Search" placeholder="Search" leftSection={<IconSearch size={16} />} w={220} mr={8} />
        <Chip.Group multiple defaultValue={["OPEN", "ASSIGNED", "ESCALATED"]}>
          {(["OPEN", "ASSIGNED", "ESCALATED", "RESOLVED"] as ExceptionStatus[]).map((s) => (
            <Chip key={s} value={s} variant="outline" color="brass" radius="sm" styles={{ label: { fontSize: 15, height: 40, paddingInline: 14 } }}>
              {sentence(s)}
            </Chip>
          ))}
        </Chip.Group>
        <Chip variant="outline" color="brass" radius="sm" styles={{ label: { fontSize: 15, height: 40, paddingInline: 14 } }}>
          This run only
        </Chip>
      </Group>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th()}>Account</th>
            <th style={th()}>Status</th>
            <th style={th()}>Assignee</th>
            <th style={th("right")}>Equity</th>
            <th style={th("right")}>Deficit</th>
            <th style={th("right")}>Age</th>
          </tr>
        </thead>
        {groups.map((g) => {
          const total = g.rows.reduce((t, r) => t + r.deficit, 0);
          return (
            <tbody key={g.p}>
              <tr>
                <td colSpan={6} style={{ padding: "16px 16px 8px", borderBottom: `1px solid ${tokens.line}` }}>
                  <Group gap={10}>
                    <PriorityBadge p={g.p} />
                    <Text fz={13} c={tokens.steel} className="num">
                      {g.rows.length} {g.rows.length === 1 ? "exception" : "exceptions"}, {money(total)} deficit
                    </Text>
                  </Group>
                </td>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.id} className="lab-row" style={{ color: rowColor(r) }}>
                  <td style={td()}>
                    <Account r={r} meta={`${r.account.id}, ${r.source === "SWEEP" ? "sweep" : "scenario"}`} />
                  </td>
                  <td style={td()}>
                    <StatusDot s={r.status} />
                  </td>
                  <td style={td()}>
                    <Text span fz={15} c={r.assignee ? "inherit" : tokens.steel}>
                      {r.assignee?.name ?? "Unassigned"}
                    </Text>
                  </td>
                  <td style={td("right")}>
                    <Money n={r.equity} />
                  </td>
                  <td style={td("right")}>
                    <Text span fz={15} fw={600} className="num" c={r.status === "RESOLVED" ? tokens.steel : tokens.breach}>
                      {money(r.deficit)}
                    </Text>
                  </td>
                  <td style={td("right")}>
                    <Text span fz={15} c={tokens.steel} className="num">
                      {age(r.createdAt)}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </Box>
  );
}
