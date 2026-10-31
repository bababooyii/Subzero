"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { Dropdown } from "@/components/ui/Dropdown";
import { toast } from "@/components/ui/toast";
import type { Tax } from "@/lib/mock/types";
import { btnPrimary, btnSquare, field } from "@/lib/ui";
import { localId } from "./form-utils";

const NEW = "__new-tax__";

type Props = {
  taxes: Tax[];
  value: string;
  onChange: (id: string) => void;
  /** Called with the new tax. The parent appends it to its local list. */
  onCreate: (tax: Tax) => void;
  id?: string;
  size?: "md" | "sm";
  className?: string;
};

/** Tax select. Its last row swaps the control for an inline name + rate form at the same height. */
export function TaxPicker({ taxes, value, onChange, onCreate, id, size = "md", className }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const sm = size === "sm";

  const options = useMemo(
    () => [
      ...taxes.map((t) => ({ value: t.id, label: t.name, description: `${t.rate}%` })),
      { value: NEW, label: "+ New tax rate", textValue: "new tax rate" },
    ],
    [taxes],
  );

  const trimmed = name.trim();
  const rateNum = Number(rate);
  const rateOk = rate.trim() !== "" && Number.isFinite(rateNum) && rateNum >= 0 && rateNum <= 100;
  const duplicate = trimmed !== "" && taxes.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const rateBad = rate.trim() !== "" && !rateOk;
  const canAdd = trimmed !== "" && rateOk && !duplicate;
  const problem = duplicate ? `A tax named ${trimmed} already exists.` : rateBad ? "Enter a rate between 0 and 100." : undefined;

  const close = () => {
    setCreating(false);
    setName("");
    setRate("");
  };

  const add = () => {
    if (!canAdd) return;
    const tax: Tax = { id: localId("tax"), name: trimmed, rate: rateNum };
    onCreate(tax);
    onChange(tax.id);
    toast(`Added ${tax.name}`);
    close();
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
          aria-invalid={duplicate}
          title={duplicate ? problem : undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="GST 28%"
          className={cn(field, "min-w-0 flex-1", h, duplicate && "border-[#f43f5e]/60")}
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
