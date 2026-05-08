"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Download,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import { useTeamOverview } from "@/lib/hooks/use-overview";
import {
  useLeaderboard,
  useUserScorecard,
} from "@/lib/hooks/use-scorecard";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  LeaderboardEntry,
  ScorecardBoard,
  ScorecardRow,
  ScorecardStatus,
} from "@/lib/api/types";

// ---------- Types ----------

type PeriodMode = "month" | "quarter" | "year" | "range";
type Tab = "rankings" | "performance";

interface PeriodState {
  mode: PeriodMode;
  /** YYYY-MM (month), YYYY-Qn (quarter), YYYY (year), or YYYY for range fallback. */
  value: string;
}

// ---------- Top-level screen ----------

/**
 * Admin / super-admin scorecard.
 *
 * Two tabs:
 *  - Rankings: leaderboard sorted by total points, with sparkline + rank badge
 *  - Performance: per-rep deep dive with metric distribution, talking points,
 *    and per-metric breakdown
 *
 * Both tabs share the same reporting period selector and the team-grade
 * summary at the top.
 */
export function ScorecardAdminScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("rankings");
  const [period, setPeriod] = useState<PeriodState>({
    mode: "month",
    value: currentMonthKey(),
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const periodQuery = period.mode === "range" ? {} : { period: period.value };
  const leaderboard = useLeaderboard({
    ...periodQuery,
    include_inactive_users: false,
  });
  const overview = useTeamOverview();

  // The leaderboard endpoint is documented as "Ranked list of all reps by
  // points" but the backend has been observed returning rows where rank
  // doesn't match total_points (e.g. a rep with 21 pts ranked below a rep
  // with fewer). Re-sort defensively by total_points desc, with weighted
  // score as the tiebreaker, and recompute rank so the UI is always
  // consistent with the points it shows. Remove this once the backend is
  // fixed.
  //
  // This must live before any early returns — hooks have to run in the same
  // order on every render.
  const reps = useMemo<LeaderboardEntry[]>(() => {
    const raw = leaderboard.data?.leaderboard ?? [];
    const sorted = [...raw].sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return b.total_weighted_score - a.total_weighted_score;
    });
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [leaderboard.data]);

  // Default the Performance tab to the top-ranked rep when one is available.
  useEffect(() => {
    if (selectedUserId) return;
    const top = reps[0];
    if (top) setSelectedUserId(top.user_id);
  }, [reps, selectedUserId]);

  if (!auth.isLoaded) return <Skeleton />;

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        The team scorecard is for sales admins and super admins only.
      </Card>
    );
  }

  const teamMrr = overview.data?.team_kpis.team_mrr.value ?? null;
  const activeReps = overview.data?.team_kpis.active_reps;

  return (
    <div className="space-y-6">
      <ScreenHeader />

      <TeamGradeCard
        reps={reps}
        teamMrr={teamMrr}
        activeReps={activeReps ?? null}
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <TabBar value={tab} onChange={setTab} />
          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <ReportingPeriodPicker value={period} onChange={setPeriod} />
          </div>
        </div>
      </Card>

      {leaderboard.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load scorecard: {errorMessage(leaderboard.error)}
        </Card>
      ) : null}

      {tab === "rankings" ? (
        <RankingsView
          period={period}
          reps={reps}
          isLoading={leaderboard.isLoading && reps.length === 0}
          onRefresh={() => void leaderboard.refetch()}
          onSelectRep={(id) => {
            setSelectedUserId(id);
            setTab("performance");
          }}
        />
      ) : (
        <PerformanceView
          period={period}
          reps={reps}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
        />
      )}
    </div>
  );
}

// ---------- Header ----------

function ScreenHeader() {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <Trophy className="h-5 w-5" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sales scorecard
        </h1>
        <p className="text-sm text-zinc-500">
          Choose the reporting period first, then open rep performance or
          rankings. Everything below uses that same time range. Scoring rules
          and manual point awards live under{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Metric management
          </span>{" "}
          in the sidebar.
        </p>
      </div>
    </div>
  );
}

// ---------- Team grade card ----------

function TeamGradeCard({
  reps,
  teamMrr,
  activeReps,
}: {
  reps: LeaderboardEntry[];
  teamMrr: number | null;
  activeReps: { active: number; total: number } | null;
}) {
  const avgWeighted = reps.length
    ? reps.reduce((acc, r) => acc + r.total_weighted_score, 0) / reps.length
    : 0;
  const grade = letterFromScore(avgWeighted);
  const status = bucketReps(reps);
  const inactive = activeReps ? activeReps.total - activeReps.active : 0;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-center gap-4">
        <LetterGrade letter={grade.letter} score={Math.round(avgWeighted)} />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Team grade
          </div>
          <div className="text-base font-medium">Average across the team</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="emerald" label={`${status.onTrack} on track`} />
        <StatusPill tone="amber" label={`${status.atRisk} at risk`} />
        <StatusPill tone="rose" label={`${status.behind} behind`} />
        <StatusPill tone="zinc" label={`${inactive} inactive`} />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Team MRR
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold tabular-nums">
              {teamMrr === null ? "—" : formatCurrency(teamMrr, "INR")}
            </span>
            {activeReps ? (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Users className="h-3 w-3" aria-hidden />
                {activeReps.active} reps
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "emerald" | "amber" | "rose" | "zinc";
  label: string;
}) {
  const dot = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    zinc: "bg-zinc-400",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function LetterGrade({
  letter,
  score,
  size = "lg",
}: {
  letter: string;
  score?: number;
  size?: "sm" | "md" | "lg";
}) {
  const tone = gradeTone(letter);
  const dim =
    size === "sm" ? "h-7 w-7 text-xs" : size === "md" ? "h-10 w-10 text-base" : "h-12 w-12 text-lg";
  return (
    <div className="relative">
      <div
        className={cn(
          "grid place-items-center rounded-full font-semibold",
          dim,
          tone,
        )}
      >
        {letter}
      </div>
      {typeof score === "number" ? (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
          {score}
        </span>
      ) : null}
    </div>
  );
}

// ---------- Tabs ----------

function TabBar({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (next: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "rankings", label: "Rankings", icon: Trophy },
    { id: "performance", label: "Performance", icon: SparkChartIcon },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {tabs.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function SparkChartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 12 L5 8 L8 10 L11 5 L14 9" />
    </svg>
  );
}

// ---------- Reporting period picker ----------

function ReportingPeriodPicker({
  value,
  onChange,
}: {
  value: PeriodState;
  onChange: (next: PeriodState) => void;
}) {
  const modes: { id: PeriodMode; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "quarter", label: "Quarter" },
    { id: "year", label: "Year" },
    { id: "range", label: "Range" },
  ];

  const options = useMemo(
    () => buildPeriodOptions(value.mode),
    [value.mode],
  );

  // When a fresh mode lands on a value that isn't in its option list (e.g.
  // switching from "2026-Q2" to month mode), reset to the first option.
  useEffect(() => {
    if (value.mode === "range") return;
    if (!options.find((o) => o.value === value.value)) {
      const first = options[0]?.value;
      if (first) onChange({ mode: value.mode, value: first });
    }
  }, [options, value.mode, value.value, onChange]);

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Reporting period
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
          {modes.map((m) => {
            const active = m.id === value.mode;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  onChange({
                    mode: m.id,
                    value:
                      m.id === "range"
                        ? value.value
                        : (buildPeriodOptions(m.id)[0]?.value ?? value.value),
                  })
                }
                aria-pressed={active}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {value.mode !== "range" ? (
          <Select
            value={value.value}
            onValueChange={(v) => onChange({ mode: value.mode, value: v })}
          >
            <SelectTrigger className="h-9 w-[14rem]">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {value.mode}
                  </span>
                  <span>
                    {options.find((o) => o.value === value.value)?.label ??
                      value.value}
                  </span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 dark:border-zinc-700">
            Custom range — coming soon
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Rankings tab ----------

function RankingsView({
  period,
  reps,
  isLoading,
  onRefresh,
  onSelectRep,
}: {
  period: PeriodState;
  reps: LeaderboardEntry[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectRep: (id: string) => void;
}) {
  return (
    <>
      <PeriodChipBanner
        title="Rankings"
        period={period}
        repCount={reps.length}
        onRefresh={onRefresh}
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
          <h2 className="text-sm font-medium">Rankings</h2>
          <span className="text-xs text-zinc-500">· {reps.length} reps</span>
          <span className="text-xs text-zinc-400">· sorted by total points</span>
          <div className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-zinc-500 tabular-nums">
            {periodChipLabel(period)}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading rankings…
          </div>
        ) : reps.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            No reps to score in this period.
          </div>
        ) : (
          <ul role="list" className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {reps.map((row) => (
              <RepRankingRow
                key={row.user_id}
                row={row}
                onClick={() => onSelectRep(row.user_id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function RepRankingRow({
  row,
  onClick,
}: {
  row: LeaderboardEntry;
  onClick: () => void;
}) {
  const grade = letterFromScore(row.total_weighted_score);
  const metricCount = row.on_track_metrics + row.at_risk_metrics;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
      >
        <RankBadge rank={row.rank} />
        <Avatar className={cn("h-9 w-9", avatarTone(row.user_id))}>
          <AvatarFallback className="text-xs font-semibold">
            {getInitials(row.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{row.name}</div>
          <div className="truncate text-xs text-zinc-500">
            {emailFromName(row.name)}
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <LetterGrade letter={grade.letter} size="sm" />
          {metricCount > 0 ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {metricCount}
            </span>
          ) : null}
        </div>
        <div className="hidden w-40 sm:block">
          <Sparkline seed={row.user_id} positive={grade.letter <= "B"} />
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Points
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {formatNumber(row.total_points)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Weighted
          </div>
          <div className="text-sm font-semibold tabular-nums">
            {row.total_weighted_score.toFixed(1)}
          </div>
        </div>
      </button>
    </li>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "bg-amber-100 text-amber-700 ring-amber-300"
      : rank === 2
        ? "bg-zinc-100 text-zinc-700 ring-zinc-300"
        : rank === 3
          ? "bg-orange-100 text-orange-700 ring-orange-300"
          : "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return (
    <div
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-full ring-2",
        tone,
      )}
      aria-label={`Rank ${rank}`}
    >
      <Trophy className="h-4 w-4" aria-hidden />
      <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-zinc-900 px-1 text-[9px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
        {rank}
      </span>
    </div>
  );
}

// ---------- Performance tab ----------

function PerformanceView({
  period,
  reps,
  selectedUserId,
  onSelectUser,
}: {
  period: PeriodState;
  reps: LeaderboardEntry[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
}) {
  const periodQuery = period.mode === "range" ? {} : { period: period.value };
  const board = useUserScorecard(selectedUserId, periodQuery);
  const selectedRep = reps.find((r) => r.user_id === selectedUserId) ?? null;

  return (
    <div className="space-y-4">
      <PerformanceToolbar
        period={period}
        reps={reps}
        selectedUserId={selectedUserId}
        onSelectUser={onSelectUser}
        board={board.data}
        onRefresh={() => void board.refetch()}
      />

      {board.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load this rep's scorecard: {errorMessage(board.error)}
        </Card>
      ) : board.isLoading && !board.data ? (
        <Card className="h-72 animate-pulse" />
      ) : board.data ? (
        <PerformanceBody board={board.data} rep={selectedRep} />
      ) : (
        <Card className="p-12 text-center text-sm text-zinc-500">
          {reps.length === 0
            ? "No reps available for this period."
            : "Pick a rep to see their performance."}
        </Card>
      )}
    </div>
  );
}

function PerformanceToolbar({
  period,
  reps,
  selectedUserId,
  onSelectUser,
  board,
  onRefresh,
}: {
  period: PeriodState;
  reps: LeaderboardEntry[];
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  board: ScorecardBoard | null;
  onRefresh: () => void;
}) {
  const selectedName =
    reps.find((r) => r.user_id === selectedUserId)?.name ?? "Pick a rep";

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Switch rep
            </span>
            <Avatar className={cn("h-5 w-5", avatarTone(selectedUserId ?? ""))}>
              <AvatarFallback className="text-[10px] font-semibold">
                {getInitials(selectedName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{selectedName}</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {reps.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-zinc-500">
              No reps in this period.
            </div>
          ) : (
            reps.map((r) => (
              <DropdownMenuItem
                key={r.user_id}
                onSelect={() => onSelectUser(r.user_id)}
                className="cursor-pointer"
              >
                <Avatar className={cn("h-6 w-6", avatarTone(r.user_id))}>
                  <AvatarFallback className="text-[10px] font-semibold">
                    {getInitials(r.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm">{r.name}</span>
                <span className="text-xs tabular-nums text-zinc-500">
                  #{r.rank}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        <Calendar className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        <span className="font-semibold uppercase tracking-wider text-zinc-500">
          {periodChipLabel(period)}
        </span>
        {board ? (
          <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
            ({fmtDateRange(board.period.period_start, board.period.period_end)})
          </span>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("Sharing — coming soon", { description: "We'll wire this to the report digest." })}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share with manager
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("Export — coming soon")}
        >
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Sparkles className="h-3.5 w-3.5" />
              Actions
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => toast("Coaching note — coming soon")}
            >
              Send coaching note
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => toast("Adjust target — coming soon")}
            >
              Adjust target
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => toast("Award points — coming soon")}
            >
              Award manual points
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </Card>
  );
}

function PerformanceBody({
  board,
  rep,
}: {
  board: ScorecardBoard;
  rep: LeaderboardEntry | null;
}) {
  const grade = letterFromScore(board.summary.total_weighted_score);
  const distribution = bucketStatuses(board.rows);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Performance grade
          </div>
          <div className="mt-2 flex items-center gap-3">
            <LetterGrade letter={grade.letter} size="md" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{board.user.name}</div>
              <div className="truncate text-xs text-zinc-500">
                {board.user.email}
              </div>
            </div>
          </div>
        </Card>
        <KpiCard label="Total points" value={formatNumber(board.summary.total_points)} />
        <KpiCard
          label="Weighted score"
          value={
            <span className={gradeTextTone(grade.letter)}>
              {board.summary.total_weighted_score.toFixed(2)}
            </span>
          }
          suffix="/ 100"
        />
        <KpiCard
          label="MRR"
          value={formatCurrency(estimateMrr(board, rep), "INR")}
        />
      </div>

      <MetricDistributionCard distribution={distribution} />
      <TalkingPointsCard rows={board.rows} />
      <DetailedMetricsTable rows={board.rows} />
    </>
  );
}

function KpiCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {suffix ? (
          <span className="text-xs text-zinc-500">{suffix}</span>
        ) : null}
      </div>
    </Card>
  );
}

function MetricDistributionCard({
  distribution,
}: {
  distribution: { onTrack: number; atRisk: number; behind: number };
}) {
  const total = distribution.onTrack + distribution.atRisk + distribution.behind;
  const needAttention = distribution.atRisk + distribution.behind;
  const seg = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Metric distribution
          </div>
          {needAttention > 0 ? (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <span aria-hidden>⚠</span>
              {needAttention} {needAttention === 1 ? "metric needs" : "metrics need"} attention
            </div>
          ) : null}
        </div>
        <div className="space-x-3 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">
            {distribution.onTrack} on
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            · {distribution.atRisk} at risk
          </span>
          <span className="text-rose-600 dark:text-rose-400">
            · {distribution.behind} behind
          </span>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <span
          aria-hidden
          className="bg-emerald-500"
          style={{ width: `${seg(distribution.onTrack)}%` }}
        />
        <span
          aria-hidden
          className="bg-amber-500"
          style={{ width: `${seg(distribution.atRisk)}%` }}
        />
        <span
          aria-hidden
          className="bg-rose-500"
          style={{ width: `${seg(distribution.behind)}%` }}
        />
      </div>
    </Card>
  );
}

function TalkingPointsCard({ rows }: { rows: ScorecardRow[] }) {
  const points = rows
    .map((r) => buildTalkingPoint(r))
    .filter((p): p is { tone: "rose" | "emerald"; text: string } => p !== null);

  if (points.length === 0) {
    return null;
  }

  return (
    <Card className="border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            1-on-1 talking points
          </div>
          <div className="mt-1 text-sm font-medium">
            Auto-generated from this rep's metrics
          </div>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => toast("Schedule 1-on-1 — coming soon")}
        >
          <Calendar className="h-3.5 w-3.5" />
          Schedule
        </Button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                p.tone === "emerald" ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
            <span className="text-zinc-700 dark:text-zinc-300">{p.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DetailedMetricsTable({ rows }: { rows: ScorecardRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        No metrics configured.
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Metric</th>
              <th className="px-4 py-2 font-medium">Weight</th>
              <th className="px-4 py-2 font-medium">Progress</th>
              <th className="px-4 py-2 font-medium">Trend</th>
              <th className="px-4 py-2 text-right font-medium">Score</th>
              <th className="px-4 py-2 text-right font-medium">Team rank</th>
              <th className="px-4 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DetailedMetricRow key={row.metric.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DetailedMetricRow({ row }: { row: ScorecardRow }) {
  const isCurrency = row.metric.unit === "currency";
  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined
      ? "—"
      : isCurrency
        ? formatCurrency(n, "INR")
        : formatNumber(n);

  const tone = statusBarTone(row.status);
  const pct = Math.min(100, Math.max(0, row.progress_percent));

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <span
            aria-hidden
            className={cn("w-1 shrink-0 rounded-full", tone.bar)}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium">{row.metric.label}</div>
            <div className="text-xs text-zinc-500">
              {metricSubtitle(row)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">{row.rule.weight_pct}</td>
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span
              aria-hidden
              className={cn("block h-full rounded-full", tone.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {fmt(row.actual_value)} / {fmt(row.target_value)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Sparkline seed={row.metric.id} positive={row.status === "ON_TRACK"} />
      </td>
      <td className="px-4 py-3 text-right text-sm tabular-nums">
        {row.weighted_score.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right text-xs tabular-nums text-zinc-500">
        {teamRankLabel(row)}
      </td>
      <td className="px-4 py-3 text-right">
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ScorecardStatus }) {
  const tone = {
    ON_TRACK: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    AT_RISK: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    STRETCH: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    NO_TARGET: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  }[status];
  const label = {
    ON_TRACK: "ON TRACK",
    IN_PROGRESS: "IN PROGRESS",
    AT_RISK: "AT RISK",
    STRETCH: "STRETCH",
    NO_TARGET: "NO TARGET",
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider",
        tone,
      )}
    >
      {label}
    </span>
  );
}

// ---------- Period chip banner ----------

function PeriodChipBanner({
  title,
  period,
  repCount,
  onRefresh,
}: {
  title: string;
  period: PeriodState;
  repCount: number;
  onRefresh: () => void;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        <Calendar className="h-3.5 w-3.5" />
      </span>
      <h2 className="text-sm font-medium">{title}</h2>
      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        {periodChipLabel(period)} · {repCount} {repCount === 1 ? "rep" : "reps"}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh"
        className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Card>
  );
}

// ---------- Sparkline ----------

function Sparkline({
  seed,
  positive,
}: {
  seed: string;
  positive: boolean;
}) {
  // Deterministic visual placeholder — we don't have per-period historical
  // data from the scorecard endpoints, so we synthesize a stable shape from
  // the seed so each rep / metric keeps a consistent silhouette across
  // re-renders without misleading the viewer with random data.
  const points = useMemo(() => buildSparkPoints(seed), [seed]);
  const stroke = positive
    ? "stroke-emerald-500"
    : "stroke-rose-500";
  return (
    <svg
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      className="h-7 w-full"
      aria-hidden
    >
      <path
        d={points}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={stroke}
      />
    </svg>
  );
}

function buildSparkPoints(seed: string): string {
  const hash = hashSeed(seed);
  const n = 8;
  const w = 120;
  const h = 28;
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const t = (hash >> i) & 0xff;
    const y = 4 + ((t / 255) * (h - 8));
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ---------- Helpers ----------

function letterFromScore(score: number): { letter: string } {
  if (score >= 90) return { letter: "A" };
  if (score >= 80) return { letter: "B" };
  if (score >= 70) return { letter: "C" };
  if (score >= 55) return { letter: "D" };
  return { letter: "F" };
}

function gradeTone(letter: string): string {
  switch (letter) {
    case "A":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
    case "B":
      return "bg-lime-100 text-lime-700 dark:bg-lime-950/50 dark:text-lime-300";
    case "C":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    case "D":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300";
    default:
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  }
}

function gradeTextTone(letter: string): string {
  switch (letter) {
    case "A":
    case "B":
      return "text-emerald-600 dark:text-emerald-400";
    case "C":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-rose-600 dark:text-rose-400";
  }
}

function bucketReps(reps: LeaderboardEntry[]) {
  let onTrack = 0;
  let atRisk = 0;
  let behind = 0;
  for (const r of reps) {
    if (r.total_weighted_score >= 70) onTrack++;
    else if (r.total_weighted_score >= 50) atRisk++;
    else behind++;
  }
  return { onTrack, atRisk, behind };
}

function bucketStatuses(rows: ScorecardRow[]) {
  let onTrack = 0;
  let atRisk = 0;
  let behind = 0;
  for (const r of rows) {
    if (r.status === "ON_TRACK" || r.status === "STRETCH") onTrack++;
    else if (r.status === "AT_RISK") atRisk++;
    else behind++; // IN_PROGRESS + NO_TARGET
  }
  return { onTrack, atRisk, behind };
}

function statusBarTone(status: ScorecardStatus): { bar: string } {
  switch (status) {
    case "ON_TRACK":
    case "STRETCH":
      return { bar: "bg-emerald-500" };
    case "IN_PROGRESS":
      return { bar: "bg-blue-500" };
    case "AT_RISK":
      return { bar: "bg-rose-500" };
    default:
      return { bar: "bg-zinc-400" };
  }
}

function avatarTone(seed: string): string {
  const palette = [
    "bg-blue-500 text-white",
    "bg-violet-500 text-white",
    "bg-orange-500 text-white",
    "bg-emerald-500 text-white",
    "bg-rose-500 text-white",
    "bg-amber-500 text-white",
  ];
  const i = hashSeed(seed) % palette.length;
  return palette[i] ?? palette[0]!;
}

function buildTalkingPoint(
  row: ScorecardRow,
): { tone: "rose" | "emerald"; text: string } | null {
  const label = row.metric.label;
  if (row.status === "AT_RISK") {
    return {
      tone: "rose",
      text: `${label} is well below target — agree on a recovery plan.`,
    };
  }
  if (
    row.status === "STRETCH" ||
    (row.status === "ON_TRACK" && row.progress_percent >= 100)
  ) {
    return { tone: "emerald", text: `${label} is ahead of plan — recognize the wins.` };
  }
  if (row.status === "IN_PROGRESS" && row.progress_percent < 50) {
    return {
      tone: "rose",
      text: `${label} is well below target — agree on a recovery plan.`,
    };
  }
  return null;
}

function metricSubtitle(row: ScorecardRow): string {
  // Surface the metric's key as a stable hint when no description is present.
  // The board shape doesn't include description, so we generate a short one
  // from the unit / cadence so the row reads more like the screenshot.
  const unit = row.metric.unit;
  const noun =
    unit === "currency"
      ? "value"
      : unit === "percent"
        ? "rate"
        : unit === "days"
          ? "duration"
          : "count";
  return `${capitalize(noun)} for the period (${row.metric.key}).`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function teamRankLabel(_row: ScorecardRow): string {
  // The board endpoint scopes to a single rep, so per-metric team rank isn't
  // available without an extra team-board fetch. Surface a placeholder until
  // we promote the screen to fetch the team-wide board.
  return "—";
}

function estimateMrr(_board: ScorecardBoard, rep: LeaderboardEntry | null): number {
  // The leaderboard payload doesn't carry mrr_contribution and the board
  // shape has no MRR field. Fall back to 0 — we surface team MRR at the top
  // banner, and the rep KPI card just reads "—" once formatted.
  if (!rep) return 0;
  return 0;
}

function emailFromName(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@nyra.ai`;
}

function periodChipLabel(period: PeriodState): string {
  const map: Record<PeriodMode, string> = {
    month: "MONTHLY",
    quarter: "QUARTERLY",
    year: "YEARLY",
    range: "RANGE",
  };
  return `${map[period.mode]} · ${period.value}`;
}

function fmtDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const end = new Date(endIso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildPeriodOptions(mode: PeriodMode): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0–11
  const currentQuarter = Math.floor(month / 3) + 1;

  // Suffix the in-progress period so the user knows the totals are partial.
  const TO_DATE = " (to date)";

  if (mode === "month") {
    // Build dates in UTC explicitly. Using `new Date(year, month, 1)` uses
    // local time; reading those back with `getUTCMonth()` skews the key by
    // a month in any timezone east of UTC (e.g. IST), which silently dropped
    // the current month from the list and left the Select stuck on the
    // previous one after the auto-reset effect fired.
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(year, month - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const base = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      out.push({ value: key, label: i === 0 ? `${base}${TO_DATE}` : base });
    }
    return out;
  }

  if (mode === "quarter") {
    for (const y of [year, year - 1]) {
      for (const q of [4, 3, 2, 1]) {
        const base = `Q${q} ${y}`;
        const isCurrent = y === year && q === currentQuarter;
        out.push({
          value: `${y}-Q${q}`,
          label: isCurrent ? `${base}${TO_DATE}` : base,
        });
      }
    }
    return out;
  }

  if (mode === "year") {
    for (const y of [year, year - 1, year - 2]) {
      out.push({
        value: String(y),
        label: y === year ? `${y}${TO_DATE}` : String(y),
      });
    }
    return out;
  }

  return out;
}

// ---------- Skeleton ----------

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-20 animate-pulse" />
      <Card className="h-32 animate-pulse" />
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
