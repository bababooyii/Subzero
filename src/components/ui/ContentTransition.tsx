"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Plays `content-in` whenever the page or its search string changes (page change, saved view, filter).
 * It lives below the page header, so the header never remounts on a view switch.
 * Must sit inside <Suspense> (useSearchParams under cacheComponents); PageGrid does that.
 */
export function ContentTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <div key={`${pathname}?${search}`} className="h-full min-h-0 animate-content-in">
      {children}
    </div>
  );
}
