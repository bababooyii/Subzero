import type { ReactNode } from "react";
import { surface } from "@/lib/ui";
import { Intro } from "./Intro";
import { PageGrid } from "./PageGrid";

/** Placeholder screen: PageGrid + Intro. Replace per lane with the real screen. */
export function ComingNext({ icon, title, subtitle = "Coming next" }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <PageGrid left={<Intro icon={icon} title={title} subtitle={subtitle} />}>
      <div className={`${surface} grid min-h-64 place-items-center p-8 text-center`}>
        <div>
          <p className="text-[13px] font-medium text-text">Coming next</p>
          <p className="mt-1 text-[12px] text-muted">This screen is being built. The navigation already works.</p>
        </div>
      </div>
    </PageGrid>
  );
}
