"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getInitials, roleLabel, teamDotClass } from "@/lib/format";
import { formatMetric, progressPct, timeAgo } from "@/lib/format-metric";
import type { MetricDefinition, Team, User } from "@/lib/types";

export interface MemberRow {
  user: User;
  team: Team;
  /** Aggregated values keyed by metric.key for this user over the selected window. */
  values: Record<string, number>;
  /** % of monthly target on the team's primary metric. */
  targetPct: number;
}

interface MembersTableProps {
  rows: MemberRow[];
  /**
   * When narrowed to one team, columns include that team's 4 metrics.
   * When "all", columns are the universal ones (no team-specific metrics).
   */
  scope: "single-team" | "all";
  /** Required when scope === "single-team" — drives which metric columns render. */
  team?: Team;
  /** Used for "Last active" relative timestamps so SSR matches client. */
  nowIso: string;
}

type SortDir = "asc" | "desc";

interface ColumnDef<TKey extends string = string> {
  key: TKey;
  label: string;
  align?: "left" | "right";
  /** Header sort handler skipped if undefined. */
  sortable?: boolean;
}

export function MembersTable({ rows, scope, team, nowIso }: MembersTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const columns: ColumnDef[] = useMemo(() => {
    const base: ColumnDef[] = [{ key: "name", label: "Member", sortable: true }];
    if (scope === "all") {
      base.push(
        { key: "team", label: "Team", sortable: true },
        { key: "role", label: "Role", sortable: false },
        { key: "targetPct", label: "vs Target", align: "right", sortable: true },
        { key: "lastActive", label: "Last active", align: "right", sortable: true },
      );
    } else if (team) {
      for (const m of team.metrics) {
        base.push({
          key: m.key,
          label: m.label,
          align: "right",
          sortable: true,
        });
      }
      base.push({
        key: "targetPct",
        label: "vs Target",
        align: "right",
        sortable: true,
      });
    }
    return base;
  }, [scope, team]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = getCellValue(a, sortKey);
      const vb = getCellValue(b, sortKey);
      const cmp = compare(va, vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          aria-label="Search members"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50",
                        col.align === "right" && "ml-auto",
                      )}
                      aria-label={`Sort by ${col.label}`}
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-zinc-500"
                >
                  {search
                    ? `No members match "${search}".`
                    : "No members in this view yet."}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <RowView
                  key={row.user.id}
                  row={row}
                  scope={scope}
                  team={team}
                  nowIso={nowIso}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowView({
  row,
  scope,
  team,
  nowIso,
}: {
  row: MemberRow;
  scope: "single-team" | "all";
  team?: Team;
  nowIso: string;
}) {
  return (
    <tr className="border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {getInitials(row.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium">{row.user.name}</div>
            <div className="truncate text-xs text-zinc-500">{row.user.email}</div>
          </div>
        </div>
      </td>

      {scope === "all" ? (
        <>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("h-1.5 w-1.5 rounded-full", teamDotClass(row.team.id))}
              />
              <span className="text-zinc-700 dark:text-zinc-300">{row.team.name}</span>
            </div>
          </td>
          <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
            {roleLabel(row.user.role)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums">
            <TargetPctCell pct={row.targetPct} />
          </td>
          <td className="px-4 py-3 text-right text-zinc-500">
            {timeAgo(row.user.lastActiveAt, nowIso)}
          </td>
        </>
      ) : team ? (
        <>
          {team.metrics.map((m: MetricDefinition) => (
            <td key={m.key} className="px-4 py-3 text-right tabular-nums">
              {formatMetric(row.values[m.key] ?? 0, m)}
            </td>
          ))}
          <td className="px-4 py-3 text-right tabular-nums">
            <TargetPctCell pct={row.targetPct} />
          </td>
        </>
      ) : null}
    </tr>
  );
}

function TargetPctCell({ pct }: { pct: number }) {
  const color =
    pct >= 100
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 50
        ? "text-zinc-700 dark:text-zinc-300"
        : "text-amber-600 dark:text-amber-400";
  return (
    <span className={cn("font-medium tabular-nums", color)}>
      {Math.round(pct)}%
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="h-3 w-3" aria-hidden />
  );
}

function getCellValue(row: MemberRow, key: string): string | number {
  if (key === "name") return row.user.name;
  if (key === "team") return row.team.name;
  if (key === "role") return row.user.role;
  if (key === "targetPct") return row.targetPct;
  if (key === "lastActive") return row.user.lastActiveAt;
  return row.values[key] ?? 0;
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b);
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

// Re-export progressPct so callers can compute targetPct without an extra import line.
export { progressPct };
