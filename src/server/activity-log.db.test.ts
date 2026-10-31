import { beforeEach, describe, expect, it } from "vitest";
import { payments } from "@/db/schema";
import { listRecentActivity, logActivity } from "@/server/activity-log";
import { makeInvoice, makePlan, makeSubscription, makeUser } from "@/server/state-machine/fixtures";
import { testDb, truncateAll } from "@/test/db";

beforeEach(truncateAll);

async function setup() {
  const asha = await makeUser("staff", "Asha");
  const plan = await makePlan();
  const sub = await makeSubscription(plan.id);
  const inv = await makeInvoice(sub.id, sub.customerId);
  return { asha, sub, inv };
}

describe("listRecentActivity", () => {
  it("returns newest first with labels and sentences", async () => {
    const { asha, sub, inv } = await setup();
    const [pay] = await testDb
      .insert(payments)
      .values({ invoiceId: inv.id, method: "cash", amount: 100, paidOn: "2026-01-02" })
      .returning();
    await logActivity(testDb, {
      entityType: "subscription", entityId: sub.id, action: "status:active",
      fromStatus: "confirmed", toStatus: "active", actorId: asha.id,
    });
    await logActivity(testDb, {
      entityType: "invoice", entityId: inv.id, action: "status:confirmed",
      fromStatus: "draft", toStatus: "confirmed", actorId: asha.id,
    });
    await logActivity(testDb, { entityType: "payment", entityId: pay.id, action: "recorded", actorId: asha.id });
    await logActivity(testDb, { entityType: "invoice", entityId: inv.id, action: "payment_recorded", actorId: asha.id });
    await logActivity(testDb, { entityType: "invoice", entityId: inv.id, action: "sent", actorId: asha.id });
    await logActivity(testDb, {
      entityType: "subscription", entityId: sub.id, action: "status:closed",
      fromStatus: "active", toStatus: "closed", meta: { system: true },
    });

    const feed = await listRecentActivity(testDb);
    expect(feed.map((f) => f.sentence)).toEqual([
      `${sub.number} closed automatically`,
      `${inv.number} sent`,
      `Payment recorded on ${inv.number} by Asha`,
      `${inv.number} confirmed by Asha`,
      `${sub.number} activated by Asha`,
    ]);
    expect(feed[0]).toMatchObject({ entityType: "subscription", entityLabel: sub.number, actorName: null, toStatus: "closed" });
    expect(feed[2]).toMatchObject({ entityType: "payment", entityLabel: inv.number });
  });

  it("respects limit and entityTypes", async () => {
    const { asha, sub, inv } = await setup();
    for (let i = 0; i < 3; i++) {
      await logActivity(testDb, { entityType: "subscription", entityId: sub.id, action: "updated", actorId: asha.id });
    }
    await logActivity(testDb, { entityType: "invoice", entityId: inv.id, action: "sent", actorId: asha.id });

    expect(await listRecentActivity(testDb, { limit: 2 })).toHaveLength(2);
    const subs = await listRecentActivity(testDb, { entityTypes: ["subscription"] });
    expect(subs).toHaveLength(3);
    expect(subs.every((s) => s.entityType === "subscription")).toBe(true);
    expect(subs[0].sentence).toBe(`${sub.number} updated by Asha`);
  });
});
