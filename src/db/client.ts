import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __subzeroSql?: ReturnType<typeof postgres>;
};

// Reuse the connection across Next dev HMR reloads.
const sql =
  globalForDb.__subzeroSql ??
  postgres(
    process.env.DATABASE_URL ??
      "postgres://subzero:subzero@localhost:5432/subzero",
  );
if (process.env.NODE_ENV !== "production") globalForDb.__subzeroSql = sql;

export const db = drizzle(sql, { schema });

export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
