import { useQuery } from "@apollo/client";
import { Box, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { EXCEPTIONS, LATEST_RUN, QUEUE_STATS, SCENARIOS, USERS, type ExceptionRow } from "../graphql";
import { tokens } from "../theme";
import { HeaderDeficitLed, HeaderLedger, HeaderReadout } from "./HeaderOptions";
import { WheelLedger, WheelResultFirst, WheelStacked } from "./WheelOptions";
import { TableClassic, TableGrouped, TableMoneyFirst } from "./TableOptions";
import { PremiumLab } from "./PremiumLab";

/**
 * Dev-only route (/design-lab?widget=NAME) for comparing widget options side by side.
 * main.tsx only imports this when import.meta.env.DEV is true, so it never ships.
 */

function Option({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={`Option ${name}`}>
      <Box px={24} mb={12}>
        <Title order={3}>Option {name}</Title>
        <Text fz={13} c={tokens.steel}>
          {note}
        </Text>
      </Box>
      {/* A slice of ground under each header so its bottom edge and background read in context */}
      <Box style={{ background: tokens.ground }} pb={48}>
        {children}
      </Box>
    </Box>
  );
}

function HeaderLab() {
  const stats = useQuery(QUEUE_STATS).data?.queueStats;
  const users = useQuery(USERS).data?.users ?? [];
  if (!stats) return <Text px={24}>Loading live stats…</Text>;
  const props = { stats, users, userId: "u-maya" };
  return (
    <Stack gap={40}>
      <Option name="A: Ledger" note="Even columns, number over label, centred between brand and actions. Calm and symmetrical.">
        <HeaderLedger {...props} />
      </Option>
      <Option name="B: Readout" note="Header sits on the ground. Counts read as one line; the deficit is set apart by a hairline. Densest.">
        <HeaderReadout {...props} />
      </Option>
      <Option name="C: Deficit-led" note="One lead number. The status mix is a proportional bar with a count legend. Most opinionated.">
        <HeaderDeficitLed {...props} />
      </Option>
    </Stack>
  );
}

function WheelColumn({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <Box component="section" aria-label={`Option ${name}`} style={{ width: 440, flexShrink: 0 }}>
      <Title order={3}>Option {name}</Title>
      <Text fz={13} c={tokens.steel} mb={20} mih={40}>
        {note}
      </Text>
      {children}
    </Box>
  );
}

function WheelLab() {
  const scenarios = useQuery(SCENARIOS).data?.scenarios;
  const run = useQuery(LATEST_RUN).data?.scenarioRuns[0];
  if (!scenarios || !run) return <Text px={24}>Loading the latest run…</Text>;
  return (
    <Box px={24} py={32} style={{ background: tokens.ground, display: "flex", gap: 24, overflowX: "auto" }}>
      <WheelColumn name="A: Stacked" note="Wheel first, full-width Spin, then a bordered result with a 32px name and big figures.">
        <WheelStacked scenarios={scenarios} run={run} />
      </WheelColumn>
      <WheelColumn name="B: Result first" note="The outcome leads as one readable sentence; wheel and a single control row follow.">
        <WheelResultFirst scenarios={scenarios} run={run} />
      </WheelColumn>
      <WheelColumn name="C: Ledger" note="Spin centred under the hub, seed behind a text button, result as a label and value list.">
        <WheelLedger scenarios={scenarios} run={run} />
      </WheelColumn>
    </Box>
  );
}

/** A realistic sample: a few of each status and priority, including a resolved row. */
function sampleRows(all: ExceptionRow[]) {
  const pick: ExceptionRow[] = [];
  const take = (pred: (r: ExceptionRow) => boolean, n: number) => {
    for (const r of all) if (pick.length < 40 && n > 0 && pred(r) && !pick.includes(r)) (pick.push(r), n--);
  };
  take((r) => r.priority === "CRITICAL" && r.status !== "RESOLVED", 3);
  take((r) => r.status === "RESOLVED", 1);
  take((r) => r.priority === "HIGH", 3);
  take((r) => r.priority === "MEDIUM", 2);
  take((r) => r.priority === "LOW", 1);
  return pick;
}

function TableLab() {
  const all = useQuery(EXCEPTIONS, { variables: { filter: {} } }).data?.exceptions;
  if (!all) return <Text px={24}>Loading the queue…</Text>;
  const rows = sampleRows(all);
  // 900px is the workspace width at a 1440px viewport
  const frame = (name: string, note: string, el: ReactNode) => (
    <Box component="section" aria-label={`Option ${name}`}>
      <Box px={24} mb={12}>
        <Title order={3}>Option {name}</Title>
        <Text fz={13} c={tokens.steel}>
          {note}
        </Text>
      </Box>
      <Box px={24} py={24} style={{ background: tokens.ground }}>
        <Box style={{ width: 900, background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10, overflow: "hidden" }}>
          {el}
        </Box>
      </Box>
    </Box>
  );
  return (
    <Stack gap={40}>
      {frame("A: Classic", "Every field in its own column; one toolbar of filters. Familiar and complete.", <TableClassic rows={rows} />)}
      {frame("B: Money first", "Deficit leads; priority is a left rule; status and owner merge into one phrase; saved views replace filters.", <TableMoneyFirst rows={rows} />)}
      {frame("C: Grouped", "Rows grouped by priority with a count and deficit per group; status chips filter. Linear-style triage.", <TableGrouped rows={rows} />)}
    </Stack>
  );
}

const WIDGETS: Record<string, () => JSX.Element> = { header: HeaderLab, wheel: WheelLab, table: TableLab, premium: PremiumLab };

export function DesignLab() {
  const widget = new URLSearchParams(window.location.search).get("widget") ?? "header";
  const Lab = WIDGETS[widget];
  return (
    <Box py={32} style={{ background: tokens.surface, minHeight: "100vh" }}>
      <Box px={24} mb={32}>
        <Title order={1}>Design lab</Title>
        <Text fz={15} c={tokens.steel}>
          Widget: {widget}. Pick one option; it gets built for real.
        </Text>
      </Box>
      {Lab ? <Lab /> : <Text px={24}>Unknown widget "{widget}". Available: {Object.keys(WIDGETS).join(", ")}.</Text>}
    </Box>
  );
}
