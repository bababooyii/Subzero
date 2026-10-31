# A-02: pricing function (lane A, Labeeb) — branch `feat/07-pricing`

Read `docs/specs/conventions.md`. Files: `src/server/pricing/{index.ts,price.ts,allocate.ts,price.test.ts,allocate.test.ts}` only.

## Interface (other lanes code against this; don't change names)
```ts
export type PriceLineInput = {
  key: string;            // caller's id for the line
  productId: string;
  quantity: number;       // integer ≥ 1
  unitPrice: number;      // paise (already includes variant extra price)
  taxRatesBps: number[];  // e.g. [1800] for GST 18%; empty = exempt
};
export type DiscountRule = {
  id: string; name: string;
  kind: "fixed" | "percent"; value: number;      // paise | bps
  scope: "products" | "subscription"; productIds: string[];
  minAmount: number | null; minQty: number | null;
  startsOn: string | null; endsOn: string | null; // YYYY-MM-DD inclusive
  usageLimit: number | null; usedCount: number; active: boolean;
};
export type PricedLine = { key: string; subtotal: number; discount: number; taxable: number; tax: number; total: number; taxRateBps: number };
export type PriceResult = {
  lines: PricedLine[]; subtotal: number; discountTotal: number; taxTotal: number; total: number;
  applied: { discountId: string; name: string; amount: number }[];
  rejected: { discountId: string; reason: "inactive" | "not_started" | "expired" | "used_up" | "min_amount" | "min_qty" | "no_matching_products" }[];
};
export function price(input: { lines: PriceLineInput[]; discounts: DiscountRule[]; on: string }): PriceResult;
```

## Rules
1. `subtotal = quantity × unitPrice` per line.
2. Eligibility per discount, in this order of rejection reasons: `active` false → inactive; `on < startsOn` → not_started; `on > endsOn` → expired; `usageLimit != null && usedCount >= usageLimit` → used_up. Base = matching lines (products scope: lines whose productId ∈ productIds; none → no_matching_products) or all lines (subscription scope). `minAmount` compared with base subtotal; `minQty` with base total quantity.
3. Amount: percent → `round_half_up(baseSubtotal × bps / 10000)`; fixed → `value`. Cap at the base's remaining (undiscounted) amount.
4. Allocate each discount across its base lines pro-rata to their remaining amount with the largest-remainder method so the parts sum exactly (allocate.ts, pure, tested).
5. Discounts apply in order: products-scope first, then subscription-scope, each in input order. A line's discount never exceeds its subtotal.
6. `taxable = subtotal − discount`; `taxRateBps = sum(taxRatesBps)`; `tax = round_half_up(taxable × taxRateBps / 10000)` per line; `total = taxable + tax`. Totals are sums of line values.
7. Pure: no I/O, no Date.now, no mutation of inputs. Throw on non-integer money/quantity.

## Tests (≥ 15)
No discounts; GST 18% rounding half-up (e.g. 333 paise × 18% = 59.94 → 60); exempt line; multiple tax rates; percent subscription discount allocated across 3 lines summing exactly; fixed discount larger than subtotal capped; products-scope only hits matching lines; each rejection reason; usage limit boundary (usedCount = limit − 1 applies); date boundaries inclusive; two discounts stacking; the brief's example: product with "Odoo" brand variant +₹560 (unit price includes it); deterministic output.

Done when typecheck/lint/test pass. Don't commit.
