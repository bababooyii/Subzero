import { beforeEach, describe, expect, it } from "vitest";
import { user } from "@/db/schema";
import { testDb, truncateAll } from "@/test/db";
import { listUsers } from "./queries";

beforeEach(truncateAll);

async function addUser(id: string, name: string, role: "admin" | "staff" | "customer", createdAt?: Date) {
  await testDb.insert(user).values({ id, name, email: `${id}@x.test`, role, ...(createdAt ? { createdAt } : {}) });
}

describe("listUsers", () => {
  it("pages, filters by role and searches", async () => {
    await addUser("u1", "Alice Admin", "admin", new Date("2026-01-01"));
    await addUser("u2", "Bob Staff", "staff", new Date("2026-02-01"));
    await addUser("u3", "Carol Cust", "customer", new Date("2026-03-01"));

    const all = await listUsers(testDb, {});
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => r.id)).toEqual(["u3", "u2", "u1"]);
    expect(all.rows[0]!.createdAt).toBe("2026-03-01");

    const staff = await listUsers(testDb, { role: "staff" });
    expect(staff.rows.map((r) => r.id)).toEqual(["u2"]);

    const q = await listUsers(testDb, { q: "carol" });
    expect(q.rows.map((r) => r.id)).toEqual(["u3"]);

    const paged = await listUsers(testDb, { pageSize: 2, page: 2, sort: "name", dir: "asc" });
    expect(paged.total).toBe(3);
    expect(paged.rows.map((r) => r.id)).toEqual(["u3"]);
  });

  it("treats wildcards literally", async () => {
    await addUser("u1", "Alice", "admin");
    expect((await listUsers(testDb, { q: "%" })).total).toBe(0);
  });
});
