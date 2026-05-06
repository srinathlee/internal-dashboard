"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Coins,
  Download,
  HelpCircle,
  History as HistoryIcon,
  LineChart,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  TestTube2,
  Trash2,
  Trophy,
  Users,
  Wand2,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/format-metric";
import { getInitials } from "@/lib/format";
import { getTeamMembers } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

import {
  GRADE_BG,
  GRADE_FG,
  HeroGrade,
  HeroStat,
  PeriodTabs,
  PeriodValueDropdown,
  ScorecardSkeleton,
  ScorecardTable,
  buildOptions,
  buildScorecard,
  computeMrrForUser,
  defaultSelectionFor,
  letterGrade,
  periodTagLabel,
  resolveWindow,
  type GradeTone,
  type Period,
  type ScoreRow,
  type ScorecardWindow,
} from "./scorecard-shared";

type AdminTab = "rep" | "rankings";

/**
 * Sales-admin scorecard. Wraps the per-rep scorecard inside admin-level
 * navigation (rep performance / rankings / setup / manual points), a team
 * grade hero, and a rep switcher so the admin can drill into any rep without
 * leaving the page. Period selection drives every section.
 */
export function ScorecardAdminScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<AdminTab>("rankings");
  const [period, setPeriod] = useState<Period>("month");
  const [selectionKey, setSelectionKey] = useState<string>(() =>
    defaultSelectionFor("month"),
  );

  const reps = useMemo(
    () =>
      getTeamMembers("sales").filter(
        (u) => u.role === "member" && u.status === "active",
      ),
    [],
  );

  const [selectedRepId, setSelectedRepId] = useState<string>(
    () => reps[0]?.id ?? "",
  );

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    setSelectionKey(defaultSelectionFor(next));
  };

  const options = useMemo(() => buildOptions(period), [period]);
  const window = resolveWindow(period, selectionKey);

  // Compute scorecards for every rep in one pass — the team hero, rep switcher
  // (with grade chips), team-rank column, and rankings tab all need them.
  const teamScorecards = useMemo(
    () =>
      reps.map((r) => ({
        user: r,
        metrics: buildScorecard(r, window),
        mrr: computeMrrForUser(r, window),
      })),
    [reps, window.from, window.to],
  );

  if (!auth.isLoaded) return <ScorecardSkeleton />;

  if (!isSalesAdminOrSuperAdmin(auth) || !auth.user) {
    return (
      <div className="space-y-6">
        <ScreenTitle />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The admin scorecard is for sales admins and super-admins.
        </Card>
      </div>
    );
  }

  const teamSummary = summarizeTeam(teamScorecards);
  const selectedRep =
    teamScorecards.find((s) => s.user.id === selectedRepId) ??
    teamScorecards[0];

  return (
    <div className="space-y-6">
      <ScreenTitle />

      <TeamGradeCard summary={teamSummary} />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as AdminTab)}
        className="space-y-4"
      >
        <Card className="p-3">
          <TabsList className="bg-zinc-50 dark:bg-zinc-900">
            <TabsTrigger
              value="rankings"
              className="gap-1.5 data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900"
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden />
              Rankings
            </TabsTrigger>
            <TabsTrigger
              value="rep"
              className="gap-1.5 data-[state=active]:bg-zinc-900 data-[state=active]:text-white dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900"
            >
              <LineChart className="h-3.5 w-3.5" aria-hidden />
              Performance
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
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
          </div>
        </Card>

        <TabsContent value="rep" className="mt-0 space-y-6">
          {selectedRep ? (
            <RepPerformanceTab
              reps={teamScorecards}
              selectedRepId={selectedRep.user.id}
              onSelectRep={setSelectedRepId}
              period={period}
              window={window}
              data={selectedRep}
            />
          ) : (
            <Card className="p-12 text-center text-sm text-zinc-500">
              No active sales reps yet. Invite a rep from the Team page to start
              tracking scorecards.
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rankings" className="mt-0">
          <RankingsTab reps={teamScorecards} window={window} period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Title -----------------------------------------------------------

function ScreenTitle() {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
      >
        <Trophy className="h-5 w-5" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales scorecard</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Choose the reporting period first, then open rep performance or
          rankings. Everything below uses that same time range. Scoring
          rules and manual point awards live under{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Metric management
          </span>{" "}
          in the sidebar.
        </p>
      </div>
    </div>
  );
}

// ---------- Team grade ------------------------------------------------------

interface TeamSummary {
  reps: number;
  averageScore: number;
  grade: { letter: string; tone: GradeTone };
  onTrack: number;
  atRisk: number;
  behind: number;
  inactive: number;
  mrr: number;
}

function summarizeTeam(
  scorecards: { user: User; metrics: ScoreRow[]; mrr: number }[],
): TeamSummary {
  const reps = scorecards.length;
  if (reps === 0) {
    return {
      reps: 0,
      averageScore: 0,
      grade: letterGrade(0),
      onTrack: 0,
      atRisk: 0,
      behind: 0,
      inactive: 0,
      mrr: 0,
    };
  }

  let onTrack = 0;
  let atRisk = 0;
  let behind = 0;
  let inactive = 0;
  let totalScore = 0;
  let totalMrr = 0;

  for (const s of scorecards) {
    const repScore = s.metrics.reduce((sum, m) => sum + m.score, 0);
    totalScore += repScore;
    totalMrr += s.mrr;

    const noActivity = s.metrics.every((m) => m.rawCount === 0);
    if (noActivity) {
      inactive += 1;
      continue;
    }
    if (repScore >= 75) onTrack += 1;
    else if (repScore >= 50) atRisk += 1;
    else behind += 1;
  }

  const averageScore = totalScore / reps;
  return {
    reps,
    averageScore,
    grade: letterGrade(averageScore),
    onTrack,
    atRisk,
    behind,
    inactive,
    mrr: totalMrr,
  };
}

function TeamGradeCard({ summary }: { summary: TeamSummary }) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-semibold",
            GRADE_BG[summary.grade.tone],
            GRADE_FG[summary.grade.tone],
          )}
        >
          {summary.grade.letter}
          <span className="absolute -bottom-0.5 right-0 grid h-4 min-w-[1rem] place-items-center rounded-full bg-white px-1 text-[9px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
            {Math.round(summary.averageScore)}
          </span>
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Team grade
          </div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Average across the team
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPip tone="emerald" count={summary.onTrack} label="on track" />
        <StatusPip tone="amber" count={summary.atRisk} label="at risk" />
        <StatusPip tone="rose" count={summary.behind} label="behind" />
        <StatusPip tone="zinc" count={summary.inactive} label="inactive" />
      </div>

      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-500 dark:bg-violet-950/40 dark:text-violet-400"
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Team MRR
          </div>
          <div className="flex items-baseline justify-end gap-2">
            <span className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatCurrency(summary.mrr, "INR")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <Users className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">{summary.reps}</span> rep
              {summary.reps === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatusPip({
  tone,
  count,
  label,
}: {
  tone: "emerald" | "amber" | "rose" | "zinc";
  count: number;
  label: string;
}) {
  const dotClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
      ? "bg-amber-500"
      : tone === "rose"
      ? "bg-rose-500"
      : "bg-zinc-400";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden />
      <span className="font-medium tabular-nums">{count}</span>
      <span className="text-zinc-500">{label}</span>
    </span>
  );
}

// ---------- Rep performance tab --------------------------------------------

function RepPerformanceTab({
  reps,
  selectedRepId,
  onSelectRep,
  period,
  window,
  data,
}: {
  reps: { user: User; metrics: ScoreRow[]; mrr: number }[];
  selectedRepId: string;
  onSelectRep: (id: string) => void;
  period: Period;
  window: ScorecardWindow;
  data: { user: User; metrics: ScoreRow[]; mrr: number };
}) {
  const { user, metrics, mrr } = data;

  const totalPoints = metrics.reduce((sum, m) => sum + m.rawCount, 0);
  const weightedScore = metrics.reduce((sum, m) => sum + m.score, 0);
  const grade = letterGrade(weightedScore);
  const onTrack = metrics.filter((m) => m.status === "on-track").length;
  const atRisk = metrics.filter((m) => m.status === "at-risk").length;
  const behind = metrics.filter(
    (m) => m.status === "at-risk" && m.progress < 0.25,
  ).length;
  const distribution =
    metrics.length === 0 ? 0 : (onTrack / metrics.length) * 100;

  const rankByMetricId = useMemo(
    () => computeRanks(reps, user.id),
    [reps, user.id],
  );

  const talkingPoints = useMemo(
    () => buildTalkingPoints(metrics),
    [metrics],
  );

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <RepSwitcher
            reps={reps}
            selectedRepId={selectedRepId}
            onSelectRep={onSelectRep}
          />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {periodTagLabel(period)}
            </span>
            <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
              {window.tagDate}
            </span>
            <span className="hidden text-sm text-zinc-500 sm:inline">
              ({window.fromHuman} – {window.toHuman})
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share with manager
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export PDF
          </Button>
          <ActionsMenu rep={user} />
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => toast.success("Scorecard refreshed.")}
            className="grid h-8 w-8 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroGrade
          grade={grade}
          name={user.name}
          email={user.email}
          label="Performance grade"
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
        <HeroStat label="MRR" value={formatCurrency(mrr, "INR")} />
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
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {atRisk} at risk
            </span>
            <span className="mx-1.5 text-zinc-300">·</span>
            <span className="font-medium text-rose-600 dark:text-rose-400">
              {behind} behind
            </span>
          </div>
        </div>
        {atRisk > 0 ? (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" aria-hidden />
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

      <TalkingPointsCard repName={user.name} points={talkingPoints} />

      <ScorecardTable
        metrics={metrics}
        rankByMetricId={rankByMetricId}
        showTeamRank
      />
    </div>
  );
}

function ActionsMenu({ rep }: { rep: User }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Actions
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onSelect={() => toast.success(`Coaching note logged for ${rep.name}.`)}
        >
          Log coaching note
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            toast.success(`1-on-1 scheduled with ${rep.name}.`)
          }
        >
          Schedule 1-on-1
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => toast.success(`Manual points awarded to ${rep.name}.`)}
        >
          Award manual points
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RepSwitcher({
  reps,
  selectedRepId,
  onSelectRep,
}: {
  reps: { user: User; metrics: ScoreRow[] }[];
  selectedRepId: string;
  onSelectRep: (id: string) => void;
}) {
  const selected = reps.find((r) => r.user.id === selectedRepId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch rep"
          className="inline-flex h-9 min-w-[14rem] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 text-sm shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Switch rep
          </span>
          {selected ? (
            <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[9px]">
                  {getInitials(selected.user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {selected.user.name}
              </span>
            </span>
          ) : (
            <span className="flex-1 text-left text-zinc-500">Select rep…</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-1">
        {reps.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">
            No active sales reps yet.
          </div>
        ) : (
          reps.map(({ user, metrics }) => {
            const score = metrics.reduce((sum, m) => sum + m.score, 0);
            const grade = letterGrade(score);
            const isSelected = user.id === selectedRepId;
            return (
              <DropdownMenuItem
                key={user.id}
                onSelect={() => onSelectRep(user.id)}
                className={cn(
                  "gap-2.5 px-2 py-1.5",
                  isSelected && "bg-zinc-100 dark:bg-zinc-800",
                )}
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {user.name}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {user.email}
                  </div>
                </div>
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold",
                    GRADE_BG[grade.tone],
                    GRADE_FG[grade.tone],
                  )}
                >
                  {grade.letter}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- Talking points --------------------------------------------------

interface TalkingPoint {
  id: string;
  text: string;
  tone: "rose" | "amber" | "emerald";
}

function buildTalkingPoints(metrics: ScoreRow[]): TalkingPoint[] {
  const points: TalkingPoint[] = [];
  for (const m of metrics) {
    if (m.status === "on-track" && m.progress >= 0.9) {
      points.push({
        id: `${m.id}_win`,
        text: `${m.label} is ahead of plan — recognize the wins.`,
        tone: "emerald",
      });
    } else if (m.progress < 0.25) {
      points.push({
        id: `${m.id}_miss`,
        text: `${m.label} is well below target — agree on a recovery plan.`,
        tone: "rose",
      });
    } else if (m.status === "at-risk") {
      points.push({
        id: `${m.id}_risk`,
        text: `${m.label} is trending behind — discuss what needs to change.`,
        tone: "amber",
      });
    }
  }
  return points;
}

function TalkingPointsCard({
  repName,
  points,
}: {
  repName: string;
  points: TalkingPoint[];
}) {
  const empty = points.length === 0;
  return (
    <Card className="border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            1-on-1 talking points
          </div>
          <div className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Auto-generated from this rep&apos;s metrics
          </div>
          {empty ? (
            <p className="mt-1 text-xs italic text-zinc-500">
              Nothing flagged this period — recognize what&apos;s going right.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {points.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                      p.tone === "rose"
                        ? "bg-rose-500"
                        : p.tone === "amber"
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                    )}
                  />
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            toast.success(`1-on-1 with ${repName.split(" ")[0]} scheduled.`)
          }
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          Schedule
        </button>
      </div>
    </Card>
  );
}

// ---------- Team rank lookup ------------------------------------------------

function computeRanks(
  reps: { user: User; metrics: ScoreRow[] }[],
  forUserId: string,
): Record<string, { rank: number; total: number }> {
  if (reps.length === 0) return {};
  const out: Record<string, { rank: number; total: number }> = {};
  // Pull the metric ids from any rep — every rep ships the same set.
  const sampleMetrics = reps[0]?.metrics ?? [];
  for (const m of sampleMetrics) {
    const ranking = reps
      .map((r) => ({
        userId: r.user.id,
        achieved: r.metrics.find((x) => x.id === m.id)?.achieved ?? 0,
      }))
      .sort((a, b) => b.achieved - a.achieved);
    const rank = ranking.findIndex((x) => x.userId === forUserId) + 1;
    out[m.id] = { rank: rank || reps.length, total: reps.length };
  }
  return out;
}

// ---------- Rankings tab ----------------------------------------------------

const AVATAR_PALETTE = [
  { bg: "bg-sky-500", fg: "text-white" },
  { bg: "bg-rose-500", fg: "text-white" },
  { bg: "bg-orange-500", fg: "text-white" },
  { bg: "bg-violet-500", fg: "text-white" },
  { bg: "bg-emerald-500", fg: "text-white" },
  { bg: "bg-amber-500", fg: "text-white" },
  { bg: "bg-indigo-500", fg: "text-white" },
];

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!;
}

const MEDAL_TONES: Record<1 | 2 | 3, { ring: string; bg: string; fg: string; chip: string }> = {
  1: {
    ring: "ring-amber-200",
    bg: "bg-gradient-to-b from-amber-300 to-amber-500",
    fg: "text-amber-900",
    chip: "bg-amber-500 text-white",
  },
  2: {
    ring: "ring-zinc-200",
    bg: "bg-gradient-to-b from-zinc-300 to-zinc-400",
    fg: "text-zinc-800",
    chip: "bg-zinc-500 text-white",
  },
  3: {
    ring: "ring-orange-200",
    bg: "bg-gradient-to-b from-orange-300 to-orange-500",
    fg: "text-orange-900",
    chip: "bg-orange-500 text-white",
  },
};

function RankMedal({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {rank}
      </span>
    );
  }
  const tone = MEDAL_TONES[rank as 1 | 2 | 3];
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid h-7 w-7 place-items-center rounded-full ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950",
        tone.ring,
        tone.bg,
      )}
    >
      <Trophy className={cn("h-3.5 w-3.5", tone.fg)} />
      <span
        className={cn(
          "absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold leading-none",
          tone.chip,
        )}
      >
        {rank}
      </span>
    </span>
  );
}

function RankingSparkline({
  data,
  tone,
}: {
  data: { date: string; value: number }[];
  tone: "emerald" | "indigo" | "amber" | "rose" | "zinc";
}) {
  const colors: Record<typeof tone, string> = {
    emerald: "#10b981",
    indigo: "#6366f1",
    amber: "#f59e0b",
    rose: "#f43f5e",
    zinc: "#a1a1aa",
  };
  if (data.length < 2) {
    return (
      <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" aria-hidden />
    );
  }
  const id = `rank-spark-${tone}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[tone]} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colors[tone]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="natural"
            dataKey="value"
            stroke={colors[tone]}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankingsTab({
  reps,
  window,
  period,
}: {
  reps: { user: User; metrics: ScoreRow[]; mrr: number }[];
  window: ScorecardWindow;
  period: Period;
}) {
  const ranked = useMemo(() => {
    return reps
      .map((r) => {
        const totalPoints = r.metrics.reduce((sum, m) => sum + m.rawCount, 0);
        const weighted = r.metrics.reduce((sum, m) => sum + m.score, 0);
        // Combine all metric trends into one summary sparkline by date.
        const byDate = new Map<string, number>();
        for (const m of r.metrics) {
          for (const p of m.trend) {
            byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
          }
        }
        const trend = Array.from(byDate.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, value]) => ({ date, value }));
        return {
          user: r.user,
          totalPoints,
          weighted,
          metricCount: r.metrics.length,
          trend,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [reps]);

  const periodLabel = periodTagLabel(period).toUpperCase();

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <CalendarClock className="h-4 w-4" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Rankings
            </div>
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-zinc-100 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <span>{periodLabel}</span>
              <span className="text-zinc-400">·</span>
              <span className="font-mono normal-case tracking-tight">
                {window.tagDate}
              </span>
              <span className="text-zinc-400">·</span>
              <span>
                {ranked.length} rep{ranked.length === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Refresh rankings"
          onClick={() => toast.success("Rankings refreshed.")}
          className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Rankings
            </span>
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-600 dark:text-zinc-300">
              {ranked.length} rep{ranked.length === 1 ? "" : "s"}
            </span>
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-500">sorted by total points</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>{periodLabel}</span>
            <span className="mx-1.5 text-zinc-300">·</span>
            <span className="font-mono">{window.tagDate}</span>
          </span>
        </div>

        {ranked.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            No active reps in this period.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ranked.map((row, idx) => {
              const rank = idx + 1;
              const score = row.weighted;
              const grade = letterGrade(score);
              const tone =
                grade.tone === "emerald"
                  ? "emerald"
                  : grade.tone === "indigo"
                  ? "indigo"
                  : grade.tone === "amber"
                  ? "amber"
                  : "rose";
              const palette = avatarColor(row.user.id);
              return (
                <li
                  key={row.user.id}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:gap-4"
                >
                  <div className="flex items-center gap-3">
                    <RankMedal rank={rank} />
                    <Avatar className={cn("h-9 w-9", palette.bg)}>
                      <AvatarFallback
                        className={cn(
                          "bg-transparent text-sm font-semibold",
                          palette.fg,
                        )}
                      >
                        {row.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.user.name}
                      </div>
                      <div className="truncate text-xs text-zinc-500">
                        {row.user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full text-sm font-semibold",
                        GRADE_BG[grade.tone],
                        GRADE_FG[grade.tone],
                      )}
                    >
                      {grade.letter}
                    </span>
                    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-50 px-2 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="tabular-nums">{row.metricCount}</span>
                    </span>
                  </div>

                  <div className="hidden sm:block" aria-hidden />

                  <div className="hidden min-w-0 sm:block">
                    <RankingSparkline data={row.trend} tone={tone} />
                  </div>

                  <div className="flex items-center justify-end gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Points
                      </div>
                      <div className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {row.totalPoints}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Weighted
                      </div>
                      <div className="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {row.weighted.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------- Metrics setup tab ----------------------------------------------

interface MetricRow {
  id: string;
  label: string;
  systemId: string;
  weight: number;
  sortOrder: number;
  active: boolean;
  description: string;
  unit: ScoreRow["unit"];
  target: number;
  pointsPerUnit: number;
  bonusPoints: number;
  bonusAtTargetPct: number;
  /** null = no cap. */
  cap: number | null;
  /** null = no minimum floor. */
  floor: number | null;
  /** null = no stretch target. */
  stretch: number | null;
}

const RULE_SET_VERSION = 5;

const UNIT_LABEL: Record<ScoreRow["unit"], string> = {
  count: "count",
  currency: "currency",
  percent: "percent",
};

function emptyMetricDraft(sortOrder: number): MetricRow {
  return {
    id: `new_${Date.now().toString(36)}`,
    label: "New metric",
    systemId: "new_metric",
    weight: 0,
    sortOrder,
    active: true,
    description: "",
    unit: "count",
    target: 0,
    pointsPerUnit: 1,
    bonusPoints: 0,
    bonusAtTargetPct: 100,
    cap: null,
    floor: null,
    stretch: null,
  };
}

const WEIGHT_PALETTE = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];

export function MetricsSetupTab() {
  const sampleMetrics = useMemo(() => {
    const reps = getTeamMembers("sales").filter((u) => u.role === "member");
    if (reps.length === 0) return [];
    const first = reps[0]!;
    return buildScorecard(
      first,
      resolveWindow("month", defaultSelectionFor("month")),
    );
  }, []);

  const initialRows = useMemo<MetricRow[]>(
    () =>
      sampleMetrics.map((m, idx) => ({
        id: m.id,
        label: m.label,
        systemId: m.id.toLowerCase(),
        // Bump the first metric's weight so the demo distribution is over 100%
        // — matches the "currently 120%" warning in the reference design.
        weight: idx === 0 ? m.weight + 15 : m.weight,
        sortOrder: (idx + 1) * 10,
        active: true,
        description: m.description,
        unit: m.unit,
        target: m.target,
        pointsPerUnit: 1,
        bonusPoints: 0,
        bonusAtTargetPct: 100,
        cap: null,
        floor: null,
        stretch: null,
      })),
    [sampleMetrics],
  );

  const [rows, setRows] = useState<MetricRow[]>(initialRows);
  /** When non-null, the metrics list is replaced by a full-page edit form for the draft below. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MetricRow | null>(null);
  /** True when the draft is for a brand-new metric (Save adds it; Cancel discards it). */
  const [isNewDraft, setIsNewDraft] = useState(false);
  /** When true, the metrics list is replaced by the rule-set version history view. */
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Metric id queued for deletion — drives the confirmation dialog. */
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const deleteTarget = deleteTargetId
    ? rows.find((r) => r.id === deleteTargetId) ?? null
    : null;

  const totalWeight = rows.reduce(
    (sum, r) => sum + (r.active ? r.weight : 0),
    0,
  );
  const weightOk = Math.abs(totalWeight - 100) < 0.01;

  const updateRow = (id: string, patch: Partial<MetricRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const startEdit = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setDraft({ ...row });
    setEditingId(id);
    setIsNewDraft(false);
  };

  const startNew = () => {
    const nextSort = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 10;
    const fresh = emptyMetricDraft(nextSort);
    setDraft(fresh);
    setEditingId(fresh.id);
    setIsNewDraft(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setIsNewDraft(false);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    const target = rows.find((r) => r.id === deleteTargetId);
    setRows((prev) => prev.filter((r) => r.id !== deleteTargetId));
    // If the deleted metric is currently being edited, close the form.
    if (editingId === deleteTargetId) {
      setEditingId(null);
      setDraft(null);
      setIsNewDraft(false);
    }
    setDeleteTargetId(null);
    if (target) toast.success(`Removed "${target.label}".`);
  };

  const saveDraft = (next: MetricRow) => {
    if (!next.label.trim()) {
      toast.error("Title is required.");
      return;
    }
    setRows((prev) =>
      isNewDraft ? [...prev, next] : prev.map((r) => (r.id === next.id ? next : r)),
    );
    toast.success(isNewDraft ? "Metric created." : "Metric updated.");
    cancelEdit();
  };

  const reset = () => {
    setRows(initialRows);
    toast.success("Reset to last saved version.");
  };

  const save = () => {
    if (!weightOk) {
      toast.error(
        `Weights must total 100% (currently ${totalWeight.toFixed(1)}%).`,
      );
      return;
    }
    toast.success("Rule set saved.");
  };

  const deleteDialog = (
    <Dialog
      open={deleteTargetId !== null}
      onOpenChange={(open) => {
        if (!open) setDeleteTargetId(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete metric?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              &ldquo;{deleteTarget?.label}&rdquo;
            </span>{" "}
            will be removed from this rule set. Past scores keep their values,
            but the metric won&apos;t appear on future scorecards.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete metric
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (editingId && draft) {
    return (
      <>
        <MetricEditForm
          draft={draft}
          onChange={setDraft}
          onCancel={cancelEdit}
          onSave={() => saveDraft(draft)}
          onDelete={isNewDraft ? undefined : () => setDeleteTargetId(draft.id)}
        />
        {deleteDialog}
      </>
    );
  }

  if (historyOpen) {
    return (
      <RuleSetHistoryView
        liveVersion={RULE_SET_VERSION - 1}
        onClose={() => setHistoryOpen(false)}
        onRestore={(v) => {
          toast.success(`Rule set restored to version ${v}.`);
          setHistoryOpen(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Rule set
              </span>
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-emerald-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <div className="mt-0.5 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Version 4
            </div>
            <div className="text-xs text-zinc-500">Applied date unavailable</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon className="h-3.5 w-3.5" aria-hidden />
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.message("Rule simulation coming soon.")}
          >
            <TestTube2 className="h-3.5 w-3.5" aria-hidden />
            Test rule changes
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Weight distribution
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              weightOk
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
            )}
          >
            {weightOk ? null : (
              <AlertTriangle className="h-3 w-3" aria-hidden />
            )}
            Should equal 100%
            <span className="text-zinc-400">·</span>
            <span className="tabular-nums">
              Currently {totalWeight.toFixed(1)}%
            </span>
          </span>
        </div>

        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          {rows
            .filter((r) => r.active && r.weight > 0)
            .map((r, idx) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center justify-center text-[10px] font-semibold text-white",
                  WEIGHT_PALETTE[idx % WEIGHT_PALETTE.length],
                )}
                style={{
                  width: `${(r.weight / Math.max(totalWeight, 100)) * 100}%`,
                }}
                title={`${r.label} — ${r.weight}%`}
              >
                {r.weight >= 8 ? `${r.weight}%` : null}
              </div>
            ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          {rows
            .filter((r) => r.active)
            .map((r, idx) => (
              <span key={r.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 rounded-full",
                    WEIGHT_PALETTE[idx % WEIGHT_PALETTE.length],
                  )}
                />
                <span>{r.label}</span>
                <span className="font-medium tabular-nums">{r.weight}%</span>
              </span>
            ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Rule set
          </div>
          <div className="mt-0.5 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Version 4
          </div>
          <div className="text-xs text-zinc-500">
            Manage metrics in the list, then edit details. Save applies the
            whole configuration.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Reset"
            onClick={reset}
            className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button onClick={save}>Save</Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Metrics
            </div>
            <div className="text-xs text-zinc-500">
              All scorecard metrics. Edit one or create another.
            </div>
            <div className="text-[11px] text-zinc-400">
              Internal IDs are mainly for integrations — most of the team only
              needs titles and targets.
            </div>
          </div>
          <Button size="sm" onClick={startNew}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New metric
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">System ID</th>
                <th className="px-4 py-2.5 w-[18%]">Weight</th>
                <th className="px-4 py-2.5">Sort order</th>
                <th className="px-4 py-2.5">Active</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-zinc-500"
                  >
                    No metrics configured yet.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {r.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {r.systemId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-9 text-right font-medium tabular-nums">
                          {r.weight}%
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={cn(
                              "h-full",
                              WEIGHT_PALETTE[idx % WEIGHT_PALETTE.length],
                            )}
                            style={{
                              width: `${Math.min(100, r.weight)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-500">
                      {r.sortOrder}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={r.active}
                          onCheckedChange={(v) => updateRow(r.id, { active: v })}
                        />
                        <span className="text-xs text-zinc-500">
                          {r.active ? "Yes" : "No"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(r.id)}
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          Edit
                        </Button>
                        <button
                          type="button"
                          aria-label={`Delete ${r.label}`}
                          onClick={() => setDeleteTargetId(r.id)}
                          className="grid h-8 w-8 place-items-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Custom targets by rep
          </div>
          <div className="text-xs text-zinc-500">
            Override the default target for a specific person and period.
          </div>
        </div>
        <Button
          onClick={() => toast.message("Per-rep override flow coming soon.")}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add override
        </Button>
      </Card>

      {deleteDialog}
    </div>
  );
}

// ---------- Metric edit form ----------------------------------------------

function MetricEditForm({
  draft,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: MetricRow;
  onChange: (next: MetricRow) => void;
  onCancel: () => void;
  onSave: () => void;
  /** Omit for new (unsaved) drafts — there's nothing to delete yet. */
  onDelete?: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const patch = (next: Partial<MetricRow>) => onChange({ ...draft, ...next });

  // Number fields hold their own draft string so users can clear / type freely
  // without React forcing a 0 back into a half-typed input.
  const numberValue = (n: number) => (Number.isFinite(n) ? String(n) : "");
  const optionalValue = (n: number | null) => (n === null ? "" : String(n));

  const onNumber =
    (key: keyof MetricRow) => (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const parsed = raw === "" ? 0 : Number(raw);
      if (Number.isNaN(parsed)) return;
      patch({ [key]: parsed } as Partial<MetricRow>);
    };

  const onOptionalNumber =
    (key: "cap" | "floor" | "stretch") =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        patch({ [key]: null });
        return;
      }
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) return;
      patch({ [key]: parsed });
    };

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All metrics
          </Button>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Edit metric
            </div>
            <div className="truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {draft.label || "Untitled metric"}
            </div>
            <div className="text-xs text-zinc-500">
              Rule set version {RULE_SET_VERSION}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            Save
          </Button>
        </div>
      </Card>

      <Card className="space-y-6 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Metric
            </div>
            <div className="mt-0.5 truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {draft.label || "Untitled metric"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => patch({ active: !draft.active })}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            aria-pressed={draft.active}
          >
            <span
              aria-hidden
              className={cn(
                "grid h-4 w-4 place-items-center rounded border transition-colors",
                draft.active
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950",
              )}
            >
              {draft.active ? <Check className="h-3 w-3" /> : null}
            </span>
            Active on scorecard
          </button>
        </div>

        <section className="space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            What people see
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="metric-title">
              <Input
                id="metric-title"
                value={draft.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="e.g. New leads assigned"
              />
            </Field>
            <Field label="Unit" htmlFor="metric-unit">
              <Select
                value={draft.unit}
                onValueChange={(v) =>
                  patch({ unit: v as ScoreRow["unit"] })
                }
              >
                <SelectTrigger id="metric-unit">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(UNIT_LABEL) as ScoreRow["unit"][]).map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="metric-description">
            <Textarea
              id="metric-description"
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What this metric measures and why it matters."
              rows={3}
            />
          </Field>
        </section>

        <div className="border-t border-zinc-200 dark:border-zinc-800" />

        <section className="space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Targets &amp; scoring
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Default target" htmlFor="metric-target">
              <Input
                id="metric-target"
                type="number"
                inputMode="decimal"
                value={numberValue(draft.target)}
                onChange={onNumber("target")}
              />
            </Field>
            <Field label="Points per unit" htmlFor="metric-points">
              <Input
                id="metric-points"
                type="number"
                inputMode="decimal"
                value={numberValue(draft.pointsPerUnit)}
                onChange={onNumber("pointsPerUnit")}
              />
            </Field>
            <Field label="Weight %" htmlFor="metric-weight">
              <Input
                id="metric-weight"
                type="number"
                inputMode="decimal"
                value={numberValue(draft.weight)}
                onChange={onNumber("weight")}
              />
            </Field>
            <Field label="Bonus points" htmlFor="metric-bonus">
              <Input
                id="metric-bonus"
                type="number"
                inputMode="decimal"
                value={numberValue(draft.bonusPoints)}
                onChange={onNumber("bonusPoints")}
              />
            </Field>
            <Field label="Bonus at target %" htmlFor="metric-bonus-pct">
              <Input
                id="metric-bonus-pct"
                type="number"
                inputMode="decimal"
                value={numberValue(draft.bonusAtTargetPct)}
                onChange={onNumber("bonusAtTargetPct")}
              />
            </Field>
            <Field label="Cap per period (optional)" htmlFor="metric-cap">
              <Input
                id="metric-cap"
                type="number"
                inputMode="decimal"
                value={optionalValue(draft.cap)}
                onChange={onOptionalNumber("cap")}
                placeholder="Leave empty for none"
              />
            </Field>
            <Field label="Minimum floor (optional)" htmlFor="metric-floor">
              <Input
                id="metric-floor"
                type="number"
                inputMode="decimal"
                value={optionalValue(draft.floor)}
                onChange={onOptionalNumber("floor")}
                placeholder="Leave empty for none"
              />
            </Field>
            <Field label="Stretch target (optional)" htmlFor="metric-stretch">
              <Input
                id="metric-stretch"
                type="number"
                inputMode="decimal"
                value={optionalValue(draft.stretch)}
                onChange={onOptionalNumber("stretch")}
                placeholder="Leave empty for none"
              />
            </Field>
          </div>
        </section>

        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 text-left text-sm focus-visible:outline-none"
            aria-expanded={advancedOpen}
          >
            <span className="flex items-center gap-2">
              <span className="font-medium text-zinc-700 underline decoration-dotted underline-offset-4 dark:text-zinc-200">
                Advanced: IDs for CRM &amp; integrations
              </span>
              <HelpCircle
                className="h-3.5 w-3.5 text-zinc-400"
                aria-hidden
              />
              <span className="text-xs text-zinc-500">
                Optional—skip unless you connect data feeds or APIs.
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-zinc-400 transition-transform",
                advancedOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {advancedOpen ? (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="System ID" htmlFor="metric-system-id">
                <Input
                  id="metric-system-id"
                  value={draft.systemId}
                  onChange={(e) => patch({ systemId: e.target.value })}
                  placeholder="snake_case_id"
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Sort order" htmlFor="metric-sort-order">
                <Input
                  id="metric-sort-order"
                  type="number"
                  inputMode="numeric"
                  value={numberValue(draft.sortOrder)}
                  onChange={onNumber("sortOrder")}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </Card>

      {onDelete ? (
        <Card className="flex flex-col gap-3 border-rose-200/70 bg-rose-50/40 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Danger zone
            </div>
            <div className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Delete this metric
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Removes &ldquo;{draft.label || "Untitled metric"}&rdquo; from the
              rule set. Past scores keep their values.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete metric
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ---------- Rule set history -----------------------------------------------

interface RuleSetVersion {
  version: number;
  appliedAt: string;
  appliedBy: string;
  summary: string;
  changes: string[];
}

const MOCK_RULE_SET_HISTORY: RuleSetVersion[] = [
  {
    version: 4,
    appliedAt: "Apr 02, 2026",
    appliedBy: "Priya Shah",
    summary: "Tightened weights and added a stretch target on demos.",
    changes: [
      "Re-weighted 'New leads assigned' from 25% to 35%.",
      "Added a 200-point cap to 'Calls made'.",
      "Added a stretch target of 50 on 'Demos booked'.",
    ],
  },
  {
    version: 3,
    appliedAt: "Feb 17, 2026",
    appliedBy: "Aakash Mehta",
    summary: "Introduced 'Demos booked' and rebalanced the weights.",
    changes: [
      "Added 'Demos booked' (weight 20%, points per unit 2).",
      "Re-weighted 'Pipeline created' from 30% to 25%.",
      "Renamed 'Lead conversions' to 'Closed-won leads'.",
    ],
  },
  {
    version: 2,
    appliedAt: "Dec 04, 2025",
    appliedBy: "Priya Shah",
    summary: "Retired the activity vanity metrics.",
    changes: [
      "Archived 'Email opens' and 'Calls dialed'.",
      "Boosted 'Meetings held' weight by 10%.",
      "Set a minimum floor of 5 on 'New leads assigned'.",
    ],
  },
  {
    version: 1,
    appliedAt: "Sep 10, 2025",
    appliedBy: "Priya Shah",
    summary: "Initial rule set.",
    changes: [
      "Created the first scorecard with 6 metrics.",
      "Set baseline weights summing to 100%.",
    ],
  },
];

function RuleSetHistoryView({
  liveVersion,
  onClose,
  onRestore,
}: {
  liveVersion: number;
  onClose: () => void;
  onRestore: (version: number) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to setup
          </Button>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Rule set
            </div>
            <div className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Version history
            </div>
            <div className="text-xs text-zinc-500">
              Past rule sets — restore to roll the scoring rules back to that
              version.
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 sm:self-auto dark:bg-zinc-800 dark:text-zinc-300">
          <HistoryIcon className="h-3 w-3" aria-hidden />
          <span className="tabular-nums">{MOCK_RULE_SET_HISTORY.length}</span>{" "}
          versions
        </span>
      </Card>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {MOCK_RULE_SET_HISTORY.map((v) => {
            const isLive = v.version === liveVersion;
            return (
              <li
                key={v.version}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-semibold tabular-nums",
                      isLive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                    )}
                  >
                    v{v.version}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        Version {v.version}
                      </div>
                      <VersionStatusChip live={isLive} />
                      <span className="text-xs text-zinc-500">
                        Applied {v.appliedAt} · by {v.appliedBy}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                      {v.summary}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {v.changes.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400"
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400"
                          />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
                  {isLive ? (
                    <span className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                      Currently live
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore(v.version)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Restore
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function VersionStatusChip({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider",
        live
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          live ? "bg-emerald-500" : "bg-zinc-400",
        )}
      />
      {live ? "Live" : "Archived"}
    </span>
  );
}

// ---------- Manual points tab ----------------------------------------------

const ADJUSTMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: "coaching", label: "Coaching" },
  { value: "spiff", label: "Spiff / contest" },
  { value: "correction", label: "Correction" },
  { value: "other", label: "Other" },
];

export function ManualPointsTab({
  reps,
}: {
  reps: { user: User; metrics: ScoreRow[]; mrr: number }[];
}) {
  const metricOptions = reps[0]?.metrics ?? [];

  const [repId, setRepId] = useState<string>("");
  const [metricId, setMetricId] = useState<string>(
    metricOptions[0]?.id ?? "",
  );
  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [category, setCategory] = useState<string>("coaching");
  const [internalNote, setInternalNote] = useState<string>("");

  const pointsNum = points === "" ? Number.NaN : Number(points);
  const valid =
    repId.length > 0 &&
    metricId.length > 0 &&
    Number.isFinite(pointsNum) &&
    pointsNum !== 0 &&
    reason.trim().length > 0;

  const reset = () => {
    setPoints("");
    setReason("");
    setInternalNote("");
  };

  const apply = () => {
    if (!valid) {
      toast.error("Rep, metric, points, and reason are required.");
      return;
    }
    const rep = reps.find((r) => r.user.id === repId);
    const metric = metricOptions.find((m) => m.id === metricId);
    const sign = pointsNum > 0 ? "+" : "";
    toast.success(
      `${sign}${pointsNum} pts applied to ${rep?.user.name} on ${metric?.label}.`,
    );
    reset();
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Manual adjustment
          </div>
          <div className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Adjust points
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">
            Pick a rep and metric, enter a positive or negative amount, and add
            a short reason for the audit trail.
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800" />

      <section className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Who &amp; what
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Sales rep" htmlFor="manual-rep">
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger id="manual-rep">
                <SelectValue placeholder="Choose a rep…" />
              </SelectTrigger>
              <SelectContent>
                {reps.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-zinc-500">
                    No active reps yet.
                  </div>
                ) : (
                  reps.map((r) => (
                    <SelectItem key={r.user.id} value={r.user.id}>
                      {r.user.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Metric" htmlFor="manual-metric">
            <Select value={metricId} onValueChange={setMetricId}>
              <SelectTrigger id="manual-metric">
                <SelectValue placeholder="Pick a metric…" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-zinc-500">
                    No metrics configured.
                  </div>
                ) : (
                  metricOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <div className="mx-4 border-t border-zinc-200 sm:mx-5 dark:border-zinc-800" />

      <section className="space-y-2 px-4 py-4 sm:px-5 sm:py-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Amount
        </div>
        <Field label="Points" htmlFor="manual-points">
          <Input
            id="manual-points"
            type="number"
            inputMode="decimal"
            placeholder="e.g. 5 or -2"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="sm:max-w-xs"
          />
        </Field>
        <p className="text-xs text-zinc-500">
          Use a positive number to add points, or a negative number to
          subtract.
        </p>
      </section>

      <div className="mx-4 border-t border-zinc-200 sm:mx-5 dark:border-zinc-800" />

      <section className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Reason
        </div>
        <Field label="Note for the audit trail" htmlFor="manual-reason">
          <Textarea
            id="manual-reason"
            placeholder="What changed and why (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </Field>

        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <span className="flex items-baseline gap-1">
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              Advanced options
            </span>
            <span className="text-xs text-zinc-500">(optional)</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-400 transition-transform",
              advancedOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {advancedOpen ? (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-zinc-50/40 p-3 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <Field label="Category" htmlFor="manual-category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="manual-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Internal note (not shown to rep)"
              htmlFor="manual-internal-note"
            >
              <Input
                id="manual-internal-note"
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Optional context for admins"
              />
            </Field>
          </div>
        ) : null}
      </section>

      <div className="border-t border-zinc-200 dark:border-zinc-800" />

      <div className="space-y-2 px-4 py-4 sm:px-5 sm:py-5">
        <Button
          size="lg"
          className="w-full"
          onClick={apply}
          disabled={!valid}
        >
          Apply adjustment
        </Button>
        <p className="text-center text-xs text-zinc-500">
          Rep, metric, points, and reason are required. The adjustment is sent
          as soon as you apply it.
        </p>
      </div>
    </Card>
  );
}
