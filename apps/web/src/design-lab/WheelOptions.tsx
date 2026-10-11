import { ActionIcon, Badge, Box, Button, CopyButton, Group, Stack, Switch, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useState, type ReactNode } from "react";
import { money, sentence } from "../format";
import type { Scenario, ScenarioRun, SeverityLabel } from "../graphql";
import { tokens } from "../theme";
import { ShockWheel } from "../components/wheel/ShockWheel";
import { useWheelSpin } from "../components/wheel/useWheelSpin";

export interface WheelOptionProps {
  scenarios: Scenario[];
  run: ScenarioRun;
}

const SEVERITY_BADGE: Record<SeverityLabel, { color: string; variant: "filled" | "light" }> = {
  MILD: { color: "steel", variant: "light" },
  SEVERE: { color: "breach", variant: "light" },
  TAIL: { color: "breach", variant: "filled" },
};

function SeverityBadge({ label }: { label: SeverityLabel }) {
  return <Badge {...SEVERITY_BADGE[label]}>{sentence(label)}</Badge>;
}

const shockSize = (m: number) => `${m}×`;

function Seed({ seed }: { seed: string }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Text ff="monospace" fz={15} className="num">
        {seed}
      </Text>
      <CopyButton value={seed}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? "Copied" : "Copy seed"} withArrow>
            <ActionIcon variant="subtle" color={copied ? "cleared" : "steel"} onClick={copy} aria-label="Copy seed">
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text fz={13} c={tokens.steel}>
        {label}
      </Text>
      {children}
    </div>
  );
}

/** Shared wheel state for a lab option: rests on the run's slice, previews a spin on demand. */
function useLabWheel(scenarios: Scenario[], run: ScenarioRun, sound: boolean) {
  const reducedMotion = useReducedMotion() ?? false;
  const wheel = useWheelSpin(scenarios.length, { reducedMotion, sound });
  const [landed, setLanded] = useState<number | null>(run.sliceIndex);
  const { placeAt } = wheel;
  useEffect(() => placeAt(run.sliceIndex), [placeAt, run.sliceIndex]);
  const preview = async () => {
    setLanded(null);
    await wheel.spinTo(Math.floor(Math.random() * scenarios.length)); // lab preview only; the app uses the server's slice
    setLanded(run.sliceIndex);
    wheel.placeAt(run.sliceIndex);
  };
  return { ...wheel, landed, preview };
}

const items = (scenarios: Scenario[]) => scenarios.map((s) => ({ id: s.id, shortLabel: s.shortLabel, color: s.color }));

/* A: Stacked. Wheel on the ground, full-width Spin, seed and sound below, result panel last. */
export function WheelStacked({ scenarios, run }: WheelOptionProps) {
  const [sound, setSound] = useState(false);
  const w = useLabWheel(scenarios, run, sound);
  return (
    <Stack gap={24}>
      <ShockWheel items={items(scenarios)} rotation={w.rotation} flap={w.flap} labelRotation={w.labelRotation} landedIndex={w.landed} maxWidth={420} />
      <Stack gap={12}>
        <Button fullWidth onClick={w.preview} loading={w.spinning}>
          Spin
        </Button>
        <Group gap={12} align="flex-end" wrap="nowrap">
          <TextInput label="Replay seed" placeholder="e.g. demo-42" style={{ flex: 1 }} />
          <Switch label="Peg sound" checked={sound} onChange={(e) => setSound(e.currentTarget.checked)} mb={10} />
        </Group>
      </Stack>
      <Box p={24} style={{ background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10 }}>
        <Text className="display" fz={32} fw={650} lh={1.15}>
          {run.scenario.name}
        </Text>
        <Text fz={15} c={tokens.steel} mt={8}>
          {run.scenario.blurb}
        </Text>
        <Group gap={12} mt={16}>
          <SeverityBadge label={run.severityLabel} />
          <Text fz={15}>Shocks applied at {shockSize(run.severity)}</Text>
        </Group>
        <Group gap={32} mt={20} pt={16} style={{ borderTop: `1px solid ${tokens.line}` }}>
          <Figure label="Breaches">
            <Text className="display num" fz={24} fw={600} c={run.breachCount ? tokens.breach : tokens.cleared}>
              {run.breachCount}
            </Text>
          </Figure>
          <Figure label="Total deficit">
            <Text className="display num" fz={24} fw={600} c={run.totalDeficit > 0 ? tokens.breach : tokens.ink}>
              {money(run.totalDeficit)}
            </Text>
          </Figure>
        </Group>
        <Box mt={16}>
          <Figure label="Seed">
            <Seed seed={run.seed} />
          </Figure>
        </Box>
      </Box>
    </Stack>
  );
}

/* B: Result first. The outcome leads as one sentence; the wheel and a single control row follow. */
export function WheelResultFirst({ scenarios, run }: WheelOptionProps) {
  const [sound, setSound] = useState(false);
  const w = useLabWheel(scenarios, run, sound);
  return (
    <Stack gap={24}>
      <Box p={20} style={{ background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10 }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap={12}>
          <Text className="display" fz={24} fw={650} lh={1.2}>
            {run.scenario.name}
          </Text>
          <SeverityBadge label={run.severityLabel} />
        </Group>
        <Text fz={15} mt={10} lh={1.55}>
          Shocks applied at {shockSize(run.severity)}.{" "}
          <Text span fw={600} c={run.breachCount ? tokens.breach : tokens.cleared} className="num">
            {run.breachCount} {run.breachCount === 1 ? "account" : "accounts"} breached
          </Text>
          , with{" "}
          <Text span fw={600} className="num">
            {money(run.totalDeficit)}
          </Text>{" "}
          in total deficit.
        </Text>
        <Group gap={6} mt={10}>
          <Text fz={13} c={tokens.steel}>
            Seed
          </Text>
          <Seed seed={run.seed} />
        </Group>
      </Box>
      <ShockWheel items={items(scenarios)} rotation={w.rotation} flap={w.flap} labelRotation={w.labelRotation} landedIndex={w.landed} maxWidth={420} />
      <Group gap={8} align="flex-end" wrap="nowrap">
        <TextInput aria-label="Replay seed" placeholder="Replay seed (optional)" style={{ flex: 1 }} />
        <Button onClick={w.preview} loading={w.spinning} w={120}>
          Spin
        </Button>
      </Group>
      <Switch label="Peg sound" checked={sound} onChange={(e) => setSound(e.currentTarget.checked)} />
    </Stack>
  );
}

/* C: Ledger. Spin sits under the hub; the seed hides behind a text button; the result is a definition list. */
export function WheelLedger({ scenarios, run }: WheelOptionProps) {
  const [sound, setSound] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const w = useLabWheel(scenarios, run, sound);
  const rows: Array<[string, ReactNode]> = [
    ["Severity", <SeverityBadge key="s" label={run.severityLabel} />],
    ["Shock size", <Text key="m" fz={15} className="num">{shockSize(run.severity)}</Text>],
    [
      "Breaches",
      <Text key="b" fz={15} fw={600} className="num" c={run.breachCount ? tokens.breach : tokens.cleared}>
        {run.breachCount} of 16 accounts
      </Text>,
    ],
    [
      "Total deficit",
      <Text key="d" fz={15} fw={600} className="num" c={run.totalDeficit > 0 ? tokens.breach : tokens.ink}>
        {money(run.totalDeficit)}
      </Text>,
    ],
    ["Seed", <Seed key="seed" seed={run.seed} />],
  ];
  return (
    <Stack gap={20}>
      <ShockWheel items={items(scenarios)} rotation={w.rotation} flap={w.flap} labelRotation={w.labelRotation} landedIndex={w.landed} maxWidth={420} />
      <Group justify="center" gap={16}>
        <Button onClick={w.preview} loading={w.spinning} w={160}>
          Spin
        </Button>
        <UnstyledButton onClick={() => setShowSeed((v) => !v)} fz={15} c={tokens.ink} td="underline">
          {showSeed ? "Hide seed" : "Replay a seed"}
        </UnstyledButton>
        <Switch label="Sound" checked={sound} onChange={(e) => setSound(e.currentTarget.checked)} />
      </Group>
      {showSeed && <TextInput label="Seed" placeholder="e.g. demo-42" />}
      <Box style={{ background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10 }}>
        <Box px={20} pt={20} pb={16} style={{ borderBottom: `1px solid ${tokens.line}` }}>
          <Text className="display" fz={24} fw={650} lh={1.2}>
            {run.scenario.name}
          </Text>
          <Text fz={15} c={tokens.steel} mt={4}>
            {run.scenario.blurb}
          </Text>
        </Box>
        <Box component="dl" m={0} px={20} py={8}>
          {rows.map(([label, value], i) => (
            <Group key={label} justify="space-between" py={10} style={{ borderTop: i ? `1px solid ${tokens.line}` : undefined }}>
              <Text component="dt" fz={13} c={tokens.steel}>
                {label}
              </Text>
              <Box component="dd" m={0}>
                {value}
              </Box>
            </Group>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}
