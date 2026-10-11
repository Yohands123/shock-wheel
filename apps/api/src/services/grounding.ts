/**
 * Numeric grounding for LLM output: every number a model writes must be one the engine
 * supplied (or a common formatting of it). Shared by the scenario and renewal explainers.
 */

export const GROUNDING_TOLERANCE = 0.01;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Values a reader would quote: exact, whole dollars, "$1.6k", "$1.2M". */
export function dollarVariants(v: number): number[] {
  const a = Math.abs(v);
  return [a, Math.round(a), round1(a / 1_000) * 1_000, round1(a / 1_000_000) * 1_000_000];
}

/** A fraction like -0.35: as written (0.35) and as a percentage (35, 35.0, whole number). */
export function pctVariants(fraction: number): number[] {
  const p = Math.abs(fraction * 100);
  return [Math.abs(fraction), p, Math.round(p), round1(p)];
}

export const ID_TOKEN = /\b[A-Za-z]+-\d+\b/g;
// 1,638.94 | 1.6k | 12M | 0.5 ; a k/m/b suffix only counts when no letter follows ("5 months" and "75bp" keep their value)
const NUMBER_TOKEN = /(\d[\d,]*(?:\.\d+)?)(?:\s?([kKmMbB])(?![A-Za-z]))?/g;
const SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

export function numbersIn(text: string): number[] {
  return [...text.matchAll(NUMBER_TOKEN)].map(([, digits, suffix]) => {
    const n = Number(digits.replace(/,/g, ""));
    return suffix ? n * SUFFIX[suffix.toLowerCase()] : n;
  });
}

/** The JSON object in a reply, ignoring code fences or any prose before or after it. */
export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return text.slice(start, end + 1);
}

/**
 * Numbers in `texts` that match nothing in `allowed` within 1%. Small integers (0-10) and
 * numbers inside ID tokens (ACC-1004) are always fine. Empty array = grounded.
 */
export function ungroundedNumbers(texts: string[], allowed: number[], extraAllowed: Set<number> = new Set()) {
  const ok = (n: number) =>
    (Number.isInteger(n) && n >= 0 && n <= 10) ||
    extraAllowed.has(n) ||
    allowed.some((a) => Math.abs(n - a) <= GROUNDING_TOLERANCE * Math.max(Math.abs(a), 1e-9));
  const found = texts.flatMap((t) => numbersIn(t.replace(ID_TOKEN, " ")));
  return [...new Set(found.filter((n) => !ok(n)))];
}

/** The strings that contain any of the given numbers, for logging what failed. */
export function textsContaining(texts: string[], numbers: number[]) {
  return texts.filter((t) => numbersIn(t.replace(ID_TOKEN, " ")).some((n) => numbers.includes(n)));
}
