import type { ReactNode } from "react";
import { getPortalData } from "./load";
import { PortalProvider } from "./PortalProvider";

/**
 * Server wrapper for the portal pages: loads the signed-in customer's data and hosts the client provider.
 * Mounted once in `app/(portal)/portal/layout.tsx` (inside <Suspense>), so state like a just-paid invoice survives
 * moving between portal pages. Re-runs on `router.refresh()`.
 */
export async function PortalLoader({ children }: { children: ReactNode }) {
  const data = await getPortalData();
  return <PortalProvider data={data}>{children}</PortalProvider>;
}
