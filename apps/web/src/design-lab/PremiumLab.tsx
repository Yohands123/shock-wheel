import { Badge, Box, Group, Stack, Text, Title } from "@mantine/core";
import {
  computeRenewal,
  DEFAULT_HOUSE,
  exposure,
  PERIL_LABEL,
  PERILS,
  regionById,
  renewalEventById,
  simulateRenewals,
  type HouseProfile,
  type NonRenewalRisk,
} from "@shock/shared";
import { money, sentence, signedMoney } from "../format";
import { tokens } from "../theme";

/**
 * Dev-only view of the premium engine's raw output (Phase 2). No API involved:
 * this calls the same pure functions the server will. The real UI comes in Phase 3.
 */

const HOUSES: HouseProfile[] = [
  DEFAULT_HOUSE,
  { ...DEFAULT_HOUSE, label: "Wood frame backing onto forest", region: "INTERIOR_BC", wildlandInterface: true, distanceToWater: "OVER_2KM" },
  { ...DEFAULT_HOUSE, label: "Near the water, old roof", region: "FLORIDA_GULF", distanceToWater: "UNDER_500M", roofAgeYears: 18, currentAnnualPremium: 5200, endorsements: [] },
];

const RISK_BADGE: Record<NonRenewalRisk, { color: string; variant: "filled" | "light" }> = {
  LOW: { color: "steel", variant: "light" },
  MEDIUM: { color: "brass", variant: "light" },
  HIGH: { color: "breach", variant: "filled" },
};

const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(1)}%`;

function HazardBars({ house }: { house: HouseProfile }) {
  const region = regionById(house.region).hazards;
  const exp = exposure(house);
  return (
    <div className="table-scroll">
    <table className="detail-table" style={{ maxWidth: 520 }}>
      <thead>
        <tr>
          <th scope="col">Peril</th>
          <th scope="col">Region score</th>
          <th scope="col" className="r">
            Your exposure
          </th>
        </tr>
      </thead>
      <tbody>
        {PERILS.map((p) => (
          <tr key={p}>
            <th scope="row">{PERIL_LABEL[p]}</th>
            <td>
              <div role="img" aria-label={`${PERIL_LABEL[p]} region score ${region[p].toFixed(2)}`} style={{ width: "min(160px, 28vw)", height: 6, borderRadius: 3, background: tokens.neutralTint }}>
                <div style={{ width: `${region[p] * 100}%`, height: 6, borderRadius: 3, background: region[p] >= 0.7 ? tokens.breach : tokens.steel }} />
              </div>
            </td>
            <td className="r num" style={{ color: exp[p] >= 1 ? tokens.breach : undefined }}>
              {exp[p].toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function House({ house }: { house: HouseProfile }) {
  const steps = simulateRenewals(house, "demo", 5);
  const last = steps.at(-1)!.result;
  const wildfire = computeRenewal(house, renewalEventById("wildfire-season"), 1);
  return (
    <Box component="section" p={{ base: 16, sm: 24 }} style={{ background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 10 }}>
      <Title order={3} fz={19}>
        {house.label}
      </Title>
      <Text fz={13} c={tokens.steel} mb={20}>
        {regionById(house.region).name}, {sentence(house.construction)}, roof {house.roofAgeYears} years old, {money(house.currentAnnualPremium)} a year today
      </Text>
      <div className="explanation-columns">
        <div>
          <Title order={4} fz={16} mb={8}>
            Hazards
          </Title>
          <HazardBars house={house} />
          <Text fz={13} c={tokens.steel} mt={12}>
            A severe wildfire season would change this premium by {pct(wildfire.changePct)}.
          </Text>
        </div>
        <div>
          <Title order={4} fz={16} mb={8}>
            Five renewals from seed "demo"
          </Title>
          <div className="table-scroll">
          <table className="detail-table">
            <thead>
              <tr>
                <th scope="col">Year</th>
                <th scope="col">Event</th>
                <th scope="col" className="r">
                  Premium
                </th>
                <th scope="col" className="r">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.year}>
                  <td className="num">{s.year}</td>
                  <td>
                    <div className="queue-account">
                      <span>{s.event.name}</span>
                      <span className="queue-meta">{sentence(s.severityLabel)}</span>
                    </div>
                  </td>
                  <td className="r num">{money(s.result.newPremium)}</td>
                  <td className="r num" style={{ color: s.result.changePct > 0 ? tokens.breach : tokens.clearedInk }}>
                    {pct(s.result.changePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Group gap={8} mt={16}>
            <Text fz={13} c={tokens.steel}>
              Non-renewal risk after year 5
            </Text>
            <Badge {...RISK_BADGE[last.nonRenewalRisk]}>{sentence(last.nonRenewalRisk)}</Badge>
          </Group>
          <Title order={4} fz={16} mt={20} mb={8}>
            Year 5 drivers
          </Title>
          <table className="detail-table">
            <tbody>
              {last.drivers.map((d) => (
                <tr key={d.label}>
                  <th scope="row">{d.label}</th>
                  <td className="r num" style={{ color: d.amount > 0 ? tokens.breach : tokens.clearedInk }}>
                    {signedMoney(d.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {last.coverageGaps.map((g) => (
            <Text key={g.endorsement} fz={15} mt={12} pl={12} style={{ borderLeft: `3px solid ${tokens.breach}`, background: tokens.breachTint, padding: "8px 12px" }}>
              {g.message}
            </Text>
          ))}
        </div>
      </div>
    </Box>
  );
}

export function PremiumLab() {
  return (
    <Box px={{ base: 16, sm: 24 }} py={24} style={{ background: tokens.ground }}>
      <Text fz={15} mb={20} pl={12} py={8} style={{ borderLeft: `3px solid ${tokens.brass}`, background: tokens.amberTint }}>
        Illustrative model, not a quote. Real premiums depend on your insurer's rating and policy wording. Hazard scores are illustrative.
      </Text>
      <Stack gap={24}>
        {HOUSES.map((h) => (
          <House key={h.label} house={h} />
        ))}
      </Stack>
    </Box>
  );
}
