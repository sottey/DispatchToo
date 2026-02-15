"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers to show
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-full px-3.5 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        Previous
      </button>

      {pages.map((p, i) => {
        // Show ellipsis if there's a gap
        const showEllipsis = i > 0 && p - pages[i - 1] > 1;
        return (
          <span key={p} className="flex items-center">
            {showEllipsis && (
              <span className="px-1 text-neutral-400 dark:text-neutral-500 text-sm">&hellip;</span>
            )}
            <button
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-all active:scale-95 ${
                p === page
                  ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-full px-3.5 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        Next
      </button>
    </div>
  );
}
