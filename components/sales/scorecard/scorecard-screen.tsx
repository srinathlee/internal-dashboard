"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Share2, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { formatCurrency } from "@/lib/format-metric";
import { cn } from "@/lib/utils";

import {
  HeroGrade,
  HeroStat,
  PeriodTabs,
  PeriodValueDropdown,
  ScorecardSkeleton,
  ScorecardTable,
  buildOptions,
  buildScorecard,
  defaultSelectionFor,
  letterGrade,
  periodTagLabel,
  resolveWindow,
  type Period,
} from "./scorecard-shared";

/**
 * Sales-member scorecard. Single-rep view that scores the period against six
 * weighted metrics, surfaces a letter grade based on the weighted total, and
 * lists the per-metric breakdown so the rep knows where to push.
 *
 * Strictly scoped to `isSalesMember` — admins and super-admins use the
 * sales-admin scorecard instead.
 */
export function ScorecardScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [selectionKey, setSelectionKey] = useState<string>(() =>
    defaultSelectionFor("month"),
  );

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    setSelectionKey(defaultSelectionFor(next));
  };

  const options = useMemo(() => buildOptions(period), [period]);

  if (!auth.isLoaded) return <ScorecardSkeleton />;

  if (!isSalesMember(auth) || !auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales scorecard" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The scorecard is for individual sales reps. Admins and super-admins
          should use the Sales admin scorecard instead.
        </Card>
      </div>
    );
  }

  const user = auth.user;
  const window = resolveWindow(period, selectionKey);
  const metrics = useMemo(
    () => buildScorecard(user, window),
    [user, window.from, window.to],
  );

  const totalPoints = metrics.reduce((sum, m) => sum + m.rawCount, 0);
  const weightedScore = metrics.reduce((sum, m) => sum + m.score, 0);
  const grade = letterGrade(weightedScore);
  const winValue = metrics.find((m) => m.id === "deals_won")?.achieved ?? 0;

  const onTrack = metrics.filter((m) => m.status === "on-track").length;
  const atRisk = metrics.filter((m) => m.status === "at-risk").length;
  const distribution =
    metrics.length === 0 ? 0 : (onTrack / metrics.length) * 100;

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
              Choose the reporting period. Everything below uses that same time
              range.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Reporting period
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PeriodTabs value={period} onChange={handlePeriodChange} />
          <PeriodValueDropdown
            period={period}
            value={selectionKey}
            options={options}
            label={window.label}
            onChange={setSelectionKey}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 items-center rounded-full bg-zinc-100 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {periodTagLabel(period)}
          </span>
          <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
            {window.tagDate}
          </span>
          <span className="text-sm text-zinc-500">
            ({window.fromHuman} – {window.toHuman})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share with manager
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export PDF
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroGrade
          grade={grade}
          name={user.name.split(" ")[0] ?? user.name}
          email={user.email}
        />
        <HeroStat label="Total points" value={String(totalPoints)} />
        <HeroStat
          label="Weighted score"
          value={
            <span
              className={cn(
                "tabular-nums",
                weightedScore < 50
                  ? "text-rose-600 dark:text-rose-400"
                  : weightedScore < 75
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {weightedScore.toFixed(2)}
            </span>
          }
          suffix="/ 100"
        />
        <HeroStat label="Win" value={formatCurrency(winValue, "INR")} />
      </div>

      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Metric distribution
          </div>
          <div className="text-xs tabular-nums text-zinc-500">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {onTrack} on
            </span>
            <span className="mx-1.5 text-zinc-300">·</span>
            <span className="font-medium text-rose-600 dark:text-rose-400">
              {atRisk} at risk
            </span>
          </div>
        </div>
        {atRisk > 0 ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {atRisk} metric{atRisk === 1 ? "" : "s"} need attention
          </div>
        ) : null}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={cn(
              "h-full transition-[width]",
              distribution >= 50 ? "bg-emerald-500" : "bg-amber-500",
            )}
            style={{ width: `${distribution}%` }}
          />
        </div>
      </Card>

      <ScorecardTable metrics={metrics} />

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p>
          Weighted score is the sum of each metric's progress (capped at 100%)
          times its weight. Grades land at A+ ≥95, A ≥85, B ≥75, C ≥65, D ≥50,
          F &lt;50.
        </p>
        <p className="mt-1">
          Calculated against {user.name.split(" ")[0]}'s targets for{" "}
          {window.tagDate}.
        </p>
      </div>
    </div>
  );
}
