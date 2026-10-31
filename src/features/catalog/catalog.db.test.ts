import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  customers,
  productVariants,
  quotationTemplates,
  subscriptions,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { testDb as db, truncateAll } from "@/test/db";
import { ServiceError } from "./errors";
import {
  getPlan,
  getProduct,
  getTemplate,
  lineUnitPrice,
  listPaymentTerms,
  listPlans,
  listProducts,
  listTaxes,
  listTemplates,
  productOptions,
} from "./queries";
import type { PlanInput, ProductInput } from "./schemas";
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

const admin: Actor = { id: "admin-1", role: "admin" };
const staff: Actor = { id: "staff-1", role: "staff" };

const product = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "CRM",
  type: "service",
  salesPrice: 100000,
  costPrice: 40000,
  taxIds: [],
  variants: [],
  ...over,
});

const plan = (over: Partial<PlanInput> = {}): PlanInput => ({
  name: "Monthly",
  price: 50000,
  interval: "monthly",
  intervalCount: 1,
  minQty: 1,
  availableFrom: "2026-01-01",
  availableTo: null,
  autoClose: false,
  closable: true,
  pausable: true,
  renewable: true,
  ...over,
});

beforeEach(truncateAll);

describe("products and variants", () => {
  it("creates a product with variants and taxes", async () => {
    const gst = await createTax(db, { name: "GST 18%", rateBps: 1800 }, admin);
    const { id } = await createProduct(
      db,
      product({
        taxIds: [gst.id],
        variants: [{ attribute: "Brand", value: "Odoo", extraPrice: 56000 }],
      }),
      admin,
    );
    const p = await getProduct(db, id);
    expect(p?.name).toBe("CRM");
    expect(p?.variants).toHaveLength(1);
    expect(p?.taxes).toEqual([{ id: gst.id, name: "GST 18%", rateBps: 1800 }]);
  });

  it("rejects staff writes and invalid input", async () => {
    await expect(createProduct(db, product(), staff)).rejects.toThrow(ServiceError);
    await expect(createProduct(db, product({ name: "" }), admin)).rejects.toThrow();
    await expect(
      createProduct(db, product({ taxIds: ["00000000-0000-4000-8000-000000000000"] }), admin),
    ).rejects.toThrow(ServiceError);
  });

  it("upserts variants: update, add and remove in one call", async () => {
    const { id } = await createProduct(
      db,
      product({
        variants: [
          { attribute: "Brand", value: "Odoo", extraPrice: 100 },
          { attribute: "Brand", value: "Other", extraPrice: 200 },
        ],
      }),
      admin,
    );
    const before = (await getProduct(db, id))!.variants;
    const odoo = before.find((v) => v.value === "Odoo")!;
    await updateProduct(
      db,
      id,
      product({
        name: "CRM v2",
        variants: [
          { id: odoo.id, attribute: "Brand", value: "Odoo", extraPrice: 999 },
          { attribute: "Tier", value: "Pro", extraPrice: 5 },
        ],
      }),
      admin,
    );
    const after = await getProduct(db, id);
    expect(after?.name).toBe("CRM v2");
    expect(after?.variants.map((v) => v.value).sort()).toEqual(["Odoo", "Pro"]);
    expect(after?.variants.find((v) => v.id === odoo.id)?.extraPrice).toBe(999);
    expect(await db.select().from(productVariants)).toHaveLength(2);
  });

  it("rejects a variant id that belongs to another product", async () => {
    const a = await createProduct(
      db,
      product({ variants: [{ attribute: "A", value: "1", extraPrice: 0 }] }),
      admin,
    );
    const b = await createProduct(db, product({ name: "Other" }), admin);
    const foreign = (await getProduct(db, a.id))!.variants[0];
    await expect(
      updateProduct(
        db,
        b.id,
        product({ variants: [{ id: foreign.id, attribute: "A", value: "1", extraPrice: 0 }] }),
        admin,
      ),
    ).rejects.toThrow("Variant does not belong");
  });

  it("replaces product taxes on update", async () => {
    const t1 = await createTax(db, { name: "A", rateBps: 500 }, admin);
    const t2 = await createTax(db, { name: "B", rateBps: 1200 }, admin);
    const { id } = await createProduct(db, product({ taxIds: [t1.id] }), admin);
    await updateProduct(db, id, product({ taxIds: [t2.id] }), admin);
    expect((await getProduct(db, id))!.taxes.map((t) => t.id)).toEqual([t2.id]);
  });

  it("archives instead of deleting, and errors on unknown id", async () => {
    const { id } = await createProduct(db, product(), admin);
    await archiveProduct(db, id, admin);
    expect((await getProduct(db, id))?.active).toBe(false);
    await expect(
      archiveProduct(db, "00000000-0000-4000-8000-000000000000", admin),
    ).rejects.toThrow("not found");
  });
});

describe("listProducts", () => {
  beforeEach(async () => {
    for (let i = 1; i <= 5; i++) {
      await createProduct(
        db,
        product({
          name: `Item ${i}`,
          salesPrice: i * 100,
          type: i % 2 ? "goods" : "service",
          variants: i === 1 ? [{ attribute: "A", value: "1", extraPrice: 0 }] : [],
        }),
        admin,
      );
    }
  });

  it("paginates with total", async () => {
    const r = await listProducts(db, { page: 2, pageSize: 2 });
    expect(r.total).toBe(5);
    expect(r.rows.map((x) => x.name)).toEqual(["Item 3", "Item 4"]);
  });
  it("sorts by price desc", async () => {
    const r = await listProducts(db, { sort: "salesPrice", dir: "desc", pageSize: 2 });
    expect(r.rows.map((x) => x.salesPrice)).toEqual([500, 400]);
  });
  it("searches by name, filters by type/active, counts variants", async () => {
    expect((await listProducts(db, { q: "item 3" })).rows).toHaveLength(1);
    expect((await listProducts(db, { q: "%" })).total).toBe(0);
    expect((await listProducts(db, { type: "goods" })).total).toBe(3);
    const first = (await listProducts(db, { q: "Item 1" })).rows[0];
    expect(first.variantCount).toBe(1);
    await archiveProduct(db, first.id, admin);
    expect((await listProducts(db, { active: true })).total).toBe(4);
  });
});

describe("plans", () => {
  it("creates, updates, archives and lists", async () => {
    const { id } = await createPlan(db, plan(), admin);
    await updatePlan(db, id, plan({ name: "Yearly", interval: "yearly" }), admin);
    expect((await getPlan(db, id))?.name).toBe("Yearly");
    await archivePlan(db, id, admin);
    expect((await listPlans(db, { active: true })).total).toBe(0);
    expect((await listPlans(db)).total).toBe(1);
  });
  it("rejects availableTo before availableFrom and non-admins", async () => {
    await expect(
      createPlan(db, plan({ availableFrom: "2026-05-01", availableTo: "2026-04-01" }), admin),
    ).rejects.toThrow();
    await expect(createPlan(db, plan(), staff)).rejects.toThrow(ServiceError);
  });
});

describe("taxes and payment terms", () => {
  it("creates, updates and archives taxes", async () => {
    const { id } = await createTax(db, { name: "GST", rateBps: 1800 }, admin);
    await updateTax(db, id, { name: "GST 12", rateBps: 1200 }, admin);
    expect((await listTaxes(db))[0]).toMatchObject({ name: "GST 12", rateBps: 1200, active: true });
    await archiveTax(db, id, admin);
    expect((await listTaxes(db))[0].active).toBe(false);
  });
  it("rejects out-of-range tax rate", async () => {
    await expect(createTax(db, { name: "x", rateBps: 10001 }, admin)).rejects.toThrow();
  });
  it("creates and updates payment terms", async () => {
    const { id } = await createPaymentTerm(db, { name: "Net 30", dueDays: 30 }, admin);
    await updatePaymentTerm(db, id, { name: "Net 15", dueDays: 15 }, admin);
    expect(await listPaymentTerms(db)).toEqual([{ id, name: "Net 15", dueDays: 15 }]);
  });
  it("rejects invalid due days", async () => {
    await expect(createPaymentTerm(db, { name: "x", dueDays: 366 }, admin)).rejects.toThrow();
  });
});

describe("lineUnitPrice and productOptions", () => {
  it("adds the variant extra price (Odoo +56000)", async () => {
    const gst = await createTax(db, { name: "GST", rateBps: 1800 }, admin);
    const { id } = await createProduct(
      db,
      product({
        name: "CRM",
        salesPrice: 100000,
        taxIds: [gst.id],
        variants: [{ attribute: "Brand", value: "Odoo", extraPrice: 56000 }],
      }),
      admin,
    );
    const variantId = (await getProduct(db, id))!.variants[0].id;
    expect(await lineUnitPrice(db, id, variantId)).toEqual({
      unitPrice: 156000,
      taxRatesBps: [1800],
      description: "CRM",
      variantLabel: "Brand: Odoo",
    });
    expect(await lineUnitPrice(db, id, null)).toMatchObject({
      unitPrice: 100000,
      variantLabel: null,
    });
  });
  it("errors on unknown product or mismatched variant", async () => {
    const a = await createProduct(db, product(), admin);
    const b = await createProduct(
      db,
      product({ name: "B", variants: [{ attribute: "X", value: "1", extraPrice: 1 }] }),
      admin,
    );
    const vb = (await getProduct(db, b.id))!.variants[0].id;
    await expect(lineUnitPrice(db, a.id, vb)).rejects.toThrow(ServiceError);
    await expect(
      lineUnitPrice(db, "00000000-0000-4000-8000-000000000000", null),
    ).rejects.toThrow(ServiceError);
  });
  it("productOptions lists active products with labels and tax rates", async () => {
    const gst = await createTax(db, { name: "GST", rateBps: 1800 }, admin);
    const keep = await createProduct(
      db,
      product({
        name: "Keep",
        taxIds: [gst.id],
        variants: [{ attribute: "Brand", value: "Odoo", extraPrice: 56000 }],
      }),
      admin,
    );
    const gone = await createProduct(db, product({ name: "Gone" }), admin);
    await archiveProduct(db, gone.id, admin);
    const opts = await productOptions(db);
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({
      id: keep.id,
      taxRatesBps: [1800],
      variants: [{ label: "Brand: Odoo", extraPrice: 56000 }],
    });
  });
});

describe("templates", () => {
  async function setup() {
    const pl = await createPlan(db, plan(), admin);
    const term = await createPaymentTerm(db, { name: "Net 30", dueDays: 30 }, admin);
    const p = await createProduct(
      db,
      product({ variants: [{ attribute: "Brand", value: "Odoo", extraPrice: 56000 }] }),
      admin,
    );
    const v = (await getProduct(db, p.id))!.variants[0];
    return { pl, term, p, v };
  }

  it("creates, reads, updates (replacing lines) and lists", async () => {
    const { pl, term, p, v } = await setup();
    const { id } = await createTemplate(
      db,
      {
        name: "Starter",
        validityDays: 30,
        planId: pl.id,
        paymentTermId: term.id,
        lines: [{ productId: p.id, variantId: v.id, quantity: 2 }],
      },
      admin,
    );
    const t = await getTemplate(db, id);
    expect(t?.lines).toEqual([
      expect.objectContaining({
        productName: "CRM",
        variantLabel: "Brand: Odoo",
        unitPrice: 156000,
        quantity: 2,
      }),
    ]);
    expect(t?.plan?.name).toBe("Monthly");

    await updateTemplate(
      db,
      id,
      {
        name: "Starter 2",
        validityDays: 15,
        planId: pl.id,
        paymentTermId: term.id,
        lines: [{ productId: p.id, variantId: null, quantity: 1 }],
      },
      admin,
    );
    const t2 = await getTemplate(db, id);
    expect(t2?.name).toBe("Starter 2");
    expect(t2?.lines).toHaveLength(1);
    expect(t2?.lines[0].unitPrice).toBe(100000);
    const list = await listTemplates(db);
    expect(list.rows[0]).toMatchObject({ name: "Starter 2", lineCount: 1, planName: "Monthly" });
  });

  it("rejects empty lines and a variant of another product", async () => {
    const { pl, term, p } = await setup();
    const other = await createProduct(
      db,
      product({ name: "Other", variants: [{ attribute: "A", value: "1", extraPrice: 0 }] }),
      admin,
    );
    const ov = (await getProduct(db, other.id))!.variants[0];
    const base = { name: "T", validityDays: 30, planId: pl.id, paymentTermId: term.id };
    await expect(createTemplate(db, { ...base, lines: [] }, admin)).rejects.toThrow();
    await expect(
      createTemplate(
        db,
        { ...base, lines: [{ productId: p.id, variantId: ov.id, quantity: 1 }] },
        admin,
      ),
    ).rejects.toThrow("Variant does not belong");
  });

  it("deletes unused templates but not ones used by a subscription", async () => {
    const { pl, term, p } = await setup();
    const input = {
      name: "T",
      validityDays: 30,
      planId: pl.id,
      paymentTermId: term.id,
      lines: [{ productId: p.id, variantId: null, quantity: 1 }],
    };
    const free = await createTemplate(db, input, admin);
    await deleteTemplate(db, free.id, admin);
    expect(await getTemplate(db, free.id)).toBeNull();

    const used = await createTemplate(db, input, admin);
    const [c] = await db
      .insert(customers)
      .values({ name: "C", email: "c@example.com" })
      .returning();
    await db.insert(subscriptions).values({
      number: "S-1",
      customerId: c.id,
      planId: pl.id,
      startDate: "2026-01-01",
      templateId: used.id,
    });
    await expect(deleteTemplate(db, used.id, admin)).rejects.toThrow("used by subscriptions");
    expect(await db.select().from(quotationTemplates).where(eq(quotationTemplates.id, used.id))).toHaveLength(1);
  });
});
