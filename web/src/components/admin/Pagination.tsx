"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Default rows per page — override per-list via the `pageSize` param/prop. */
export const PAGE_SIZE = 10;

export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The slice of `items` belonging to `page` (1-indexed). */
export function pageSlice<T>(items: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Most slots the number row will ever render, ellipses included. */
const MAX_SLOTS = 7;

/**
 * The page numbers to render: first, last, the current page and its
 * neighbours, with gaps collapsed to an ellipsis. Without this the row grew a
 * 32px button per page — twenty pages ran to ~700px and broke out of any
 * phone-width container.
 */
export function pageWindow(page: number, pages: number): (number | "ellipsis")[] {
  if (pages <= MAX_SLOTS) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }

  const slots = new Set<number>([1, pages, page]);
  // Keep the row a fixed width: near an edge the window has nothing to show
  // on one side, so spend those slots on the other.
  if (page <= 3) [2, 3, 4].forEach((candidate) => slots.add(candidate));
  else if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((c) => slots.add(c));
  else [page - 1, page + 1].forEach((candidate) => slots.add(candidate));

  const sorted = [...slots].filter((slot) => slot >= 1 && slot <= pages).sort((a, b) => a - b);

  return sorted.flatMap((slot, index) => {
    const previous = sorted[index - 1];
    return previous !== undefined && slot - previous > 1
      ? (["ellipsis", slot] as (number | "ellipsis")[])
      : [slot];
  });
}

/**
 * Paging is done client-side, on the list the page already fetched — the
 * admin lists are tens of rows, not thousands, so a round-trip per page
 * would buy nothing. Swap for server-side `limit`/`offset` (the shape
 * `common/dto/pagination-query.dto.ts` already defines) if these ever grow.
 */
export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="text-xs text-[#5b7186]">
        {first}–{last} sur {total}
      </p>

      <div className="flex items-center gap-1 self-end">
        <PageButton
          label="Page précédente"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PageButton>

        {pageWindow(page, pages).map((slot, index) =>
          slot === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="grid size-8 place-items-center text-xs text-[#5b7186]"
            >
              …
            </span>
          ) : (
            <button
              key={slot}
              type="button"
              aria-current={slot === page ? "page" : undefined}
              aria-label={`Page ${slot}`}
              onClick={() => onPageChange(slot)}
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg text-xs transition-colors",
                slot === page
                  ? "bg-[#2a93d5] font-medium text-white"
                  : "text-[#93a6bc] hover:bg-white/5 hover:text-white",
              )}
            >
              {slot}
            </button>
          ),
        )}

        <PageButton
          label="Page suivante"
          disabled={page === pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-[#93a6bc] transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
