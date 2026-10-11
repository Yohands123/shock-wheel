/**
 * Prints the seed breach matrix: accounts x scenarios x severities.
 *   pnpm --filter @shock/api calibrate
 * Each cell is three characters, one per severity (mild, severe, tail): "#" = breach, "." = ok.
 */
import { calibrate, calibrationProblems, SEVERITIES } from "../src/calibration";

const c = calibrate();
const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
const colW = 4;

console.log(`\nBreach matrix (cell = ${SEVERITIES.map((s) => s[0]).join("")}; # breach, . ok)\n`);
console.log(pad("", 28) + c.scenarios.map((_, j) => pad(String(j + 1).padStart(2), colW)).join("") + "  share  start");
c.books.forEach((b, i) => {
  const cells = c.breached[i].map((sev) => pad(sev.map((x) => (x ? "#" : ".")).join(""), colW)).join("");
  const share = `${Math.round(c.breachShare[b.account.id] * 100)}%`.padStart(5);
  const start = c.startBreached.includes(b.account.id) ? "  BREACHED" : "";
  console.log(pad(`${b.account.id} ${b.account.name}`, 28) + cells + "  " + share + start);
});

console.log("\nScenarios:");
c.scenarios.forEach((s, j) => {
  const set = c.severeSets[s.id];
  console.log(`${String(j + 1).padStart(2)}. ${pad(s.name, 34)} SEVERE: ${set.length ? set.join(", ") : "-"}`);
});

const problems = calibrationProblems(c);
console.log(problems.length ? `\nProblems:\n- ${problems.join("\n- ")}\n` : "\nBalanced: all calibration rules pass.\n");
process.exitCode = problems.length ? 1 : 0;
