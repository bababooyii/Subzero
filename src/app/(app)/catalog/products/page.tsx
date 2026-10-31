import { ProductsView } from "@/components/catalog/ProductsView";
import { listProducts, listTaxes } from "@/lib/mock/selectors";

export const metadata = { title: "Products · Brightloop" };

export default function Page() {
  return <ProductsView initial={listProducts()} taxes={listTaxes()} />;
}
