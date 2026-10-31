import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { quotationTemplateLines, quotationTemplates, subscriptionLines, subscriptions } from "@/db/schema";
import {
  makeCustomer,
  makePlan,
  makeProduct,
  makeSubscription,
  makeTerm,
  makeUser,
  makeVariant,
} from "@/server/state-machine/fixtures";
import { InvalidTransitionError } from "@/server/state-machine";
import { listActivity } from "@/server/activity-log";
import { testDb, truncateAll } from "@/test/db";
import {
  applyAction,
  createFromTemplate,
  createSubscription,
  renewSubscription,
  SubscriptionError,
  subscriptionLinePrice,
  updateSubscription,
} from "./service";

beforeEach(truncateAll);

async function base() {
  const actor = await makeUser("staff");
  const customer = await makeCustomer();
  const plan = await makePlan({ minQty: 2 });
  const term = await makeTerm();
  const product = await makeProduct({ salesPrice: 50000, taxRatesBps: [1800] });
  const input = {
    customerId: customer.id,
    planId: plan.id,
    startDate: "2026-02-01",
    expiryDate: "2026-12-31",
    paymentTermId: term.id,
    lines: [{ productId: product.id, variantId: null, quantity: 2 }],
  };
  return { actor, customer, plan, term, product, input };
}

describe("subscriptionLinePrice", () => {
  it("adds variant extra price and returns tax rates", async () => {
    const product = await makeProduct({ salesPrice: 50000, taxRatesBps: [1800] });
    const variant = await makeVariant(product.id, 2500);
    expect(await subscriptionLinePrice(testDb, product.id, variant.id)).toEqual({
      unitPrice: 52500,
      taxRatesBps: [1800],
    });
  });

  it("rejects a variant of another product", async () => {
    const a = await makeProduct();
    const b = await makeProduct();
    const v = await makeVariant(b.id, 100);
    await expect(subscriptionLinePrice(testDb, a.id, v.id)).rejects.toBeInstanceOf(SubscriptionError);
  });
});

describe("createSubscription", () => {
  it("creates a draft with catalog prices, SUB-0001 numbering and activity", async () => {
    const { actor, input, product } = await base();
    const sub = await createSubscription(testDb, input, actor);
    expect(sub.status).toBe("draft");
    expect(sub.number).toBe("SUB-0001");
    const lines = await testDb.select().from(subscriptionLines).where(eq(subscriptionLines.subscriptionId, sub.id));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productId: product.id, quantity: 2, unitPrice: 50000 });
    expect((await listActivity(testDb, "subscription", sub.id))[0].action).toBe("created");
  });

  it("numbers are sequential and unique; explicit unitPrice overrides catalog", async () => {
    const { actor, input } = await base();
    const a = await createSubscription(testDb, input, actor);
    const b = await createSubscription(
      testDb,
      { ...input, lines: [{ ...input.lines[0], unitPrice: 123 }] },
      actor,
    );
    expect(a.number).toMatch(/^SUB-\d{4,}$/);
    expect(Number(b.number.slice(4))).toBe(Number(a.number.slice(4)) + 1);
    const [line] = await testDb.select().from(subscriptionLines).where(eq(subscriptionLines.subscriptionId, b.id));
    expect(line.unitPrice).toBe(123);
  });

  it("rejects quantity below plan minimum", async () => {
    const { actor, input } = await base();
    await expect(
      createSubscription(testDb, { ...input, lines: [{ ...input.lines[0], quantity: 1 }] }, actor),
    ).rejects.toThrow(/Minimum quantity/);
  });

  it("validates input: expiry before start, no lines", async () => {
    const { actor, input } = await base();
    await expect(createSubscription(testDb, { ...input, expiryDate: "2026-01-01" }, actor)).rejects.toThrow();
    await expect(createSubscription(testDb, { ...input, lines: [] }, actor)).rejects.toThrow();
  });
});

describe("createFromTemplate", () => {
  it("copies plan, terms and lines and sets quotation validity", async () => {
    const { actor, customer, plan, term, product } = await base();
    const [tpl] = await testDb
      .insert(quotationTemplates)
      .values({ name: "Starter", validityDays: 14, planId: plan.id, paymentTermId: term.id })
      .returning();
    await testDb.insert(quotationTemplateLines).values({ templateId: tpl.id, productId: product.id, quantity: 3 });

    const sub = await createFromTemplate(
      testDb,
      { templateId: tpl.id, customerId: customer.id, startDate: "2026-05-01" },
      actor,
    );
    expect(sub).toMatchObject({
      status: "draft",
      planId: plan.id,
      paymentTermId: term.id,
      templateId: tpl.id,
      quotationValidUntil: "2026-05-15",
    });
    const lines = await testDb.select().from(subscriptionLines).where(eq(subscriptionLines.subscriptionId, sub.id));
    expect(lines[0]).toMatchObject({ quantity: 3, unitPrice: 50000 });
  });

  it("rejects an incomplete template", async () => {
    const { actor, customer } = await base();
    const [tpl] = await testDb.insert(quotationTemplates).values({ name: "Empty" }).returning();
    await expect(
      createFromTemplate(testDb, { templateId: tpl.id, customerId: customer.id, startDate: "2026-05-01" }, actor),
    ).rejects.toBeInstanceOf(SubscriptionError);
  });
});

describe("updateSubscription", () => {
  it("replaces lines in draft and is locked after confirm", async () => {
    const { actor, input } = await base();
    const sub = await createSubscription(testDb, input, actor);
    const other = await makeProduct({ salesPrice: 700 });
    await updateSubscription(
      testDb,
      sub.id,
      { ...input, lines: [{ productId: other.id, variantId: null, quantity: 5 }] },
      actor,
    );
    const lines = await testDb.select().from(subscriptionLines).where(eq(subscriptionLines.subscriptionId, sub.id));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productId: other.id, quantity: 5, unitPrice: 700 });

    await applyAction(testDb, { id: sub.id, action: "send_quotation" }, actor);
    await updateSubscription(testDb, sub.id, input, actor); // quotation still editable
    await applyAction(testDb, { id: sub.id, action: "confirm" }, actor);
    await expect(updateSubscription(testDb, sub.id, input, actor)).rejects.toThrow(/can be edited/);
  });
});

describe("applyAction", () => {
  it("walks the happy path and the revise/cancel branches", async () => {
    const { actor, input } = await base();
    const sub = await createSubscription(testDb, input, actor);
    const step = async (action: Parameters<typeof applyAction>[1]["action"]) =>
      (await applyAction(testDb, { id: sub.id, action }, actor)).status;

    expect(await step("send_quotation")).toBe("quotation");
    expect(await step("revise")).toBe("draft");
    expect(await step("send_quotation")).toBe("quotation");
    expect(await step("confirm")).toBe("confirmed");
    expect(await step("activate")).toBe("active");
    expect(await step("pause")).toBe("paused");
    expect(await step("resume")).toBe("active");
    expect(await step("close")).toBe("closed");

    const other = await createSubscription(testDb, input, actor);
    expect((await applyAction(testDb, { id: other.id, action: "cancel" }, actor)).status).toBe("closed");
  });

  it("rejects invalid actions and plan-guarded ones", async () => {
    const { actor, input, plan } = await base();
    const sub = await createSubscription(testDb, input, actor);
    await expect(applyAction(testDb, { id: sub.id, action: "activate" }, actor)).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    await testDb.update(subscriptions).set({ planId: (await makePlan({ pausable: false })).id }).where(eq(subscriptions.id, sub.id));
    for (const action of ["send_quotation", "confirm", "activate"] as const) {
      await applyAction(testDb, { id: sub.id, action }, actor);
    }
    await expect(applyAction(testDb, { id: sub.id, action: "pause" }, actor)).rejects.toThrow(/pausing/);
    expect(plan).toBeTruthy();
  });
});

describe("renewSubscription", () => {
  it("extends expiry by one plan period and logs 'renewed'", async () => {
    const actor = await makeUser("staff");
    const plan = await makePlan({ interval: "monthly", intervalCount: 3 });
    const sub = await makeSubscription(plan.id, { status: "active", expiryDate: "2026-06-30" });
    const updated = await renewSubscription(testDb, { id: sub.id }, actor);
    expect(updated.expiryDate).toBe("2026-09-30");
    expect((await listActivity(testDb, "subscription", sub.id))[0].action).toBe("renewed");
  });

  it("rejects non-renewable plans, draft status and missing expiry", async () => {
    const actor = await makeUser("staff");
    const fixed = await makePlan({ renewable: false });
    const a = await makeSubscription(fixed.id, { status: "active", expiryDate: "2026-06-30" });
    await expect(renewSubscription(testDb, { id: a.id }, actor)).rejects.toThrow(/renewal/);

    const plan = await makePlan();
    const b = await makeSubscription(plan.id, { expiryDate: "2026-06-30" });
    await expect(renewSubscription(testDb, { id: b.id }, actor)).rejects.toThrow(/active or paused/);
    const c = await makeSubscription(plan.id, { status: "active" });
    await expect(renewSubscription(testDb, { id: c.id }, actor)).rejects.toThrow(/no expiry/);
  });
});
