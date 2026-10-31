import { Suspense } from "react";
import { TemplatesView } from "@/components/catalog/TemplatesView";
import { db } from "@/db/client";
import { getTemplate, listPaymentTerms, listPlans, listTemplates, productOptions } from "@/features/catalog/queries";
import { readPaging } from "@/lib/table-params";

export const metadata = { title: "Templates · Brightloop" };

export default function Page(props: PageProps<"/catalog/templates">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Templates {...props} />
    </Suspense>
  );
}

async function Templates({ searchParams }: PageProps<"/catalog/templates">) {
  const paging = readPaging(await searchParams);
  const [list, plans, products, paymentTerms] = await Promise.all([
    listTemplates(db, paging),
    listPlans(db, { active: true, pageSize: 200 }),
    productOptions(db),
    listPaymentTerms(db),
  ]);
  // The list rows only carry a line count; the table and the edit dialog need the lines themselves.
  const details = await Promise.all(list.rows.map((r) => getTemplate(db, r.id)));
  const templates = list.rows.map((row, i) => {
    const t = details[i];
    return {
      id: row.id,
      name: row.name,
      validityDays: row.validityDays,
      planId: row.planId,
      planName: row.planName,
      paymentTermId: row.paymentTermId,
      notes: t?.notes ?? null,
      lines: (t?.lines ?? []).map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        productName: l.productName,
      })),
    };
  });
  return (
    <TemplatesView
      templates={templates}
      paging={{ total: list.total, page: list.page, pageSize: list.pageSize }}
      products={products.map((p) => ({ id: p.id, name: p.name }))}
      plans={plans.rows.map((p) => ({ id: p.id, name: p.name, price: p.price, interval: p.interval }))}
      paymentTerms={paymentTerms}
    />
  );
}
