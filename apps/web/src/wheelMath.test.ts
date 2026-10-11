import { describe, expect, it } from "vitest";
import { nextRotation, restingRotation, sliceAtPointer, wrapLabel } from "./wheelMath";

describe("wheel rotation", () => {
  it("lands the pointer on every slice from any starting angle", () => {
    for (const start of [0, 17, 359, 1234.5, -90]) {
      for (let i = 0; i < 8; i++) {
        const r = nextRotation(start, i, 8);
        expect(sliceAtPointer(r, 8)).toBe(i);
        expect(r - start).toBeGreaterThanOrEqual(5 * 360);
        expect(r - start).toBeLessThan(6 * 360);
      }
    }
  });

  it("rests on the slice centre", () => {
    expect(restingRotation(0, 8)).toBe(337.5);
    expect(sliceAtPointer(restingRotation(3, 8), 8)).toBe(3);
  });
});

describe("wrapLabel", () => {
  it("wraps on word boundaries", () => {
    expect(wrapLabel("Strait of Hormuz closure", 14)).toEqual(["Strait of", "Hormuz closure"]);
  });

  it("caps the line count", () => {
    expect(wrapLabel("a b c d", 1, 2)).toEqual(["a", "b…"]);
  });
});
