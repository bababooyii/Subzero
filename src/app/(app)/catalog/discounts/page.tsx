import { Suspense } from "react";
import { DiscountsView } from "@/components/catalog/DiscountsView";
import { db } from "@/db/client";
import { productOptions } from "@/features/catalog/queries";
import { getDiscount, listDiscounts } from "@/features/discounts/queries";
import { requestToday } from "@/lib/request-today";
import { readPaging } from "@/lib/table-params";

export const metadata = { title: "Discounts · Brightloop" };

export default function Page(props: PageProps<"/catalog/discounts">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Discounts {...props} />
    </Suspense>
  );
}

async function Discounts({ searchParams }: PageProps<"/catalog/discounts">) {
  const paging = readPaging(await searchParams);
  const today = await requestToday();
  const [list, active, products] = await Promise.all([
    listDiscounts(db, { ...paging, today }),
    listDiscounts(db, { status: "active", pageSize: 1, today }),
    productOptions(db),
  ]);
  // The list rows don't say which products a discount targets; the table and the edit dialog need them.
  const rules = await Promise.all(list.rows.map((r) => getDiscount(db, r.id)));
  const discounts = list.rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    value: r.value,
    scope: r.scope,
    productIds: rules[i]?.productIds ?? [],
    minAmount: r.minAmount,
    minQty: r.minQty,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    usageLimit: r.usageLimit,
    usedCount: r.usedCount,
    active: r.active,
    status: r.status,
  }));
  return (
    <DiscountsView
      discounts={discounts}
      paging={{ total: list.total, page: list.page, pageSize: list.pageSize }}
      activeCount={active.total}
      products={products.map((p) => ({ id: p.id, name: p.name }))}
      today={today}
    />
  );
}
