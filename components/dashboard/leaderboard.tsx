import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { formatMetric, progressPct } from "@/lib/format-metric";
import type { MetricDefinition, User } from "@/lib/types";

export interface LeaderboardRow {
  user: User;
  value: number;
  /** Optional individual target — drives the tiny progress bar. */
  target?: number;
}

interface LeaderboardProps {
  rows: LeaderboardRow[];
  metric: MetricDefinition;
  /** Show only this many rows. Defaults to all. */
  limit?: number;
}

export function Leaderboard({ rows, metric, limit }: LeaderboardProps) {
  const visible = limit ? rows.slice(0, limit) : rows;
  if (visible.length === 0) return <LeaderboardEmpty />;

  return (
    <div role="table" aria-label={`Leaderboard by ${metric.label}`}>
      <div
        role="row"
        className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 border-b border-zinc-200 px-1 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 sm:grid-cols-[2rem_1fr_8rem_auto]"
      >
        <span role="columnheader">#</span>
        <span role="columnheader">Member</span>
        <span role="columnheader" className="hidden text-right sm:block">
          Progress
        </span>
        <span role="columnheader" className="text-right">
          {metric.label}
        </span>
      </div>
      <div role="rowgroup">
        {visible.map((row, idx) => (
          <LeaderboardRowView
            key={row.user.id}
            row={row}
            rank={idx + 1}
            metric={metric}
          />
        ))}
      </div>
    </div>
  );
}

function LeaderboardRowView({
  row,
  rank,
  metric,
}: {
  row: LeaderboardRow;
  rank: number;
  metric: MetricDefinition;
}) {
  const pct =
    row.target !== undefined ? progressPct(row.value, row.target) : null;

  return (
    <div
      role="row"
      className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 border-b border-zinc-100 px-1 py-3 text-sm transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:grid-cols-[2rem_1fr_8rem_auto]"
    >
      <span
        role="cell"
        className={cn(
          "tabular-nums font-medium",
          rank === 1 ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500",
        )}
      >
        {rank}
      </span>
      <div role="cell" className="flex min-w-0 items-center gap-3">
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
      <div role="cell" className="hidden sm:block">
        {pct !== null ? <ProgressBar pct={pct} /> : <span className="text-zinc-400">—</span>}
      </div>
      <span role="cell" className="text-right font-medium tabular-nums">
        {formatMetric(row.value, metric)}
      </span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, pct);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-zinc-500">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function LeaderboardEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
      No team members to rank yet.
    </div>
  );
}
