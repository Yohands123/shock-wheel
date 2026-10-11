import type { ExceptionStatus, PrismaClient } from "@prisma/client";
import { GraphQLError } from "graphql";

const fail = (message: string, code: string) => new GraphQLError(message, { extensions: { code } });

async function load(prisma: PrismaClient, id: string) {
  const ex = await prisma.exception.findUnique({ where: { id } });
  if (!ex) throw fail(`Exception ${id} not found`, "NOT_FOUND");
  if (ex.status === "RESOLVED") throw fail("Exception is already resolved", "CONFLICT");
  return ex;
}

/**
 * Status change + audit row in one transaction. The update is conditional on the
 * status we read, so two analysts acting at once can't both win (optimistic lock).
 */
async function transition(
  prisma: PrismaClient,
  id: string,
  fromStatus: ExceptionStatus,
  data: Parameters<PrismaClient["exception"]["update"]>[0]["data"],
  audit: { action: string; actorId: string; payload: Record<string, unknown> },
) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.exception.updateMany({ where: { id, status: fromStatus }, data: data as never });
    if (count === 0) throw fail("Exception changed while you were working on it; refresh and retry", "CONFLICT");
    await tx.auditLog.create({ data: { exceptionId: id, ...audit, payload: audit.payload as never } });
    return tx.exception.findUniqueOrThrow({ where: { id } });
  });
}

export async function assignException(prisma: PrismaClient, actorId: string, id: string, userId: string) {
  const ex = await load(prisma, id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "system") throw fail(`User ${userId} cannot be assigned`, "BAD_USER_INPUT");
  return transition(
    prisma, id, ex.status,
    { assigneeId: userId, status: ex.status === "OPEN" ? "ASSIGNED" : ex.status },
    { action: "ASSIGNED", actorId, payload: { from: ex.assigneeId, to: userId } },
  );
}

export async function resolveException(prisma: PrismaClient, actorId: string, id: string, note: string) {
  if (note.trim().length < 5) throw fail("Add a resolution note of at least 5 characters", "BAD_USER_INPUT");
  const ex = await load(prisma, id);
  return transition(
    prisma, id, ex.status,
    { status: "RESOLVED", resolutionNote: note.trim() },
    { action: "RESOLVED", actorId, payload: { note: note.trim(), previousStatus: ex.status } },
  );
}

export async function escalateException(prisma: PrismaClient, actorId: string, id: string, reason: string) {
  if (reason.trim().length < 5) throw fail("Add an escalation reason of at least 5 characters", "BAD_USER_INPUT");
  const ex = await load(prisma, id);
  if (ex.status === "ESCALATED") throw fail("Exception is already escalated", "CONFLICT");
  const supervisor = await prisma.user.findFirst({ where: { role: "supervisor" }, orderBy: { id: "asc" } });
  return transition(
    prisma, id, ex.status,
    { status: "ESCALATED", escalationReason: reason.trim(), assigneeId: supervisor?.id ?? ex.assigneeId },
    { action: "ESCALATED", actorId, payload: { reason: reason.trim(), to: supervisor?.id } },
  );
}
