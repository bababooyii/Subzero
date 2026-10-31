import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { sendMail } from "@/server/mail";
import { checkPassword } from "./password";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 9,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your Brightloop password",
        text: `Hi ${user.name},\n\nReset your password: ${url}\n\nIf you did not ask for this, ignore this email.`,
        html: `<p>Hi ${user.name},</p><p><a href="${url}">Reset your password</a></p><p>If you did not ask for this, ignore this email.</p>`,
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (
        ctx.path !== "/sign-up/email" &&
        ctx.path !== "/reset-password" &&
        ctx.path !== "/change-password"
      ) {
        return;
      }
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      const pw = ctx.path === "/sign-up/email" ? body.password : body.newPassword;
      const result = checkPassword(typeof pw === "string" ? pw : "");
      if (!result.ok) {
        throw new APIError("BAD_REQUEST", {
          message: "Password does not meet the requirements",
          code: "WEAK_PASSWORD",
          failed: result.failed,
        });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (created) => {
          const role = (created as { role?: string }).role ?? "customer";
          if (role !== "customer") return;
          await db
            .insert(schema.customers)
            .values({
              userId: created.id,
              name: created.name,
              email: created.email,
            })
            .onConflictDoNothing({ target: schema.customers.userId });
        },
      },
    },
  },
});

