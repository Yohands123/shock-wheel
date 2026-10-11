import { SEVERITY_MULTIPLIER, type SeverityLabel } from "./types";

/** FNV-1a string hash -> 32-bit seed */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, deterministic PRNG */
export function rngFromSeed(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Same seed + same slice count always lands on the same outcome. */
export function spinOutcome(seed: string, sliceCount: number) {
  const rand = rngFromSeed(seed);
  const sliceIndex = Math.floor(rand() * sliceCount);
  const r = rand();
  // Tail events are rare: 55% mild, 35% severe, 10% tail
  const severityLabel: SeverityLabel = r < 0.55 ? "MILD" : r < 0.9 ? "SEVERE" : "TAIL";
  return { sliceIndex, severityLabel, severity: SEVERITY_MULTIPLIER[severityLabel] };
}
