import { TemplatesView } from "@/components/catalog/TemplatesView";
import { listPlans, listProducts, listTemplates } from "@/lib/mock/selectors";

export const metadata = { title: "Templates · Brightloop" };

export default function Page() {
  return <TemplatesView initial={listTemplates()} products={listProducts()} plans={listPlans()} />;
}
