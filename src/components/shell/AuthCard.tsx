import Link from "next/link";
import type { ReactNode } from "react";
import { heroBody, heroFrame } from "@/lib/ui";

/** Centred single column: wordmark above a hero frame holding the form. */
export function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    // h-dvh + `m-auto` on the inner block: centred when it fits, top-aligned and scrollable on very short windows.
    <main className="flex h-dvh flex-col items-center overflow-y-auto px-4 py-6">
      <div className="m-auto flex w-full flex-col items-center gap-6">
        <Link href="/login" className="text-[16px] font-extrabold tracking-[0.025em] text-text uppercase">
          Brightloop
        </Link>
        <div className="w-full max-w-[402px] animate-rise">
          <div className={heroFrame}>
            <div className={`${heroBody} p-6`}>
              <h1 className="text-lg font-medium tracking-tight text-text">{title}</h1>
              <p className="mt-1 mb-6 text-[13px] text-muted">{subtitle}</p>
              {children}
            </div>
            <p className="px-4 py-3 text-center text-[12px] text-muted">{footer}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
