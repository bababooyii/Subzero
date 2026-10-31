"use server";

import { runAction } from "./action-helpers";
import {
  archivePlan,
  archiveProduct,
  archiveTax,
  createPaymentTerm,
  createPlan,
  createProduct,
  createTax,
  createTemplate,
  deleteTemplate,
  updatePaymentTerm,
  updatePlan,
  updateProduct,
  updateTax,
  updateTemplate,
} from "./service";
import type {
  PaymentTermInput,
  PlanInput,
  ProductInput,
  TaxInput,
  TemplateInput,
} from "./schemas";

export async function createProductAction(input: ProductInput) {
  return runAction(["admin"], ["/products"], (tx, actor) => createProduct(tx, input, actor));
}

export async function updateProductAction(id: string, input: ProductInput) {
  return runAction(["admin"], ["/products"], (tx, actor) => updateProduct(tx, id, input, actor));
}

export async function archiveProductAction(id: string) {
  return runAction(["admin"], ["/products"], (tx, actor) => archiveProduct(tx, id, actor));
}

export async function createPlanAction(input: PlanInput) {
  return runAction(["admin"], ["/plans"], (tx, actor) => createPlan(tx, input, actor));
}

export async function updatePlanAction(id: string, input: PlanInput) {
  return runAction(["admin"], ["/plans"], (tx, actor) => updatePlan(tx, id, input, actor));
}

export async function archivePlanAction(id: string) {
  return runAction(["admin"], ["/plans"], (tx, actor) => archivePlan(tx, id, actor));
}

export async function createTaxAction(input: TaxInput) {
  return runAction(["admin"], ["/taxes"], (tx, actor) => createTax(tx, input, actor));
}

export async function updateTaxAction(id: string, input: TaxInput) {
  return runAction(["admin"], ["/taxes"], (tx, actor) => updateTax(tx, id, input, actor));
}

export async function archiveTaxAction(id: string) {
  return runAction(["admin"], ["/taxes"], (tx, actor) => archiveTax(tx, id, actor));
}

export async function createPaymentTermAction(input: PaymentTermInput) {
  return runAction(["admin"], ["/payment-terms"], (tx, actor) => createPaymentTerm(tx, input, actor));
}

export async function updatePaymentTermAction(id: string, input: PaymentTermInput) {
  return runAction(["admin"], ["/payment-terms"], (tx, actor) => updatePaymentTerm(tx, id, input, actor));
}

export async function createTemplateAction(input: TemplateInput) {
  return runAction(["admin"], ["/templates"], (tx, actor) => createTemplate(tx, input, actor));
}

export async function updateTemplateAction(id: string, input: TemplateInput) {
  return runAction(["admin"], ["/templates"], (tx, actor) => updateTemplate(tx, id, input, actor));
}

export async function deleteTemplateAction(id: string) {
  return runAction(["admin"], ["/templates"], (tx, actor) => deleteTemplate(tx, id, actor));
}
