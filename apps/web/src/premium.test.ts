import { describe, expect, it } from "vitest";
import { RENEWAL_EVENTS } from "@shock/shared";
import { niceStep, pathPoints, tickLabel } from "./components/premium/PathChart";
import { waterfallRows } from "./components/premium/Waterfall";
import type { RenewalRun } from "./premiumGraphql";
import { contrastRatio, sliceTone } from "./wheelMath";

describe("renewal wheel tones", () => {
  it("give every event label at least 4.5:1 contrast", () => {
    RENEWAL_EVENTS.forEach((e, i) => {
      const tone = sliceTone(i, e.color);
      expect(contrastRatio(tone.label, tone.fill), e.id).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("render premium-lowering events as solid cleared green", () => {
    RENEWAL_EVENTS.forEach((e, i) => {
      if (e.lowersPremium) expect(sliceTone(i, e.color).fill, e.id).toBe("#2F7A57");
    });
  });

  it("alternate light and dark around the whole wheel", () => {
    RENEWAL_EVENTS.forEach((e, i) => {
      const next = RENEWAL_EVENTS[(i + 1) % RENEWAL_EVENTS.length];
      expect(contrastRatio(sliceTone(i, e.color).fill, sliceTone(i + 1, next.color).fill), `${e.id} vs ${next.id}`).toBeGreaterThan(2);
    });
  });
});

describe("waterfallRows", () => {
  it("runs from last year's premium through each driver to this year's", () => {
    const rows = waterfallRows(2400, [{ label: "Annual rate trend", amount: 72 }, { label: "New roof credit", amount: -168.3 }], 2303.7);
    expect(rows.map((r) => r.label)).toEqual(["Last year", "Annual rate trend", "New roof credit", "This year"]);
    expect(rows[1]).toMatchObject({ kind: "up", from: 2400, to: 2472 });
    expect(rows[2]).toMatchObject({ kind: "down", from: 2472, to: 2303.7 });
    expect(rows.at(-1)!.to).toBe(2303.7);
  });
});

describe("path chart helpers", () => {
  it("starts the path at the saved premium and labels points by event", () => {
    const run = { year: 1, premiumAfter: 2600, changePct: 0.0833, event: { shortLabel: "Hail storm", name: "Hail storm" } } as RenewalRun;
    const pts = pathPoints(2400, [run]);
    expect(pts.map((p) => [p.year, p.label, p.premium])).toEqual([
      [0, "Start", 2400],
      [1, "Hail storm", 2600],
    ]);
  });

  it("labels ticks so neighbours never read the same", () => {
    expect([2400, 2450, 2500].map((v) => tickLabel(v, 50))).toEqual(["$2,400", "$2,450", "$2,500"]);
    expect([2400, 2600].map((v) => tickLabel(v, 200))).toEqual(["$2.4K", "$2.6K"]);
    expect([2000, 3000].map((v) => tickLabel(v, 1000))).toEqual(["$2K", "$3K"]);
  });

  it("picks round tick steps", () => {
    expect(niceStep(4000)).toBe(1000);
    expect(niceStep(700)).toBe(200);
    expect(niceStep(90)).toBe(50);
  });
});
