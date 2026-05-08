"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { canSeeSalesTabs } from "@/lib/access";
import { errorMessage } from "@/lib/hooks/use-async";
import { useMyScorecard } from "@/lib/hooks/use-scorecard";

import { ScorecardBoardView } from "./scorecard-board";

/**
 * Sales rep scorecard backed by GET /api/v1/sales/scorecard/me/board.
 *
 * The period defaults to the current month (the API will auto-resolve when
 * no `period` is sent). Reps can switch to quarter / half / year.
 */
export function ScorecardScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<string>(currentMonthKey());

  const board = useMyScorecard({ period });

  if (!auth.isLoaded) return <BoardSkeleton />;

  if (!canSeeSalesTabs(auth) || !auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales scorecard" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view this scorecard.
        </Card>
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
              Sales scorecard
            </h1>
            <p className="text-sm text-zinc-500">
              Per-metric performance for the selected period.
            </p>
          </div>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {board.error ? (
        <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
          Couldn't load your scorecard: {errorMessage(board.error)}
        </Card>
      ) : board.isLoading && !board.data ? (
        <BoardSkeleton />
      ) : board.data ? (
        <ScorecardBoardView board={board.data} />
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
  // Last 6 months
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
  // Quarters for current and previous year
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

function BoardSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="h-16 animate-pulse" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse" />
        ))}
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
