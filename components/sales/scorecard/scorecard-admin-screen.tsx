"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useLeaderboard,
  useUserScorecard,
} from "@/lib/hooks/use-scorecard";
import { formatNumber } from "@/lib/format-metric";

import { ScorecardBoardView } from "./scorecard-board";

/**
 * Admin / super-admin view of the sales scorecard.
 *
 * Renders the team leaderboard (GET /scorecard/leaderboard). Clicking a row
 * drills into that rep's per-metric board (GET /scorecard/users/:id/board).
 * The two views share the same period selector.
 */
export function ScorecardAdminScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<string>(currentMonthKey());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const leaderboard = useLeaderboard({ period, include_inactive_users: false });
  const userBoard = useUserScorecard(selectedUserId, { period });

  if (!auth.isLoaded) return <Skeleton />;

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales scorecard" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The admin scorecard is for super admins only.
        </Card>
      </div>
    );
  }

  if (selectedUserId) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedUserId(null)}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to leaderboard
        </Button>
        {userBoard.isLoading && !userBoard.data ? (
          <Skeleton />
        ) : userBoard.error ? (
          <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
            Couldn't load this rep's scorecard:{" "}
            {errorMessage(userBoard.error)}
          </Card>
        ) : userBoard.data ? (
          <ScorecardBoardView board={userBoard.data} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sales scorecard — team
            </h1>
            <p className="text-sm text-zinc-500">
              Tap a rep to see their per-metric breakdown.
            </p>
          </div>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {leaderboard.error ? (
        <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
          Couldn't load the leaderboard: {errorMessage(leaderboard.error)}
        </Card>
      ) : leaderboard.isLoading && !leaderboard.data ? (
        <Skeleton />
      ) : leaderboard.data ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-zinc-400" aria-hidden />
              Leaderboard ({leaderboard.data.total_users})
            </h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              {leaderboard.data.period.period_key}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Rep</th>
                <th className="px-4 py-2 text-right font-medium">Total points</th>
                <th className="px-4 py-2 text-right font-medium">Weighted</th>
                <th className="px-4 py-2 text-right font-medium">On track</th>
                <th className="px-4 py-2 text-right font-medium">At risk</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.data.leaderboard.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No reps to score in this period.
                  </td>
                </tr>
              ) : (
                leaderboard.data.leaderboard.map((row) => (
                  <tr
                    key={row.user_id}
                    className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    onClick={() => setSelectedUserId(row.user_id)}
                  >
                    <td className="px-4 py-2 tabular-nums">{row.rank}</td>
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(row.total_points)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.total_weighted_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {row.on_track_metrics}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {row.at_risk_metrics}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

function PeriodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = useMemo(buildPeriodOptions, []);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Period"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildPeriodOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    out.push({ value: key, label });
  }
  const year = now.getUTCFullYear();
  for (const y of [year, year - 1]) {
    for (const q of [4, 3, 2, 1]) {
      out.push({ value: `${y}-Q${q}`, label: `Q${q} ${y}` });
    }
    out.push({ value: `${y}-H1`, label: `H1 ${y}` });
    out.push({ value: `${y}-H2`, label: `H2 ${y}` });
    out.push({ value: `${y}`, label: String(y) });
  }
  return out;
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <Card className="h-16 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
