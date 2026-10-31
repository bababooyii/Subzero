import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { customers, user } from "../schema";

// Stub: seeds only the admin user. The full demo dataset lands in feat/06-seed.
async function main() {
  const { auth } = await import("../../lib/auth");
  const email = "admin@brightloop.test";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  const [existing] = await db.select().from(user).where(eq(user.email, email));
  if (existing) {
    console.log("Admin already exists.");
  } else {
    const res = await auth.api.signUpEmail({
      body: { name: "Brightloop Admin", email, password },
    });
    await db.update(user).set({ role: "admin" }).where(eq(user.id, res.user.id));
    // Sign-up creates a customer profile; staff/admin do not need one.
    await db.delete(customers).where(eq(customers.userId, res.user.id));
    console.log(`Created admin ${email}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
