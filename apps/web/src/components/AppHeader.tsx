import { useMutation, useQuery } from "@apollo/client";
import { Box, Button, Container, Group, Select, Skeleton, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconRadar2 } from "@tabler/icons-react";
import { QUEUE_QUERIES } from "../apollo";
import { errorMessage, moneyWhole } from "../format";
import { QUEUE_STATS, RUN_SWEEP, USERS } from "../graphql";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="stat">
      <Text component="span" fw={650} fz="lg" className="num" c={tone}>
        {value}
      </Text>
      <Text component="span" fz="xs" c="dimmed">
        {label}
      </Text>
    </div>
  );
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#172030" />
      <path d="M16 16 L16 2 A14 14 0 0 1 28.1 9 Z" fill="#B8862B" />
      <circle cx="16" cy="16" r="3.5" fill="#EDF0F2" />
    </svg>
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
      <Container size={1440} px={{ base: "md", md: "xl" }} py="sm">
        <Group justify="space-between" gap="md" wrap="wrap">
          <Group gap={10} wrap="nowrap">
            <Mark />
            <Text component="h1" className="display" fz={22} fw={700} m={0} lh={1}>
              Shock Wheel
            </Text>
          </Group>

          <Group gap="md" wrap="nowrap" aria-label="Queue stats" role="group" style={{ order: 3, flexBasis: "auto" }} visibleFrom="sm">
            {s ? (
              <>
                <Stat label="Open" value={String(s.open)} />
                <Stat label="Assigned" value={String(s.assigned)} />
                <Stat label="Escalated" value={String(s.escalated)} tone={s.escalated > 0 ? "breach.7" : undefined} />
                <Stat label="Open deficit" value={moneyWhole(s.openDeficit)} tone={s.openDeficit > 0 ? "breach.7" : undefined} />
              </>
            ) : (
              <Skeleton h={36} w={300} />
            )}
          </Group>

          <Group gap="sm" wrap="nowrap" style={{ order: 4 }}>
            <Select
              aria-label="Acting as"
              placeholder="User"
              w={{ base: 150, sm: 180 }}
              data={(users.data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))}
              value={userId}
              onChange={(v) => v && onUserChange(v)}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            <Button
              variant="outline"
              leftSection={<IconRadar2 size={16} aria-hidden />}
              loading={sweepState.loading}
              onClick={runSweep}
            >
              Run margin sweep
            </Button>
          </Group>
        </Group>

        {/* Compact stats row for phones */}
        <Box hiddenFrom="sm" mt="sm">
          {s ? (
            <Group gap="sm" wrap="nowrap" justify="space-between">
              <Stat label="Open" value={String(s.open)} />
              <Stat label="Assigned" value={String(s.assigned)} />
              <Stat label="Escalated" value={String(s.escalated)} tone={s.escalated > 0 ? "breach.7" : undefined} />
              <Stat label="Deficit" value={moneyWhole(s.openDeficit)} tone={s.openDeficit > 0 ? "breach.7" : undefined} />
            </Group>
          ) : (
            <Skeleton h={36} />
          )}
        </Box>
      </Container>
    </header>
  );
}
