import { Children, Fragment, type ReactNode, Suspense, isValidElement } from "react";
import { cn } from "@/helpers/classname-helper";
import { ContentTransition } from "./ContentTransition";

type Props = {
  /**
   * Page header. The first child (normally `<Intro>`) is the title block on the left;
   * every other child sits in a right-aligned toolbar (saved views, filters, at most two buttons).
   */
  left: ReactNode;
  /** Right context column (no card). Switches the content to the "focus" layout: centre deck + context, both filling the height. */
  right?: ReactNode;
  /**
   * default / wide: identical. Every page uses the full width of `main`, so the header never moves.
   * form: only the *content* is capped at 760px.
   */
  width?: "default" | "wide" | "form";
  className?: string;
  children: ReactNode;
};

/** Unwraps a top-level fragment so `left={<>…</>}` splits into title + toolbar. */
function headerParts(left: ReactNode) {
  const top = isValidElement<{ children?: ReactNode }>(left) && left.type === Fragment ? left.props.children : left;
  const [title, ...tools] = Children.toArray(top);
  return { title, tools };
}

/**
 * Fit-to-screen page frame (design-adaptation "Fit to screen"). Fills `main` exactly; the page never scrolls.
 *
 * Layout contract for `children`:
 * - They render in a block with a definite height (`h-full`, `min-h-0`). Return ONE root element and size it
 *   with `h-full` (or `flex h-full min-h-0 flex-col` / `grid h-full min-h-0 …`).
 * - To make a column or card fill the remaining space, give it `min-h-0 flex-1` inside a flex column, or let a
 *   grid track be `minmax(0,1fr)`. Every flex/grid ancestor of a scroller needs `min-h-0`.
 * - Tables: `<DataTable>` as the filling child auto-fits its rows. Other long content goes in `<ScrollPanel>`.
 * - Pin a footer (totals, actions) as a `shrink-0` sibling after the `flex-1` area.
 * - The header is a fixed `h-14` on every page, so the title tile sits at the same x/y everywhere.
 * - The content (not the header) re-animates on pathname or search-string change.
 */
export function PageGrid({ left, right, width = "default", className, children }: Props) {
  const focus = right !== undefined;
  const { title, tools } = headerParts(left);
  return (
    <div className={cn("flex min-h-0 flex-col px-5 pb-6 fit:h-full fit:pb-16 sm:px-8", className)}>
      <header className="mb-5 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 fit:h-14 fit:flex-nowrap">
        <div className="min-w-0">{title}</div>
        {tools.length ? (
          <div className="flex min-w-0 animate-rise items-center gap-2" style={{ animationDelay: "120ms" }}>
            {tools}
          </div>
        ) : null}
      </header>
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<div className="h-full" />}>
          <ContentTransition>
            {focus ? (
              <div className="grid h-full min-h-0 gap-10 lg:grid-cols-[402px_minmax(0,360px)] lg:justify-center lg:gap-14">
                <div className="h-full min-h-0 min-w-0">{children}</div>
                <div className="h-full min-h-0 min-w-0">{right}</div>
              </div>
            ) : (
              <div className={cn("h-full min-h-0 min-w-0", width === "form" && "max-w-[760px]")}>{children}</div>
            )}
          </ContentTransition>
        </Suspense>
      </div>
    </div>
  );
}
