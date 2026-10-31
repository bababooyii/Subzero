import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set");

const client = postgres(url, { max: 4 });
export const testDb = drizzle(client, { schema });

/** Empty every table in the public schema (sequences reset too). */
export async function truncateAll() {
  const rows = await testDb.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const names = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await testDb.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

export async function closeTestDb() {
  await client.end();
}
