import type { PrismaClient } from "@prisma/client";
import type { AccountInput, PositionInput, Sector } from "@shock/shared";
import { num } from "../db";

export interface Book {
  account: AccountInput & { name: string; owner: string };
  positions: (PositionInput & { name: string })[];
}

/** Load accounts with positions priced off the latest price feed. */
export async function loadBooks(prisma: PrismaClient, accountIds?: string[]): Promise<Book[]> {
  const accounts = await prisma.account.findMany({
    where: accountIds ? { id: { in: accountIds } } : undefined,
    include: { positions: { include: { instrument: true } } },
    orderBy: { id: "asc" },
  });
  return accounts.map((a) => ({
    account: {
      id: a.id,
      name: a.name,
      owner: a.owner,
      cash: num(a.cash),
      longMaintPct: num(a.longMaintPct),
      shortMaintPct: num(a.shortMaintPct),
    },
    positions: a.positions.map((p) => ({
      symbol: p.symbol,
      name: p.instrument.name,
      sector: p.instrument.sector as Sector,
      qty: p.qty,
      price: num(p.instrument.price),
    })),
  }));
}
