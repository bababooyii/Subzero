import { and, eq, ne, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { customers } from "@/db/schema";
import { assertRole, ServiceError } from "@/features/catalog/errors";
import type { Actor } from "@/lib/auth/session";
import { customerInput, type CustomerInput } from "./schemas";

type Db = DB | Tx;

async function assertEmailFree(db: Db, email: string, exceptId?: string) {
  const clash = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        sql`lower(${customers.email}) = ${email.toLowerCase()}`,
        exceptId ? ne(customers.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  if (clash.length > 0) {
    throw new ServiceError("A customer with this email already exists", {
      email: ["A customer with this email already exists"],
    });
  }
}

function values(input: CustomerInput) {
  return {
    name: input.name,
    email: input.email,
    company: input.company || null,
    phone: input.phone || null,
    address: input.address || null,
    gstin: input.gstin || null,
  };
}

/** Staff-created customers have `user_id` null; sign-up ones are created by the auth hook. */
export async function createCustomer(
  db: Db,
  rawInput: CustomerInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin", "staff");
  const input = customerInput.parse(rawInput);
  await assertEmailFree(db, input.email);
  const [row] = await db.insert(customers).values(values(input)).returning({ id: customers.id });
  return { id: row.id };
}

export async function updateCustomer(
  db: Db,
  id: string,
  rawInput: CustomerInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin", "staff");
  const input = customerInput.parse(rawInput);
  await assertEmailFree(db, input.email, id);
  const rows = await db
    .update(customers)
    .set(values(input))
    .where(eq(customers.id, id))
    .returning({ id: customers.id });
  if (!rows[0]) throw new ServiceError("Customer not found");
  return { id };
}
