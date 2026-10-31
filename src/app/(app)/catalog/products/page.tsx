import { Suspense } from "react";
import { ProductsView } from "@/components/catalog/ProductsView";
import { db } from "@/db/client";
import { getProduct, listProducts, listTaxes } from "@/features/catalog/queries";
import { readPaging } from "@/lib/table-params";

export const metadata = { title: "Products · Brightloop" };

export default function Page(props: PageProps<"/catalog/products">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Products {...props} />
    </Suspense>
  );
}

async function Products({ searchParams }: PageProps<"/catalog/products">) {
  const paging = readPaging(await searchParams);
  const [list, taxes] = await Promise.all([listProducts(db, { ...paging, active: true }), listTaxes(db)]);
  // The list rows only carry a variant count; the table and the edit dialog need the variants and default tax too.
  const details = await Promise.all(list.rows.map((r) => getProduct(db, r.id)));
  const products = details.flatMap((p) => (p ? [{ id: p.id, name: p.name, type: p.type, salesPrice: p.salesPrice, costPrice: p.costPrice, notes: p.notes, variants: p.variants, taxes: p.taxes }] : []));
  return (
    <ProductsView
      products={products}
      paging={{ total: list.total, page: list.page, pageSize: list.pageSize }}
      taxes={taxes.filter((t) => t.active).map(({ id, name, rateBps }) => ({ id, name, rateBps }))}
    />
  );
}
