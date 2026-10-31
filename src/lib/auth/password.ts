export const PASSWORD_RULES = [
  {
    id: "length",
    label: "More than 8 characters",
    test: (pw: string) => pw.length > 8,
  },
  {
    id: "uppercase",
    label: "An uppercase letter",
    test: (pw: string) => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "A lowercase letter",
    test: (pw: string) => /[a-z]/.test(pw),
  },
  {
    id: "special",
    label: "A special character",
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
  },
] as const;

export type RuleId = (typeof PASSWORD_RULES)[number]["id"];

/** Rule ids and labels, safe to import from client components. */
export const passwordRules: ReadonlyArray<{ id: RuleId; label: string }> =
  PASSWORD_RULES.map(({ id, label }) => ({ id, label }));

export function checkPassword(pw: string): { ok: boolean; failed: RuleId[] } {
  const failed = PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.id);
  return { ok: failed.length === 0, failed };
}
