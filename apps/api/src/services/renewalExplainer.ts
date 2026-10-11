import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  PERIL_LABEL,
  PERILS,
  regionById,
  type CoverageGap,
  type Driver,
  type HouseProfile,
  type NonRenewalRisk,
  type Peril,
  type PerilScores,
  type RenewalEvent,
} from "@shock/shared";
import { dollarVariants, extractJson, pctVariants, textsContaining, ungroundedNumbers } from "./grounding";

export const RenewalExplanationSchema = z.object({
  headline: z.string().min(1),
  whyItMoved: z.array(z.string()).min(1).max(6),
  askYourBroker: z.array(z.string()).min(1).max(5),
  mitigation: z.array(z.string()).min(1).max(6),
  coverageGaps: z.array(z.string()).max(4),
});
export type RenewalExplanation = z.infer<typeof RenewalExplanationSchema> & { source: "claude" | "template" };

export interface RenewalExplainInput {
  year: number;
  event: Pick<RenewalEvent, "id" | "name" | "blurb" | "kind">;
  severityLabel: string;
  severity: number;
  profile: HouseProfile;
  exposure: PerilScores;
  premiumBefore: number;
  premiumAfter: number;
  changePct: number;
  drivers: Driver[];
  nonRenewalRisk: NonRenewalRisk;
  coverageGaps: CoverageGap[];
}

const SYSTEM = `You explain one home insurance renewal that has ALREADY been computed by a pricing model.
Use only the numbers in the input: premiums, the change, driver amounts, exposures, deductible and house facts.
Never invent prices, percentages, discounts or savings. Plain English, under 25 words per bullet.
Mitigation ideas come from this list when relevant: roof replacement or impact-rated shingles, sump pump,
backwater valve, ember-resistant vents and clearing brush, higher deductible. Do not quote savings for them.
This is an illustrative model, not a quote; do not promise outcomes.
Respond with JSON only:
{"headline": string, "whyItMoved": string[], "askYourBroker": string[], "mitigation": string[], "coverageGaps": string[]}`;

const usd = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${Math.abs(n * 100).toFixed(1)}%`;

function topPerils(exp: PerilScores, n: number): Peril[] {
  return [...PERILS].sort((a, b) => exp[b] - exp[a]).slice(0, n).filter((p) => exp[p] >= 0.3);
}

const MITIGATION: Record<Peril, string> = {
  WIND: "Ask whether a new or impact-rated roof would earn a credit with your insurer",
  HAIL: "Impact-rated shingles are the usual hail mitigation; ask if they change your rating",
  WILDFIRE: "Ember-resistant vents and clearing brush near the house reduce wildfire risk",
  FLOOD: "A backwater valve and keeping valuables out of the basement limit flood damage",
  WATER_BACKUP: "A sump pump with battery backup and a backwater valve cut water backup risk",
  EARTHQUAKE: "Bolting the frame to the foundation is the standard earthquake retrofit",
  WINTER: "Insulating exposed pipes and keeping heat on when away prevents freeze damage",
};

/** Deterministic fallback: used without an API key, in tests, or when Claude fails validation. */
export function templateRenewalExplanation(input: RenewalExplainInput): RenewalExplanation {
  const { event, severityLabel, premiumBefore, premiumAfter, changePct, drivers, exposure, profile } = input;
  const direction = premiumAfter > premiumBefore ? "raises" : premiumAfter < premiumBefore ? "lowers" : "leaves";
  const sev = event.kind === "PERSONAL" ? "" : ` (${severityLabel.toLowerCase()})`;
  const headline =
    direction === "leaves"
      ? `${event.name}${sev} leaves your premium at ${usd(premiumAfter)}.`
      : `${event.name}${sev} ${direction} your premium from ${usd(premiumBefore)} to ${usd(premiumAfter)}, ${changePct > 0 ? "up" : "down"} ${pct(changePct)}.`;

  const sorted = [...drivers].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const whyItMoved = sorted.slice(0, 5).map((d) => (d.amount >= 0 ? `${d.label} added ${usd(d.amount)}` : `${d.label} took off ${usd(d.amount)}`));

  const perils = topPerils(exposure, 2);
  const askYourBroker = [
    perils[0] ? `How is ${PERIL_LABEL[perils[0]].toLowerCase()} risk rated for my address, and what would lower it?` : "Which rating factors moved my premium this year?",
    "How would a higher deductible change my premium, and what would I pay out of pocket on a claim?",
    "Are there credits for mitigation work I could do this year?",
  ];
  if (input.nonRenewalRisk !== "LOW") askYourBroker.push("Is there any risk my policy won't be renewed, and what are my options if it isn't?");

  const mitigation = perils.map((p) => MITIGATION[p]);
  if (profile.roofAgeYears > 15 && !perils.includes("WIND") && !perils.includes("HAIL")) mitigation.push(MITIGATION.WIND);
  mitigation.push("A higher deductible usually lowers the premium; weigh it against what you could cover yourself");

  return {
    source: "template",
    headline,
    whyItMoved: whyItMoved.length ? whyItMoved : ["Nothing changed the price this year"],
    askYourBroker: askYourBroker.slice(0, 5),
    mitigation: mitigation.slice(0, 6),
    coverageGaps: input.coverageGaps.map((g) => g.message).slice(0, 4),
  };
}

/** Every number the model was given, plus common formatted variants. */
export function allowedRenewalNumbers(input: RenewalExplainInput): number[] {
  const { profile, exposure } = input;
  const change = input.premiumAfter - input.premiumBefore;
  const allowed: number[] = [
    ...dollarVariants(input.premiumBefore),
    ...dollarVariants(input.premiumAfter),
    ...dollarVariants(change),
    ...pctVariants(input.changePct),
    ...dollarVariants(profile.deductible),
    ...dollarVariants(profile.replacementCost),
    profile.roofAgeYears,
    profile.yearBuilt,
    profile.claimsLast5Years,
    input.year,
    input.severity,
  ];
  for (const d of input.drivers) {
    allowed.push(...dollarVariants(d.amount));
    if (input.premiumBefore) allowed.push(...pctVariants(d.amount / input.premiumBefore));
  }
  for (const p of PERILS) allowed.push(exposure[p], Math.round(exposure[p] * 100) / 100, Math.round(exposure[p] * 10) / 10);
  for (const p of PERILS) allowed.push(regionById(profile.region).hazards[p]);
  return allowed;
}

function explanationText(e: z.infer<typeof RenewalExplanationSchema>) {
  return [e.headline, ...e.whyItMoved, ...e.askYourBroker, ...e.mitigation, ...e.coverageGaps];
}

export function findUngroundedRenewalNumbers(explanation: z.infer<typeof RenewalExplanationSchema>, input: RenewalExplainInput) {
  return ungroundedNumbers(explanationText(explanation), allowedRenewalNumbers(input));
}

/** Claude's raw text to an explanation, or the template if it isn't valid JSON, fails the schema, or isn't grounded. */
export function renewalExplanationFromResponse(text: string, input: RenewalExplainInput): RenewalExplanation {
  try {
    const parsed = RenewalExplanationSchema.parse(JSON.parse(extractJson(text)));
    const ungrounded = findUngroundedRenewalNumbers(parsed, input);
    if (ungrounded.length > 0) {
      console.warn("[renewal-explainer] falling back to template: ungrounded numbers", ungrounded, textsContaining(explanationText(parsed), ungrounded).slice(0, 3));
      return templateRenewalExplanation(input);
    }
    return { ...parsed, source: "claude" };
  } catch (err) {
    console.warn("[renewal-explainer] falling back to template:", (err as Error).message);
    return templateRenewalExplanation(input);
  }
}

export async function explainRenewal(input: RenewalExplainInput): Promise<RenewalExplanation> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return templateRenewalExplanation(input);
  try {
    const client = new Anthropic({ apiKey, timeout: 20_000 });
    const { profile, ...rest } = input;
    const prompt = {
      ...rest,
      house: {
        region: regionById(profile.region).name,
        construction: profile.construction,
        roofAgeYears: profile.roofAgeYears,
        yearBuilt: profile.yearBuilt,
        distanceToWater: profile.distanceToWater,
        wildlandInterface: profile.wildlandInterface,
        claimsLast5Years: profile.claimsLast5Years,
        deductible: profile.deductible,
        replacementCost: profile.replacementCost,
        endorsements: profile.endorsements,
      },
    };
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(prompt) }],
    });
    if (res.stop_reason === "max_tokens") throw new Error("response hit max_tokens before the JSON was complete");
    const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    return renewalExplanationFromResponse(text, input);
  } catch (err) {
    // Never on the critical path: a failed call degrades to the template
    console.warn("[renewal-explainer] falling back to template:", (err as Error).message);
    return templateRenewalExplanation(input);
  }
}
