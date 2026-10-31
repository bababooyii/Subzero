"use client";

import { type ReactNode, createContext, useContext } from "react";

export type AppRole = "admin" | "staff";

type Ctx = { role: AppRole };
const RoleContext = createContext<Ctx>({ role: "staff" });

/** The signed-in staff member's role, fed from the server session by the (app) layout. Staff can't see Catalog or Settings. */
export function RoleProvider({ role, children }: { role: AppRole; children: ReactNode }) {
  return <RoleContext.Provider value={{ role }}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
