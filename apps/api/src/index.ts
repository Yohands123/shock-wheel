import { startStandaloneServer } from "@apollo/server/standalone";
import { createServer } from "./server";
import { prisma } from "./db";
import { startScheduler } from "./jobs/scheduler";

const server = createServer();
const { url } = await startStandaloneServer(server, {
  listen: { port: Number(process.env.PORT ?? 4000) },
  context: async ({ req }) => ({
    prisma,
    actorId: (req.headers["x-user-id"] as string | undefined) ?? "u-maya",
  }),
});
console.log(`GraphQL ready at ${url}`);

if (process.env.DISABLE_SCHEDULER !== "1") startScheduler(prisma);
