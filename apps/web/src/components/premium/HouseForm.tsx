import { useQuery } from "@apollo/client";
import { Box, Button, Checkbox, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { coverageGaps, exposure, PERIL_LABEL, PERILS, type HouseProfile } from "@shock/shared";
import { useState } from "react";
import { errorMessage } from "../../format";
import { REGIONS_AND_EVENTS, type Construction, type DistanceToWater, type Endorsement, type RegionId } from "../../premiumGraphql";
import { tokens } from "../../theme";
import { usePremium } from "./PremiumContext";

const CONSTRUCTION: Array<{ value: Construction; label: string }> = [
  { value: "WOOD_FRAME", label: "Wood frame" },
  { value: "MASONRY", label: "Masonry" },
  { value: "CONCRETE", label: "Concrete" },
];
const DISTANCE: Array<{ value: DistanceToWater; label: string }> = [
  { value: "UNDER_500M", label: "Under 500 m" },
  { value: "500M_TO_2KM", label: "500 m to 2 km" },
  { value: "OVER_2KM", label: "Over 2 km" },
];
const ENDORSEMENT_LABEL: Record<Endorsement, string> = {
  OVERLAND_FLOOD: "Overland flood",
  SEWER_BACKUP: "Sewer backup",
  EARTHQUAKE: "Earthquake",
};
const DEDUCTIBLES = ["500", "1000", "2500", "5000", "10000"];

/** Region scores and this house's exposure, side by side. Updates as the form changes. */
function HazardPanel({ draft }: { draft: HouseProfile }) {
  const { data } = useQuery(REGIONS_AND_EVENTS, { fetchPolicy: "cache-first" });
  const region = data?.regions.find((r) => r.id === draft.region);
  const exp = exposure(draft);
  const gaps = coverageGaps(draft);
  return (
    <Box>
      <Title order={3} fz={16} mb={4}>
        Hazards in {region?.name ?? "your region"}
      </Title>
      <Text fz={13} c={tokens.steel} mb={12}>
        Bars show the region's illustrative score. The number is your house's exposure after its features, from 0 to 1.5.
      </Text>
      <table className="detail-table">
        <thead>
          <tr>
            <th scope="col">Peril</th>
            <th scope="col">Region</th>
            <th scope="col" className="r">
              Your exposure
            </th>
          </tr>
        </thead>
        <tbody>
          {PERILS.map((p) => {
            const score = region?.hazards.find((h) => h.peril === p)?.score ?? 0;
            return (
              <tr key={p}>
                <th scope="row">{PERIL_LABEL[p]}</th>
                <td style={{ width: "40%" }}>
                  <div className="hazard-bar" role="img" aria-label={`${PERIL_LABEL[p]}: region score ${score.toFixed(2)}`}>
                    <span style={{ width: `${score * 100}%`, background: score >= 0.7 ? tokens.breach : tokens.steel }} />
                  </div>
                </td>
                <td className="r num" style={{ color: exp[p] >= 1 ? tokens.breach : undefined, fontWeight: exp[p] >= 1 ? 600 : 400 }}>
                  {exp[p].toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {gaps.length > 0 && (
        <Stack gap={8} mt={16}>
          {gaps.map((g) => (
            <div key={g.endorsement} className="callout is-breach">
              {g.message}
            </div>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function HouseForm() {
  const { data } = useQuery(REGIONS_AND_EVENTS, { fetchPolicy: "cache-first" });
  const { draft, setDraft, house, dirty, save, spinning } = usePremium();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof HouseProfile>(key: K, value: HouseProfile[K]) => setDraft({ ...draft, [key]: value });
  const num = (v: string | number, fallback: number) => (typeof v === "number" ? v : Number(v) || fallback);

  const regionOptions = ["CA", "US"].map((country) => ({
    group: country === "CA" ? "Canada" : "United States",
    items: (data?.regions ?? []).filter((r) => r.country === country).map((r) => ({ value: r.id, label: r.name })),
  }));

  const doSave = async () => {
    setSaving(true);
    try {
      await save();
      notifications.show({ color: "cleared", title: "House saved", message: "The renewal path starts again from year 1." });
    } catch (err) {
      notifications.show({ color: "breach", ...errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const restarts = !!house && house.year > 0 && dirty;

  return (
    <div className="explanation-columns">
      <Stack gap={16}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={16}>
          <TextInput label="Name" value={draft.label} onChange={(e) => set("label", e.currentTarget.value)} maxLength={60} />
          <Select
            label="Region"
            data={regionOptions}
            value={draft.region}
            onChange={(v) => v && set("region", v as RegionId)}
            allowDeselect={false}
            comboboxProps={{ shadow: "md" }}
          />
        </SimpleGrid>
        <TextInput
          label="Area note"
          description="Optional, for your own reference. It doesn't change the price."
          placeholder="e.g. corner lot near the creek"
          value={draft.areaNote}
          onChange={(e) => set("areaNote", e.currentTarget.value)}
          maxLength={200}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={16}>
          <NumberInput
            label="Current premium"
            prefix="$"
            thousandSeparator=","
            min={100}
            max={200000}
            value={draft.currentAnnualPremium}
            onChange={(v) => set("currentAnnualPremium", num(v, draft.currentAnnualPremium))}
          />
          <NumberInput
            label="Rebuild cost"
            prefix="$"
            thousandSeparator=","
            step={10000}
            min={50000}
            max={20000000}
            value={draft.replacementCost}
            onChange={(v) => set("replacementCost", num(v, draft.replacementCost))}
          />
          <Select
            label="Deductible"
            data={DEDUCTIBLES.map((d) => ({ value: d, label: `$${Number(d).toLocaleString("en-US")}` }))}
            value={String(draft.deductible)}
            onChange={(v) => v && set("deductible", Number(v))}
            allowDeselect={false}
            comboboxProps={{ shadow: "md" }}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing={16}>
          <NumberInput label="Year built" min={1800} max={new Date().getFullYear()} value={draft.yearBuilt} onChange={(v) => set("yearBuilt", num(v, draft.yearBuilt))} />
          <NumberInput label="Roof age (years)" min={0} max={80} value={draft.roofAgeYears} onChange={(v) => set("roofAgeYears", num(v, draft.roofAgeYears))} />
          <NumberInput label="Claims, last 5 years" min={0} max={5} value={draft.claimsLast5Years} onChange={(v) => set("claimsLast5Years", num(v, draft.claimsLast5Years))} />
        </SimpleGrid>
        <div>
          <Text component="label" fz={13} fw={600} display="block" mb={4} id="construction-label">
            Construction
          </Text>
          <SegmentedControl fullWidth aria-labelledby="construction-label" data={CONSTRUCTION} value={draft.construction} onChange={(v) => set("construction", v as Construction)} />
        </div>
        <div>
          <Text component="label" fz={13} fw={600} display="block" mb={4} id="water-label">
            Distance to water
          </Text>
          <SegmentedControl fullWidth aria-labelledby="water-label" data={DISTANCE} value={draft.distanceToWater} onChange={(v) => set("distanceToWater", v as DistanceToWater)} />
        </div>
        <Switch label="Backs onto forest or brush" checked={draft.wildlandInterface} onChange={(e) => set("wildlandInterface", e.currentTarget.checked)} />
        <Checkbox.Group label="Endorsements you have" value={draft.endorsements} onChange={(v) => set("endorsements", v as Endorsement[])}>
          <Group gap={20} mt={6}>
            {(Object.keys(ENDORSEMENT_LABEL) as Endorsement[]).map((e) => (
              <Checkbox key={e} value={e} label={ENDORSEMENT_LABEL[e]} />
            ))}
          </Group>
        </Checkbox.Group>
        {house && dirty ? (
          <Group gap={12} align="center">
            <Button onClick={doSave} loading={saving} disabled={spinning}>
              Save changes
            </Button>
            <Text fz={13} c={tokens.steel}>
              {restarts ? "Saving restarts the renewal path from year 1." : "Spinning also saves your changes."}
            </Text>
          </Group>
        ) : (
          <Text fz={13} c={tokens.steel}>
            {house ? "Saved. Spin on the left to price the next renewal." : "Spin the wheel on the left; your house is saved automatically."}
          </Text>
        )}
      </Stack>
      <HazardPanel draft={draft} />
    </div>
  );
}
