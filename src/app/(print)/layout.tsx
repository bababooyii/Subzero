import type { ReactNode } from "react";

/**
 * Print routes sit outside the app shell. This is the only light surface in the app (design-adaptation §9):
 * it covers the dark page and drops back to plain white when printing.
 */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{"@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; } }"}</style>
      <div className="fixed inset-0 z-[100] overflow-auto bg-[#e9e8e4] text-[#1c1c1a] print:static print:overflow-visible print:bg-white">
        {children}
      </div>
    </>
  );
}
