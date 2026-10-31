"use client";

import { Box, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { archiveProductAction, createProductAction, updateProductAction } from "@/features/catalog/actions";
import { formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, btnSquare, hint } from "@/lib/ui";
import { type ProductType, PRODUCT_TYPES, productMargin, productTypeLabel } from "./catalog-utils";
import { type FieldErrors, errorHint } from "./field-errors";
import { fromPaise, isAmount, toPaise } from "./form-utils";
import { HoldDelete } from "./HoldDelete";
import { type TaxOption, TaxPicker } from "./TaxPicker";

export type ProductData = {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice: number;
  notes: string | null;
  variants: { id: string; attribute: string; value: string; extraPrice: number }[];
  /** The product's default taxes. The form edits the first one and keeps any others as they are. */
  taxes: TaxOption[];
};

type VariantDraft = { id?: string; attribute: string; value: string; extra: string };

/** GST 18% when the list has it (the usual default), otherwise the first tax. */
const defaultTaxId = (taxes: TaxOption[]) => (taxes.find((t) => t.rateBps === 1800) ?? taxes[0])?.id ?? "";

function ProductForm({
  initial,
  taxes,
  onCreateTax,
  onOpenChange,
}: {
  initial: ProductData | null;
  taxes: TaxOption[];
  onCreateTax: (t: TaxOption) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ProductType>(initial?.type ?? "service");
  const [price, setPrice] = useState(initial ? fromPaise(initial.salesPrice) : "");
  const [cost, setCost] = useState(initial ? fromPaise(initial.costPrice) : "");
  const [taxId, setTaxId] = useState(initial ? (initial.taxes[0]?.id ?? "") : defaultTaxId(taxes));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [variants, setVariants] = useState<VariantDraft[]>(
    () =>
      initial?.variants.map((v) => ({
        id: v.id,
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

  const variantError = errorHint(
    errors,
    "variants",
    ...variants.flatMap((_, i) => [`variants.${i}.attribute`, `variants.${i}.value`, `variants.${i}.extraPrice`]),
  );

  const save = () => {
    const input = {
      name: name.trim(),
      type,
      salesPrice: toPaise(price),
      costPrice: toPaise(cost),
      notes: notes.trim() || undefined,
      taxIds: [...(taxId ? [taxId] : []), ...(initial?.taxes.slice(1).map((t) => t.id) ?? [])],
      variants: variants
        .filter((v) => !isBlank(v))
        .map((v) => ({ id: v.id, attribute: v.attribute.trim(), value: v.value.trim(), extraPrice: toPaise(v.extra) })),
    };
    startTransition(async () => {
      const result = initial ? await updateProductAction(initial.id, input) : await createProductAction(input);
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
      title={initial ? "Edit product" : "New product"}
      description={initial ? initial.name : "What you sell, with optional variants."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid || pending}>
            {initial ? "Save product" : "Add product"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="Name" htmlFor="prd-name" hint={errorHint(errors, "name")}>
            <Input id="prd-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Odoo ERP Suite" autoFocus />
          </Field>
          <Field label="Type" htmlFor="prd-type" hint={errorHint(errors, "type")}>
            <Dropdown id="prd-type" value={type} onChange={(v) => setType(v as ProductType)} options={PRODUCT_TYPES} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sales price (₹)" htmlFor="prd-price" hint={errorHint(errors, "salesPrice")}>
            <Input
              id="prd-price"
              align="right"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1499"
            />
          </Field>
          <Field label="Cost price (₹)" htmlFor="prd-cost" hint={errorHint(errors, "costPrice")}>
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
        <Field
          label="Tax"
          htmlFor="prd-tax"
          hint={errorHint(errors, "taxIds") ?? "Default tax for this product on new subscription lines."}
        >
          <TaxPicker id="prd-tax" taxes={taxes} value={taxId} onChange={setTaxId} onCreate={onCreateTax} />
        </Field>
        <Field label="Notes" htmlFor="prd-notes" hint={errorHint(errors, "notes")}>
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
          {variantError ? <p className={hint}>{variantError}</p> : null}
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

/** Products table (server-paged) plus the product dialog. Saves go through the catalog server actions. */
export function ProductsView({
  products,
  paging,
  taxes: serverTaxes,
}: {
  products: ProductData[];
  paging: { total: number; page: number; pageSize: number };
  taxes: TaxOption[];
}) {
  const [createdTaxes, setCreatedTaxes] = useState<TaxOption[]>([]);
  const taxes = useMemo(
    () => [...serverTaxes, ...createdTaxes.filter((c) => !serverTaxes.some((t) => t.id === c.id))],
    [serverTaxes, createdTaxes],
  );
  const [editing, setEditing] = useState<ProductData | "new" | null>(null);
  const [, startTransition] = useTransition();

  const columns = useMemo<TableColumn<ProductData>[]>(
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
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted">{productTypeLabel(row.original.type)}</span>,
      },
      {
        id: "variants",
        header: "Variants",
        enableSorting: false,
        cell: ({ row }) => {
          const n = row.original.variants.length;
          return <span className="text-muted tabular-nums">{n === 0 ? "None" : `${n} variant${n === 1 ? "" : "s"}`}</span>;
        },
      },
      {
        id: "tax",
        header: "Tax",
        enableSorting: false,
        cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.taxes[0]?.name ?? "–"}</span>,
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
        enableSorting: false,
        cell: ({ row }) => <span className="text-muted">{formatMoney(row.original.costPrice)}</span>,
        meta: { align: "right" },
      },
      {
        id: "margin",
        header: "Margin",
        enableSorting: false,
        cell: ({ row }) => {
          const m = productMargin(row.original);
          return <span className="text-muted">{m === null ? "–" : `${m}%`}</span>;
        },
        meta: { align: "right" },
      },
    ],
    [],
  );

  const remove = (p: ProductData) =>
    startTransition(async () => {
      const result = await archiveProductAction(p.id);
      toast(result.ok ? `Removed ${p.name}` : result.error);
    });

  const { total } = paging;
  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro icon={<Box />} title="Products" subtitle={`${total} product${total === 1 ? "" : "s"}`} />
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
          paging={paging}
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
              onCreateTax={(t) => setCreatedTaxes((ts) => [...ts, t])}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
