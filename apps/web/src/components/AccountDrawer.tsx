import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import {
  Box,
  Button,
  Drawer,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
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
import { tokens } from "../theme";

export interface DrawerTarget {
  accountId: string;
  exceptionId: string | null;
  runId: string | null;
}

const MIN_TEXT = 5;

/* ---------- Margin ---------- */

function MarginState({ m }: { m: MarginSnapshot }) {
  return m.breached ? (
    <Text span fz={13} fw={600} c={tokens.breach}>
      Breached
    </Text>
  ) : (
    <Text span fz={13} fw={600} c={tokens.clearedInk}>
      Within margin
    </Text>
  );
}

/** Before and after in one bordered unit: a row per figure, a column per state. */
function MarginCompare({ before, after }: { before: MarginSnapshot; after: MarginSnapshot | null }) {
  const cols = after ? [{ label: "Before", m: before }, { label: "After shock", m: after }] : [{ label: "Current", m: before }];
  const figures: Array<{ label: string; get: (m: MarginSnapshot) => number; tone?: (m: MarginSnapshot) => string | undefined }> = [
    { label: "Equity", get: (m) => m.equity, tone: (m) => (m.equity < 0 ? tokens.breach : undefined) },
    { label: "Requirement", get: (m) => m.maintenanceRequirement },
    { label: "Deficit", get: (m) => m.deficit, tone: (m) => (m.deficit > 0 ? tokens.breach : undefined) },
  ];
  return (
    <table className="detail-table margin-compare">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Figure</span>
          </th>
          {cols.map((c) => (
            <th key={c.label} scope="col" className="r">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {figures.map((f) => (
          <tr key={f.label}>
            <th scope="row">{f.label}</th>
            {cols.map((c) => (
              <td key={c.label} className={`r num${f.label === "Deficit" ? " strong" : ""}`} style={{ color: f.tone?.(c.m) }}>
                {money(f.get(c.m))}
              </td>
            ))}
          </tr>
        ))}
        <tr>
          <th scope="row">State</th>
          {cols.map((c) => (
            <td key={c.label} className="r">
              <MarginState m={c.m} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/* ---------- Positions ---------- */

function PositionsTable({ positions, shocked }: { positions: Position[]; shocked: boolean }) {
  const tone = (n: number | null) => (n ? (n > 0 ? tokens.clearedInk : tokens.breach) : tokens.steel);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="detail-table" style={{ minWidth: 440 }}>
        <thead>
          <tr>
            <th scope="col">Symbol</th>
            <th scope="col" className="r">
              Qty
            </th>
            <th scope="col" className="r">
              Price
            </th>
            {shocked ? (
              <>
                <th scope="col" className="r">
                  Shocked
                </th>
                <th scope="col" className="r">
                  Shock
                </th>
                <th scope="col" className="r">
                  P&amp;L
                </th>
              </>
            ) : (
              <th scope="col" className="r">
                Market value
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const short = p.qty < 0;
            return (
              <tr key={p.symbol}>
                <td>
                  <div className="queue-account">
                    <span className="queue-account-name" title={p.name}>
                      {p.symbol}
                    </span>
                    <span className="queue-meta">{sentence(p.sector)}</span>
                  </div>
                </td>
                <td className="r">
                  <div className="queue-account" style={{ alignItems: "flex-end" }}>
                    <span className="num">{short ? `\u2212${qty(Math.abs(p.qty))}` : qty(p.qty)}</span>
                    {short && (
                      <span className="queue-meta" style={{ color: tokens.breach }}>
                        Short
                      </span>
                    )}
                  </div>
                </td>
                <td className="r num">{money(p.price)}</td>
                {shocked ? (
                  <>
                    <td className="r num">{p.shockedPrice !== null ? money(p.shockedPrice) : "\u2014"}</td>
                    <td className="r num" style={{ color: tone(p.shockPct) }}>
                      {p.shockPct !== null ? signedPct(p.shockPct) : "\u2014"}
                    </td>
                    <td className="r num strong" style={{ color: tone(p.pnl) }}>
                      {p.pnl !== null ? signedMoney(p.pnl) : "\u2014"}
                    </td>
                  </>
                ) : (
                  <td className="r num">{money(p.marketValue)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  if (audit.length === 0) return <Text fz={15} c={tokens.steel}>No activity yet.</Text>;
  return (
    <Timeline bulletSize={22} lineWidth={2} active={audit.length - 1} color="steel">
      {audit.map((a) => (
        <Timeline.Item
          key={a.id}
          bullet={AUDIT_ICON[a.action]}
          color={AUDIT_COLOR[a.action] ?? "steel"}
          title={
            <Group gap={6} wrap="wrap">
              <Text fw={600} fz={15}>
                {sentence(a.action)}
              </Text>
              <Text fz={15} c={tokens.steel}>
                by {a.actor.name}
              </Text>
            </Group>
          }
        >
          <Text fz={15}>{auditSummary(a, names)}</Text>
          <Text fz={13} c={tokens.steel} mt={2} title={new Date(a.createdAt).toLocaleString()}>
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
            variant="default"
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
            variant="default"
            disabled={resolved || exception.status === "ESCALATED"}
            onClick={() => setModal("escalate")}
          >
            Escalate
          </Button>
          <Button disabled={resolved} onClick={() => setModal("resolve")}>
            Resolve
          </Button>
        </Group>
        {resolved && (
          <Text fz={15} c={tokens.steel}>
            Resolved{exception.resolutionNote ? `: “${exception.resolutionNote}”` : "."} No further actions.
          </Text>
        )}
        {exception.status === "ESCALATED" && exception.escalationReason && (
          <Text fz={15} c={tokens.steel}>
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
        color="brass"
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
        color="brass"
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
      <Title order={3} fz={16} mb={12}>
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
      padding={isMobile ? "md" : "lg"}
      title={
        account && !stale ? (
          <div>
            <Text className="display" fz={24} fw={650} lh={1.2}>
              {account.name}
            </Text>
            <Text fz={15} c={tokens.steel} mt={2}>
              {account.owner}, {account.riskProfile.toLowerCase()} risk profile, <span className="num">{account.id}</span>
            </Text>
          </div>
        ) : (
          <Skeleton h={44} w={260} />
        )
      }
      closeButtonProps={{ "aria-label": "Close account" }}
    >
      {detail.error ? (
        <Text c={tokens.breach}>Couldn't load this account. {errorMessage(detail.error).message}</Text>
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
                      label: `${money(e.deficit)} ${sentence(e.source).toLowerCase()} breach, ${sentence(e.status).toLowerCase()}, ${dateTime(e.createdAt)}`,
                    }))}
                    value={exception.id}
                    onChange={(v) => v && setSelectedId(v)}
                    allowDeselect={false}
                    comboboxProps={{ withinPortal: true, zIndex: 400 }}
                  />
                )}
                <Group gap="sm" wrap="wrap">
                  <PriorityBadge priority={exception.priority} />
                  <StatusBadge status={exception.status}>
                    {exception.status === "OPEN"
                      ? "Open, unassigned"
                      : exception.assignee
                        ? `${sentence(exception.status)}, ${exception.assignee.name}`
                        : sentence(exception.status)}
                  </StatusBadge>
                  <Text fz={15} c={tokens.steel}>
                    From {exception.source === "SWEEP" ? "the margin sweep" : "a scenario run"}
                  </Text>
                </Group>
                <Actions exception={exception} users={users.data?.users ?? []} />
              </Stack>
            </Section>
          )}

          <Section title={margin.after ? "Margin before and after the shock" : "Current margin"}>
            <MarginCompare before={margin.before} after={margin.after} />
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
