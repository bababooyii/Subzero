"use client";

import { ChevronLeft, ChevronRight, Layers, Plus } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { toast } from "@/components/ui/toast";
import { TODAY_ISO } from "@/lib/mock/clock";
import { INTERVALS, PLAN_FLAGS, type PlanFlagKey, type PlanStats } from "@/lib/mock/selectors-catalog";
import type { Interval, Plan } from "@/lib/mock/types";
import { btnPrimary, btnSecondary, btnSquare, surface } from "@/lib/ui";
import { fromPaise, isAmount, isWhole, localId, toPaise } from "./form-utils";
import { PlanCard } from "./PlanCard";

/** Cards sit three across; a row needs at least this much height for the full card. */
const COLS = 3;
const MIN_CARD_H = 400;
const GAP = 16;

/** Rows of full-size cards that fit the grid's height, so the page never scrolls (same idea as DataTable auto-fit). */
function useRowsThatFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(2);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setRows(Math.max(1, Math.floor((el.clientHeight + GAP) / (MIN_CARD_H + GAP))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, rows] as const;
}

function PlanForm({
  initial,
  onSave,
  onOpenChange,
}: {
  initial: Plan | null;
  onSave: (p: Plan) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? fromPaise(initial.price) : "");
  const [every, setEvery] = useState<Interval>(initial?.interval ?? "monthly");
  const [minQty, setMinQty] = useState(String(initial?.minQty ?? 1));
  const [start, setStart] = useState(initial?.startDate ?? TODAY_ISO);
  const [end, setEnd] = useState(initial?.endDate ?? "");
  const [flags, setFlags] = useState<Record<PlanFlagKey, boolean>>({
    autoClose: initial?.autoClose ?? false,
    closable: initial?.closable ?? true,
    pausable: initial?.pausable ?? true,
    renewable: initial?.renewable ?? true,
  });

  const endBeforeStart = end !== "" && start !== "" && end < start;
  const valid =
    name.trim() !== "" && isAmount(price) && Number(price) > 0 && isWhole(minQty, 1) && start !== "" && !endBeforeStart;

  const save = () => {
    onSave({
      id: initial?.id ?? localId("pln"),
      name: name.trim(),
      price: toPaise(price),
      interval: every,
      minQty: Number(minQty),
      startDate: start,
      endDate: end || null,
      ...flags,
    });
    onOpenChange(false);
  };

  return (
    <DialogContent
      width={520}
      title={initial ? "Edit plan" : "New plan"}
      description={initial ? initial.name : "A price, a billing interval and the rules around it."}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={save} disabled={!valid}>
            {initial ? "Save plan" : "Add plan"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="pln-name">
          <Input id="pln-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Growth Monthly" autoFocus />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price (₹)" htmlFor="pln-price">
            <Input
              id="pln-price"
              align="right"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2499"
            />
          </Field>
          <Field label="Interval" htmlFor="pln-interval">
            <Dropdown
              id="pln-interval"
              value={every}
              onChange={(v) => setEvery(v as Interval)}
              options={INTERVALS.map((i) => ({
                value: i.value,
                label: i.label,
              }))}
            />
          </Field>
          <Field label="Min quantity" htmlFor="pln-min">
            <Input id="pln-min" align="right" inputMode="numeric" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Available from" htmlFor="pln-start">
            <Input id="pln-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field
            label="Available until"
            htmlFor="pln-end"
            hint={
              endBeforeStart ? <span className="text-danger">Must be after the start date.</span> : "Leave empty for no end date."
            }
          >
            <Input id="pln-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium text-text">Options</legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {PLAN_FLAGS.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-px"
                  checked={flags[f.key]}
                  onChange={(e) => setFlags((s) => ({ ...s, [f.key]: e.target.checked }))}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] text-text">{f.label}</span>
                  <span className="block text-[12px] text-muted">{f.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </DialogContent>
  );
}

/** Plans as a pricing-card grid that fills the page height, plus the plan dialog. Changes are local state only. */
export function PlansView({ initial, stats }: { initial: Plan[]; stats: Record<string, PlanStats> }) {
  const [plans, setPlans] = useState(initial);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [gridRef, rowsThatFit] = useRowsThatFit();
  const [page, setPage] = useState(0);
  // Never more rows than the plans need, so 4 plans stay two tall rows rather than a sparse grid.
  const rows = Math.min(rowsThatFit, Math.max(1, Math.ceil(plans.length / COLS)));
  const perPage = rows * COLS;
  const pages = Math.max(1, Math.ceil(plans.length / perPage));
  const safePage = Math.min(page, pages - 1);
  const visible = plans.slice(safePage * perPage, (safePage + 1) * perPage);

  const save = (p: Plan) => {
    const isNew = !plans.some((x) => x.id === p.id);
    setPlans((ps) => (isNew ? [...ps, p] : ps.map((x) => (x.id === p.id ? p : x))));
    toast(isNew ? `Added ${p.name}` : `Saved ${p.name}`);
  };

  const remove = (p: Plan) => {
    setPlans((ps) => ps.filter((x) => x.id !== p.id));
    toast(`Deleted ${p.name}`);
  };

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro icon={<Layers />} title="Plans" subtitle={`${plans.length} plan${plans.length === 1 ? "" : "s"}`} />
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            <Plus size={14} strokeWidth={2.5} /> New plan
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {plans.length === 0 ? (
          <div className={`${surface} grid h-full place-items-center p-8`}>
            <Intro centered icon={<Layers />} title="No plans yet" subtitle="Create a plan to price your subscriptions." />
          </div>
        ) : (
          <>
            {/* Rows share the height equally; the row count is whatever fits, the rest pages. */}
            <div ref={gridRef} className="min-h-0 flex-1">
              <ul
                key={page}
                className="grid h-full min-h-0 grid-cols-1 gap-4 sm:grid-cols-3 sm:grid-rows-[repeat(var(--rows),minmax(0,1fr))]"
                style={{ "--rows": rows } as CSSProperties}
              >
                {visible.map((p, i) => (
                  <li key={p.id} className="min-h-0 animate-card-in" style={{ animationDelay: `${i * 25}ms` }}>
                    <PlanCard plan={p} stats={stats[p.id]} onEdit={() => setEditing(p)} onDelete={() => remove(p)} />
                  </li>
                ))}
              </ul>
            </div>
            {pages > 1 ? (
              <div className="flex h-12 shrink-0 items-center justify-between pt-3 text-[12px] text-muted">
                <span className="tabular-nums">
                  {safePage * perPage + 1}–{Math.min(plans.length, (safePage + 1) * perPage)} of {plans.length}
                </span>
                <div className="flex gap-1">
                  <button type="button" className={`${btnSquare} size-7`} aria-label="Previous plans" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" className={`${btnSquare} size-7`} aria-label="Next plans" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          {editing ? (
            <PlanForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              onSave={save}
              onOpenChange={(o) => !o && setEditing(null)}
            />
          ) : null}
        </Dialog>
      </div>
    </PageGrid>
  );
}
