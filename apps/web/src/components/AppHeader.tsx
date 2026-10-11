import { useMutation, useQuery } from "@apollo/client";
import { Box, Button, Group, Select, Skeleton, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { QUEUE_QUERIES } from "../apollo";
import { errorMessage, moneyWhole } from "../format";
import { QUEUE_STATS, RUN_SWEEP, USERS, type QueueStats } from "../graphql";
import { tokens } from "../theme";

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill={tokens.ink} />
      <path d="M16 16 L16 2 A14 14 0 0 1 28.1 9 Z" fill={tokens.brass} />
      <circle cx="16" cy="16" r="3.5" fill={tokens.ground} />
    </svg>
  );
}

/** Lead number plus the queue's status mix as a proportional bar with a count legend. */
function QueueHealth({ stats }: { stats: QueueStats }) {
  const active = stats.open + stats.assigned + stats.escalated;
  const total = Math.max(active, 1);
  const parts = [
    { label: "Open", value: stats.open, color: tokens.brass },
    { label: "Assigned", value: stats.assigned, color: tokens.steel },
    { label: "Escalated", value: stats.escalated, color: tokens.breach },
  ];
  return (
    <Group gap={32} wrap="nowrap" className="queue-health">
      <div>
        <Text className="display num" fz={24} fw={600} lh={1.1} c={stats.openDeficit > 0 ? tokens.breach : tokens.ink}>
          {moneyWhole(stats.openDeficit)}
        </Text>
        <Text fz={13} c={tokens.steel} style={{ whiteSpace: "nowrap" }}>
          Open deficit across {active} {active === 1 ? "exception" : "exceptions"}
        </Text>
      </div>
      <div className="queue-health-mix">
        <div
          role="img"
          aria-label={`Queue mix: ${parts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")}`}
          style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: tokens.neutralTint }}
        >
          {parts.map((p) =>
            p.value > 0 ? <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} /> : null,
          )}
        </div>
        <Group gap={16} mt={8} wrap="nowrap" aria-hidden>
          {parts.map((p) => (
            <Group key={p.label} gap={6} wrap="nowrap">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
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
  );
}

export function AppHeader({ userId, onUserChange }: { userId: string; onUserChange: (id: string) => void }) {
  const users = useQuery(USERS);
  const stats = useQuery(QUEUE_STATS);
  const [sweep, sweepState] = useMutation(RUN_SWEEP, { refetchQueries: QUEUE_QUERIES, awaitRefetchQueries: true });

  const runSweep = async () => {
    try {
      const { data } = await sweep();
      const r = data?.runMarginSweep;
      if (!r) return;
      notifications.show(
        r.skippedLocked
          ? { color: "steel", title: "Sweep already running", message: "Another sweep holds the lock. Try again in a moment." }
          : {
              color: r.created > 0 ? "breach" : "cleared",
              title: "Margin sweep finished",
              message: `Checked ${r.checked} accounts: ${r.breaches} in breach, ${r.created} new ${r.created === 1 ? "exception" : "exceptions"}.`,
            },
      );
    } catch (err) {
      notifications.show({ color: "breach", ...errorMessage(err) });
    }
  };

  const s = stats.data?.queueStats;

  return (
    <header className="app-header">
      <Box className="app-header-inner">
        <Group gap={10} wrap="nowrap" className="app-header-brand">
          <Mark />
          <Text component="h1" className="display" fz={19} fw={700} m={0} lh={1}>
            Shock Wheel
          </Text>
        </Group>

        <Box className="app-header-stats" aria-live="polite">
          {s ? <QueueHealth stats={s} /> : <Skeleton h={40} w={420} maw="100%" />}
        </Box>

        <Group gap="sm" wrap="nowrap" className="app-header-actions">
          <Select
            aria-label="Acting as"
            w={{ base: 150, sm: 180 }}
            data={(users.data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))}
            value={userId}
            onChange={(v) => v && onUserChange(v)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true, shadow: "md" }}
          />
          <Button variant="default" loading={sweepState.loading} onClick={runSweep}>
            Run margin sweep
          </Button>
        </Group>
      </Box>
    </header>
  );
}
