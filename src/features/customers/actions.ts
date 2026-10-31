"use server";

import { runAction } from "@/features/catalog/action-helpers";
import type { CustomerInput } from "./schemas";
import { createCustomer, updateCustomer } from "./service";

export async function createCustomerAction(input: CustomerInput) {
  return runAction(["admin", "staff"], ["/customers"], (tx, actor) =>
    createCustomer(tx, input, actor),
  );
}

export async function updateCustomerAction(id: string, input: CustomerInput) {
  return runAction(["admin", "staff"], ["/customers", `/customers/${id}`], (tx, actor) =>
    updateCustomer(tx, id, input, actor),
  );
}
