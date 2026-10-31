"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

export type AppRole = "admin" | "staff";

type Ctx = { role: AppRole; setRole: (r: AppRole) => void };
const RoleContext = createContext<Ctx>({ role: "admin", setRole: () => {} });

/** Demo role switcher state. Staff can't see Catalog or Settings. */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>("admin");
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
