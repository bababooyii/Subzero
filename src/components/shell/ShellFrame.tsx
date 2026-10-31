import { type ReactNode, Suspense } from "react";

/** The fit-to-screen frame shared by the admin and portal shells: full-height sidebar, slim top bar, fixed-height `main`. */
export function ShellFrame({ sidebar, topBar, children }: { sidebar: ReactNode; topBar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Suspense fallback={<div className="hidden shrink-0 sm:block lg:w-[232px]" />}>{sidebar}</Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        {/* Fit-to-screen: main fills the rest and pages lay out inside it. Below 640×600 it scrolls instead. */}
        <main className="min-h-0 min-w-0 flex-1 overflow-auto fit:overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
