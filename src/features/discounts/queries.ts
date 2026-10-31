import { and, asc, desc, eq, ilike, inArray, isNull, lte, gte, or, sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { discountProducts, discounts } from "@/db/schema";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";
import type { DiscountRule } from "@/server/pricing";
import type { DiscountStatus } from "./schemas";

type Executor = DB | Tx;

export type DiscountListRow = {
  id: string;
  name: string;
  kind: "fixed" | "percent";
  value: number;
  scope: "products" | "subscription";
  minAmount: number | null;
  minQty: number | null;
  startsOn: string | null;
  endsOn: string | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
} & Record<"status", DiscountStatus>;

function statusSql(today: string) {
  return sql<DiscountStatus>`case
    when not ${discounts.active} then 'inactive'
    when ${discounts.usageLimit} is not null and ${discounts.usedCount} >= ${discounts.usageLimit} then 'used_up'
    when ${discounts.startsOn} is not null and ${discounts.startsOn} > ${today}::date then 'scheduled'
    when ${discounts.endsOn} is not null and ${discounts.endsOn} < ${today}::date then 'expired'
    else 'active' end`;
}

const SORTS = {
  name: discounts.name,
  value: discounts.value,
  startsOn: discounts.startsOn,
  endsOn: discounts.endsOn,
  usedCount: discounts.usedCount,
} as const;

export async function listDiscounts(
  db: Executor,
  params: ListParams & { status?: DiscountStatus; today: string },
): Promise<Paged<DiscountListRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const status = statusSql(params.today);
  const conds: SQL[] = [];
  if (params.q?.trim()) conds.push(ilike(discounts.name, `%${params.q.trim()}%`));
  if (params.status) conds.push(sql`${status} = ${params.status}`);
  const where = conds.length ? and(...conds) : undefined;

  const sortCol = SORTS[params.sort as keyof typeof SORTS] ?? discounts.name;
  const order = params.dir === "desc" ? desc(sortCol) : asc(sortCol);

  const rows = await db
    .select({
      id: discounts.id,
      name: discounts.name,
      kind: discounts.kind,
      value: discounts.value,
      scope: discounts.scope,
      minAmount: discounts.minAmount,
      minQty: discounts.minQty,
      startsOn: discounts.startsOn,
      endsOn: discounts.endsOn,
      usageLimit: discounts.usageLimit,
      usedCount: discounts.usedCount,
      active: discounts.active,
      status,
    })
    .from(discounts)
    .where(where)
    .orderBy(order, asc(discounts.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(discounts)
    .where(where);
  return { rows, total, page, pageSize };
}

async function productIdsFor(db: Executor, ids: string[]) {
  const map = new Map<string, string[]>();
  if (!ids.length) return map;
  const rows = await db
    .select()
    .from(discountProducts)
    .where(inArray(discountProducts.discountId, ids));
  for (const r of rows) {
    const list = map.get(r.discountId) ?? [];
    list.push(r.productId);
    map.set(r.discountId, list);
  }
  return map;
}

export async function getDiscount(db: Executor, id: string): Promise<DiscountRule | null> {
  const [row] = await db.select().from(discounts).where(eq(discounts.id, id));
  if (!row) return null;
  const map = await productIdsFor(db, [id]);
  return toRule(row, map.get(id) ?? []);
}

function toRule(row: typeof discounts.$inferSelect, productIds: string[]): DiscountRule {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    value: row.value,
    scope: row.scope,
    productIds,
    minAmount: row.minAmount,
    minQty: row.minQty,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    active: row.active,
  };
}

/** Active, in the date window on `on`, not used up; subscription scope or touching one of `productIds`. */
export async function listApplicableDiscounts(
  db: Executor,
  params: { productIds: string[]; on: string },
): Promise<DiscountRule[]> {
  const overlap = params.productIds.length
    ? sql`exists (select 1 from ${discountProducts} where ${discountProducts.discountId} = ${discounts.id} and ${inArray(discountProducts.productId, params.productIds)})`
    : sql`false`;
  const rows = await db
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.active, true),
        or(isNull(discounts.startsOn), lte(discounts.startsOn, params.on)),
        or(isNull(discounts.endsOn), gte(discounts.endsOn, params.on)),
        or(isNull(discounts.usageLimit), sql`${discounts.usedCount} < ${discounts.usageLimit}`),
        or(eq(discounts.scope, "subscription"), overlap),
      ),
    )
    .orderBy(asc(discounts.name), asc(discounts.id));
  const map = await productIdsFor(db, rows.map((r) => r.id));
  return rows.map((r) => toRule(r, map.get(r.id) ?? []));
}
