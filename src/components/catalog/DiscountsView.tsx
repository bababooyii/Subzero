"use client";

import { BadgePercent, Lock, Pencil, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatusDot, type StatusKey } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { archiveDiscountAction, createDiscountAction, updateDiscountAction } from "@/features/discounts/actions";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { btnPrimary, btnSecondary, btnSquare } from "@/lib/ui";
import { DISCOUNT_STATUS_LABEL, type DiscountStatus, bpsToPercent, percentToBps } from "./catalog-utils";
import { type FieldErrors, errorHint } from "./field-errors";
import { fromPaise, isAmount, isWhole, toPaise } from "./form-utils";
import { HoldDelete } from "./HoldDelete";
import { UsageBar } from "./UsageBar";

export type DiscountData = {
  id: string;
  name: string;
  kind: "fixed" | "percent";
  /** Paise for fixed, basis points for percent. */
  value: number;
  scope: "products" | "subscription";
  productIds: string[];
  minAmount: number | null;
  minQty: number | null;
  startsOn: string | null;
  endsOn: string | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  status: DiscountStatus;
};
export type DiscountProduct = { id: string; name: string };

const STATUS_DOT: Record<DiscountStatus, StatusKey> = {
  active: "active",
  scheduled: "draft",
  expired: "closed",
  used_up: "cancelled",
  inactive: "closed",
};

const valueLabel = (d: DiscountData) => (d.kind === "percent" ? `${bpsToPercent(d.value)}%` : formatMoney(d.value));

function minimums(d: DiscountData): string {
  const parts: string[] = [];
  if (d.minAmount) parts.push(`${formatMoney(d.minAmount)} min`);
  if (d.minQty && d.minQty > 1) parts.push(`Qty ${d.minQty}+`);
  return parts.length ? parts.join(" · ") : "None";
}

function period(d: DiscountData): string {
  if (d.startsOn && d.endsOn) return formatPeriod(d.startsOn, d.endsOn);
  if (d.startsOn) return `From ${formatDate(d.startsOn)}`;
  if (d.endsOn) return `Until ${formatDate(d.endsOn)}`;
  return "Always";
}

function DiscountForm({
  initial,
  products,
  today,
  onOpenChange,
}: {
  initial: DiscountData | null;
  products: DiscountProduct[];
  today: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<DiscountData["kind"]>(initial?.kind ?? "percent");
  const [value, setValue] = useState(
    initial ? (initial.kind === "fixed" ? fromPaise(initial.value) : bpsToPercent(initial.value)) : "",
  );
  const [minPurchase, setMinPurchase] = useState(initial?.minAmount ? fromPaise(initial.minAmount) : "");
  const [minQty, setMinQty] = useState(String(initial?.minQty ?? 1));
  const [start, setStart] = useState(initial ? (initial.startsOn ?? "") : today);
  const [end, setEnd] = useState(initial?.endsOn ?? "");
  const [limit, setLimit] = useState(initial?.usageLimit == null ? "" : String(initial.usageLimit));
  const [scope, setScope] = useState<DiscountData["scope"]>(initial?.scope ?? "products");
  const [targets, setTargets] = useState<string[]>(initial?.productIds ?? []);

  const endBeforeStart = end !== "" && start !== "" && end < start;
  const valueOk = isAmount(value) && Number(value) > 0 && (type === "fixed" || Number(value) <= 100);
  const valid =
    name.trim() !== "" &&
    valueOk &&
    (minPurchase.trim() === "" || isAmount(minPurchase)) &&
    isWhole(minQty, 1) &&
    !endBeforeStart &&
    (limit.trim() === "" || isWhole(limit, 0));

  const save = () => {
    const qty = Number(minQty);
    const input = {
      name: name.trim(),
      kind: type,
      value: type === "fixed" ? toPaise(value) : percentToBps(value),
      scope,
      productIds: scope === "products" ? targets : [],
      minAmount: minPurchase.trim() === "" || toPaise(minPurchase) === 0 ? null : toPaise(minPurchase),
      minQty: qty > 1 ? qty : null,
      startsOn: start || null,
      endsOn: end || null,
      usageLimit: limit.trim() === "" ? null : Number(limit),
      active: initial?.active ?? true,
    };
    startTransition(async () => {
      const result = initial ? await updateDiscountAction(initial.id, input) : await createDiscountAction(input);
      if (!result.ok) {
        setErrors(result.fieldErrors);
        toast(result.error);
        return;
      }
      toast(initial ? `Saved ${input.name}` : `Added ${input.name}`);
      onOpenChange(false);
    });
  };

  return (
    <DialogContent
      width={540}
      title={initial ? "Edit discount" : "New discount"}
      description={initial ? initial.name : "An offer applied to products or a whole subscription."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid || pending}>
            {initial ? "Save discount" : "Add discount"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-muted">
          <Lock size={13} aria-hidden="true" className="shrink-0" />
          Admin only. Staff can apply discounts but not edit them.
        </p>
        <Field label="Name" htmlFor="dsc-name" hint={errorHint(errors, "name")}>
          <Input
            id="dsc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Diwali Dhamaka 10%"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="dsc-type" hint={errorHint(errors, "kind")}>
            <Dropdown
              id="dsc-type"
              value={type}
              onChange={(v) => setType(v as DiscountData["kind"])}
              options={[
                { value: "percent", label: "Percentage" },
                { value: "fixed", label: "Fixed amount" },
              ]}
            />
          </Field>
          <Field label={type === "percent" ? "Value (%)" : "Value (₹)"} htmlFor="dsc-value" hint={errorHint(errors, "value")}>
            <Input
              id="dsc-value"
              align="right"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "percent" ? "10" : "1500"}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum purchase (₹)" htmlFor="dsc-minp" hint={errorHint(errors, "minAmount")}>
            <Input
              id="dsc-minp"
              align="right"
              inputMode="decimal"
              value={minPurchase}
              onChange={(e) => setMinPurchase(e.target.value)}
              placeholder="None"
            />
          </Field>
          <Field label="Minimum quantity" htmlFor="dsc-minq" hint={errorHint(errors, "minQty")}>
            <Input id="dsc-minq" align="right" inputMode="numeric" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="dsc-start" hint={errorHint(errors, "startsOn")}>
            <Input id="dsc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field
            label="Ends"
            htmlFor="dsc-end"
            hint={
              endBeforeStart ? <span className="text-danger">Must be after the start date.</span> : (errorHint(errors, "endsOn") ?? "Leave empty for no end date.")
            }
          >
            <Input id="dsc-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usage limit" htmlFor="dsc-limit" hint={errorHint(errors, "usageLimit")}>
            <Input
              id="dsc-limit"
              align="right"
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Unlimited"
            />
          </Field>
          <Field label="Applies to" htmlFor="dsc-scope" hint={errorHint(errors, "scope")}>
            <Dropdown
              id="dsc-scope"
              value={scope}
              onChange={(v) => setScope(v as DiscountData["scope"])}
              options={[
                { value: "products", label: "Selected products" },
                { value: "subscription", label: "Whole subscription" },
              ]}
            />
          </Field>
        </div>
        {scope === "products" ? (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-text">Products</legend>
            {errorHint(errors, "productIds") ? <p className="mb-2 text-[12px]">{errorHint(errors, "productIds")}</p> : null}
            <ScrollPanel className="max-h-[min(18vh,96px)] rounded-md border border-white/[0.07] bg-[#1c1c1c]">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3">
                {products.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 text-[13px] text-text">
                    <input
                      type="checkbox"
                      checked={targets.includes(p.id)}
                      onChange={(e) => setTargets((ts) => (e.target.checked ? [...ts, p.id] : ts.filter((x) => x !== p.id)))}
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </ScrollPanel>
          </fieldset>
        ) : null}
      </div>
    </DialogContent>
  );
}

/** Discounts table (server-paged) plus the admin-only discount dialog. Saves go through the discount server actions. */
export function DiscountsView({
  discounts,
  paging,
  activeCount,
  products,
  today,
}: {
  discounts: DiscountData[];
  paging: { total: number; page: number; pageSize: number };
  activeCount: number;
  products: DiscountProduct[];
  today: string;
}) {
  const [editing, setEditing] = useState<DiscountData | "new" | null>(null);
  const [, startTransition] = useTransition();

  const columns = useMemo<TableColumn<DiscountData>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setEditing(row.original)}
            className="block max-w-[260px] cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="block truncate font-medium text-text hover:underline">{row.original.name}</span>
            <span className="block truncate text-[12px] text-muted">
              {row.original.scope === "subscription"
                ? "Whole subscription"
                : `${row.original.productIds.length} product${row.original.productIds.length === 1 ? "" : "s"}`}
            </span>
          </button>
        ),
      },
      {
        accessorKey: "value",
        header: "Discount",
        cell: ({ row }) => <span className="tabular-nums">{valueLabel(row.original)}</span>,
      },
      {
        id: "minimums",
        header: "Minimums",
        enableSorting: false,
        cell: ({ row }) => <span className="whitespace-nowrap text-muted">{minimums(row.original)}</span>,
      },
      {
        accessorKey: "startsOn",
        header: "Dates",
        cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{period(row.original)}</span>,
      },
      {
        accessorKey: "usedCount",
        header: "Usage",
        cell: ({ row }) => <UsageBar discount={row.original} />,
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => {
          const s = row.original.status;
          return <StatusDot className="whitespace-nowrap" status={STATUS_DOT[s]} label={DISCOUNT_STATUS_LABEL[s]} />;
        },
      },
    ],
    [],
  );

  const remove = (d: DiscountData) =>
    startTransition(async () => {
      const result = await archiveDiscountAction(d.id);
      toast(result.ok ? `Deactivated ${d.name}` : result.error);
    });

  const { total } = paging;
  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<BadgePercent />}
            title="Discounts"
            subtitle={`${total} discount${total === 1 ? "" : "s"} · ${activeCount} active`}
          />
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus size={14} strokeWidth={2.5} /> New discount
          </button>
        </>
      }
    >
      <div className="h-full min-h-0">
        <DataTable
          aria-label="Discounts"
          data={discounts}
          columns={columns}
          paging={paging}
          getRowId={(d) => d.id}
          empty={{
            icon: <BadgePercent />,
            title: "No discounts yet",
            subtitle: "Offers you create here can be applied to subscription lines.",
          }}
          rowActions={(d) => (
            <>
              <button
                type="button"
                className={btnSquare}
                aria-label={`Edit ${d.name}`}
                title="Edit"
                onClick={() => setEditing(d)}
              >
                <Pencil size={14} />
              </button>
              <HoldDelete label={d.name} onConfirm={() => remove(d)} />
            </>
          )}
        />
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          {editing ? (
            <DiscountForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              products={products}
              today={today}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
