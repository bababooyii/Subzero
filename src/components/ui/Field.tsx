"use client";

import { Children, type ChangeEvent, Fragment, type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes, isValidElement } from "react";
import { cn } from "@/helpers/classname-helper";
import { field, fieldArea, hint as hintClass } from "@/lib/ui";
import { Dropdown, type DropdownOption } from "./Dropdown";

type FieldProps = {
  label: string;
  /** Must match the control's id. */
  htmlFor?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Label (8px gap) → control → hint (8px gap). */
export function Field({ label, htmlFor, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-text">
        {label}
      </label>
      {children}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { align?: "left" | "right" };

/** 32px input. `align="right"` for money. */
export function Input({ className, align = "left", ...props }: InputProps) {
  return (
    <input
      className={cn(field, "w-full", align === "right" && "text-right tabular-nums", className)}
      {...props}
    />
  );
}

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };

/** Flattens `<option>` elements (also inside fragments and `<optgroup>`) into Dropdown options. */
function optionsFrom(children: ReactNode): DropdownOption[] {
  const out: DropdownOption[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<OptionProps>;
    if (el.type === "option") {
      const label = Children.toArray(el.props.children).join("");
      out.push({ value: String(el.props.value ?? label), label, disabled: el.props.disabled });
    } else if (el.type === Fragment || el.type === "optgroup") {
      out.push(...optionsFrom(el.props.children));
    }
  });
  return out;
}

type SelectProps = {
  id?: string;
  value: string;
  /** Called with a change-like event, so `(e) => set(e.target.value)` keeps working. */
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** `<option>` elements. */
  children: ReactNode;
};

/**
 * Drop-in replacement for a native `<select>`, rendered with the shared Dropdown.
 * Prefer `<Dropdown options=…>` in new code; this keeps `<option>` children and `onChange(e)` working.
 */
export function Select({ onChange, className, children, ...props }: SelectProps) {
  return (
    <Dropdown
      {...props}
      className={className}
      options={optionsFrom(children)}
      onChange={(value) => onChange?.({ target: { value }, currentTarget: { value } } as unknown as ChangeEvent<HTMLSelectElement>)}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldArea, "w-full resize-none", className)} {...props} />;
}
