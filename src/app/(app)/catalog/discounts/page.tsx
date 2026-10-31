import { DiscountsView } from "@/components/catalog/DiscountsView";
import { listDiscounts, listProducts } from "@/lib/mock/selectors";

export const metadata = { title: "Discounts · Brightloop" };

export default function Page() {
  return <DiscountsView initial={listDiscounts()} products={listProducts()} />;
}
