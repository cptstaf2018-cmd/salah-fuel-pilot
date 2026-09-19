"use client";
import { formatCount } from "@/lib/stock";

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PagerProps = {
  meta: PageMeta;
  label: string;
  onPage: (direction: -1 | 1) => void;
  onPageSize: (size: number) => void;
};

/** Sizes the server accepts; anything outside is clamped into this range. */
const pageSizes = [20, 30, 50];

/**
 * One pager behind every long table. It always renders, even on a single page,
 * because the row count and the page-size control are useful in their own right
 * — and a control that appears only once a list grows is one the operator never
 * learns is there.
 */
export function Pager({ meta, label, onPage, onPageSize }: PagerProps) {
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="pager">
      <span className="pager-count">
        {label} {formatCount(first)}–{formatCount(last)} من {formatCount(meta.total)}
      </span>

      <label className="pager-size">
        <span>لكل صفحة</span>
        <select
          value={meta.pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <span className="pager-nav">
        <button
          type="button"
          className="btn btn-sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(-1)}
        >
          السابق
        </button>
        <span className="pager-page">
          {formatCount(meta.page)} / {formatCount(meta.totalPages)}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(1)}
        >
          التالي
        </button>
      </span>
    </div>
  );
}
