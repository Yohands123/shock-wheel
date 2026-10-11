import { useQuery } from "@apollo/client";
import { Box, Button, Group, MultiSelect, SegmentedControl, Skeleton, Stack, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { age, errorMessage, money, sentence } from "../format";
import { EXCEPTIONS, type ExceptionFilter, type ExceptionPriority, type ExceptionRow, type ExceptionSource, type ExceptionStatus } from "../graphql";
import { PriorityBadge, StatusBadge } from "./badges";

const STATUS_OPTIONS: ExceptionStatus[] = ["OPEN", "ASSIGNED", "ESCALATED", "RESOLVED"];
const PRIORITY_OPTIONS: ExceptionPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: sentence(v) }));

const COLS = 8;

interface Props {
  latestRunId: string | null;
  onOpen: (row: ExceptionRow) => void;
}

export function QueuePanel({ latestRunId, onOpen }: Props) {
  const [status, setStatus] = useState<ExceptionStatus[]>([]);
  const [priority, setPriority] = useState<ExceptionPriority[]>([]);
  const [source, setSource] = useState<"ALL" | ExceptionSource>("ALL");
  const [thisRun, setThisRun] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);

  // Re-render every 30s so the age column stays honest
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const filter = useMemo<ExceptionFilter>(
    () => ({
      status: status.length ? status : undefined,
      priority: priority.length ? priority : undefined,
      source: source === "ALL" ? undefined : source,
      scenarioRunId: thisRun && latestRunId ? latestRunId : undefined,
      search: debouncedSearch || undefined,
    }),
    [status, priority, source, thisRun, latestRunId, debouncedSearch],
  );

  const { data, previousData, loading, error } = useQuery(EXCEPTIONS, { variables: { filter } });
  const rows = (data ?? previousData)?.exceptions;
  const filtersActive = status.length > 0 || priority.length > 0 || source !== "ALL" || thisRun || debouncedSearch !== "";

  const clearFilters = () => {
    setStatus([]);
    setPriority([]);
    setSource("ALL");
    setThisRun(false);
    setSearch("");
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: ExceptionRow) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row);
    }
  };

  return (
    <Box className="surface" component="section" aria-labelledby="queue-title">
      <Stack gap="md" p={{ base: "md", sm: "lg" }} pb="md">
        <Group justify="space-between" align="baseline">
          <Title order={2} fz="h3" id="queue-title">
            Exception queue
          </Title>
          {rows && (
            <Text fz="sm" c="dimmed" className="num">
              {rows.length} {rows.length === 1 ? "exception" : "exceptions"}
              {loading && data === undefined ? " · updating" : ""}
            </Text>
          )}
        </Group>

        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            label="Search"
            placeholder="Account, ID or owner"
            leftSection={<IconSearch size={16} aria-hidden />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={{ base: "100%", sm: 220 }}
          />
          <MultiSelect
            label="Status"
            placeholder={status.length ? undefined : "Any status"}
            data={toOptions(STATUS_OPTIONS)}
            value={status}
            onChange={(v) => setStatus(v as ExceptionStatus[])}
            clearable
            w={{ base: "100%", sm: 220 }}
          />
          <MultiSelect
            label="Priority"
            placeholder={priority.length ? undefined : "Any priority"}
            data={toOptions(PRIORITY_OPTIONS)}
            value={priority}
            onChange={(v) => setPriority(v as ExceptionPriority[])}
            clearable
            w={{ base: "100%", sm: 220 }}
          />
          <div>
            <Text component="label" fz="sm" fw={500} display="block" mb={4} id="source-label">
              Source
            </Text>
            <SegmentedControl
              aria-labelledby="source-label"
              value={source}
              onChange={(v) => setSource(v as "ALL" | ExceptionSource)}
              data={[
                { value: "ALL", label: "All" },
                { value: "SWEEP", label: "Sweep" },
                { value: "SCENARIO", label: "Scenario" },
              ]}
            />
          </div>
          <Switch
            label="This run only"
            checked={thisRun}
            onChange={(e) => setThisRun(e.currentTarget.checked)}
            disabled={!latestRunId}
            mb={8}
          />
          {filtersActive && (
            <Button variant="subtle" color="steel" onClick={clearFilters} mb={2}>
              Clear filters
            </Button>
          )}
        </Group>
      </Stack>

      <Table.ScrollContainer minWidth={860} type="native">
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover={false} style={{ borderTop: "1px solid var(--sw-line)" }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Account</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th ta="right">Deficit</Table.Th>
              <Table.Th ta="right">Equity</Table.Th>
              <Table.Th>Assignee</Table.Th>
              <Table.Th ta="right">Age</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {error && !rows ? (
              <Table.Tr>
                <Table.Td colSpan={COLS}>
                  <Text c="breach.7" py="lg" ta="center">
                    Couldn't load the queue. {errorMessage(error).message}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : !rows ? (
              Array.from({ length: 6 }, (_, i) => (
                <Table.Tr key={i}>
                  {Array.from({ length: COLS }, (__, j) => (
                    <Table.Td key={j}>
                      <Skeleton h={j === 0 ? 30 : 16} w={j === 0 ? "80%" : "60%"} />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            ) : rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={COLS}>
                  <Stack align="center" gap={6} py={48}>
                    {filtersActive ? (
                      <>
                        <Text fw={600}>No exceptions match these filters.</Text>
                        <Button variant="light" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <Text fw={600}>No exceptions yet.</Text>
                        <Text fz="sm" c="dimmed">
                          Spin the wheel or run a margin sweep.
                        </Text>
                      </>
                    )}
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr
                  key={row.id}
                  className="row-link"
                  tabIndex={0}
                  onClick={() => onOpen(row)}
                  onKeyDown={(e) => onRowKey(e, row)}
                  aria-label={`Open ${row.account.name}, ${sentence(row.priority)} priority, deficit ${money(row.deficit)}`}
                  style={{ opacity: row.status === "RESOLVED" ? 0.65 : 1 }}
                >
                  <Table.Td>
                    <Text fw={600} fz="sm" lh={1.3}>
                      {row.account.name}
                    </Text>
                    <Text fz="xs" c="dimmed" className="num">
                      {row.account.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <PriorityBadge priority={row.priority} />
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={row.status} />
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm">{sentence(row.source)}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" fw={600} className="num" c={row.deficit > 0 ? "breach.7" : undefined}>
                      {money(row.deficit)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" className="num" c={row.equity < 0 ? "breach.7" : undefined}>
                      {money(row.equity)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" c={row.assignee ? undefined : "dimmed"}>
                      {row.assignee?.name ?? "Unassigned"}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" c="dimmed" className="num" title={new Date(row.createdAt).toLocaleString()}>
                      {age(row.createdAt, now)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Box>
  );
}
