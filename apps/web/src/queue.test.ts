import { describe, expect, it } from "vitest";
import { groupByPriority } from "./components/QueuePanel";
import type { ExceptionRow } from "./graphql";

const row = (id: string, priority: ExceptionRow["priority"], deficit: number, status: ExceptionRow["status"] = "OPEN"): ExceptionRow => ({
  id,
  priority,
  status,
  deficit,
  source: "SCENARIO",
  equity: 1000,
  maintenanceRequirement: 2000,
  createdAt: "2026-10-11T12:00:00Z",
  account: { id: `ACC-${id}`, name: `Account ${id}` },
  assignee: null,
  scenarioRun: null,
});

describe("groupByPriority", () => {
  it("orders groups from critical to low and skips empty ones", () => {
    const groups = groupByPriority([row("1", "LOW", 10), row("2", "CRITICAL", 50), row("3", "HIGH", 20)]);
    expect(groups.map((g) => g.priority)).toEqual(["CRITICAL", "HIGH", "LOW"]);
  });

  it("sums only unresolved deficit per group", () => {
    const [critical] = groupByPriority([row("1", "CRITICAL", 100), row("2", "CRITICAL", 40, "RESOLVED"), row("3", "CRITICAL", 5)]);
    expect(critical.rows).toHaveLength(3);
    expect(critical.deficit).toBe(105);
  });
});
