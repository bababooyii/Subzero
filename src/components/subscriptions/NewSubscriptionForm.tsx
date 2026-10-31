"use client";

import { Check, FilePlus2, LayoutTemplate, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { unitPriceWithVariant } from "@/features/catalog/plan-availability";
import { applySubscriptionAction, createFromTemplateAction, createSubscriptionAction } from "@/features/subscriptions/actions";
import type { ActionResult } from "@/lib/action-result";
import { formatMoney } from "@/lib/format";
import { btnSecondary, btnSquare, field, sectionTitle, surface } from "@/lib/ui";
import { price } from "@/server/pricing";
import type { NewSubscriptionData } from "./form-data";
import { INTERVAL_LABEL, addDaysISO, addMonthsISO } from "./labels";
import { PrimaryDynamicButton } from "./PrimaryDynamicButton";

type Data = NewSubscriptionData;
type DraftLine = { key: number; productId: string; variantId: string; qty: number };
type SendState = "idle" | "saving" | "sent";

let keySeq = 0;
const nextKey = () => ++keySeq;

/** Layout follows the form's width (container query), not the viewport: the left column eats space at lg. */
const lineGrid = "grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-2 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_112px_64px_84px_92px_32px]";

/** Catalog price per period for a product + variant, in paise: the same number the server snapshots onto the line. */
function unitPrice(data: Data, productId: string, variantId: string): number {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return 0;
  const extra = product.variants.find((v) => v.id === variantId)?.extraPrice ?? 0;
  return unitPriceWithVariant(product.salesPrice, extra);
}

function defaultVariant(data: Data, productId: string): string {
  return data.products.find((p) => p.id === productId)?.variants[0]?.id ?? "";
}

/** "GST 18%" when a tax has that rate, else "18%"; "Exempt" with none. Taxes come from the product, not the line. */
function taxLabel(data: Data, rates: number[]): string {
  if (rates.length === 0) return "Exempt";
  return rates.map((r) => data.taxes.find((t) => t.rateBps === r)?.name ?? `${Number((r / 100).toFixed(2))}%`).join(" + ");
}

type Props = { data: Data; initialCustomerId?: string; initialTemplateId?: string };

/** Quotation builder with a live totals block. Prices with the server's `price()`; saves through the subscription actions. */
export function NewSubscriptionForm({ data, initialCustomerId, initialTemplateId }: Props) {
  const router = useRouter();
  const defaultPlan = data.plans[0];
  const firstProduct = data.products[0];
  const initialTemplate = data.templates.find((t) => t.id === initialTemplateId);

  const makeLines = (templateId: string | null, plan: Data["plans"][number]): DraftLine[] => {
    const t = data.templates.find((x) => x.id === templateId);
    const src = t ? t.lines : firstProduct ? [{ productId: firstProduct.id, variantId: defaultVariant(data, firstProduct.id) || null, qty: 1 }] : [];
    return src.map((l) => ({ key: nextKey(), productId: l.productId, variantId: l.variantId ?? defaultVariant(data, l.productId), qty: Math.max(l.qty, plan.minQty) }));
  };

  const termFor = (id: string | null | undefined) =>
    data.paymentTerms.find((t) => t.id === id)?.id ?? data.paymentTerms.find((t) => /net 15/i.test(t.name))?.id ?? data.paymentTerms[0]?.id ?? "";

  const [templateId, setTemplateId] = useState<string | null>(initialTemplate?.id ?? null);
  const [customerId, setCustomerId] = useState(data.customers.some((c) => c.id === initialCustomerId) ? (initialCustomerId as string) : "");
  const [planId, setPlanId] = useState(
    (data.plans.some((p) => p.id === initialTemplate?.planId) ? initialTemplate?.planId : undefined) ?? defaultPlan?.id ?? "",
  );
  const [start, setStart] = useState(data.today);
  const [expiryOverride, setExpiryOverride] = useState<string | null>(null);
  const [termId, setTermId] = useState(termFor(initialTemplate?.paymentTermId));
  const [lines, setLines] = useState<DraftLine[]>(() => {
    const p = data.plans.find((x) => x.id === initialTemplate?.planId) ?? defaultPlan;
    return p ? makeLines(initialTemplate?.id ?? null, p) : [];
  });
  /** True once the lines, plan, terms or expiry differ from the chosen template: then it is saved as a plain subscription. */
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [send, setSend] = useState<SendState>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const plan = data.plans.find((p) => p.id === planId) ?? defaultPlan;

  const priced = useMemo(
    () =>
      lines.map((l) => ({
        ...l,
        unit: unitPrice(data, l.productId, l.variantId),
        rates: data.products.find((p) => p.id === l.productId)?.taxRatesBps ?? [],
      })),
    [lines, data],
  );

  // price() is the one pricing function. Lines still being typed (blank or fractional quantity) are left out of the total.
  const totals = useMemo(
    () =>
      price({
        lines: priced
          .filter((l) => Number.isInteger(l.qty) && l.qty >= 1)
          .map((l) => ({ key: String(l.key), productId: l.productId, quantity: l.qty, unitPrice: l.unit, taxRatesBps: l.rates })),
        discounts: data.discounts,
        on: data.today,
      }),
    [priced, data.discounts, data.today],
  );
  const appliedNames = totals.applied.map((a) => a.name).join(", ");

  if (!plan) {
    return (
      <PageGrid left={<Intro icon={<FilePlus2 />} title="New subscription" subtitle="Build a quotation with a live total." />}>
        <p className="text-[13px] text-muted">No plan is on sale today. Add or reactivate a plan in the catalog first.</p>
      </PageGrid>
    );
  }

  const computedExpiry = addMonthsISO(start, plan.interval === "yearly" ? 24 : 12);
  const expiry = expiryOverride ?? computedExpiry;

  const badQty = lines.some((l) => !Number.isInteger(l.qty) || l.qty < plan.minQty);
  const problems = [
    !customerId && "Choose a customer",
    !termId && "Choose payment terms",
    lines.length === 0 && "Add at least one line",
    badQty && `Quantity must be at least ${plan.minQty}`,
  ].filter(Boolean) as string[];
  const valid = problems.length === 0;
  const customerName = data.customers.find((c) => c.id === customerId)?.name ?? "customer";
  const lineError = Object.entries(errors).find(([k]) => k === "lines" || k.startsWith("lines."))?.[1][0];

  const clearError = (key: string) =>
    setErrors((e) => {
      if (!(key in e)) return e;
      return Object.fromEntries(Object.entries(e).filter(([k]) => k !== key));
    });
  const errorHint = (key: string, fallback?: React.ReactNode) => {
    const msg = errors[key]?.[0];
    return msg ? <span className="text-[#f43f5e]">{msg}</span> : fallback;
  };

  const patchLine = (key: number, patch: Partial<DraftLine>) => {
    setEdited(true);
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== "lines" && !k.startsWith("lines."))));
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const applyTemplate = (id: string | null) => {
    const t = data.templates.find((x) => x.id === id);
    const nextPlan = (t && data.plans.find((p) => p.id === t.planId)) || plan;
    setTemplateId(id);
    setEdited(false);
    setErrors({});
    setPlanId(nextPlan.id);
    if (t?.paymentTermId) setTermId(termFor(t.paymentTermId));
    setExpiryOverride(null);
    setLines(makeLines(id, nextPlan));
    toast(t ? `Loaded “${t.name}”` : "Started a blank quotation");
  };

  const changePlan = (id: string) => {
    const next = data.plans.find((p) => p.id === id);
    if (!next) return;
    setEdited(true);
    clearError("planId");
    setPlanId(id);
    setExpiryOverride(null);
    setLines((ls) => ls.map((l) => ({ ...l, qty: Math.max(l.qty, next.minQty) })));
  };

  const addLine = () => {
    if (!firstProduct) return;
    setEdited(true);
    setLines((ls) => [...ls, { key: nextKey(), productId: firstProduct.id, variantId: defaultVariant(data, firstProduct.id), qty: plan.minQty }]);
  };

  /** Saves the subscription as a draft, optionally sending the quotation straight away. */
  const save = async (andSend: boolean) => {
    if (!valid || send !== "idle") return;
    setSend("saving");
    setErrors({});
    const template = data.templates.find((t) => t.id === templateId);
    const fromTemplate = !!template && !edited && !!template.planId && !!template.paymentTermId;
    const created: ActionResult<{ id: string; number: string }> = fromTemplate
      ? await createFromTemplateAction({ templateId: template.id, customerId, startDate: start })
      : await createSubscriptionAction({
          customerId,
          planId,
          startDate: start,
          expiryDate: expiry,
          paymentTermId: termId,
          lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.qty })),
        });
    if (!created.ok) {
      setSend("idle");
      setErrors(created.fieldErrors ?? {});
      toast(created.error);
      return;
    }
    const { id, number } = created.data;
    if (!andSend) {
      setSend("idle");
      toast(`Draft ${number} saved for ${customerName}`);
      router.push(`/subscriptions/${id}`);
      return;
    }
    const sent = await applySubscriptionAction({ id, action: "send_quotation" });
    if (!sent.ok) {
      setSend("idle");
      toast(`${number} saved as a draft. ${sent.error}`);
      router.push(`/subscriptions/${id}`);
      return;
    }
    setSend("sent");
    toast(`Quotation sent to ${customerName}`);
    timers.current.push(setTimeout(() => router.push("/subscriptions?view=quotations"), 900));
  };

  const planUnit = plan.interval === "daily" ? "day" : plan.interval === "weekly" ? "week" : plan.interval === "monthly" ? "month" : "year";

  return (
    <PageGrid
      left={<Intro icon={<FilePlus2 />} title="New subscription" subtitle="Build a quotation with a live total." />}
    >
      <form
        className="@container flex h-full min-h-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <section aria-label="Start from template" className="grid shrink-0 grid-cols-2 gap-2.5 @3xl:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          <button
            type="button"
            aria-pressed={templateId === null}
            onClick={() => applyTemplate(null)}
            className={cn(surface, "flex min-w-0 cursor-pointer flex-col items-start gap-0.5 px-3.5 py-2.5 text-left outline-none hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-accent", templateId === null && "border-white/20 bg-white/[0.05]")}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-text">
              <Plus size={13} /> Blank
            </span>
            <span className="text-[12px] text-muted">Start with one empty line</span>
          </button>
          {data.templates.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={templateId === t.id}
              onClick={() => applyTemplate(t.id)}
              className={cn(surface, "flex min-w-0 cursor-pointer flex-col items-start gap-0.5 px-3.5 py-2.5 text-left outline-none hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-accent", templateId === t.id && "border-white/20 bg-white/[0.05]")}
            >
              <span className="flex max-w-full items-center gap-1.5 text-[13px] font-medium text-text">
                <LayoutTemplate size={13} className="shrink-0" /> <span className="truncate">{t.name}</span>
              </span>
              <span className="max-w-full truncate text-[12px] text-muted">
                {data.plans.find((p) => p.id === t.planId)?.name} · {t.lines.length} {t.lines.length === 1 ? "line" : "lines"} · valid {t.validityDays} days
              </span>
            </button>
          ))}
        </section>

        <section aria-label="Details" className="grid shrink-0 gap-x-4 gap-y-3 @lg:grid-cols-2 @3xl:grid-cols-3">
          <Field label="Customer" htmlFor="ns-customer" hint={errorHint("customerId")}>
            <Dropdown
              id="ns-customer"
              value={customerId}
              onChange={(v) => {
                clearError("customerId");
                setCustomerId(v);
              }}
              placeholder="Choose a customer…"
              options={[{ value: "", label: "Choose a customer…" }, ...data.customers.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <Field label="Plan" htmlFor="ns-plan" hint={errorHint("planId", `${INTERVAL_LABEL[plan.interval]} · minimum quantity ${plan.minQty}`)}>
            <Dropdown id="ns-plan" value={planId} onChange={changePlan} options={data.plans.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Payment terms" htmlFor="ns-terms" hint={errorHint("paymentTermId")}>
            <Dropdown
              id="ns-terms"
              value={termId}
              onChange={(v) => {
                setEdited(true);
                clearError("paymentTermId");
                setTermId(v);
              }}
              options={data.paymentTerms.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
          <Field label="Start" htmlFor="ns-start" hint={errorHint("startDate")}>
            <Input
              id="ns-start"
              type="date"
              value={start}
              onChange={(e) => {
                if (!e.target.value) return;
                clearError("startDate");
                setStart(e.target.value);
              }}
            />
          </Field>
          <Field
            label="Expiry"
            htmlFor="ns-expiry"
            hint={errorHint(
              "expiryDate",
              expiryOverride ? <button type="button" className="underline hover:text-text" onClick={() => setExpiryOverride(null)}>Reset to plan default</button> : `${plan.interval === "yearly" ? "24" : "12"} months from the start date.`,
            )}
          >
            <Input
              id="ns-expiry"
              type="date"
              min={addDaysISO(start, 1)}
              value={expiry}
              onChange={(e) => {
                if (!e.target.value) return;
                setEdited(true);
                clearError("expiryDate");
                setExpiryOverride(e.target.value);
              }}
            />
          </Field>
          <Field
            label="Discount"
            htmlFor="ns-discount"
            hint={appliedNames ? "Applied automatically to eligible lines." : "Live discounts apply automatically when a line qualifies."}
          >
            <Input id="ns-discount" readOnly value={appliedNames || "None applicable"} className={appliedNames ? undefined : "text-muted"} />
          </Field>
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className={sectionTitle}>Lines</h2>
            <button
              type="button"
              className={btnSecondary}
              disabled={!firstProduct}
              onClick={addLine}
            >
              <Plus size={14} /> Add line
            </button>
          </div>

          <div className={cn(surface, "flex min-h-0 flex-1 flex-col gap-2 pt-3")}>
            <div className={cn(lineGrid, "mx-3 hidden shrink-0 px-0.5 text-[12px] font-medium text-muted @2xl:grid")} aria-hidden="true">
              <span>Product</span>
              <span>Variant</span>
              <span>Tax</span>
              <span>Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ScrollPanel className="min-h-0 flex-1 px-3 pb-3">
              <div className="space-y-2">
                {priced.length === 0 ? <p className="py-4 text-center text-[13px] text-muted">No lines yet. Add one to price the quotation.</p> : null}
                {priced.map((l, i) => {
                  const product = data.products.find((p) => p.id === l.productId);
                  const lowQty = !Number.isInteger(l.qty) || l.qty < plan.minQty;
                  return (
                    <div key={l.key} className={cn(lineGrid, "border-b border-white/[0.05] pb-3 last:border-0 last:pb-0 @2xl:border-0 @2xl:pb-0")}>
                      <Dropdown
                        aria-label={`Line ${i + 1} product`}
                        className="col-span-3 @2xl:col-span-1"
                        value={l.productId}
                        onChange={(v) => patchLine(l.key, { productId: v, variantId: defaultVariant(data, v) })}
                        options={data.products.map((p) => ({ value: p.id, label: p.name }))}
                      />
                      <Dropdown
                        aria-label={`Line ${i + 1} variant`}
                        className="col-span-3 @2xl:col-span-1"
                        value={l.variantId}
                        disabled={!product?.variants.length}
                        onChange={(v) => patchLine(l.key, { variantId: v })}
                        options={
                          product?.variants.length
                            ? product.variants.map((v) => ({
                                value: v.id,
                                label: `${v.label}${v.extraPrice ? ` (+${formatMoney(v.extraPrice)})` : ""}`,
                                textValue: v.label,
                              }))
                            : [{ value: "", label: "No variants" }]
                        }
                      />
                      <span
                        className={cn(field, "col-span-3 flex h-7 min-w-0 items-center truncate text-muted @2xl:col-span-1")}
                        title="Taxes follow the product"
                      >
                        {taxLabel(data, l.rates)}
                      </span>
                      <Input
                        aria-label={`Line ${i + 1} quantity`}
                        aria-invalid={lowQty}
                        type="number"
                        inputMode="numeric"
                        min={plan.minQty}
                        step={1}
                        align="right"
                        value={Number.isNaN(l.qty) ? "" : l.qty}
                        className={cn("px-2", lowQty && "border-[#f43f5e]/60")}
                        onChange={(e) => patchLine(l.key, { qty: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                      />
                      <span className="hidden text-right text-[13px] text-muted tabular-nums @2xl:block">{formatMoney(l.unit)}</span>
                      <span className="text-right text-[13px] text-text tabular-nums">
                        <span className="mr-2 text-[12px] text-muted @2xl:hidden">{formatMoney(l.unit)} each</span>
                        {formatMoney(Math.round((Number.isNaN(l.qty) ? 0 : l.qty) * l.unit))}
                      </span>
                      <button
                        type="button"
                        className={cn(btnSquare, "justify-self-end hover:text-[#f43f5e]")}
                        aria-label={`Remove line ${i + 1}`}
                        onClick={() => {
                          setEdited(true);
                          setLines((ls) => ls.filter((x) => x.key !== l.key));
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollPanel>
          </div>
        </section>

        <div className={cn(surface, "flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3")}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2" aria-live="polite" aria-label="Totals">
            <TotalCell label="Subtotal" value={totals.subtotal} />
            <TotalCell label="Discount" value={-totals.discountTotal} />
            <TotalCell label="Tax" value={totals.taxTotal} />
            <TotalCell label={`Total per ${planUnit}`} value={totals.total} strong />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {lineError ? <p className="mr-2 text-[12px] text-[#f43f5e]">{lineError}</p> : !valid ? <p className="mr-2 text-[12px] text-muted">{problems[0]}.</p> : null}
            <button type="button" className={btnSecondary} disabled={!customerId || send !== "idle"} onClick={() => void save(false)}>
              Save as Draft
            </button>
            <PrimaryDynamicButton
              type="submit"
              stateKey={send}
              disabled={!valid || send !== "idle"}
              icon={send === "idle" ? <Send size={13} /> : send === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
            >
              {send === "idle" ? "Send quotation" : send === "saving" ? "Saving…" : "Sent"}
            </PrimaryDynamicButton>
          </div>
        </div>
      </form>
    </PageGrid>
  );
}

function TotalCell({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cn("mt-0.5 tabular-nums", strong ? "text-[17px] font-medium text-text" : "text-[15px] text-text")}>{formatMoney(value)}</p>
    </div>
  );
}
