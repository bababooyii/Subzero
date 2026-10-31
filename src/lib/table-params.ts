/** Shared parsing of list-page `searchParams` (server-paged tables, see `DataTable`'s `paging` prop). */
export type SearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_TABLE_SIZE = 12;
export const MIN_TABLE_SIZE = 3;
export const MAX_TABLE_SIZE = 100;

export type TablePaging = {
  /** 1-based. */
  page: number;
  /** Rows per page, clamped 3..100 (default 12). */
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
  q?: string;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parse `?page&size&sort&dir&q` the same way on every list page. Spread the result into a query's params. */
export function readPaging(searchParams: SearchParams | undefined): TablePaging {
  const sp = searchParams ?? {};
  const page = Math.max(1, Math.floor(Number(first(sp.page))) || 1);
  const rawSize = Math.floor(Number(first(sp.size))) || DEFAULT_TABLE_SIZE;
  const pageSize = Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, rawSize));
  const sort = first(sp.sort)?.trim() || undefined;
  const d = first(sp.dir);
  const dir = d === "asc" || d === "desc" ? d : undefined;
  const q = first(sp.q)?.trim() || undefined;
  return { page, pageSize, sort, dir, q };
}
