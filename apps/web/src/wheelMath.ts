/**
 * Slice i spans [i * step, (i + 1) * step) degrees, measured clockwise from 12 o'clock,
 * where the pointer sits. Rotating the wheel by R moves a point at angle a to a + R.
 */
export const sliceStep = (count: number) => 360 / count;

const mod360 = (deg: number) => ((deg % 360) + 360) % 360;

/** Resting rotation (0-360) that puts the centre of slice i under the pointer. */
export function restingRotation(sliceIndex: number, count: number) {
  return mod360(-(sliceIndex + 0.5) * sliceStep(count));
}

/**
 * Next cumulative rotation: always forward, at least `turns` full turns, landing on the slice.
 * Keeping it cumulative means the CSS transition never spins backwards.
 */
export function nextRotation(current: number, sliceIndex: number, count: number, turns = 5) {
  const delta = mod360(restingRotation(sliceIndex, count) - mod360(current));
  return current + turns * 360 + delta;
}

/** Which slice sits under the pointer for a given rotation. */
export function sliceAtPointer(rotation: number, count: number) {
  return Math.floor(mod360(-rotation) / sliceStep(count)) % count;
}

/** Greedy word wrap for SVG labels (SVG text doesn't wrap by itself). */
export function wrapLabel(text: string, maxChars: number, maxLines = 3) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
  return kept;
}

/** Point on a circle, with 0deg at 12 o'clock and angles growing clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/* ---------- Tones and contrast ---------- */

const INK = "#172030";
const WHITE = "#FFFFFF";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix a hex colour toward white by t (0..1). */
export function tint(hex: string, t: number) {
  return toHex(rgb(hex).map((v) => v + (255 - v) * t));
}

/**
 * Neighbouring slices alternate dark and light so they never blur together:
 * even slices use the scenario colour with white labels, odd slices a light tint with ink labels.
 */
export function sliceTone(index: number, color: string) {
  return index % 2 === 0 ? { fill: color, label: WHITE } : { fill: tint(color, 0.62), label: INK };
}

/* ---------- Spin motion ---------- */

const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Share of the spin spent settling back from the overshoot. */
export const SETTLE_SHARE = 0.14;

/**
 * Wheel angle at progress p (0..1): decelerates past the target by `overshoot` degrees,
 * then settles back onto it. Ends exactly on target.
 */
export function spinAngle(p: number, start: number, target: number, overshoot: number) {
  const t = Math.min(Math.max(p, 0), 1);
  const peak = target + overshoot;
  if (t < 1 - SETTLE_SHARE) return start + (peak - start) * easeOutQuart(t / (1 - SETTLE_SHARE));
  return peak - overshoot * easeInOutSine((t - (1 - SETTLE_SHARE)) / SETTLE_SHARE);
}

/** Pegs sit on slice boundaries; how many crossed the pointer moving from angle a to b. */
export function pegsPassed(a: number, b: number, count: number) {
  const step = sliceStep(count);
  return Math.abs(Math.floor(b / step) - Math.floor(a / step));
}

/**
 * Where and how long to decelerate onto a slice.
 * From rest: five full turns over 4.6s. From a free spin at `speed` deg/ms: the duration is
 * chosen so the slow-down starts at that same speed (no jerk), and it lasts at least `minMs`.
 */
export function landingPlan(from: number, sliceIndex: number, count: number, speed: number, minMs: number) {
  if (speed <= 0) return { target: nextRotation(from, sliceIndex, count, 5), duration: 4600 };
  // easeOutQuart starts at 4x the average rate, over the non-settle share of the duration
  const rate = (1 - SETTLE_SHARE) / 4;
  const minDistance = speed * rate * minMs;
  const target = nextRotation(from + minDistance, sliceIndex, count, 0);
  return { target, duration: (target - from) / (speed * rate) };
}
