import { useQuery } from "@apollo/client";
import { Badge, Box, Button, Group, Skeleton, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef, useState } from "react";
import { errorMessage, money, sentence } from "../../format";
import { REGIONS_AND_EVENTS, type RenewalRun } from "../../premiumGraphql";
import { tokens } from "../../theme";
import { ShockWheel } from "../wheel/ShockWheel";
import { useWheelSpin } from "../wheel/useWheelSpin";
import { usePremium } from "./PremiumContext";

const SOUND_KEY = "shock-wheel:peg-sound";
const readSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
};

const SEVERITY_BADGE = {
  MILD: { color: "steel", variant: "light" },
  SEVERE: { color: "breach", variant: "light" },
  TAIL: { color: "breach", variant: "filled" },
} as const;

export const signedPctText = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(1)}%`;

/** Outcome of the latest renewal as one sentence, above the wheel. */
function RenewalSummary({ run }: { run: RenewalRun }) {
  const up = run.premiumAfter > run.premiumBefore;
  const personal = run.event.kind === "PERSONAL";
  return (
    <Box p={20}>
      <Text fz={13} c={tokens.steel}>
        Renewal year {run.year}
      </Text>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap={12} mt={2}>
        <Text className="display" fz={24} fw={650} lh={1.2}>
          {run.event.name}
        </Text>
        {!personal && (
          <Badge {...SEVERITY_BADGE[run.severityLabel]} style={{ flexShrink: 0 }}>
            {sentence(run.severityLabel)}
          </Badge>
        )}
      </Group>
      <Text fz={15} c={tokens.steel} mt={4}>
        {run.event.blurb}
      </Text>
      <Text fz={15} mt={12} lh={1.55}>
        Your premium goes from <span className="num">{money(run.premiumBefore)}</span> to{" "}
        <Text span fw={600} className="num">
          {money(run.premiumAfter)}
        </Text>
        ,{" "}
        <Text span fw={600} className="num" c={up ? tokens.breach : tokens.clearedInk}>
          {signedPctText(run.changePct)}
        </Text>
        .
      </Text>
    </Box>
  );
}

export function RenewalRail() {
  const { data, loading, error } = useQuery(REGIONS_AND_EVENTS, { fetchPolicy: "cache-first" });
  const { house, spinning, setSpinning, latestRun, requestSpin, land, startOver } = usePremium();
  const reducedMotion = useReducedMotion() ?? false;
  const [sound, setSound] = useState(readSound);
  const [seed, setSeed] = useState("");
  const [resetting, setResetting] = useState(false);
  const events = data?.renewalEvents ?? [];
  const wheel = useWheelSpin(events.length, { reducedMotion, sound });
  const placedFor = useRef<string | null>(null);

  // Rest the wheel on the latest renewal when it loads, without animating
  const { placeAt } = wheel;
  const lastRun = house?.runs.at(-1);
  useEffect(() => {
    if (!lastRun || events.length === 0 || placedFor.current === lastRun.id || spinning) return;
    placedFor.current = lastRun.id;
    placeAt(lastRun.sliceIndex);
  }, [lastRun, events.length, placeAt, spinning]);

  const toggleSound = (on: boolean) => {
    setSound(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // Storage blocked: the toggle still works for this visit
    }
  };

  const spin = async () => {
    if (spinning || events.length === 0) return;
    setSpinning(true);
    wheel.startFreeSpin();
    try {
      const run = await requestSpin(seed.trim() || undefined);
      placedFor.current = run.id;
      // The server picked the event; the wheel only lands on it
      await wheel.spinTo(run.sliceIndex);
      setSeed("");
      land(run);
    } catch (err) {
      wheel.cancel();
      notifications.show({ color: "breach", ...errorMessage(err) });
    } finally {
      setSpinning(false);
    }
  };

  const doStartOver = async () => {
    setResetting(true);
    try {
      await startOver();
      placedFor.current = null;
      notifications.show({ color: "steel", title: "Started over", message: "Back to your saved house, with a fresh path." });
    } catch (err) {
      notifications.show({ color: "breach", ...errorMessage(err) });
    } finally {
      setResetting(false);
    }
  };

  const items = events.map((e) => ({ id: e.id, shortLabel: e.shortLabel, color: e.color }));
  const year = house?.year ?? 0;

  return (
    <Stack gap={24} component="section" aria-label="Renewal wheel">
      <Box aria-live="polite" style={{ background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10 }}>
        {spinning ? (
          <Stack gap={10} p={20}>
            <Text fz={13} c={tokens.steel}>
              Pricing renewal year {year + 1}…
            </Text>
            <Skeleton h={28} w="70%" />
            <Skeleton h={16} w="90%" />
          </Stack>
        ) : latestRun ? (
          <RenewalSummary run={latestRun} />
        ) : (
          <Box p={20}>
            <Text className="display" fz={24} fw={650} lh={1.2}>
              Renewal roulette
            </Text>
            <Text fz={15} c={tokens.steel} mt={4}>
              Describe your house in the Home premium tab, or keep the defaults, then spin. Each spin is one renewal year.
            </Text>
          </Box>
        )}
      </Box>

      {loading && !data ? (
        <Skeleton circle h={380} w={380} mx="auto" />
      ) : error ? (
        <Text c={tokens.breach} ta="center">
          Couldn't load the wheel. {errorMessage(error).message}
        </Text>
      ) : (
        <ShockWheel
          items={items}
          rotation={wheel.rotation}
          flap={wheel.flap}
          labelRotation={wheel.labelRotation}
          landedIndex={!spinning && latestRun ? latestRun.sliceIndex : null}
          maxWidth={440}
          label="Renewal wheel"
        />
      )}

      <Stack gap={12}>
        <Group gap={8} align="flex-end" wrap="nowrap">
          <TextInput
            aria-label="Replay seed for this year"
            placeholder="Seed (optional)"
            value={seed}
            onChange={(e) => setSeed(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void spin();
            }}
            disabled={spinning}
            maxLength={64}
            style={{ flex: 1 }}
          />
          <Button onClick={spin} loading={spinning} disabled={events.length === 0}>
            {year === 0 ? "Spin year 1" : "Spin next year"}
          </Button>
        </Group>
        <Group justify="space-between">
          <Switch label="Peg sound" checked={sound} onChange={(e) => toggleSound(e.currentTarget.checked)} />
          <Button variant="default" onClick={doStartOver} loading={resetting} disabled={!house || year === 0 || spinning}>
            Start over
          </Button>
        </Group>
        {house && (
          <Text fz={13} c={tokens.steel}>
            Path seed <span className="num">{house.pathSeed}</span>. Year {year + 1} will use{" "}
            <span className="num">
              {house.pathSeed}:{year + 1}
            </span>{" "}
            unless you enter a seed.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}
