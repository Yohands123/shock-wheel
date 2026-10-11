import { useQuery } from "@apollo/client";
import { Box, Button, Chip, Group, Skeleton, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconChevronDown, IconChevronRight, IconSearch } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { age, errorMessage, money, sentence } from "../format";
import { EXCEPTIONS, type ExceptionFilter, type ExceptionPriority, type ExceptionRow, type ExceptionSource, type ExceptionStatus } from "../graphql";
import { tokens } from "../theme";
import { PriorityBadge, StatusBadge } from "./badges";

const STATUSES: ExceptionStatus[] = ["OPEN", "ASSIGNED", "ESCALATED", "RESOLVED"];
const ACTIVE: ExceptionStatus[] = ["OPEN", "ASSIGNED", "ESCALATED"];
const PRIORITY_ORDER: ExceptionPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const COLS = 6;

const chipStyles = { label: { fontSize: 15, height: 40, paddingInline: 14 } };

/** Group rows by priority, most urgent first, with each group's count and open deficit. */
export function groupByPriority(rows: ExceptionRow[]) {
  return PRIORITY_ORDER.map((priority) => {
    const items = rows.filter((r) => r.priority === priority);
    return { priority, rows: items, deficit: items.reduce((t, r) => t + (r.status === "RESOLVED" ? 0 : r.deficit), 0) };
  }).filter((g) => g.rows.length > 0);
}

interface Props {
  latestRunId: string | null;
  onOpen: (row: ExceptionRow) => void;
}

export function QueuePanel({ latestRunId, onOpen }: Props) {
  const [status, setStatus] = useState<string[]>(ACTIVE);
  const [source, setSource] = useState<string[]>([]);
  const [thisRun, setThisRun] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [collapsed, setCollapsed] = useState<Set<ExceptionPriority>>(new Set());

  // Re-render every 30s so the age column stays honest
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filter = useMemo<ExceptionFilter>(
    () => ({
      status: status.length ? (status as ExceptionStatus[]) : undefined,
      // One source chip narrows; none or both means any source
      source: source.length === 1 ? (source[0] as ExceptionSource) : undefined,
      scenarioRunId: thisRun && latestRunId ? latestRunId : undefined,
      search: debouncedSearch || undefined,
    }),
    [status, source, thisRun, latestRunId, debouncedSearch],
  );

  const { data, previousData, error } = useQuery(EXCEPTIONS, { variables: { filter } });
  const rows = (data ?? previousData)?.exceptions;
  const groups = useMemo(() => groupByPriority(rows ?? []), [rows]);
  const openDeficit = groups.reduce((t, g) => t + g.deficit, 0);
  const filtered = [...status].sort().join() !== [...ACTIVE].sort().join() || source.length > 0 || thisRun || debouncedSearch !== "";

  const reset = () => {
    setStatus(ACTIVE);
    setSource([]);
    setThisRun(false);
    setSearch("");
  };

  const toggleGroup = (p: ExceptionPriority) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: ExceptionRow) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row);
    }
  };

  return (
    <Box component="section" aria-label="Exception queue" className="queue">
      <Box px={20} py={16} style={{ borderBottom: `1px solid ${tokens.line}` }}>
        <TextInput
          aria-label="Search accounts"
          placeholder="Search accounts"
          leftSection={<IconSearch size={16} aria-hidden />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="queue-search-mobile"
          mb={12}
        />
        <Group gap={8} wrap="wrap" align="center" className="queue-filters">
          <TextInput
            className="queue-search-desktop"
            aria-label="Search accounts"
            placeholder="Search accounts"
            leftSection={<IconSearch size={16} aria-hidden />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={{ base: "100%", sm: 240 }}
            mr={8}
          />
          <Chip.Group multiple value={status} onChange={setStatus}>
            <Group gap={8} wrap="wrap" role="group" aria-label="Status">
              {STATUSES.map((s) => (
                <Chip key={s} value={s} variant="outline" color="brass" radius="sm" styles={chipStyles}>
                  {sentence(s)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          <Chip.Group multiple value={source} onChange={setSource}>
            <Group gap={8} wrap="wrap" role="group" aria-label="Source">
              <Chip value="SWEEP" variant="outline" color="brass" radius="sm" styles={chipStyles}>
                Sweep
              </Chip>
              <Chip value="SCENARIO" variant="outline" color="brass" radius="sm" styles={chipStyles}>
                Scenario
              </Chip>
            </Group>
          </Chip.Group>
          <Chip checked={thisRun} onChange={setThisRun} disabled={!latestRunId} variant="outline" color="brass" radius="sm" styles={chipStyles}>
            This run only
          </Chip>
        </Group>
        <Group justify="space-between" mt={12} gap={8}>
          <Text fz={13} c={tokens.steel} className="num" aria-live="polite">
            {rows ? `${rows.length} ${rows.length === 1 ? "exception" : "exceptions"}, ${money(openDeficit)} open deficit` : "Loading the queue…"}
          </Text>
          {filtered && (
            <UnstyledButton onClick={reset} fz={13} fw={600} c={tokens.ink} td="underline">
              Reset filters
            </UnstyledButton>
          )}
        </Group>
      </Box>

      <div className="queue-scroll" tabIndex={0} role="region" aria-label="Exception table">
        <table className="queue-table">
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Status</th>
              <th scope="col">Assignee</th>
              <th scope="col" className="r">
                Equity
              </th>
              <th scope="col" className="r">
                Deficit
              </th>
              <th scope="col" className="r">
                Age
              </th>
            </tr>
          </thead>
          {error && !rows ? (
            <tbody>
              <tr>
                <td colSpan={COLS}>
                  <Text c={tokens.breach} py={32} ta="center">
                    Couldn't load the queue. {errorMessage(error).message}
                  </Text>
                </td>
              </tr>
            </tbody>
          ) : !rows ? (
            <tbody>
              {Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: COLS }, (__, j) => (
                    <td key={j}>
                      <Skeleton h={j === 0 ? 30 : 16} w={j === 0 ? "70%" : "55%"} ml={j >= 3 ? "auto" : 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={COLS}>
                  <Stack align="center" gap={8} py={56}>
                    {filtered ? (
                      <>
                        <Text fw={600}>No exceptions match these filters.</Text>
                        <Button variant="default" onClick={reset}>
                          Reset filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <Text fw={600}>No open exceptions.</Text>
                        <Text fz={15} c={tokens.steel}>
                          Spin the wheel or run a margin sweep to stress the books.
                        </Text>
                      </>
                    )}
                  </Stack>
                </td>
              </tr>
            </tbody>
          ) : (
            groups.map((g) => {
              const isCollapsed = collapsed.has(g.priority);
              return (
                <tbody key={g.priority}>
                  <tr className="queue-group">
                    <td colSpan={COLS}>
                      <UnstyledButton onClick={() => toggleGroup(g.priority)} aria-expanded={!isCollapsed} className="queue-group-toggle">
                        <Group gap={10} wrap="nowrap">
                          {isCollapsed ? <IconChevronRight size={16} aria-hidden /> : <IconChevronDown size={16} aria-hidden />}
                          <PriorityBadge priority={g.priority} />
                          <Text span fz={13} c={tokens.steel} className="num">
                            {g.rows.length} {g.rows.length === 1 ? "exception" : "exceptions"}, {money(g.deficit)} deficit
                          </Text>
                        </Group>
                      </UnstyledButton>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    g.rows.map((row) => {
                      const resolved = row.status === "RESOLVED";
                      return (
                        <tr
                          key={row.id}
                          className={`queue-row${resolved ? " is-resolved" : ""}`}
                          tabIndex={0}
                          onClick={() => onOpen(row)}
                          onKeyDown={(e) => onRowKey(e, row)}
                          aria-label={`Open ${row.account.name}, ${sentence(row.priority)} priority, ${sentence(row.status)}, deficit ${money(row.deficit)}`}
                        >
                          <td>
                            <div className="queue-account">
                              <span className="queue-account-name">{row.account.name}</span>
                              <span className="queue-meta num">
                                {row.account.id}, {row.source === "SWEEP" ? "sweep" : "scenario"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={row.status} />
                          </td>
                          <td className={row.assignee ? undefined : "muted"}>{row.assignee?.name ?? "Unassigned"}</td>
                          <td className={`r num${row.equity < 0 && !resolved ? " breach" : ""}`}>{money(row.equity)}</td>
                          <td className={`r num strong${resolved ? "" : " breach"}`}>{money(row.deficit)}</td>
                          <td className="r num muted" title={new Date(row.createdAt).toLocaleString()}>
                            {age(row.createdAt, now)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              );
            })
          )}
        </table>
      </div>
    </Box>
  );
}
