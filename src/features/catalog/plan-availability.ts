export type PlanWindow = {
  availableFrom: string; // YYYY-MM-DD
  availableTo: string | null; // YYYY-MM-DD, inclusive; null = open-ended
};

/** True when `on` (YYYY-MM-DD) falls within the plan's window, both ends inclusive. */
export function isPlanAvailable(plan: PlanWindow, on: string): boolean {
  if (on < plan.availableFrom) return false;
  return plan.availableTo === null || on <= plan.availableTo;
}

/** "Brand: Odoo" */
export function variantLabel(attribute: string, value: string): string {
  return `${attribute}: ${value}`;
}

/** Unit price in paise for a product line, with the variant's extra price added. */
export function unitPriceWithVariant(salesPrice: number, extraPrice: number): number {
  return salesPrice + extraPrice;
}
