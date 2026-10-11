import { useMutation, useQuery } from "@apollo/client";
import { ActionIcon, Box, Button, CopyButton, Group, Skeleton, Stack, Text, TextInput, Title, Tooltip, VisuallyHidden } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { errorMessage, money } from "../format";
import { SCENARIOS, SPIN_WHEEL, type Scenario, type ScenarioRun } from "../graphql";
import { nextRotation, polar, restingRotation, sliceStep, wrapLabel } from "../wheelMath";
import { SeverityBadge } from "./badges";

const SIZE = 420;
const C = SIZE / 2;
const R = 192;
const LABEL_R = 128;
const SPIN_MS = 4400; // keep in sync with .wheel-rotor.is-spinning

function slicePath(i: number, count: number) {
  const step = sliceStep(count);
  const a = polar(C, C, R, i * step);
  const b = polar(C, C, R, (i + 1) * step);
  return `M ${C} ${C} L ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y} Z`;
}

function Wheel({ scenarios, rotation, animate, highlight }: { scenarios: Scenario[]; rotation: number; animate: boolean; highlight: number | null }) {
  const count = scenarios.length;
  const step = sliceStep(count);
  return (
    <svg className="wheel" viewBox={`-6 -6 ${SIZE + 12} ${SIZE + 12}`} role="img" aria-label={`Shock wheel with ${count} scenarios`}>
      <g className={`wheel-rotor${animate ? " is-spinning" : ""}`} style={{ transform: `rotate(${rotation}deg)` }}>
        {scenarios.map((s, i) => {
          const mid = (i + 0.5) * step;
          const lines = wrapLabel(s.name, 12, 3);
          const lineH = 15;
          const labelY = C - LABEL_R;
          const top = labelY - ((lines.length - 1) * lineH) / 2;
          // Labels that come to rest in the lower half get flipped so they read upright
          const at = (((mid + rotation) % 360) + 360) % 360;
          const flip = at > 90 && at < 270 ? ` rotate(180 ${C} ${labelY})` : "";
          return (
            <g key={s.id}>
              <path d={slicePath(i, count)} fill={s.color} stroke="#fff" strokeWidth={2} />
              <text className="wheel-label" textAnchor="middle" transform={`rotate(${mid} ${C} ${C})${flip}`}>
                {lines.map((line, j) => (
                  <tspan key={j} x={C} y={top + j * lineH} dominantBaseline="middle">
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        {highlight !== null && scenarios[highlight] && (
          <path
            d={slicePath(highlight, count)}
            fill="none"
            stroke="#B8862B"
            strokeWidth={4}
            strokeLinejoin="round"
          />
        )}
        {/* Tick marks between slices on the rim */}
        {scenarios.map((s, i) => {
          const p1 = polar(C, C, R - 10, i * step);
          const p2 = polar(C, C, R, i * step);
          return <line key={`t-${s.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff" strokeWidth={3} />;
        })}
      </g>
      {/* Rim, hub and pointer stay still */}
      <circle cx={C} cy={C} r={R + 2} fill="none" stroke="#172030" strokeWidth={6} />
      {highlight !== null && (
        <path
          d={`M ${polar(C, C, R + 2, -step / 2).x} ${polar(C, C, R + 2, -step / 2).y} A ${R + 2} ${R + 2} 0 0 1 ${polar(C, C, R + 2, step / 2).x} ${polar(C, C, R + 2, step / 2).y}`}
          fill="none"
          stroke="#B8862B"
          strokeWidth={6}
        />
      )}
      <circle cx={C} cy={C} r={40} fill="#172030" />
      <circle cx={C} cy={C} r={30} fill="none" stroke="#B8862B" strokeWidth={3} />
      <circle cx={C} cy={C} r={6} fill="#B8862B" />
      <path d={`M ${C - 17} -4 L ${C + 17} -4 L ${C} 34 Z`} fill="#B8862B" stroke="#172030" strokeWidth={3} strokeLinejoin="round" />
    </svg>
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
  const reduceMotion = useReducedMotion();
  const [seed, setSeed] = useState("");
  const [rotation, setRotation] = useState(0);
  const [animate, setAnimate] = useState(false);
  const placed = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const list = scenarios.data?.scenarios ?? [];
  const count = list.length;

  // Rest the wheel on the latest run when the page loads, without animating
  useEffect(() => {
    if (placed.current || !run || count === 0) return;
    placed.current = true;
    setRotation(restingRotation(run.sliceIndex, count));
  }, [run, count]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const doSpin = async () => {
    if (count === 0 || spinning) return;
    onSpinStart();
    try {
      const { data } = await spin({ variables: { seed: seed.trim() || undefined } });
      const result = data?.spinWheel;
      if (!result) throw new Error("The server returned no result");
      placed.current = true;
      // The server picked the slice; we only animate to it
      if (reduceMotion) {
        setAnimate(false);
        setRotation(restingRotation(result.sliceIndex, count));
        onLanded(result);
        return;
      }
      setAnimate(true);
      setRotation((r) => nextRotation(r, result.sliceIndex, count, 5));
      timer.current = window.setTimeout(() => onLanded(result), SPIN_MS + 150);
    } catch (err) {
      onSpinFailed();
      notifications.show({ color: "breach", ...errorMessage(err) });
    }
  };

  const showResult = run && !spinning;

  return (
    <Box className="surface" p={{ base: "md", sm: "lg" }}>
      <Group justify="space-between" align="baseline" mb="xs">
        <Title order={2} fz="h3">
          Spin a stress scenario
        </Title>
        <Text fz="sm" c="dimmed">
          {count || 8} scenarios
        </Text>
      </Group>
      <Text fz="sm" c="dimmed" mb="md">
        The server picks the scenario and severity, applies it to every book and flags margin breaches.
      </Text>

      {scenarios.loading && !scenarios.data ? (
        <Skeleton circle h={320} w={320} mx="auto" />
      ) : scenarios.error ? (
        <Text c="breach.7" ta="center" py="xl">
          Couldn't load scenarios. {errorMessage(scenarios.error).message}
        </Text>
      ) : (
        <Wheel scenarios={list} rotation={rotation} animate={animate} highlight={showResult ? run.sliceIndex : null} />
      )}

      <Stack gap="sm" mt="lg">
        <Button size="lg" fullWidth onClick={doSpin} loading={spinning} disabled={count === 0} loaderProps={{ type: "dots" }}>
          Spin
        </Button>
        <TextInput
          label="Replay seed"
          description="Optional. The same seed always lands on the same scenario and severity."
          placeholder="e.g. demo-42"
          value={seed}
          onChange={(e) => setSeed(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void doSpin();
          }}
          disabled={spinning}
          maxLength={64}
        />
      </Stack>

      <Box mt="lg" pt="md" style={{ borderTop: "1px solid var(--sw-line)" }} aria-live="polite">
        {spinning ? (
          <Stack gap={6}>
            <Text fz="sm" c="dimmed">
              Spinning…
            </Text>
            <Skeleton h={24} w="70%" />
            <Skeleton h={16} w="50%" />
          </Stack>
        ) : runLoading ? (
          <Stack gap={6}>
            <Skeleton h={24} w="70%" />
            <Skeleton h={16} w="50%" />
          </Stack>
        ) : showResult ? (
          <RunSummary run={run} />
        ) : (
          <Text fz="sm" c="dimmed">
            No runs yet. Press spin to stress every portfolio against a random scenario.
          </Text>
        )}
      </Box>
    </Box>
  );
}

function RunSummary({ run }: { run: ScenarioRun }) {
  return (
    <Stack gap="sm">
      <VisuallyHidden>Landed on</VisuallyHidden>
      <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
        <div>
          <Text className="display" fz={22} fw={650} lh={1.2}>
            {run.scenario.name}
          </Text>
          <Text fz="sm" c="dimmed" mt={2}>
            {run.scenario.blurb}
          </Text>
        </div>
      </Group>
      <Group gap="xs">
        <SeverityBadge label={run.severityLabel} multiplier={run.severity} />
      </Group>
      <Group gap="xl" mt={4} wrap="wrap">
        <div>
          <Text fz="xs" c="dimmed">
            Breaches
          </Text>
          <Text fw={650} fz="lg" className="num" c={run.breachCount > 0 ? "breach.7" : "cleared.7"}>
            {run.breachCount}
          </Text>
        </div>
        <div>
          <Text fz="xs" c="dimmed">
            Total deficit
          </Text>
          <Text fw={650} fz="lg" className="num" c={run.totalDeficit > 0 ? "breach.7" : undefined}>
            {money(run.totalDeficit)}
          </Text>
        </div>
        <div style={{ minWidth: 0 }}>
          <Text fz="xs" c="dimmed">
            Seed
          </Text>
          <Group gap={4} wrap="nowrap">
            <Text ff="monospace" fz="sm" truncate maw={160}>
              {run.seed}
            </Text>
            <CopyButton value={run.seed}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy seed"} withArrow>
                  <ActionIcon variant="subtle" color={copied ? "cleared" : "steel"} onClick={copy} aria-label="Copy seed" size="sm">
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </div>
      </Group>
    </Stack>
  );
}
