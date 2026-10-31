"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  type CellData,
  type PaginationState,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type TableFeatures,
  flexRender,
} from "@tanstack/react-table";
import {
  type LegacyColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { formatNumber } from "@/lib/format";
import { TABLE_ROW_H, btnSquare, raised, tableWrap, td, th, tr } from "@/lib/ui";
import { Intro } from "./Intro";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<in out TFeatures extends TableFeatures, in out TData extends RowData, TValue extends CellData = CellData> {
    /** Right-align header and cells (money, quantities). */
    align?: "left" | "right";
    /** Extra classes for the header and cells. */
    className?: string;
  }
}

/** Column definition for DataTable (TanStack Table v9, legacy v8-style API). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TableColumn<T extends RowData> = LegacyColumnDef<T, any>;

type Empty = { icon: ReactNode; title: string; subtitle?: string };

/** Server paging: `data` is one server page; page, size and sort live in the URL (`?page&size&sort&dir`). */
export type TablePagingProp = { total: number; page: number; pageSize: number };

type Props<T extends RowData> = {
  data: T[];
  columns: TableColumn<T>[];
  /** Whole row becomes a link. */
  getRowHref?: (row: T) => string;
  getRowId?: (row: T, index: number) => string;
  /** Adds a checkbox column. */
  selectable?: boolean;
  /** Rendered in the bulk bar when rows are selected, e.g. a Confirm button. */
  bulkBar?: (selected: T[], clear: () => void) => ReactNode;
  /** Buttons shown at the right edge on row hover/focus. Use `btnSquare`. */
  rowActions?: (row: T) => ReactNode;
  empty?: Empty;
  /**
   * Rows per page. Ignored while `autoFit` is on, except as the first guess before the table is measured.
   * Default 10 (autoFit) or 50 (autoFit off).
   */
  pageSize?: number;
  /**
   * On by default: the table fills its parent's height and shows exactly as many rows as fit (min 1),
   * paginating the rest. The parent must have a definite height (a `flex-1 min-h-0` slot, `h-full` in PageGrid,
   * a `minmax(0,1fr)` grid track). Pass `false` for a table in auto-height flow, which then uses `pageSize`.
   */
  autoFit?: boolean;
  initialSorting?: SortingState;
  /**
   * Server-paged mode. `data` is rendered as-is (one page); the footer shows "21–40 of 4,812"; prev/next, auto-fit
   * and header sorting write `?page`, `?size`, `?sort` and `?dir` with `router.replace`. Read them with `readPaging()`.
   * Sorting is by column id (`sort=<columnId>`). Without `paging` the table pages and sorts client-side.
   */
  paging?: TablePagingProp;
  className?: string;
  "aria-label"?: string;
};

/** Never fewer than this many rows per page. */
const MIN_ROWS = 1;
/** Row stagger on (re)entry: 15ms per row, first 10 rows only. */
const stagger = (i: number) => `${Math.min(i, 10) * 15}ms`;

/**
 * Generic TanStack table with sorting, client pagination, row-click href, selection and an empty state.
 * Fills the height it is given (`h-full`): header on top, rows in the middle, a pinned footer; rows that
 * do not fit go to the next page (see `autoFit`).
 * Column definitions contain functions, so build the `columns` array in a client component
 * (a file with "use client"), not in a server component.
 */
export function DataTable<T extends RowData>(props: Props<T>) {
  // Only paged tables read the URL, so client-side tables never need a Suspense boundary for `useSearchParams`.
  return props.paging ? <PagedTable {...props} /> : <DataTableInner {...props} url={null} />;
}

type UrlState = { pathname: string; params: URLSearchParams };

function PagedTable<T extends RowData>(props: Props<T>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useMemo<UrlState>(() => ({ pathname, params: new URLSearchParams(searchParams.toString()) }), [pathname, searchParams]);
  return <DataTableInner {...props} url={url} />;
}

function DataTableInner<T extends RowData>({
  url,
  data,
  columns,
  getRowHref,
  getRowId,
  selectable,
  bulkBar,
  rowActions,
  empty,
  pageSize,
  autoFit = true,
  initialSorting = [],
  paging,
  className,
  ...rest
}: Props<T> & { url: UrlState | null }) {
  const router = useRouter();
  const [localSorting, setLocalSorting] = useState<SortingState>(initialSorting);
  const sortParam = url?.params.get("sort") ?? null;
  const dirParam = url?.params.get("dir") ?? null;
  const sorting = useMemo<SortingState>(
    () => (paging ? (sortParam ? [{ id: sortParam, desc: dirParam === "desc" }] : []) : localSorting),
    [paging, sortParam, dirParam, localSorting],
  );

  /** Rewrite the URL, keeping the other params. */
  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      if (!url) return;
      const next = new URLSearchParams(url.params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${url.pathname}?${qs}` : url.pathname, { scroll: false });
    },
    [router, url],
  );
  const replaceRef = useRef(replaceParams);
  useEffect(() => {
    replaceRef.current = replaceParams;
  }, [replaceParams]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: Math.max(MIN_ROWS, pageSize ?? (autoFit ? 10 : 50)) });
  /** Bumped on sort and page changes so the rows fade in again. */
  const [tick, setTick] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const allColumns = useMemo(() => {
    const cols: TableColumn<T>[] = [...columns];
    if (selectable) {
      cols.unshift({
        id: "_select",
        enableSorting: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        meta: { className: "w-14 pr-0" },
      });
    }
    return cols;
  }, [columns, selectable]);

  const table = useLegacyTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, rowSelection, pagination },
    manualSorting: !!paging,
    manualPagination: !!paging,
    onSortingChange: (u) => {
      const next = typeof u === "function" ? u(sorting) : u;
      if (paging) {
        const s = next[0];
        replaceParams({ sort: s ? s.id : null, dir: s ? (s.desc ? "desc" : "asc") : null, page: null });
      } else {
        setLocalSorting(next);
      }
      setTick((t) => t + 1);
    },
    onPaginationChange: (u) => {
      if (paging) return;
      setPagination(u);
      setTick((t) => t + 1);
    },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Auto-fit: rows per page = space the parent slot offers (minus header row and footer) / measured row height.
  // The table itself only grows to its rows, so a short list doesn't leave an empty card.
  const pagingSize = paging?.pageSize;
  const fitTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const slot = root?.parentElement;
    const el = bodyRef.current;
    if (!autoFit || !root || !slot || !el) return;
    const measure = () => {
      const head = el.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const row = el.querySelector("tbody tr")?.getBoundingClientRect().height || TABLE_ROW_H;
      const foot = root.lastElementChild instanceof HTMLElement && root.lastElementChild !== el ? root.lastElementChild.offsetHeight : 0;
      const fit = Math.max(MIN_ROWS, Math.floor((slot.clientHeight - foot - head - 2) / row));
      if (pagingSize !== undefined) {
        // Server-paged: ask the server for as many rows as fit (debounced), back on page 1.
        clearTimeout(fitTimer.current);
        if (fit !== pagingSize) fitTimer.current = setTimeout(() => replaceRef.current({ size: String(fit), page: "1" }), 150);
        return;
      }
      // Keep the first visible row on screen when the page size changes.
      setPagination((p) => (p.pageSize === fit ? p : { pageSize: fit, pageIndex: Math.floor((p.pageIndex * p.pageSize) / fit) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    return () => {
      ro.disconnect();
      clearTimeout(fitTimer.current);
    };
  }, [autoFit, pagingSize]);

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const { pageIndex: localIndex, pageSize: localSize } = table.getState().pagination;
  const size = paging ? paging.pageSize : localSize;
  const pageIndex = paging ? Math.max(0, paging.page - 1) : localIndex;
  const total = paging ? paging.total : data.length;
  const from = total === 0 ? 0 : pageIndex * size + 1;
  const to = paging ? Math.min(total, pageIndex * size + data.length) : Math.min(total, (pageIndex + 1) * size);
  const canPrev = paging ? pageIndex > 0 : table.getCanPreviousPage();
  const canNext = paging ? pageIndex * size + data.length < total : table.getCanNextPage();
  const goPage = (delta: 1 | -1) => {
    if (paging) replaceParams({ page: String(Math.max(1, paging.page + delta)) });
    else if (delta > 0) table.nextPage();
    else table.previousPage();
  };

  const isEmpty = total === 0 && !!empty;

  return (
    <div ref={rootRef} className={cn(tableWrap, "flex max-h-full min-h-0 flex-col", className)}>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        {isEmpty && empty ? (
          <div className="grid h-full min-h-40 place-items-center p-8">
            <Intro centered icon={empty.icon} title={empty.title} subtitle={empty.subtitle} />
          </div>
        ) : (
          <table className="w-full border-collapse" aria-label={rest["aria-label"]}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort();
                    const dir = h.column.getIsSorted();
                    const align = h.column.columnDef.meta?.align;
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                        className={cn(th, align === "right" && "text-right", h.column.columnDef.meta?.className)}
                      >
                        {h.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={h.column.getToggleSortingHandler()}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1 outline-none hover:text-text focus-visible:outline-2 focus-visible:outline-accent",
                              align === "right" && "flex-row-reverse",
                            )}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? (
                              <ChevronUp size={12} strokeWidth={2.5} />
                            ) : dir === "desc" ? (
                              <ChevronDown size={12} strokeWidth={2.5} />
                            ) : (
                              <ChevronsUpDown size={12} className="opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                  {rowActions ? <th className={cn(th, "w-0")} aria-label="Actions" /> : null}
                </tr>
              ))}
            </thead>
            <tbody key={`${tick}-${paging ? `${paging.page}-${sortParam}-${dirParam}` : ""}`}>
              {table.getRowModel().rows.map((row, i) => {
                const href = getRowHref?.(row.original);
                return (
                  <tr
                    key={row.id}
                    className={cn(tr, "animate-content-in", href && "cursor-pointer", row.getIsSelected() && "bg-white/[0.04]")}
                    style={{ animationDelay: stagger(i) }}
                    tabIndex={href ? 0 : undefined}
                    onClick={href ? () => router.push(href) : undefined}
                    onKeyDown={
                      href
                        ? (e) => {
                            if (e.key === "Enter" && e.target === e.currentTarget) router.push(href);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td key={cell.id} className={cn(td, meta?.align === "right" && "text-right tabular-nums", meta?.className)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                    {rowActions ? (
                      <td className={cn(td, "w-0 py-0 pr-4 pl-0")}>
                        <div
                          className="flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rowActions(row.original)}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {isEmpty ? null : (
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-t border-white/[0.05] px-5 text-[12px] text-muted">
          {selectable && selectedRows.length > 0 ? (
            // The bulk bar takes over the footer's left side, so selecting rows never changes the table height.
            <div className={cn("flex animate-fade-in items-center gap-3 rounded-full py-1 pr-1 pl-4 text-[13px]", raised)}>
              <span className="text-text tabular-nums">{selectedRows.length} selected</span>
              {bulkBar ? (
                <>
                  <span aria-hidden="true" className="text-muted">·</span>
                  <div className="flex items-center gap-1.5">{bulkBar(selectedRows, () => table.resetRowSelection())}</div>
                </>
              ) : null}
            </div>
          ) : (
            <span className="tabular-nums">
              {from}–{to} of {formatNumber(total)}
            </span>
          )}
          {total > size ? (
            <div className="flex gap-1">
              <button type="button" className={cn(btnSquare, "size-7")} aria-label="Previous page" disabled={!canPrev} onClick={() => goPage(-1)}>
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
              <button type="button" className={cn(btnSquare, "size-7")} aria-label="Next page" disabled={!canNext} onClick={() => goPage(1)}>
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
