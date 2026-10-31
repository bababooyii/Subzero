import path from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;

  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const adminSql = postgres(admin.toString(), { max: 1 });
  const exists = await adminSql`select 1 from pg_database where datname = ${dbName}`;
  if (exists.length === 0) {
    await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
  }
  await adminSql.end();

  const sql = postgres(url, { max: 1 });
  await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await sql.unsafe("DROP SCHEMA public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");
  await migrate(drizzle(sql), {
    migrationsFolder: path.resolve(__dirname, "../../drizzle"),
  });
  await sql.end();
}
