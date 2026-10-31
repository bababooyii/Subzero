export type ListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
};

export type Paged<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function toLimitOffset(params: ListParams = {}) {
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const rawSize = Math.floor(Number(params.pageSize)) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { limit: pageSize, offset: (page - 1) * pageSize, page, pageSize };
}
