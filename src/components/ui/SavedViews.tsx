import type { ReactNode } from "react";
import { PillSwitch } from "@/components/ui/PillSwitch";

export type SavedView = {
  key: string;
  label: string;
  href: string;
  /** Kept for callers; the pill switcher doesn't show descriptions. */
  description?: string;
  icon?: ReactNode;
  /** Count chip beside the label. Hidden when 0 or undefined. */
  count?: number;
};

type Props = { views: SavedView[]; active: string; className?: string; "aria-label"?: string };

/** Saved views as a horizontal pill switcher of filter links. Also used for the Catalog menu. Pass `active` from the page's search params. */
export function SavedViews({ views, active, className, ...rest }: Props) {
  return (
    <PillSwitch
      options={views.map(({ key, label, href, icon, count }) => ({ key, label, href, icon, count }))}
      value={active}
      className={className}
      aria-label={rest["aria-label"] ?? "Views"}
    />
  );
}
