"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Rows per page across every admin list. */
export const PAGE_SIZE = 10;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** The slice of `items` belonging to `page` (1-indexed). */
export function pageSlice<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
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
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = pageCount(total);
  if (pages <= 1) return null;

  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mt-2 flex items-center justify-between gap-4">
      <p className="text-xs text-[#5b7186]">
        {first}–{last} sur {total}
      </p>

      <div className="flex items-center gap-1">
        <PageButton
          label="Page précédente"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </PageButton>

        {Array.from({ length: pages }, (_, index) => index + 1).map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-current={candidate === page ? "page" : undefined}
            onClick={() => onPageChange(candidate)}
            className={cn(
              "grid size-8 place-items-center rounded-lg text-xs transition-colors",
              candidate === page
                ? "bg-[#2a93d5] font-medium text-white"
                : "text-[#93a6bc] hover:bg-white/5 hover:text-white",
            )}
          >
            {candidate}
          </button>
        ))}

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
      className="grid size-8 place-items-center rounded-lg text-[#93a6bc] transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
