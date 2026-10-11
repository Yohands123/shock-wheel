import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SECTORS, type Scenario, type SeverityLabel } from "@shock/shared";

export const ExplanationSchema = z.object({
  headline: z.string().min(1),
  firstOrder: z.array(z.string()).min(1).max(8),
  secondOrder: z.array(z.string()).min(1).max(8),
  accountsAtRisk: z.array(z.object({ accountId: z.string(), why: z.string() })).max(8),
  opsActions: z.array(z.string()).min(1).max(6),
});
export type Explanation = z.infer<typeof ExplanationSchema> & { source: "claude" | "template" };

export interface ExplainInput {
  scenario: Scenario;
  severityLabel: SeverityLabel;
  severity: number;
  accountCount: number;
  breaches: Array<{
    accountId: string;
    name: string;
    deficit: number;
    equityBefore: number;
    equityAfter: number;
    worstPosition: { symbol: string; sector: string; pnl: number } | null;
  }>;
}

const SYSTEM = `You are a risk analyst on a brokerage operations desk.
You explain a stress scenario that has ALREADY been computed. Use only the numbers in the input.
Never invent prices, percentages, or account figures. Keep each bullet under 25 words.
Cover insurance and coverage angles where the factors mention them.
Respond with JSON only, no markdown fences:
{"headline": string,
 "firstOrder": string[],   // direct price effects on sectors
 "secondOrder": string[],  // insurance, supply chain, volatility, house margin policy
 "accountsAtRisk": [{"accountId": string, "why": string}],
 "opsActions": string[]}   // what the ops desk should do next`;

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Deterministic fallback: used without an API key, in CI, or when Claude fails validation or grounding. */
export function templateExplanation(input: ExplainInput): Explanation {
  const { scenario, severity, severityLabel, breaches, accountCount } = input;
  const moves = SECTORS.flatMap((s) => {
    const v = scenario.sectorShocks[s];
    return v === undefined ? [] : [{ s, pct: Math.max(-1, v * severity) }];
  }).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const totalDeficit = breaches.reduce((t, b) => t + b.deficit, 0);
  const top = [...breaches].sort((a, b) => b.deficit - a.deficit).slice(0, 5);

  return {
    source: "template",
    headline: `${scenario.name} (${severityLabel.toLowerCase()}) pushes ${breaches.length} of ${accountCount} accounts below maintenance, ${fmt(totalDeficit)} in total calls.`,
    firstOrder: moves.slice(0, 5).map(
      ({ s, pct }) => `${s.replace("_", " ").toLowerCase()} ${pct >= 0 ? "rallies" : "falls"} ${Math.abs(pct * 100).toFixed(0)}%`,
    ),
    secondOrder: scenario.factors.slice(0, 5),
    accountsAtRisk: top.map((b) => ({
      accountId: b.accountId,
      why: b.worstPosition
        ? `${b.worstPosition.symbol} loses ${fmt(-b.worstPosition.pnl)}; deficit ${fmt(b.deficit)}`
        : `Deficit ${fmt(b.deficit)}`,
    })),
    opsActions: [
      breaches.length ? `Issue maintenance calls to ${breaches.length} account(s), largest first` : "No calls needed; log the run",
      `Confirm house requirement increase of ${(scenario.houseMarginBump * 100).toFixed(0)} pts with risk`,
      "Check concentrated books in the hardest-hit sectors before the open",
    ],
  };
}

/* ---------- Numeric grounding ---------- */

const GROUNDING_TOLERANCE = 0.01;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Values a reader would quote: exact, whole dollars, "$1.6k", "$1.2M". */
function dollarVariants(v: number): number[] {
  const a = Math.abs(v);
  return [a, Math.round(a), round1(a / 1_000) * 1_000, round1(a / 1_000_000) * 1_000_000];
}

/** A fraction like -0.35 as a percentage: 35, 35.0, and the whole-number form. */
function pctVariants(fraction: number): number[] {
  const p = Math.abs(fraction * 100);
  return [p, Math.round(p), round1(p)];
}

const ID_TOKEN = /\b[A-Za-z]+-\d+\b/g;
// 1,638.94 | 1.6k | 12M | 0.5 ; a k/m/b suffix only counts when no letter follows ("5 months" and "75bp" keep their value)
const NUMBER_TOKEN = /(\d[\d,]*(?:\.\d+)?)(?:\s?([kKmMbB])(?![A-Za-z]))?/g;
const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

export function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER_TOKEN)].map(([, digits, suffix]) => {
    const n = Number(digits.replace(/,/g, ""));
    return suffix ? n * SUFFIX[suffix.toLowerCase()] : n;
  });
}

/**
 * Every number the engine handed the agent, plus common formatted variants.
 * Includes the scenario's own text (e.g. "75bp", "Category 5") since that is input too.
 */
export function allowedNumbers(input: ExplainInput): number[] {
  const { scenario, severity, breaches, accountCount } = input;
  const allowed: number[] = [accountCount, breaches.length, severity];
  for (const b of breaches) {
    allowed.push(...dollarVariants(b.deficit), ...dollarVariants(b.equityBefore), ...dollarVariants(b.equityAfter));
    allowed.push(...dollarVariants(b.equityBefore - b.equityAfter));
    if (b.worstPosition) allowed.push(...dollarVariants(b.worstPosition.pnl));
  }
  allowed.push(...dollarVariants(breaches.reduce((t, b) => t + b.deficit, 0)));
  for (const sector of SECTORS) {
    const raw = scenario.sectorShocks[sector];
    if (raw !== undefined) allowed.push(...pctVariants(Math.max(-1, raw * severity)));
  }
  allowed.push(...pctVariants(scenario.houseMarginBump), scenario.houseMarginBump);
  for (const text of [scenario.name, scenario.blurb, ...scenario.factors]) allowed.push(...numbersIn(text));
  return allowed;
}

/** Every string a reader will see in the explanation. */
function explanationText(e: z.infer<typeof ExplanationSchema>): string[] {
  return [e.headline, ...e.firstOrder, ...e.secondOrder, ...e.opsActions, ...e.accountsAtRisk.map((a) => a.why)];
}

/**
 * Numbers in the explanation that the engine never produced. Small integers (0-10)
 * and numbers that are part of account IDs (ACC-1004, or "account 1004") are allowed.
 * Empty array = grounded.
 */
export function findUngroundedNumbers(explanation: z.infer<typeof ExplanationSchema>, input: ExplainInput): number[] {
  const allowed = allowedNumbers(input);
  const idNumbers = new Set(input.breaches.flatMap((b) => (b.accountId.match(/\d+/g) ?? []).map(Number)));
  const ok = (n: number) =>
    (Number.isInteger(n) && n >= 0 && n <= 10) ||
    idNumbers.has(n) ||
    allowed.some((a) => Math.abs(n - a) <= GROUNDING_TOLERANCE * Math.max(Math.abs(a), 1e-9));
  const found = explanationText(explanation).flatMap((t) => numbersIn(t.replace(ID_TOKEN, " ")));
  return [...new Set(found.filter((n) => !ok(n)))];
}

/**
 * Turn Claude's raw text into an explanation, or fall back to the template if it isn't
 * valid JSON, fails the schema, or quotes a number the engine didn't compute.
 */
export function explanationFromResponse(text: string, input: ExplainInput): Explanation {
  try {
    const parsed = ExplanationSchema.parse(JSON.parse(text.replace(/```json|```/g, "").trim()));
    const ungrounded = findUngroundedNumbers(parsed, input);
    if (ungrounded.length > 0) {
      console.warn("[explainer] falling back to template: ungrounded numbers", ungrounded);
      return templateExplanation(input);
    }
    return { ...parsed, source: "claude" };
  } catch (err) {
    console.warn("[explainer] falling back to template:", (err as Error).message);
    return templateExplanation(input);
  }
}

export async function explainScenario(input: ExplainInput): Promise<Explanation> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return templateExplanation(input);

  try {
    const client = new Anthropic({ apiKey, timeout: 20_000 });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    return explanationFromResponse(text, input);
  } catch (err) {
    // The agent is never on the critical path: a failed call degrades to the template.
    console.warn("[explainer] falling back to template:", (err as Error).message);
    return templateExplanation(input);
  }
}
