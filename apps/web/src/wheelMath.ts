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
