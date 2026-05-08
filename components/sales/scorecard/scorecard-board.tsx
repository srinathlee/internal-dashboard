"use client";

import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { cn } from "@/lib/utils";
import type { ScorecardBoard, ScorecardRow, ScorecardStatus } from "@/lib/api/types";

interface ScorecardBoardViewProps {
  board: ScorecardBoard;
}

/**
 * Renders one user's scorecard board (the response shape from
 * /scorecard/me/board, /scorecard/users/:id/board). Used by the personal
 * scorecard screen and the admin "view rep" screen alike.
 */
export function ScorecardBoardView({ board }: ScorecardBoardViewProps) {
  const { summary, rows, period, user } = board;

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Period
          </div>
          <div className="text-sm font-medium tabular-nums">
            {period.period_key} ·{" "}
            <span className="text-zinc-500">
              {fmtDate(period.period_start)} – {fmtDate(period.period_end)}
            </span>
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          {user.name} · {user.email}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total points" value={formatNumber(summary.total_points)} />
        <Stat
          label="Weighted score"
          value={
            <span
              className={cn(
                "tabular-nums",
                summary.total_weighted_score < 50
                  ? "text-rose-600 dark:text-rose-400"
                  : summary.total_weighted_score < 75
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {summary.total_weighted_score.toFixed(2)}
            </span>
          }
          suffix="/ 100"
        />
        <Stat
          label="On track"
          value={String(summary.on_track_metrics)}
          tone="positive"
        />
        <Stat
          label="At risk"
          value={String(summary.at_risk_metrics)}
          tone={summary.at_risk_metrics > 0 ? "negative" : "neutral"}
        />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-4 py-2 text-right font-medium">Actual</th>
              <th className="px-4 py-2 text-right font-medium">Target</th>
              <th className="px-4 py-2 text-right font-medium">Progress</th>
              <th className="px-4 py-2 text-right font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Points</th>
              <th className="px-4 py-2 text-right font-medium">Weighted</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No metrics configured.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <ScorecardRowRow key={row.metric.id} row={row} />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ScorecardRowRow({ row }: { row: ScorecardRow }) {
  const isCurrency = row.metric.unit === "currency";
  const fmtVal = (n: number | null | undefined) =>
    n === null || n === undefined
      ? "—"
      : isCurrency
        ? formatCurrency(n, "INR")
        : formatNumber(n);

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-2">
        <div className="font-medium">{row.metric.label}</div>
        <div className="text-xs text-zinc-500">
          {row.rule.weight_pct}% weight · {row.rule.points_per_unit} pts/unit
        </div>
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {fmtVal(row.actual_value)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {fmtVal(row.target_value)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {row.progress_percent}%
      </td>
      <td className="px-4 py-2 text-right">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {row.points.total_points}
        {row.points.cap_applied ? (
          <span className="ml-1 text-[10px] text-amber-600">capped</span>
        ) : null}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {row.weighted_score.toFixed(2)}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ScorecardStatus }) {
  const map: Record<ScorecardStatus, { label: string; cls: string }> = {
    ON_TRACK: {
      label: "On track",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    IN_PROGRESS: {
      label: "In progress",
      cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    },
    AT_RISK: {
      label: "At risk",
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    },
    STRETCH: {
      label: "Stretch",
      cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    },
    NO_TARGET: {
      label: "No target",
      cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneCls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "";
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold tabular-nums ${toneCls}`}>
          {value}
        </span>
        {suffix ? (
          <span className="text-xs text-zinc-500">{suffix}</span>
        ) : null}
      </div>
    </Card>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
