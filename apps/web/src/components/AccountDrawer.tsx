import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  Timeline,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCheck, IconCirclePlus, IconUserCheck } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QUEUE_QUERIES } from "../apollo";
import { dateTime, errorMessage, money, qty, sentence, signedMoney, signedPct } from "../format";
import {
  ACCOUNT_DETAIL,
  ASSIGN,
  ESCALATE,
  RESOLVE,
  USERS,
  type AccountException,
  type AuditEntry,
  type MarginSnapshot,
  type Position,
  type User,
} from "../graphql";
import { PriorityBadge, StatusBadge } from "./badges";

export interface DrawerTarget {
  accountId: string;
  exceptionId: string | null;
  runId: string | null;
}

const MIN_TEXT = 5;

/* ---------- Margin ---------- */

function MarginCard({ title, m }: { title: string; m: MarginSnapshot }) {
  const rows: Array<[string, string, string | undefined]> = [
    ["Equity", money(m.equity), m.equity < 0 ? "breach.7" : undefined],
    ["Requirement", money(m.maintenanceRequirement), undefined],
    ["Deficit", money(m.deficit), m.deficit > 0 ? "breach.7" : undefined],
  ];
  return (
    <Box p="sm" style={{ border: `1px solid ${m.breached ? "var(--mantine-color-breach-2)" : "var(--sw-line)"}`, borderRadius: 8 }}>
      <Group justify="space-between" mb={6} gap={4}>
        <Text fw={600} fz="sm">
          {title}
        </Text>
        <Badge size="sm" color={m.breached ? "breach" : "cleared"} variant="light">
          {m.breached ? "Breached" : "Within margin"}
        </Badge>
      </Group>
      {rows.map(([label, value, tone]) => (
        <Group key={label} justify="space-between" gap="xs" wrap="nowrap">
          <Text fz="sm" c="dimmed">
            {label}
          </Text>
          <Text fz="sm" fw={label === "Deficit" ? 650 : 500} className="num" c={tone}>
            {value}
          </Text>
        </Group>
      ))}
    </Box>
  );
}

/* ---------- Positions ---------- */

function PositionsTable({ positions, shocked }: { positions: Position[]; shocked: boolean }) {
  return (
    <Table.ScrollContainer minWidth={440} type="native">
      <Table verticalSpacing={6} horizontalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Symbol</Table.Th>
            <Table.Th ta="right">Qty</Table.Th>
            <Table.Th ta="right">Price</Table.Th>
            {shocked ? (
              <>
                <Table.Th ta="right">Shocked</Table.Th>
                <Table.Th ta="right">Shock</Table.Th>
                <Table.Th ta="right">P&amp;L</Table.Th>
              </>
            ) : (
              <Table.Th ta="right">Market value</Table.Th>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {positions.map((p) => {
            const short = p.qty < 0;
            return (
              <Table.Tr key={p.symbol}>
                <Table.Td>
                  <Text fw={600} fz="sm" lh={1.3} title={p.name}>
                    {p.symbol}
                  </Text>
                  <Text fz="xs" c="dimmed">
                    {sentence(p.sector)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Group gap={6} justify="flex-end" wrap="nowrap">
                    {short && (
                      <Badge size="xs" color="breach" variant="light">
                        Short
                      </Badge>
                    )}
                    <Text fz="sm" className="num">
                      {short ? `−${qty(Math.abs(p.qty))}` : qty(p.qty)}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {money(p.price)}
                </Table.Td>
                {shocked ? (
                  <>
                    <Table.Td ta="right" className="num">
                      {p.shockedPrice !== null ? money(p.shockedPrice) : "—"}
                    </Table.Td>
                    <Table.Td ta="right" className="num" c={p.shockPct ? (p.shockPct > 0 ? "cleared.7" : "breach.7") : "dimmed"}>
                      {p.shockPct !== null ? signedPct(p.shockPct) : "—"}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" fw={600} className="num" c={p.pnl ? (p.pnl > 0 ? "cleared.7" : "breach.7") : "dimmed"}>
                        {p.pnl !== null ? signedMoney(p.pnl) : "—"}
                      </Text>
                    </Table.Td>
                  </>
                ) : (
                  <Table.Td ta="right" className="num">
                    {money(p.marketValue)}
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/* ---------- Audit ---------- */

function auditSummary(entry: AuditEntry, names: Map<string, string>): string {
  let p: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(entry.payload);
    p = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return entry.payload;
  }
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const who = (v: unknown) => (str(v) ? (names.get(str(v)!) ?? str(v)!) : undefined);
  switch (entry.action) {
    case "CREATED":
      return [str(p.source) && `${sentence(str(p.source)!)} breach`, typeof p.deficit === "number" && `deficit ${money(p.deficit)}`]
        .filter(Boolean)
        .join(", ");
    case "ASSIGNED":
      return who(p.from) ? `${who(p.from)} → ${who(p.to)}` : `Assigned to ${who(p.to) ?? "someone"}`;
    case "ESCALATED":
      return `“${str(p.reason) ?? ""}”${who(p.to) ? ` → ${who(p.to)}` : ""}`;
    case "RESOLVED":
      return `“${str(p.note) ?? ""}”${str(p.previousStatus) ? ` (was ${sentence(str(p.previousStatus)!).toLowerCase()})` : ""}`;
    default:
      return Object.entries(p)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(", ");
  }
}

const AUDIT_ICON: Record<string, ReactNode> = {
  CREATED: <IconCirclePlus size={12} />,
  ASSIGNED: <IconUserCheck size={12} />,
  ESCALATED: <IconAlertTriangle size={12} />,
  RESOLVED: <IconCheck size={12} />,
};
const AUDIT_COLOR: Record<string, string> = { CREATED: "steel", ASSIGNED: "brass", ESCALATED: "breach", RESOLVED: "cleared" };

function AuditTrail({ audit, names }: { audit: AuditEntry[]; names: Map<string, string> }) {
  if (audit.length === 0) return <Text fz="sm" c="dimmed">No activity yet.</Text>;
  return (
    <Timeline bulletSize={22} lineWidth={2} active={audit.length - 1} color="steel">
      {audit.map((a) => (
        <Timeline.Item
          key={a.id}
          bullet={AUDIT_ICON[a.action]}
          color={AUDIT_COLOR[a.action] ?? "steel"}
          title={
            <Group gap={6} wrap="wrap">
              <Text fw={600} fz="sm">
                {sentence(a.action)}
              </Text>
              <Text fz="sm" c="dimmed">
                by {a.actor.name}
              </Text>
            </Group>
          }
        >
          <Text fz="sm">{auditSummary(a, names)}</Text>
          <Text fz="xs" c="dimmed" mt={2} title={new Date(a.createdAt).toLocaleString()}>
            {dateTime(a.createdAt)}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/* ---------- Reason modal ---------- */

interface ReasonModalProps {
  opened: boolean;
  title: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  color: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (text: string) => Promise<boolean>;
}

function ReasonModal({ opened, title, label, placeholder, submitLabel, color, loading, onClose, onSubmit }: ReasonModalProps) {
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (opened) {
      setText("");
      setTouched(false);
    }
  }, [opened]);
  const valid = text.trim().length >= MIN_TEXT;
  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    if (await onSubmit(text.trim())) onClose();
  };
  return (
    <Modal opened={opened} onClose={onClose} title={<Title order={3} fz="h4">{title}</Title>} centered>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          label={label}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onBlur={() => setTouched(true)}
          error={touched && !valid ? `At least ${MIN_TEXT} characters` : undefined}
          description={`${text.trim().length} / ${MIN_TEXT} characters minimum`}
          autosize
          minRows={3}
          data-autofocus
          required
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color={color} loading={loading} disabled={!valid}>
            {submitLabel}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

/* ---------- Actions ---------- */

function Actions({ exception, users }: { exception: AccountException; users: User[] }) {
  const client = useApolloClient();
  const opts = { refetchQueries: QUEUE_QUERIES, awaitRefetchQueries: true };
  const [assign, assignState] = useMutation(ASSIGN, opts);
  const [escalate, escalateState] = useMutation(ESCALATE, opts);
  const [resolve, resolveState] = useMutation(RESOLVE, opts);
  const [assignee, setAssignee] = useState<string | null>(exception.assignee?.id ?? null);
  const [modal, setModal] = useState<"escalate" | "resolve" | null>(null);

  useEffect(() => setAssignee(exception.assignee?.id ?? null), [exception.id, exception.assignee?.id]);

  const resolved = exception.status === "RESOLVED";
  // If someone else resolves it while a modal is open, there's nothing left to submit
  useEffect(() => {
    if (resolved) setModal(null);
  }, [resolved]);

  const run = async (fn: () => Promise<unknown>, success: { title: string; message: string }) => {
    try {
      await fn();
      notifications.show({ color: "cleared", ...success });
      return true;
    } catch (err) {
      notifications.show({ color: "breach", autoClose: 8000, ...errorMessage(err) });
      // A CONFLICT means our copy is stale; pull the current state so the drawer catches up
      void client.refetchQueries({ include: QUEUE_QUERIES });
      return false;
    }
  };

  const assigneeName = users.find((u) => u.id === assignee)?.name ?? "user";

  return (
    <>
      <Stack gap="sm">
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <Select
            label="Assignee"
            placeholder="Pick a user"
            data={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
            value={assignee}
            onChange={setAssignee}
            disabled={resolved}
            style={{ flex: 1 }}
            comboboxProps={{ withinPortal: true, zIndex: 400 }}
          />
          <Button
            variant="light"
            disabled={resolved || !assignee || assignee === exception.assignee?.id}
            loading={assignState.loading}
            onClick={() =>
              run(() => assign({ variables: { id: exception.id, userId: assignee! } }), {
                title: "Assigned",
                message: `${assigneeName} now owns this exception.`,
              })
            }
          >
            Assign
          </Button>
        </Group>
        <Group gap="xs" grow>
          <Button
            variant="outline"
            color="breach"
            disabled={resolved || exception.status === "ESCALATED"}
            onClick={() => setModal("escalate")}
          >
            Escalate
          </Button>
          <Button color="cleared" disabled={resolved} onClick={() => setModal("resolve")}>
            Resolve
          </Button>
        </Group>
        {resolved && (
          <Text fz="sm" c="dimmed">
            Resolved{exception.resolutionNote ? `: “${exception.resolutionNote}”` : "."} No further actions.
          </Text>
        )}
        {exception.status === "ESCALATED" && exception.escalationReason && (
          <Text fz="sm" c="dimmed">
            {`Escalated: “${exception.escalationReason}”`}
          </Text>
        )}
      </Stack>

      <ReasonModal
        opened={modal === "escalate"}
        title="Escalate exception"
        label="Reason"
        placeholder="Why does this need a supervisor?"
        submitLabel="Escalate"
        color="breach"
        loading={escalateState.loading}
        onClose={() => setModal(null)}
        onSubmit={(reason) =>
          run(() => escalate({ variables: { id: exception.id, reason } }), {
            title: "Escalated",
            message: "Sent to a supervisor for review.",
          })
        }
      />
      <ReasonModal
        opened={modal === "resolve"}
        title="Resolve exception"
        label="Resolution note"
        placeholder="e.g. Client wired funds, call met"
        submitLabel="Resolve"
        color="cleared"
        loading={resolveState.loading}
        onClose={() => setModal(null)}
        onSubmit={(note) =>
          run(() => resolve({ variables: { id: exception.id, note } }), {
            title: "Resolved",
            message: "The exception is closed.",
          })
        }
      />
    </>
  );
}

/* ---------- Drawer ---------- */

function pickException(exceptions: AccountException[], target: DrawerTarget, selectedId: string | null) {
  return (
    exceptions.find((e) => e.id === selectedId) ??
    exceptions.find((e) => e.id === target.exceptionId) ??
    exceptions.find((e) => target.runId && e.scenarioRun?.id === target.runId) ??
    exceptions.find((e) => e.status !== "RESOLVED") ??
    exceptions[0] ??
    null
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section">
      <Title order={3} fz="md" mb="xs">
        {title}
      </Title>
      {children}
    </Box>
  );
}

export function AccountDrawer({ target, onClose }: { target: DrawerTarget | null; onClose: () => void }) {
  const isMobile = useMediaQuery("(max-width: 600px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Keep the last target while the drawer animates closed
  const [shown, setShown] = useState<DrawerTarget | null>(target);
  useEffect(() => {
    if (target) {
      setShown(target);
      setSelectedId(target.exceptionId);
    }
  }, [target]);

  const users = useQuery(USERS, { fetchPolicy: "cache-first" });
  // First load uses the run we came from; the selected exception's run wins after that
  const [runId, setRunId] = useState<string | null>(null);
  useEffect(() => setRunId(target?.runId ?? null), [target]);

  const detail = useQuery(ACCOUNT_DETAIL, {
    variables: { id: shown?.accountId ?? "", runId },
    skip: !shown,
  });
  const account = detail.data?.account ?? (detail.loading ? detail.previousData?.account : undefined);
  const exception = account && shown ? pickException(account.exceptions, shown, selectedId) : null;

  useEffect(() => {
    const want = exception?.scenarioRun?.id ?? null;
    if (exception && want !== runId) setRunId(want);
  }, [exception, runId]);

  const names = useMemo(() => new Map((users.data?.users ?? []).map((u) => [u.id, u.name])), [users.data]);
  const margin = account?.margin;
  const stale = account && account.id !== shown?.accountId;

  return (
    <Drawer
      opened={target !== null}
      onClose={onClose}
      position="right"
      size={isMobile ? "100%" : 520}
      padding="lg"
      title={
        account && !stale ? (
          <div>
            <Text className="display" fz={22} fw={650} lh={1.2}>
              {account.name}
            </Text>
            <Text fz="sm" c="dimmed">
              {account.owner} · {account.riskProfile} · <span className="num">{account.id}</span>
            </Text>
          </div>
        ) : (
          <Skeleton h={44} w={260} />
        )
      }
      closeButtonProps={{ "aria-label": "Close account" }}
    >
      {detail.error ? (
        <Text c="breach.7">Couldn't load this account. {errorMessage(detail.error).message}</Text>
      ) : !account || stale || !margin ? (
        <Stack gap="md">
          <SimpleGrid cols={2}>
            <Skeleton h={110} />
            <Skeleton h={110} />
          </SimpleGrid>
          <Skeleton h={180} />
          <Skeleton h={120} />
        </Stack>
      ) : (
        <Stack gap="xl">
          {exception && (
            <Section title="Exception">
              <Stack gap="sm">
                {account.exceptions.length > 1 && (
                  <Select
                    aria-label="Exception"
                    data={account.exceptions.map((e) => ({
                      value: e.id,
                      label: `${sentence(e.source)} · ${money(e.deficit)} · ${sentence(e.status)} · ${dateTime(e.createdAt)}`,
                    }))}
                    value={exception.id}
                    onChange={(v) => v && setSelectedId(v)}
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true, zIndex: 400 }}
                  />
                )}
                <Group gap="sm" wrap="wrap">
                  <PriorityBadge priority={exception.priority} />
                  <StatusBadge status={exception.status} />
                  <Text fz="sm" c="dimmed">
                    {sentence(exception.source)} · {exception.assignee ? `Assigned to ${exception.assignee.name}` : "Unassigned"}
                  </Text>
                </Group>
                <Actions exception={exception} users={users.data?.users ?? []} />
              </Stack>
            </Section>
          )}

          <Section title={margin.after ? "Margin before and after the shock" : "Current margin"}>
            {margin.after ? (
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                <MarginCard title="Before" m={margin.before} />
                <MarginCard title="After shock" m={margin.after} />
              </SimpleGrid>
            ) : (
              <MarginCard title="Current" m={margin.before} />
            )}
          </Section>

          <Section title="Positions">
            {margin.positions.length === 0 ? (
              <Text fz="sm" c="dimmed">
                No open positions.
              </Text>
            ) : (
              <PositionsTable positions={margin.positions} shocked={margin.after !== null} />
            )}
          </Section>

          {exception && (
            <Section title="Audit trail">
              <AuditTrail audit={exception.audit} names={names} />
            </Section>
          )}

          {!exception && (
            <Text fz="sm" c="dimmed">
              This account has no exceptions. Spin the wheel or run a margin sweep to stress it.
            </Text>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
