import { connection } from "next/server";
import { todayIST } from "@/lib/dates";

/**
 * Today's date (IST) for server components. With Cache Components, reading the clock during prerender is an
 * error, so this marks the render as request-time first. Server actions and client code can call `todayIST()`.
 */
export async function requestToday(): Promise<string> {
  await connection();
  return todayIST();
}
