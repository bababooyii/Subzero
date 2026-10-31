"use client";

import { FileText, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "@/features/catalog/actions";
import { formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, btnSquare } from "@/lib/ui";
import { type Interval, intervalUnit } from "./catalog-utils";
import { type FieldErrors, errorHint } from "./field-errors";
import { isWhole } from "./form-utils";
import { HoldDelete } from "./HoldDelete";

export type TemplateData = {
  id: string;
  name: string;
  validityDays: number;
  planId: string | null;
  planName: string | null;
  paymentTermId: string | null;
  notes: string | null;
  lines: { productId: string; variantId: string | null; quantity: number; productName: string }[];
};
export type TemplatePlan = { id: string; name: string; price: number; interval: Interval };
export type TemplateProduct = { id: string; name: string };
export type TemplatePaymentTerm = { id: string; name: string; dueDays: number };

type LineDraft = { productId: string; variantId: string | null; qty: string };

function TemplateForm({
  initial,
  products,
  plans,
  paymentTerms,
  onOpenChange,
}: {
  initial: TemplateData | null;
  products: TemplateProduct[];
  plans: TemplatePlan[];
  paymentTerms: TemplatePaymentTerm[];
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>();
  const [name, setName] = useState(initial?.name ?? "");
  const [validity, setValidity] = useState(String(initial?.validityDays ?? 30));
  const [planId, setPlanId] = useState(initial?.planId ?? plans[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initial
      ? initial.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          qty: String(l.quantity),
        }))
      : [{ productId: products[0]?.id ?? "", variantId: null, qty: "1" }],
  );

  const patch = (i: number, p: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const valid =
    name.trim() !== "" &&
    isWhole(validity, 1) &&
    planId !== "" &&
    lines.length > 0 &&
    lines.every((l) => l.productId !== "" && isWhole(l.qty, 1));

  const linesError = errorHint(
    errors,
    "lines",
    ...lines.flatMap((_, i) => [`lines.${i}.productId`, `lines.${i}.variantId`, `lines.${i}.quantity`]),
  );

  const save = () => {
    const input = {
      name: name.trim(),
      validityDays: Number(validity),
      planId,
      // The dialog has no payment-term control: keep the template's own, or default to the shortest term.
      paymentTermId: initial?.paymentTermId ?? paymentTerms[0]?.id ?? "",
      notes: initial?.notes ?? undefined,
      lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: Number(l.qty) })),
    };
    startTransition(async () => {
      const result = initial ? await updateTemplateAction(initial.id, input) : await createTemplateAction(input);
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
      width={520}
      title={initial ? "Edit template" : "New template"}
      description={initial ? initial.name : "A starting point for quotations."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid || pending}>
            {initial ? "Save template" : "Add template"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="tpl-name" hint={errorHint(errors, "name")}>
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Starter bundle" autoFocus />
        </Field>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Validity (days)" htmlFor="tpl-validity" hint={errorHint(errors, "validityDays")}>
            <Input
              id="tpl-validity"
              align="right"
              inputMode="numeric"
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
            />
          </Field>
          <Field label="Plan" htmlFor="tpl-plan" hint={errorHint(errors, "planId", "paymentTermId")}>
            <Dropdown
              id="tpl-plan"
              value={planId}
              onChange={setPlanId}
              options={plans.map((p) => ({
                value: p.id,
                label: `${p.name} · ${formatMoney(p.price)} / ${intervalUnit(p.interval)}`,
              }))}
            />
          </Field>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-text">Product lines</span>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setLines((ls) => [...ls, { productId: products[0]?.id ?? "", variantId: null, qty: "1" }])}
            >
              <Plus size={14} strokeWidth={2.5} /> Add line
            </button>
          </div>
          {linesError ? <p className="text-[12px]">{linesError}</p> : null}
          {lines.length === 0 ? <p className="text-[12px] text-muted">Add at least one product line.</p> : null}
          <ScrollPanel className="max-h-[min(50vh,224px)]">
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_32px] gap-2">
                  <Dropdown
                    aria-label={`Line ${i + 1} product`}
                    value={l.productId}
                    onChange={(v) => patch(i, { productId: v, variantId: null })}
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                  <Input
                    aria-label={`Line ${i + 1} quantity`}
                    align="right"
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => patch(i, { qty: e.target.value })}
                  />
                  <button
                    type="button"
                    className={btnSquare}
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          </ScrollPanel>
        </div>
      </div>
    </DialogContent>
  );
}

/** Quotation templates table (server-paged) plus the template dialog. Saves go through the catalog server actions. */
export function TemplatesView({
  templates,
  paging,
  products,
  plans,
  paymentTerms,
}: {
  templates: TemplateData[];
  paging: { total: number; page: number; pageSize: number };
  products: TemplateProduct[];
  plans: TemplatePlan[];
  paymentTerms: TemplatePaymentTerm[];
}) {
  const [editing, setEditing] = useState<TemplateData | "new" | null>(null);
  const [, startTransition] = useTransition();

  const columns = useMemo<TableColumn<TemplateData>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setEditing(row.original)}
            className="cursor-pointer text-left font-medium text-text outline-none hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "validityDays",
        header: "Validity",
        cell: ({ row }) => <span className="text-muted">{row.original.validityDays} days</span>,
        meta: { align: "right" },
      },
      {
        id: "plan",
        header: "Plan",
        enableSorting: false,
        cell: ({ row }) => {
          const p = plans.find((x) => x.id === row.original.planId);
          if (p) {
            return (
              <span>
                {p.name}{" "}
                <span className="text-muted tabular-nums">
                  · {formatMoney(p.price)} / {intervalUnit(p.interval)}
                </span>
              </span>
            );
          }
          return row.original.planName ? <span>{row.original.planName}</span> : <span className="text-muted">Deleted plan</span>;
        },
      },
      {
        id: "lines",
        header: "Lines",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[320px] truncate text-muted">
            {row.original.lines.map((l) => `${l.productName} ×${l.quantity}`).join(", ")}
          </span>
        ),
      },
    ],
    [plans],
  );

  const remove = (t: TemplateData) =>
    startTransition(async () => {
      const result = await deleteTemplateAction(t.id);
      toast(result.ok ? `Deleted ${t.name}` : result.error);
    });

  const { total } = paging;
  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro icon={<FileText />} title="Templates" subtitle={`${total} template${total === 1 ? "" : "s"}`} />
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus size={14} strokeWidth={2.5} /> New template
          </button>
        </>
      }
    >
      <div className="h-full min-h-0">
        <DataTable
          aria-label="Quotation templates"
          data={templates}
          columns={columns}
          paging={paging}
          getRowId={(t) => t.id}
          empty={{
            icon: <FileText />,
            title: "No templates yet",
            subtitle: "Save a bundle of products and a plan to reuse in quotations.",
          }}
          rowActions={(t) => (
            <>
              <button
                type="button"
                className={btnSquare}
                aria-label={`Edit ${t.name}`}
                title="Edit"
                onClick={() => setEditing(t)}
              >
                <Pencil size={14} />
              </button>
              <HoldDelete label={t.name} onConfirm={() => remove(t)} />
            </>
          )}
        />
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          {editing ? (
            <TemplateForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              products={products}
              plans={plans}
              paymentTerms={paymentTerms}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
