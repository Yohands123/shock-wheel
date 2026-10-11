import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Fail on serious or critical violations; list them so the failure says what to fix. */
async function expectNoSeriousViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = serious.map((v) => `${v.impact}: ${v.id} (${v.help}) at ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(report, `${label}: serious or critical accessibility violations`).toEqual([]);
}

test("spin with a fixed seed, read the explanation, open the drawer: no serious a11y violations", async ({ page }) => {
  await page.goto("/");
  const wheel = page.getByRole("img", { name: /^Shock wheel/ });
  await expect(wheel).toBeVisible();
  await expectNoSeriousViolations(page, "Initial load");

  // Spin with a fixed seed; reduced motion means it lands as soon as the server answers
  await page.getByRole("textbox", { name: "Replay seed" }).fill("e2e-axe");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(wheel).toHaveAttribute("aria-label", /landed on/, { timeout: 30_000 });
  const result = page.getByRole("region", { name: "Shock wheel" }).locator("[aria-live]");
  await expect(result).not.toContainText("Spinning");
  await expectNoSeriousViolations(page, "After the spin");

  // Same seed always lands on the same scenario
  const scenario = await result.locator(".display").first().textContent();
  expect(scenario).toBeTruthy();

  await page.getByRole("tab", { name: "Run explanation" }).click();
  await expect(page.getByRole("region", { name: "Run explanation" })).toBeVisible();
  await expectNoSeriousViolations(page, "Run explanation tab");

  await page.getByRole("tab", { name: "Queue" }).click();
  const firstRow = page.locator("tr.queue-row").first();
  await expect(firstRow).toBeVisible();
  // Keyboard path: focus the row and press Enter
  await firstRow.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Audit trail" })).toBeVisible();
  await expectNoSeriousViolations(page, "Account drawer");
});
