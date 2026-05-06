"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMetric, formatShortDate } from "@/lib/format-metric";
import type { DailyMetric, Team } from "@/lib/types";

interface MemberDailyTableProps {
  rows: DailyMetric[];
  team: Team;
}

type SortDir = "asc" | "desc";

/** Daily-rows table for the Member view of /performance. */
export function MemberDailyTable({ rows, team }: MemberDailyTableProps) {
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const va = sortKey === "date" ? a.date : a.values[sortKey] ?? 0;
      const vb = sortKey === "date" ? b.date : b.values[sortKey] ?? 0;
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb)
          : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
        No daily metrics in this range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
            <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <SortHeader
                label="Date"
                active={sortKey === "date"}
                dir={sortDir}
                onClick={() => toggleSort("date")}
              />
            </th>
            {team.metrics.map((m) => (
              <th
                key={m.key}
                scope="col"
                className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-zinc-500"
              >
                <SortHeader
                  label={m.label}
                  active={sortKey === m.key}
                  dir={sortDir}
                  onClick={() => toggleSort(m.key)}
                  align="right"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.date}
              className="border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
            >
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                {formatShortDate(r.date)}
              </td>
              {team.metrics.map((m) => (
                <td key={m.key} className="px-4 py-3 text-right tabular-nums">
                  {formatMetric(r.values[m.key] ?? 0, m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50",
        align === "right" && "ml-auto",
      )}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {!active ? (
        <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />
      ) : dir === "asc" ? (
        <ArrowUp className="h-3 w-3" aria-hidden />
      ) : (
        <ArrowDown className="h-3 w-3" aria-hidden />
      )}
    </button>
  );
}
