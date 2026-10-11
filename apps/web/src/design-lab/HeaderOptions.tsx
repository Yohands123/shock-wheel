import { Button, Group, Select, Text } from "@mantine/core";
import type { QueueStats, User } from "../graphql";
import { moneyWhole } from "../format";
import { tokens } from "../theme";

export interface HeaderProps {
  stats: QueueStats;
  users: User[];
  userId: string;
}

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill={tokens.ink} />
      <path d="M16 16 L16 2 A14 14 0 0 1 28.1 9 Z" fill={tokens.brass} />
      <circle cx="16" cy="16" r="3.5" fill={tokens.ground} />
    </svg>
  );
}

function Brand() {
  return (
    <Group gap={10} wrap="nowrap">
      <Mark />
      <Text component="span" className="display" fz={19} fw={700} lh={1}>
        Shock Wheel
      </Text>
    </Group>
  );
}

function Actions({ users, userId }: Pick<HeaderProps, "users" | "userId">) {
  return (
    <Group gap="sm" wrap="nowrap">
      <Select
        aria-label="Acting as"
        w={180}
        data={users.map((u) => ({ value: u.id, label: u.name }))}
        value={userId}
        allowDeselect={false}
      />
      <Button variant="default">Run margin sweep</Button>
    </Group>
  );
}

const deficitColor = (n: number) => (n > 0 ? tokens.breach : tokens.ink);

/* A: Ledger. Stats as evenly spaced columns, number over label, centred between brand and actions. */
export function HeaderLedger({ stats, users, userId }: HeaderProps) {
  const items = [
    { label: "Open", value: String(stats.open) },
    { label: "Assigned", value: String(stats.assigned) },
    { label: "Escalated", value: String(stats.escalated) },
    { label: "Open deficit", value: moneyWhole(stats.openDeficit), color: deficitColor(stats.openDeficit) },
  ];
  return (
    <header style={{ height: 64, background: tokens.surface, borderBottom: `1px solid ${tokens.line}` }}>
      <Group h="100%" px={24} justify="space-between" wrap="nowrap">
        <Brand />
        <Group gap={40} wrap="nowrap">
          {items.map((s) => (
            <div key={s.label} style={{ lineHeight: 1.1 }}>
              <Text className="display num" fz={24} fw={600} lh={1.1} c={s.color ?? tokens.ink}>
                {s.value}
              </Text>
              <Text fz={13} c={tokens.steel}>
                {s.label}
              </Text>
            </div>
          ))}
        </Group>
        <Actions users={users} userId={userId} />
      </Group>
    </header>
  );
}

/* B: Readout. Header sits on the ground; counts read as one line ("20 open  0 assigned"), deficit set apart. */
export function HeaderReadout({ stats, users, userId }: HeaderProps) {
  const counts = [
    { label: "open", value: stats.open },
    { label: "assigned", value: stats.assigned },
    { label: "escalated", value: stats.escalated },
  ];
  return (
    <header style={{ height: 64, background: tokens.ground, borderBottom: `1px solid ${tokens.line}` }}>
      <Group h="100%" px={24} gap={32} wrap="nowrap">
        <Brand />
        <Group gap={24} wrap="nowrap" align="baseline" style={{ flex: 1 }}>
          {counts.map((c) => (
            <Group key={c.label} gap={6} wrap="nowrap" align="baseline">
              <Text className="display num" fz={24} fw={600} lh={1}>
                {c.value}
              </Text>
              <Text fz={13} c={tokens.steel}>
                {c.label}
              </Text>
            </Group>
          ))}
          <div style={{ width: 1, height: 28, background: tokens.line, alignSelf: "center" }} />
          <Group gap={8} wrap="nowrap" align="baseline">
            <Text fz={13} c={tokens.steel}>
              Open deficit
            </Text>
            <Text className="display num" fz={24} fw={600} lh={1} c={deficitColor(stats.openDeficit)}>
              {moneyWhole(stats.openDeficit)}
            </Text>
          </Group>
        </Group>
        <Actions users={users} userId={userId} />
      </Group>
    </header>
  );
}

/* C: Deficit-led. One lead number, with the queue's status mix as a proportional bar and a count legend. */
export function HeaderDeficitLed({ stats, users, userId }: HeaderProps) {
  const total = Math.max(stats.open + stats.assigned + stats.escalated, 1);
  const parts = [
    { label: "Open", value: stats.open, color: tokens.brass },
    { label: "Assigned", value: stats.assigned, color: tokens.steel },
    { label: "Escalated", value: stats.escalated, color: tokens.breach },
  ];
  return (
    <header style={{ height: 64, background: tokens.surface, borderBottom: `1px solid ${tokens.line}` }}>
      <Group h="100%" px={24} gap={40} wrap="nowrap">
        <Brand />
        <Group gap={32} wrap="nowrap" style={{ flex: 1 }}>
          <div>
            <Text className="display num" fz={24} fw={600} lh={1.1} c={deficitColor(stats.openDeficit)}>
              {moneyWhole(stats.openDeficit)}
            </Text>
            <Text fz={13} c={tokens.steel}>
              Open deficit across {total} {total === 1 ? "exception" : "exceptions"}
            </Text>
          </div>
          <div style={{ width: 320 }}>
            <div
              role="img"
              aria-label={parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")}
              style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: tokens.neutralTint }}
            >
              {parts.map((p) =>
                p.value > 0 ? <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} /> : null,
              )}
            </div>
            <Group gap={16} mt={8} wrap="nowrap">
              {parts.map((p) => (
                <Group key={p.label} gap={6} wrap="nowrap">
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} aria-hidden />
                  <Text fz={13} c={tokens.steel} style={{ whiteSpace: "nowrap" }}>
                    {p.label}{" "}
                    <Text span fz={13} fw={600} c={tokens.ink} className="num">
                      {p.value}
                    </Text>
                  </Text>
                </Group>
              ))}
            </Group>
          </div>
        </Group>
        <Actions users={users} userId={userId} />
      </Group>
    </header>
  );
}
