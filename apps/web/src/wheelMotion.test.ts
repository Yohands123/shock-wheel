import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@shock/shared";
import { contrastRatio, landingPlan, nextRotation, pegsPassed, sliceAtPointer, sliceTone, spinAngle, SETTLE_SHARE } from "./wheelMath";

describe("slice tones", () => {
  it("give every slice label at least 4.5:1 contrast", () => {
    SCENARIOS.forEach((s, i) => {
      const tone = sliceTone(i, s.color);
      expect(contrastRatio(tone.label, tone.fill), s.id).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("alternate so neighbours differ in lightness", () => {
    SCENARIOS.forEach((s, i) => {
      const next = SCENARIOS[(i + 1) % SCENARIOS.length];
      const a = sliceTone(i, s.color).fill;
      const b = sliceTone(i + 1, next.color).fill;
      expect(contrastRatio(a, b), `${s.id} vs ${next.id}`).toBeGreaterThan(2);
    });
  });
});

describe("spin motion", () => {
  const start = 30;
  const target = nextRotation(start, 3, 8, 5);
  const overshoot = 12;

  it("starts at the start and ends exactly on the server's slice", () => {
    expect(spinAngle(0, start, target, overshoot)).toBe(start);
    expect(spinAngle(1, start, target, overshoot)).toBe(target);
    expect(sliceAtPointer(spinAngle(1, start, target, overshoot), 8)).toBe(3);
  });

  it("overshoots the target and then settles back", () => {
    const peak = spinAngle(1 - SETTLE_SHARE, start, target, overshoot);
    expect(peak).toBeCloseTo(target + overshoot);
    expect(spinAngle(1 - SETTLE_SHARE / 2, start, target, overshoot)).toBeLessThan(peak);
  });

  it("only moves forward before the settle", () => {
    let prev = start;
    for (let p = 0.01; p <= 1 - SETTLE_SHARE; p += 0.01) {
      const a = spinAngle(p, start, target, overshoot);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it("counts pegs crossing the pointer", () => {
    expect(pegsPassed(0, 44, 8)).toBe(0);
    expect(pegsPassed(44, 46, 8)).toBe(1);
    expect(pegsPassed(0, 360, 8)).toBe(8);
  });
});

describe("landing from a free spin", () => {
  const speed = 0.6; // deg/ms

  it("lands on the server's slice and takes at least the minimum time", () => {
    for (const from of [0, 123.4, 5000]) {
      for (let i = 0; i < 8; i++) {
        const plan = landingPlan(from, i, 8, speed, 3200);
        expect(sliceAtPointer(plan.target, 8)).toBe(i);
        expect(plan.duration).toBeGreaterThanOrEqual(3200);
        expect(plan.target).toBeGreaterThan(from);
      }
    }
  });

  it("starts the slow-down at the free-spin speed, so there is no jerk", () => {
    const from = 777;
    const plan = landingPlan(from, 5, 8, speed, 3200);
    const dt = 1; // ms
    const v0 = (spinAngle(dt / plan.duration, from, plan.target, 0) - from) / dt;
    expect(v0).toBeCloseTo(speed, 1);
  });

  it("from rest, spins five full turns", () => {
    const plan = landingPlan(10, 2, 8, 0, 3200);
    expect(plan.target - 10).toBeGreaterThanOrEqual(5 * 360);
  });
});

