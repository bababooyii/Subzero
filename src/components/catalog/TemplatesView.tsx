"use client";

import { FileText, Pencil, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { intervalUnit } from "@/lib/mock/selectors-catalog";
import type { Plan, Product, QuotationTemplate } from "@/lib/mock/types";
import { btnPrimary, btnSecondary, btnSquare } from "@/lib/ui";
import { isWhole, localId } from "./form-utils";
import { HoldDelete } from "./HoldDelete";

type LineDraft = { productId: string; qty: string };

function TemplateForm({
  initial,
  products,
  plans,
  onSave,
  onOpenChange,
}: {
  initial: QuotationTemplate | null;
  products: Product[];
  plans: Plan[];
  onSave: (t: QuotationTemplate) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [validity, setValidity] = useState(String(initial?.validityDays ?? 30));
  const [planId, setPlanId] = useState(initial?.planId ?? plans[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initial
      ? initial.lines.map((l) => ({
          productId: l.productId,
          qty: String(l.qty),
        }))
      : [{ productId: products[0]?.id ?? "", qty: "1" }],
  );

  const patch = (i: number, p: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const valid =
    name.trim() !== "" &&
    isWhole(validity, 1) &&
    planId !== "" &&
    lines.length > 0 &&
    lines.every((l) => l.productId !== "" && isWhole(l.qty, 1));

  const save = () => {
    onSave({
      id: initial?.id ?? localId("tpl"),
      name: name.trim(),
      validityDays: Number(validity),
      planId,
      lines: lines.map((l) => ({ productId: l.productId, qty: Number(l.qty) })),
    });
    onOpenChange(false);
  };

  return (
    <DialogContent
      width={520}
      title={initial ? "Edit template" : "New template"}
      description={initial ? initial.name : "A starting point for quotations."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid}>
            {initial ? "Save template" : "Add template"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="tpl-name">
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Starter bundle" autoFocus />
        </Field>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Validity (days)" htmlFor="tpl-validity">
            <Input
              id="tpl-validity"
              align="right"
              inputMode="numeric"
              value={validity}
              onChange={(e) => setValidity(e.target.value)}
            />
          </Field>
          <Field label="Plan" htmlFor="tpl-plan">
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
              onClick={() => setLines((ls) => [...ls, { productId: products[0]?.id ?? "", qty: "1" }])}
            >
              <Plus size={14} strokeWidth={2.5} /> Add line
            </button>
          </div>
          {lines.length === 0 ? <p className="text-[12px] text-muted">Add at least one product line.</p> : null}
          <ScrollPanel className="max-h-[min(50vh,224px)]">
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_32px] gap-2">
                  <Dropdown
                    aria-label={`Line ${i + 1} product`}
                    value={l.productId}
                    onChange={(v) => patch(i, { productId: v })}
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

/** Quotation templates table plus the template dialog. Changes are local state only. */
export function TemplatesView({
  initial,
  products,
  plans,
}: {
  initial: QuotationTemplate[];
  products: Product[];
  plans: Plan[];
}) {
  const [templates, setTemplates] = useState(initial);
  const [editing, setEditing] = useState<QuotationTemplate | "new" | null>(null);

  const columns = useMemo<TableColumn<QuotationTemplate>[]>(
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
        accessorFn: (t) => plans.find((p) => p.id === t.planId)?.name ?? "",
        cell: ({ row }) => {
          const p = plans.find((x) => x.id === row.original.planId);
          return p ? (
            <span>
              {p.name}{" "}
              <span className="text-muted tabular-nums">
                · {formatMoney(p.price)} / {intervalUnit(p.interval)}
              </span>
            </span>
          ) : (
            <span className="text-muted">Deleted plan</span>
          );
        },
      },
      {
        id: "lines",
        header: "Lines",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[320px] truncate text-muted">
            {row.original.lines
              .map((l) => `${products.find((p) => p.id === l.productId)?.name ?? "Deleted product"} ×${l.qty}`)
              .join(", ")}
          </span>
        ),
      },
    ],
    [plans, products],
  );

  const save = (t: QuotationTemplate) => {
    const isNew = !templates.some((x) => x.id === t.id);
    setTemplates((ts) => (isNew ? [...ts, t] : ts.map((x) => (x.id === t.id ? t : x))));
    toast(isNew ? `Added ${t.name}` : `Saved ${t.name}`);
  };

  const remove = (t: QuotationTemplate) => {
    setTemplates((ts) => ts.filter((x) => x.id !== t.id));
    toast(`Deleted ${t.name}`);
  };

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<FileText />}
            title="Templates"
            subtitle={`${templates.length} template${templates.length === 1 ? "" : "s"}`}
          />
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
              onSave={save}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
