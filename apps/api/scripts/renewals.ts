/**
 * Prints sample Renewal roulette results from the premium engine (illustrative model, not a quote).
 *   pnpm --filter @shock/api renewals [seed]
 */
import { computeRenewal, DEFAULT_HOUSE, exposure, PERILS, PERIL_LABEL, renewalEventById, simulateRenewals, type HouseProfile } from "@shock/shared";

const seed = process.argv[2] ?? "demo";
const pct = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const houses: HouseProfile[] = [
  DEFAULT_HOUSE,
  { ...DEFAULT_HOUSE, label: "Interior BC, masonry, downtown", region: "INTERIOR_BC", construction: "MASONRY", distanceToWater: "OVER_2KM" },
  { ...DEFAULT_HOUSE, label: "Interior BC, wood frame, backs onto forest", region: "INTERIOR_BC", wildlandInterface: true, distanceToWater: "OVER_2KM" },
  { ...DEFAULT_HOUSE, label: "Florida Gulf, near water, old roof", region: "FLORIDA_GULF", distanceToWater: "UNDER_500M", roofAgeYears: 18, currentAnnualPremium: 5200, endorsements: [] },
];

console.log("\nIllustrative model, not a quote.\n");
for (const h of houses) {
  const exp = exposure(h);
  console.log(`${h.label}`);
  console.log(`  exposure: ${PERILS.map((p) => `${PERIL_LABEL[p]} ${exp[p].toFixed(2)}`).join(", ")}`);
  const wf = computeRenewal(h, renewalEventById("wildfire-season"), 1);
  console.log(`  wildfire season (severe): ${pct(wf.changePct)}`);
  for (const s of simulateRenewals(h, seed, 5)) {
    const r = s.result;
    console.log(
      `  year ${s.year}: ${s.event.name.padEnd(30)} ${s.severityLabel.padEnd(6)} ${usd(r.previousPremium).padStart(11)} -> ${usd(r.newPremium).padStart(11)} ${pct(r.changePct).padStart(7)}  non-renewal ${r.nonRenewalRisk.toLowerCase()}${r.coverageGaps.length ? `, gaps: ${r.coverageGaps.map((g) => g.endorsement.toLowerCase()).join(", ")}` : ""}`,
    );
  }
  const first = computeRenewal(h, renewalEventById("new-roof"), 1);
  console.log(`  new roof drivers: ${first.drivers.map((d) => `${d.label} ${usd(d.amount)}`).join("; ")}\n`);
}
