"use client";

import { Box, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { PRODUCT_TYPES, productMargin, productTypeLabel } from "@/lib/mock/selectors-catalog";
import type { Product, ProductType, Tax } from "@/lib/mock/types";
import { btnPrimary, btnSecondary, btnSquare, hint } from "@/lib/ui";
import { fromPaise, isAmount, localId, toPaise } from "./form-utils";
import { HoldDelete } from "./HoldDelete";
import { TaxPicker } from "./TaxPicker";

const DEFAULT_TAX_ID = "tax-gst18";

type VariantDraft = { attribute: string; value: string; extra: string };

function ProductForm({
  initial,
  taxes,
  onCreateTax,
  onSave,
  onOpenChange,
}: {
  initial: Product | null;
  taxes: Tax[];
  onCreateTax: (t: Tax) => void;
  onSave: (p: Product) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ProductType>(initial?.type ?? "service");
  const [price, setPrice] = useState(initial ? fromPaise(initial.salesPrice) : "");
  const [cost, setCost] = useState(initial ? fromPaise(initial.costPrice) : "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? DEFAULT_TAX_ID);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [variants, setVariants] = useState<VariantDraft[]>(
    () =>
      initial?.variants.map((v) => ({
        attribute: v.attribute,
        value: v.value,
        extra: fromPaise(v.extraPrice),
      })) ?? [],
  );

  const patchVariant = (i: number, patch: Partial<VariantDraft>) =>
    setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const isBlank = (v: VariantDraft) => !v.attribute.trim() && !v.value.trim() && !v.extra.trim();
  const variantOk = (v: VariantDraft) => !!v.attribute.trim() && !!v.value.trim() && (!v.extra.trim() || isAmount(v.extra));
  const valid = name.trim() !== "" && isAmount(price) && isAmount(cost) && variants.every((v) => isBlank(v) || variantOk(v));

  const save = () => {
    onSave({
      id: initial?.id ?? localId("prd"),
      name: name.trim(),
      type,
      salesPrice: toPaise(price),
      costPrice: toPaise(cost),
      taxId,
      notes: notes.trim(),
      variants: variants
        .filter((v) => !isBlank(v))
        .map((v) => ({
          attribute: v.attribute.trim(),
          value: v.value.trim(),
          extraPrice: toPaise(v.extra),
        })),
    });
    onOpenChange(false);
  };

  return (
    <DialogContent
      width={540}
      title={initial ? "Edit product" : "New product"}
      description={initial ? initial.name : "What you sell, with optional variants."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid}>
            {initial ? "Save product" : "Add product"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="Name" htmlFor="prd-name">
            <Input id="prd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Odoo ERP Suite" autoFocus />
          </Field>
          <Field label="Type" htmlFor="prd-type">
            <Dropdown id="prd-type" value={type} onChange={(v) => setType(v as ProductType)} options={PRODUCT_TYPES} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sales price (₹)" htmlFor="prd-price">
            <Input
              id="prd-price"
              align="right"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1499"
            />
          </Field>
          <Field label="Cost price (₹)" htmlFor="prd-cost">
            <Input
              id="prd-cost"
              align="right"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="700"
            />
          </Field>
        </div>
        <Field label="Tax" htmlFor="prd-tax" hint="Default tax for this product on new subscription lines.">
          <TaxPicker id="prd-tax" taxes={taxes} value={taxId} onChange={setTaxId} onCreate={onCreateTax} />
        </Field>
        <Field label="Notes" htmlFor="prd-notes">
          <Textarea id="prd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-text">Variants</span>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setVariants((vs) => [...vs, { attribute: "", value: "", extra: "" }])}
            >
              <Plus size={14} strokeWidth={2.5} /> Add variant
            </button>
          </div>
          {variants.length === 0 ? (
            <p className={hint}>No variants. Add one to charge extra for an option, e.g. Brand: Odoo +₹560.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_88px_32px] gap-2 text-[12px] text-muted">
                <span>Attribute</span>
                <span>Value</span>
                <span className="text-right">Extra (₹)</span>
                <span />
              </div>
              <ScrollPanel className="max-h-[min(50vh,224px)]">
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_88px_32px] gap-2">
                      <Input
                        aria-label={`Variant ${i + 1} attribute`}
                        value={v.attribute}
                        onChange={(e) => patchVariant(i, { attribute: e.target.value })}
                        placeholder="Brand"
                      />
                      <Input
                        aria-label={`Variant ${i + 1} value`}
                        value={v.value}
                        onChange={(e) => patchVariant(i, { value: e.target.value })}
                        placeholder="Odoo"
                      />
                      <Input
                        aria-label={`Variant ${i + 1} extra price`}
                        align="right"
                        inputMode="decimal"
                        value={v.extra}
                        onChange={(e) => patchVariant(i, { extra: e.target.value })}
                        placeholder="560"
                      />
                      <button
                        type="button"
                        className={btnSquare}
                        aria-label={`Remove variant ${i + 1}`}
                        onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollPanel>
            </div>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

/** Products table plus the product dialog. Changes are local state only. */
export function ProductsView({ initial, taxes: initialTaxes }: { initial: Product[]; taxes: Tax[] }) {
  const [products, setProducts] = useState(initial);
  const [taxes, setTaxes] = useState(initialTaxes);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const columns = useMemo<TableColumn<Product>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setEditing(row.original)}
            className="block max-w-[320px] cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="block truncate font-medium text-text hover:underline">{row.original.name}</span>
            {row.original.notes ? <span className="block truncate text-[12px] text-muted">{row.original.notes}</span> : null}
          </button>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <span className="text-muted">{productTypeLabel(row.original.type)}</span>,
      },
      {
        id: "variants",
        header: "Variants",
        accessorFn: (p) => p.variants.length,
        cell: ({ row }) => {
          const n = row.original.variants.length;
          return <span className="text-muted tabular-nums">{n === 0 ? "None" : `${n} variant${n === 1 ? "" : "s"}`}</span>;
        },
      },
      {
        id: "tax",
        header: "Tax",
        accessorFn: (p) => taxes.find((t) => t.id === (p.taxId ?? DEFAULT_TAX_ID))?.name ?? "–",
        cell: ({ getValue }) => <span className="whitespace-nowrap text-muted">{getValue<string>()}</span>,
      },
      {
        accessorKey: "salesPrice",
        header: "Sales price",
        cell: ({ row }) => formatMoney(row.original.salesPrice),
        meta: { align: "right" },
      },
      {
        accessorKey: "costPrice",
        header: "Cost price",
        cell: ({ row }) => <span className="text-muted">{formatMoney(row.original.costPrice)}</span>,
        meta: { align: "right" },
      },
      {
        id: "margin",
        header: "Margin",
        accessorFn: (p) => productMargin(p) ?? 0,
        cell: ({ row }) => {
          const m = productMargin(row.original);
          return <span className="text-muted">{m === null ? "–" : `${m}%`}</span>;
        },
        meta: { align: "right" },
      },
    ],
    [taxes],
  );

  const save = (p: Product) => {
    const isNew = !products.some((x) => x.id === p.id);
    setProducts((ps) => (isNew ? [...ps, p] : ps.map((x) => (x.id === p.id ? p : x))));
    toast(isNew ? `Added ${p.name}` : `Saved ${p.name}`);
  };

  const remove = (p: Product) => {
    setProducts((ps) => ps.filter((x) => x.id !== p.id));
    toast(`Deleted ${p.name}`);
  };

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro icon={<Box />} title="Products" subtitle={`${products.length} product${products.length === 1 ? "" : "s"}`} />
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus size={14} strokeWidth={2.5} /> New product
          </button>
        </>
      }
    >
      <div className="h-full min-h-0">
        <DataTable
          aria-label="Products"
          data={products}
          columns={columns}
          getRowId={(p) => p.id}
          empty={{
            icon: <Box />,
            title: "No products yet",
            subtitle: "Add what you sell to start building plans.",
          }}
          rowActions={(p) => (
            <>
              <button
                type="button"
                className={btnSquare}
                aria-label={`Edit ${p.name}`}
                title="Edit"
                onClick={() => setEditing(p)}
              >
                <Pencil size={14} />
              </button>
              <HoldDelete label={p.name} onConfirm={() => remove(p)} />
            </>
          )}
        />
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          {editing ? (
            <ProductForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              taxes={taxes}
              onCreateTax={(t) => setTaxes((ts) => [...ts, t])}
              onSave={save}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
