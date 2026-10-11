import cron from "node-cron";
import type { PrismaClient } from "@prisma/client";
import { runMarginSweep } from "./marginSweep";

export function startScheduler(prisma: PrismaClient, expression = process.env.SWEEP_CRON ?? "*/5 * * * *") {
  let running = false; // in-process overlap guard; the advisory lock covers multi-instance
  const task = cron.schedule(expression, async () => {
    if (running) return;
    running = true;
    try {
      const r = await runMarginSweep(prisma, { tick: true });
      console.log(`[sweep] checked=${r.checked} breaches=${r.breaches} created=${r.created}${r.skippedLocked ? " (locked)" : ""}`);
    } catch (err) {
      console.error("[sweep] failed", err);
    } finally {
      running = false;
    }
  });
  console.log(`[sweep] scheduled "${expression}"`);
  return task;
}
