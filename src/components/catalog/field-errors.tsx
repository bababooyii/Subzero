import type { ReactNode } from "react";

/** `fieldErrors` from a failed `ActionResult`, keyed by dotted field path. */
export type FieldErrors = Record<string, string[]> | undefined;

/** The first message for any of `keys`, as a red hint line for `<Field hint>`. Undefined when there is none. */
export function errorHint(errors: FieldErrors, ...keys: string[]): ReactNode {
  const message = keys.map((k) => errors?.[k]?.[0]).find(Boolean);
  return message ? <span className="text-danger">{message}</span> : undefined;
}
