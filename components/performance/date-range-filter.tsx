"use client";

import { cn } from "@/lib/utils";

export type DateRangeKey = "7d" | "30d" | "quarter";

const RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "quarter", label: "Quarter" },
];

interface DateRangeFilterProps {
  value: DateRangeKey;
  onChange: (next: DateRangeKey) => void;
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: DateRangeFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Date range"
      className={cn(
        "inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      {RANGES.map((r) => {
        const active = value === r.key;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.key)}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
