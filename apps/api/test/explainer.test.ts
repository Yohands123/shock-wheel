import { describe, expect, it, vi } from "vitest";
import { SCENARIOS, scenarioById } from "@shock/shared";
import { explanationFromResponse, findUngroundedNumbers, numbersIn, templateExplanation, type ExplainInput } from "../src/services/explainer";

// Pure unit tests: no API call, no database.

const input: ExplainInput = {
  scenario: scenarioById("hormuz-closure"),
  severityLabel: "SEVERE",
  severity: 1,
  accountCount: 16,
  breaches: [
    {
      accountId: "ACC-1004",
      name: "Halvorsen Capital",
      deficit: 1638.94,
      equityBefore: 7623,
      equityAfter: 5900.5,
      worstPosition: { symbol: "XOM", sector: "ENERGY", pnl: -2100 },
    },
  ],
};

const grounded = {
  headline: "Strait of Hormuz closure (severe) pushes 1 of 16 accounts below maintenance, $1,639 in total calls.",
  firstOrder: ["Tankers rally 50%", "Energy up 35%", "Airlines fall 25%", "Broad market slips 5%"],
  secondOrder: ["War-risk cover can be cancelled at short notice", "The house adds 10 pts of maintenance"],
  accountsAtRisk: [
    { accountId: "ACC-1004", why: "Short XOM loses $2.1k; equity drops from $7,623 to $5,900.50, a $1.6k deficit" },
  ],
  opsActions: ["Call ACC-1004 for $1,638.94 before the open", "Review account 1004 concentration"],
};

const respond = (body: unknown) => JSON.stringify(body);

describe("numbersIn", () => {
  it("parses commas, k/M suffixes and leaves words alone", () => {
    expect(numbersIn("$1,638.94 and $1.6k, 12M, 5 months, 75bp")).toEqual([1638.94, 1600, 12_000_000, 5, 75]);
  });
});

describe("numeric grounding", () => {
  it("accepts a response that only quotes engine numbers", () => {
    expect(findUngroundedNumbers(grounded, input)).toEqual([]);
    expect(explanationFromResponse(respond(grounded), input).source).toBe("claude");
  });

  it("falls back to the template when Claude invents a figure", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const invented = { ...grounded, secondOrder: [...grounded.secondOrder, "Expect a $48,000 loss across the book"] };
    expect(findUngroundedNumbers(invented, input)).toEqual([48000]);
    const result = explanationFromResponse(respond(invented), input);
    expect(result.source).toBe("template");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ungrounded"), [48000]);
    warn.mockRestore();
  });

  it("does not treat account IDs as figures", () => {
    const ids = {
      ...grounded,
      accountsAtRisk: [{ accountId: "ACC-1004", why: "ACC-1004 and ACC-1016 hold the same short" }],
    };
    expect(findUngroundedNumbers(ids, input)).toEqual([]);
  });

  it("allows small integers but not other made-up percentages", () => {
    const pct = { ...grounded, firstOrder: ["3 sectors move", "Semis fall 42%"] };
    expect(findUngroundedNumbers(pct, input)).toEqual([42]);
  });

  it("scales shock percentages by severity", () => {
    const mild = { ...input, severity: 0.5, severityLabel: "MILD" as const };
    // Tankers +50% at full severity is +25% at mild; quoting 50% is no longer grounded
    expect(findUngroundedNumbers({ ...grounded, firstOrder: ["Tankers rally 25%"] }, mild)).toEqual([]);
    expect(findUngroundedNumbers({ ...grounded, firstOrder: ["Tankers rally 50%"] }, mild)).toEqual([50]);
  });

  it("passes the template's own output for every scenario and severity", () => {
    for (const scenario of SCENARIOS) {
      for (const severity of [0.5, 1, 2]) {
        const i = { ...input, scenario, severity };
        expect(findUngroundedNumbers(templateExplanation(i), i)).toEqual([]);
      }
    }
  });

  it("still falls back on a schema failure", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(explanationFromResponse(respond({ headline: "x" }), input).source).toBe("template");
    warn.mockRestore();
  });
});
