/**
 * Query timing against the seeded DB: `npx tsx scripts/perf.ts` (pnpm perf).
 * Runs each query 5x, prints p50/max in ms, exits 1 if any max exceeds BUDGET_MS.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  dashboardKpis,
  navCounts,
  overdueAgeing,
  overdueInvoices,
  revenueByMonth,
} from "../src/features/dashboard/queries";
import { toLimitOffset } from "../src/lib/pagination";

const TODAY = process.env.TODAY ?? "2026-10-31";
const RUNS = 5;
const BUDGET_MS = 500;

type Case = { name: string; run: () => Promise<unknown> };

/** Page + search shaped like the real list queries: filtered count and ordered page, all in SQL. */
function list(table: "subscriptions" | "invoices" | "payments" | "customers", page: number, q?: string): Case {
  const { limit, offset } = toLimitOffset({ page, pageSize: 50 });
  const label = `${table} page ${page}${q ? ` q="${q}"` : ""}`;
  const like = q ? `%${q}%` : null;
  return {
    name: `list ${label}`,
    run: async () => {
      switch (table) {
        case "subscriptions": {
          const where = like
            ? sql`s.number ilike ${like} or c.name ilike ${like}`
            : sql`true`;
          await db.execute(sql`select count(*) from subscriptions s join customers c on c.id = s.customer_id where ${where}`);
          return db.execute(sql`
            select s.id, s.number, s.status, c.name as customer, p.name as plan
            from subscriptions s
            join customers c on c.id = s.customer_id
            join plans p on p.id = s.plan_id
            where ${where}
            order by s.start_date desc, s.number desc limit ${limit} offset ${offset}`);
        }
        case "invoices": {
          const where = like
            ? sql`i.number ilike ${like} or c.name ilike ${like}`
            : sql`true`;
          await db.execute(sql`select count(*) from invoices i join customers c on c.id = i.customer_id where ${where}`);
          return db.execute(sql`
            select i.id, i.number, i.status, i.total, i.amount_paid, c.name as customer
            from invoices i join customers c on c.id = i.customer_id
            where ${where}
            order by i.issued_on desc, i.number desc limit ${limit} offset ${offset}`);
        }
        case "payments": {
          const where = like ? sql`i.number ilike ${like} or c.name ilike ${like}` : sql`true`;
          await db.execute(sql`
            select count(*) from payments p join invoices i on i.id = p.invoice_id
            join customers c on c.id = i.customer_id where ${where}`);
          return db.execute(sql`
            select p.id, p.method, p.amount, p.paid_on, i.number, c.name as customer
            from payments p join invoices i on i.id = p.invoice_id
            join customers c on c.id = i.customer_id
            where ${where}
            order by p.paid_on desc, p.id desc limit ${limit} offset ${offset}`);
        }
        case "customers": {
          const where = like ? sql`name ilike ${like} or email ilike ${like}` : sql`true`;
          await db.execute(sql`select count(*) from customers where ${where}`);
          return db.execute(sql`
            select * from customers where ${where}
            order by name asc, id asc limit ${limit} offset ${offset}`);
        }
      }
    },
  };
}

const cases: Case[] = [
  { name: "dashboardKpis", run: () => dashboardKpis(db, { from: "2026-10-01", to: TODAY, today: TODAY }) },
  { name: "revenueByMonth(12)", run: () => revenueByMonth(db, { months: 12, today: TODAY }) },
  { name: "overdueAgeing", run: () => overdueAgeing(db, { today: TODAY }) },
  { name: "overdueInvoices(8)", run: () => overdueInvoices(db, { limit: 8, today: TODAY }) },
  { name: "navCounts", run: () => navCounts(db, TODAY) },
  ...(["subscriptions", "invoices", "payments", "customers"] as const).flatMap((t) => [
    list(t, 1),
    list(t, 50),
    list(t, 1, t === "customers" ? "ar" : "0001"),
  ]),
];

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
}

async function main() {
  // Touch tables so a missing seed fails loudly rather than reporting empty-table timings.
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from invoices`)) as unknown as [{ n: number }];
  if (!n) {
    console.error("No invoices found. Run the seed first (npx tsx src/db/seed/index.ts --reset).");
    process.exit(1);
  }
  console.log(`perf: ${n} invoices, ${RUNS} runs each, budget ${BUDGET_MS} ms\n`);
  console.log("query".padEnd(44), "p50".padStart(8), "max".padStart(8));

  let failed = 0;
  for (const c of cases) {
    await c.run(); // warm-up (plan cache, connection) is not counted
    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const t = performance.now();
      await c.run();
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const p50 = percentile(times, 0.5);
    const max = times[times.length - 1]!;
    const over = max > BUDGET_MS;
    if (over) failed++;
    console.log(c.name.padEnd(44), p50.toFixed(1).padStart(8), max.toFixed(1).padStart(8), over ? "  OVER BUDGET" : "");
  }
  console.log(failed ? `\n${failed} over budget` : "\nall within budget");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
