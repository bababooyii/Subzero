import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { user } from "@/db/schema";
import { containsPattern } from "@/features/catalog/queries";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";

type Db = DB | Tx;

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
  createdAt: string;
};

export type ListUsersParams = ListParams & { role?: UserRow["role"] };

export async function listUsers(db: Db, params: ListUsersParams = {}): Promise<Paged<UserRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const conds: SQL[] = [];
  const q = params.q?.trim();
  if (q) {
    const p = containsPattern(q);
    conds.push(or(ilike(user.name, p), ilike(user.email, p))!);
  }
  if (params.role) conds.push(eq(user.role, params.role));
  const where = conds.length ? and(...conds) : undefined;

  const sortCols = { name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } as const;
  const sortCol = sortCols[(params.sort as keyof typeof sortCols) ?? "createdAt"] ?? user.createdAt;
  const dir = params.dir ?? (params.sort ? "asc" : "desc");

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(where)
    .orderBy(dir === "desc" ? desc(sortCol) : asc(sortCol), asc(user.id))
    .limit(limit)
    .offset(offset);
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(where);

  return {
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString().slice(0, 10) })),
    total: n,
    page,
    pageSize,
  };
}
