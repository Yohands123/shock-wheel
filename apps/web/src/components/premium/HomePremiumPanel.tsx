import { Badge, Box, Button, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { regionById, type NonRenewalRisk } from "@shock/shared";
import { useState } from "react";
import { money, sentence, signedMoney } from "../../format";
import type { House, RenewalRun } from "../../premiumGraphql";
import { tokens } from "../../theme";
import { SourceTag } from "../badges";
import { HouseForm } from "./HouseForm";
import { PathChart, pathPoints } from "./PathChart";
import { usePremium } from "./PremiumContext";
import { signedPctText } from "./RenewalRail";
import { Waterfall } from "./Waterfall";

export const DISCLAIMER = "Illustrative model, not a quote. Real premiums depend on your insurer's rating and policy wording.";

const RISK_BADGE: Record<NonRenewalRisk, { color: string; variant: "filled" | "light" }> = {
  LOW: { color: "steel", variant: "light" },
  MEDIUM: { color: "brass", variant: "light" },
  HIGH: { color: "breach", variant: "filled" },
};

function List({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null;
  const L = ordered ? "ol" : "ul";
  return (
    <div>
      <Title order={4} fz={16} mb={8}>
        {title}
      </Title>
      <L className={`effect-list${ordered ? " is-ordered" : ""}`}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </L>
    </div>
  );
}

function RenewalResult({ run }: { run: RenewalRun }) {
  const change = run.premiumAfter - run.premiumBefore;
  const up = change > 0;
  const ex = run.explanation;
  return (
    <Stack gap={28} component="section" aria-label={`Renewal year ${run.year} result`}>
      <Group justify="space-between" align="flex-end" wrap="wrap" gap={16}>
        <div>
          <Text fz={13} c={tokens.steel}>
            Year {run.year} premium
          </Text>
          <Text className="display num" fz={32} fw={650} lh={1.15}>
            {money(run.premiumAfter)}
          </Text>
          <Text fz={15} mt={2}>
            <Text span fw={600} className="num" c={up ? tokens.breach : tokens.clearedInk}>
              {signedMoney(change)}, {signedPctText(run.changePct)}
            </Text>{" "}
            <Text span c={tokens.steel}>
              from <span className="num">{money(run.premiumBefore)}</span>
            </Text>
          </Text>
        </div>
        <Group gap={8}>
          <Text fz={13} c={tokens.steel}>
            Non-renewal risk
          </Text>
          <Badge {...RISK_BADGE[run.nonRenewalRisk]}>{sentence(run.nonRenewalRisk)}</Badge>
        </Group>
      </Group>

      <div>
        <Title order={3} fz={16} mb={8}>
          What moved the price
        </Title>
        <Waterfall before={run.premiumBefore} drivers={run.drivers} after={run.premiumAfter} />
      </div>

      {run.coverageGaps.length > 0 && (
        <Stack gap={8}>
          <Title order={3} fz={16}>
            Coverage gaps
          </Title>
          {run.coverageGaps.map((g) => (
            <div key={g.endorsement} className="callout is-breach">
              {g.message}
            </div>
          ))}
        </Stack>
      )}

      {ex && (
        <Stack gap={20}>
          <div>
            <Group gap={10} mb={6}>
              <Text fz={13} c={tokens.steel}>
                Why this renewal moved
              </Text>
              <SourceTag source={ex.source} />
            </Group>
            <Title order={3} fz={19} lh={1.4} maw="75ch">
              {ex.headline}
            </Title>
          </div>
          <div className="explanation-columns">
            <List title="Why it moved" items={ex.whyItMoved} />
            <List title="Ask your broker" items={ex.askYourBroker} />
          </div>
          <List title="Ways to lower the risk" items={ex.mitigation} />
        </Stack>
      )}

      <div className="callout is-brass">{run.disclaimer || DISCLAIMER}</div>
    </Stack>
  );
}

function PathSection({ house }: { house: House }) {
  const points = pathPoints(house.initialProfile.currentAnnualPremium, house.runs);
  return (
    <Stack gap={12} component="section" aria-label="Premium path">
      <Title order={3} fz={16}>
        Premium path
      </Title>
      <PathChart points={points} />
      <div className="table-scroll">
        <table className="detail-table">
          <caption className="sr-only">Premium by renewal year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Event</th>
              <th scope="col">Severity</th>
              <th scope="col" className="r">
                Premium
              </th>
              <th scope="col" className="r">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {house.runs.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.year}</td>
                <td>{r.event.name}</td>
                <td>{r.event.kind === "PERSONAL" ? "—" : sentence(r.severityLabel)}</td>
                <td className="r num">{money(r.premiumAfter)}</td>
                <td className="r num" style={{ color: r.changePct > 0 ? tokens.breach : tokens.clearedInk }}>
                  {signedPctText(r.changePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}

export function HomePremiumPanel() {
  const { house, loading, latestRun, spinning, draft } = usePremium();
  const [editing, setEditing] = useState(false);
  const hasRuns = (house?.runs.length ?? 0) > 0;
  const showForm = !hasRuns || editing;

  if (loading && !house) {
    return (
      <Stack gap={12} p={24}>
        <Skeleton h={28} w="40%" />
        <Skeleton h={200} />
      </Stack>
    );
  }

  return (
    <Box component="section" aria-label="Home premium" px={{ base: 16, sm: 24 }} py={24}>
      <Stack gap={32}>
        {spinning && (
          <Stack gap={10}>
            <Text fz={13} c={tokens.steel}>
              Pricing the next renewal…
            </Text>
            <Skeleton h={40} w="30%" />
            <Skeleton h={160} />
          </Stack>
        )}
        {!spinning && latestRun && <RenewalResult run={latestRun} />}
        {!spinning && house && hasRuns && <PathSection house={house} />}

        <Box component="section" aria-label="Your house">
          <Group justify="space-between" align="center" mb={showForm ? 16 : 0} wrap="wrap" gap={8}>
            <div>
              <Title order={3} fz={hasRuns ? 16 : 19}>
                {hasRuns ? "Your house" : "Describe your house"}
              </Title>
              {!showForm && house && (
                <Text fz={15} c={tokens.steel}>
                  {house.label}: {regionById(draft.region).name}, {sentence(draft.construction).toLowerCase()}, roof {house.profile.roofAgeYears} years old now
                </Text>
              )}
              {showForm && !hasRuns && (
                <Text fz={15} c={tokens.steel} maw="75ch">
                  The defaults work: spin now, or adjust them first. Each spin on the left prices one renewal year.
                </Text>
              )}
            </div>
            {hasRuns && (
              <Button variant="default" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
                {editing ? "Hide house details" : "Edit house"}
              </Button>
            )}
          </Group>
          {showForm && <HouseForm />}
        </Box>

        {!hasRuns && <div className="callout is-brass">{DISCLAIMER} Hazard scores are illustrative.</div>}
      </Stack>
    </Box>
  );
}
