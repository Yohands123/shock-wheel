import { useMutation, useQuery } from "@apollo/client";
import { ActionIcon, Badge, Box, Button, CopyButton, Group, Skeleton, Stack, Switch, Text, TextInput, Tooltip } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage, money, sentence } from "../format";
import { SCENARIOS, SPIN_WHEEL, type ScenarioRun, type SeverityLabel } from "../graphql";
import { tokens } from "../theme";
import { ShockWheel } from "./wheel/ShockWheel";
import { useWheelSpin } from "./wheel/useWheelSpin";

const SOUND_KEY = "shock-wheel:peg-sound";
const ACCOUNT_COUNT = 16;

function readSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

const SEVERITY_BADGE: Record<SeverityLabel, { color: string; variant: "filled" | "light" }> = {
  MILD: { color: "steel", variant: "light" },
  SEVERE: { color: "breach", variant: "light" },
  TAIL: { color: "breach", variant: "filled" },
};

function Seed({ seed }: { seed: string }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Text ff="monospace" fz={15}>
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

/** The outcome as one readable sentence, above the wheel. */
function RunSummary({ run }: { run: ScenarioRun }) {
  return (
    <Box p={20}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap={12}>
        <Text className="display" fz={24} fw={650} lh={1.2}>
          {run.scenario.name}
        </Text>
        <Badge {...SEVERITY_BADGE[run.severityLabel]} style={{ flexShrink: 0 }}>
          {sentence(run.severityLabel)}
        </Badge>
      </Group>
      <Text fz={15} c={tokens.steel} mt={4}>
        {run.scenario.blurb}
      </Text>
      <Text fz={15} mt={12} lh={1.55}>
        Shocks applied at <span className="num">{`${run.severity}×`}</span>.{" "}
        {run.breachCount > 0 ? (
          <>
            <Text span fw={600} c={tokens.breach} className="num">
              {run.breachCount} of {ACCOUNT_COUNT} accounts breached
            </Text>
            , with{" "}
            <Text span fw={600} className="num">
              {money(run.totalDeficit)}
            </Text>{" "}
            in total deficit.
          </>
        ) : (
          <Text span fw={600} c={tokens.clearedInk}>
            Every account stayed within margin.
          </Text>
        )}
      </Text>
      <Group gap={6} mt={12}>
        <Text fz={13} c={tokens.steel}>
          Seed
        </Text>
        <Seed seed={run.seed} />
      </Group>
    </Box>
  );
}

interface Props {
  run: ScenarioRun | null;
  runLoading: boolean;
  spinning: boolean;
  onSpinStart: () => void;
  onSpinFailed: () => void;
  onLanded: (run: ScenarioRun) => void;
}

export function WheelPanel({ run, runLoading, spinning, onSpinStart, onSpinFailed, onLanded }: Props) {
  const scenarios = useQuery(SCENARIOS, { fetchPolicy: "cache-first" });
  const [spin] = useMutation(SPIN_WHEEL);
  const reducedMotion = useReducedMotion() ?? false;
  const [sound, setSound] = useState(readSound);
  const [seed, setSeed] = useState("");
  const list = scenarios.data?.scenarios ?? [];
  const wheel = useWheelSpin(list.length, { reducedMotion, sound });
  const placed = useRef(false);

  // Rest on the latest run when the page loads, without animating
  const { placeAt } = wheel;
  useEffect(() => {
    if (placed.current || !run || list.length === 0) return;
    placed.current = true;
    placeAt(run.sliceIndex);
  }, [run, list.length, placeAt]);

  const toggleSound = (on: boolean) => {
    setSound(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // Storage blocked: the toggle still works for this visit
    }
  };

  const doSpin = async () => {
    if (list.length === 0 || spinning) return;
    onSpinStart();
    // Start turning now; the server's answer decides where it stops
    wheel.startFreeSpin();
    try {
      const { data } = await spin({ variables: { seed: seed.trim() || undefined } });
      const result = data?.spinWheel;
      if (!result) throw new Error("The server returned no result");
      placed.current = true;
      await wheel.spinTo(result.sliceIndex);
      onLanded(result);
    } catch (err) {
      wheel.cancel();
      onSpinFailed();
      notifications.show({ color: "breach", ...errorMessage(err) });
    }
  };

  const items = list.map((s) => ({ id: s.id, shortLabel: s.shortLabel, color: s.color }));
  const landedIndex = !spinning && run ? run.sliceIndex : null;

  return (
    <Stack gap={24} component="section" aria-label="Shock wheel">
      <Box aria-live="polite" style={{ background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10 }}>
        {spinning || (runLoading && !run) ? (
          <Stack gap={10} p={20}>
            <Text fz={13} c={tokens.steel}>
              {spinning ? "Spinning…" : "Loading the latest run…"}
            </Text>
            <Skeleton h={28} w="70%" />
            <Skeleton h={16} w="90%" />
            <Skeleton h={16} w="60%" />
          </Stack>
        ) : run ? (
          <RunSummary run={run} />
        ) : (
          <Text fz={15} c={tokens.steel} p={20}>
            No runs yet. Press Spin to stress every portfolio against a random scenario.
          </Text>
        )}
      </Box>

      {scenarios.loading && !scenarios.data ? (
        <Skeleton circle h={380} w={380} mx="auto" />
      ) : scenarios.error ? (
        <Text c={tokens.breach} ta="center" py="xl">
          Couldn't load scenarios. {errorMessage(scenarios.error).message}
        </Text>
      ) : (
        <ShockWheel
          items={items}
          rotation={wheel.rotation}
          flap={wheel.flap}
          labelRotation={wheel.labelRotation}
          landedIndex={landedIndex}
          maxWidth={440}
        />
      )}

      <Stack gap={12}>
        <Group gap={8} align="flex-end" wrap="nowrap">
          <TextInput
            aria-label="Replay seed"
            placeholder="Replay seed (optional)"
            value={seed}
            onChange={(e) => setSeed(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void doSpin();
            }}
            disabled={spinning}
            maxLength={64}
            style={{ flex: 1 }}
          />
          <Button onClick={doSpin} loading={spinning} disabled={list.length === 0} w={120}>
            Spin
          </Button>
        </Group>
        <Switch label="Peg sound" checked={sound} onChange={(e) => toggleSound(e.currentTarget.checked)} />
      </Stack>
    </Stack>
  );
}
