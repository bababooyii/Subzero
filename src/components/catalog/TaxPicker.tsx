"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useMemo, useState, useTransition } from "react";
import { cn } from "@/helpers/classname-helper";
import { Dropdown } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/toast";
import { createTaxAction } from "@/features/catalog/actions";
import { btnPrimary, btnSquare, field } from "@/lib/ui";
import { bpsToPercent, percentToBps } from "./catalog-utils";

export type TaxOption = { id: string; name: string; rateBps: number };

const NEW = "__new-tax__";

type Props = {
  taxes: TaxOption[];
  value: string;
  onChange: (id: string) => void;
  /** Called with the saved tax once the server has created it. The parent appends it to its list. */
  onCreate: (tax: TaxOption) => void;
  id?: string;
  size?: "md" | "sm";
  className?: string;
};

/** Tax select. Its last row swaps the control for an inline name + rate form at the same height. */
export function TaxPicker({ taxes, value, onChange, onCreate, id, size = "md", className }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const sm = size === "sm";

  const options = useMemo(
    () => [
      ...taxes.map((t) => ({ value: t.id, label: t.name, description: `${bpsToPercent(t.rateBps)}%` })),
      { value: NEW, label: "+ New tax rate", textValue: "new tax rate" },
    ],
    [taxes],
  );

  const trimmed = name.trim();
  const rateNum = Number(rate);
  const rateOk = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100;
  const duplicate = trimmed !== "" && taxes.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const rateBad = rate.trim() !== "" && !rateOk;
  const canAdd = trimmed !== "" && rateOk && !duplicate && !pending;
  const problem = duplicate
    ? `A tax named ${trimmed} already exists.`
    : rateBad
      ? "Enter a rate between 0 and 100."
      : serverError;

  const close = () => {
    setCreating(false);
    setName("");
    setRate("");
    setServerError(undefined);
  };

  const add = () => {
    if (!canAdd) return;
    setServerError(undefined);
    startTransition(async () => {
      const rateBps = percentToBps(rate);
      const result = await createTaxAction({ name: trimmed, rateBps });
      if (!result.ok) {
        const message = result.fieldErrors?.name?.[0] ?? result.fieldErrors?.rateBps?.[0] ?? result.error;
        setServerError(message);
        toast(message);
        return;
      }
      onCreate({ id: result.data.id, name: trimmed, rateBps });
      onChange(result.data.id);
      toast(`Added ${trimmed}`);
      close();
    });
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  if (!creating) {
    return (
      <Dropdown
        id={id}
        size={size}
        className={className}
        aria-label="Tax"
        value={value}
        onChange={(v) => (v === NEW ? setCreating(true) : onChange(v))}
        options={options}
        placeholder="Choose a tax…"
      />
    );
  }

  const h = sm ? "h-7" : "h-8";
  return (
    // Same height as the select it replaces. In a narrow column the form grows leftwards over its neighbours.
    <div className={cn("relative", h, className)}>
      <div
        role="group"
        aria-label="New tax rate"
        onKeyDown={onKey}
        className={cn("absolute top-0 right-0 z-10 flex w-[max(100%,264px)] items-center gap-1.5", h, sm && "rounded-md bg-[#171717] shadow-[0_0_0_4px_#171717]")}
      >
        <input
          id={id}
          autoFocus
          aria-label="Tax name"
          aria-invalid={duplicate || !!serverError}
          title={duplicate || serverError ? problem : undefined}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setServerError(undefined);
          }}
          placeholder="GST 28%"
          className={cn(field, "min-w-0 flex-1", h, (duplicate || serverError) && "border-[#f43f5e]/60")}
        />
        <input
          aria-label="Rate (%)"
          aria-invalid={rateBad}
          title={rateBad ? problem : undefined}
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="%"
          className={cn(field, "w-14 shrink-0 px-2 text-right tabular-nums", h, rateBad && "border-[#f43f5e]/60")}
        />
        <button type="button" className={cn(btnPrimary, h)} onClick={add} disabled={!canAdd}>
          Add
        </button>
        <button type="button" className={cn(btnSquare, sm ? "size-7" : "size-8")} aria-label="Cancel new tax" onClick={close}>
          <X size={14} strokeWidth={2.5} />
        </button>
        <span className="sr-only" role="status">
          {problem}
        </span>
      </div>
    </div>
  );
}
