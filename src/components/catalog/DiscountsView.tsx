"use client";

import { BadgePercent, Lock, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useRole } from "@/components/shell/role";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatusDot, type StatusKey } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { formatMoney, formatPeriod } from "@/lib/format";
import { TODAY_ISO } from "@/lib/mock/clock";
import { DISCOUNT_STATUS_LABEL, type DiscountStatus, discountStatus, discountUsagePct } from "@/lib/mock/selectors-catalog";
import type { Discount, Product } from "@/lib/mock/types";
import { btnPrimary, btnSecondary, btnSquare } from "@/lib/ui";
import { fromPaise, isAmount, isWhole, localId, toPaise } from "./form-utils";
import { HoldDelete } from "./HoldDelete";
import { UsageBar } from "./UsageBar";

const STATUS_DOT: Record<DiscountStatus, StatusKey> = {
  active: "active",
  scheduled: "draft",
  expired: "closed",
  used_up: "cancelled",
};

const valueLabel = (d: Discount) => (d.type === "percent" ? `${d.value}%` : formatMoney(d.value));

function minimums(d: Discount): string {
  const parts: string[] = [];
  if (d.minPurchase > 0) parts.push(`${formatMoney(d.minPurchase)} min`);
  if (d.minQty > 1) parts.push(`Qty ${d.minQty}+`);
  return parts.length ? parts.join(" · ") : "None";
}

function DiscountForm({
  initial,
  products,
  onSave,
  onOpenChange,
}: {
  initial: Discount | null;
  products: Product[];
  onSave: (d: Discount) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<Discount["type"]>(initial?.type ?? "percent");
  const [value, setValue] = useState(
    initial ? (initial.type === "fixed" ? fromPaise(initial.value) : String(initial.value)) : "",
  );
  const [minPurchase, setMinPurchase] = useState(initial && initial.minPurchase > 0 ? fromPaise(initial.minPurchase) : "");
  const [minQty, setMinQty] = useState(String(initial?.minQty ?? 1));
  const [start, setStart] = useState(initial?.start ?? TODAY_ISO);
  const [end, setEnd] = useState(initial?.end ?? "");
  const [limit, setLimit] = useState(initial?.usageLimit == null ? "" : String(initial.usageLimit));
  const [scope, setScope] = useState<Discount["scope"]>(initial?.scope ?? "products");
  const [targets, setTargets] = useState<string[]>(initial?.targetIds ?? []);

  const endBeforeStart = end !== "" && start !== "" && end < start;
  const valueOk = isAmount(value) && Number(value) > 0 && (type === "fixed" || Number(value) <= 100);
  const valid =
    name.trim() !== "" &&
    valueOk &&
    (minPurchase.trim() === "" || isAmount(minPurchase)) &&
    isWhole(minQty, 1) &&
    start !== "" &&
    end !== "" &&
    !endBeforeStart &&
    (limit.trim() === "" || isWhole(limit, 0));

  const save = () => {
    onSave({
      id: initial?.id ?? localId("dsc"),
      name: name.trim(),
      type,
      value: type === "fixed" ? toPaise(value) : Number(value),
      minPurchase: minPurchase.trim() === "" ? 0 : toPaise(minPurchase),
      minQty: Number(minQty),
      start,
      end,
      usageLimit: limit.trim() === "" ? null : Number(limit),
      timesUsed: initial?.timesUsed ?? 0,
      scope,
      targetIds: scope === "products" ? targets : [],
    });
    onOpenChange(false);
  };

  return (
    <DialogContent
      width={540}
      title={initial ? "Edit discount" : "New discount"}
      description={initial ? initial.name : "An offer applied to products or a whole subscription."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid || !isAdmin}>
            {initial ? "Save discount" : "Add discount"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-[12px] text-muted">
          <Lock size={13} aria-hidden="true" className="shrink-0" />
          Admin only. {isAdmin ? "Staff can apply discounts but not edit them." : "Switch to the admin role to save changes."}
        </p>
        <Field label="Name" htmlFor="dsc-name">
          <Input
            id="dsc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Diwali Dhamaka 10%"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="dsc-type">
            <Dropdown
              id="dsc-type"
              value={type}
              onChange={(v) => setType(v as Discount["type"])}
              options={[
                { value: "percent", label: "Percentage" },
                { value: "fixed", label: "Fixed amount" },
              ]}
            />
          </Field>
          <Field label={type === "percent" ? "Value (%)" : "Value (₹)"} htmlFor="dsc-value">
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
          <Field label="Minimum purchase (₹)" htmlFor="dsc-minp">
            <Input
              id="dsc-minp"
              align="right"
              inputMode="decimal"
              value={minPurchase}
              onChange={(e) => setMinPurchase(e.target.value)}
              placeholder="None"
            />
          </Field>
          <Field label="Minimum quantity" htmlFor="dsc-minq">
            <Input id="dsc-minq" align="right" inputMode="numeric" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="dsc-start">
            <Input id="dsc-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field
            label="Ends"
            htmlFor="dsc-end"
            hint={endBeforeStart ? <span className="text-danger">Must be after the start date.</span> : undefined}
          >
            <Input id="dsc-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Usage limit" htmlFor="dsc-limit">
            <Input
              id="dsc-limit"
              align="right"
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Unlimited"
            />
          </Field>
          <Field label="Applies to" htmlFor="dsc-scope">
            <Dropdown
              id="dsc-scope"
              value={scope}
              onChange={(v) => setScope(v as Discount["scope"])}
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

/** Discounts table plus the admin-only discount dialog. Changes are local state only. */
export function DiscountsView({ initial, products }: { initial: Discount[]; products: Product[] }) {
  const [discounts, setDiscounts] = useState(initial);
  const [editing, setEditing] = useState<Discount | "new" | null>(null);

  const columns = useMemo<TableColumn<Discount>[]>(
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
                : `${row.original.targetIds.length} product${row.original.targetIds.length === 1 ? "" : "s"}`}
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
        accessorKey: "start",
        header: "Dates",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted tabular-nums">{formatPeriod(row.original.start, row.original.end)}</span>
        ),
      },
      {
        id: "usage",
        header: "Usage",
        accessorFn: (d) => discountUsagePct(d) ?? -1,
        cell: ({ row }) => <UsageBar discount={row.original} />,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (d) => discountStatus(d),
        cell: ({ row }) => {
          const s = discountStatus(row.original);
          return <StatusDot className="whitespace-nowrap" status={STATUS_DOT[s]} label={DISCOUNT_STATUS_LABEL[s]} />;
        },
      },
    ],
    [],
  );

  const save = (d: Discount) => {
    const isNew = !discounts.some((x) => x.id === d.id);
    setDiscounts((ds) => (isNew ? [...ds, d] : ds.map((x) => (x.id === d.id ? d : x))));
    toast(isNew ? `Added ${d.name}` : `Saved ${d.name}`);
  };

  const remove = (d: Discount) => {
    setDiscounts((ds) => ds.filter((x) => x.id !== d.id));
    toast(`Deleted ${d.name}`);
  };

  const active = discounts.filter((d) => discountStatus(d) === "active").length;

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<BadgePercent />}
            title="Discounts"
            subtitle={`${discounts.length} discount${discounts.length === 1 ? "" : "s"} · ${active} active`}
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
              onSave={save}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
