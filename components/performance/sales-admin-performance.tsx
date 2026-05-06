"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Flame,
  Info,
  MessageSquare,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aggregateMetricsForKey } from "@/lib/aggregations";
import { formatCurrency, progressPct, timeAgo } from "@/lib/format-metric";
import { getInitials } from "@/lib/format";
import {
  REFERENCE_DATE,
  getMetricsForUser,
  getTargetForUser,
  getTeamMembers,
  lastNDates,
} from "@/lib/mock-data";
import { LEAD_STAGE_LABEL, leads as seedLeads } from "@/lib/sales-leads-data";
import { isOpenStage } from "@/lib/sales-pipeline";
import { cn } from "@/lib/utils";
import type {
  DailyMetric,
  Lead,
  LeadTimelineEvent,
  User,
} from "@/lib/types";

import { buildCsvFrom, ExportCsvButton } from "./export-csv-button";

const NOW_ISO = `${REFERENCE_DATE}T12:00:00.000Z`;
const NOW_MS = Date.parse(NOW_ISO);
const STALE_THRESHOLD_DAYS = 7;

type Period = "week" | "month" | "quarter" | "year";

const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const PERIOD_LABEL: Record<Period, string> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

interface Props {
  user: User;
  /** Triggers the existing Add-associate flow on the Team page. */
  onAddAssociate?: () => void;
  canAddMember?: boolean;
}

/**
 * Sales-admin "Team Overview" — the performance surface a sales admin lands on.
 *
 * Same data sources as the rest of the app (mock-data + sales-leads-data); the
 * shape is purely a presentation refresh: KPI tiles → status callouts →
 * leaderboard + per-rep conversion → roster → activity feed.
 */
export function SalesAdminPerformance({
  user,
  onAddAssociate,
  canAddMember = true,
}: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [activityTab, setActivityTab] =
    useState<"all" | "wins" | "losses">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [rosterSort, setRosterSort] = useState<RosterSortKey>("pipeline");

  const dateWindow = useMemo(() => getWindow(period), [period]);

  const members = useMemo(() => getTeamMembers("sales"), []);
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const teamLeads = useMemo(
    () => seedLeads.filter((l) => memberIds.has(l.ownerId)),
    [memberIds],
  );

  const teamMetrics = useMemo<DailyMetric[]>(() => {
    const out: DailyMetric[] = [];
    for (const m of members) {
      out.push(
        ...getMetricsForUser(m.id, {
          from: dateWindow.from,
          to: dateWindow.to,
        }),
      );
    }
    return out;
  }, [members, dateWindow.from, dateWindow.to]);

  const kpis = useMemo(
    () => buildKpis(teamLeads, members, teamMetrics, dateWindow),
    [teamLeads, members, teamMetrics, dateWindow],
  );

  // ---------- Status row ----------
  const repsAtRisk = useMemo(
    () => buildRepsAtRisk(members, teamLeads),
    [members, teamLeads],
  );
  const staleLeads = useMemo(() => collectStaleLeads(teamLeads), [teamLeads]);
  const hotLeads = useMemo(
    () =>
      teamLeads
        .filter((l) => l.stage === "hot-lead")
        .sort((a, b) => b.value - a.value),
    [teamLeads],
  );
  const hotValue = hotLeads.reduce((s, l) => s + l.value, 0);

  // ---------- Leaderboard ----------
  const leaderboard = useMemo(
    () => buildLeaderboard(members, teamLeads),
    [members, teamLeads],
  );

  // ---------- Conversion by rep ----------
  const conversionRows = useMemo(
    () => buildConversionRows(members, teamLeads),
    [members, teamLeads],
  );

  // ---------- Roster ----------
  const rosterRows = useMemo(
    () => buildRosterRows(members, teamLeads),
    [members, teamLeads],
  );
  const sortedRoster = useMemo(
    () => sortRoster(rosterRows, rosterSort),
    [rosterRows, rosterSort],
  );

  // ---------- Activity ----------
  const activity = useMemo(
    () => collectTeamActivity(teamLeads, activityTab),
    [teamLeads, activityTab],
  );

  const buildCsv = () => {
    const headers = [
      "Rep",
      "Email",
      "Status",
      "Pipeline (₹)",
      "Closed-won (₹)",
      "Hot leads",
      "Stale leads",
      "Quota %",
    ];
    const rows = rosterRows.map((r) => [
      r.user.name,
      r.user.email,
      r.user.status,
      r.pipelineValue,
      r.wonValue,
      r.hotCount,
      r.staleCount,
      r.quotaPct.toFixed(1),
    ]);
    return buildCsvFrom(headers, rows);
  };

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Sales team
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Team Overview
          </h1>
          <p className="text-sm text-zinc-500">
            {greeting(user.name)} — track team health, performance, and pipeline
            at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter value={period} onChange={setPeriod} />
          <ExportCsvButton
            buildCsv={buildCsv}
            filename={`sales-team-overview-${period}.csv`}
          />
          {canAddMember ? (
            <Button onClick={onAddAssociate}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Add associate
            </Button>
          ) : null}
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <KpiTile key={k.id} {...k} />
        ))}
      </div>

      {/* Status callouts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RepsAtRiskCard rows={repsAtRisk} />
        <StaleLeadsCard leads={staleLeads} />
        <HotOpportunitiesCard
          leads={hotLeads}
          totalValue={hotValue}
          memberById={new Map(members.map((m) => [m.id, m]))}
        />
      </div>

      {/* Leaderboard + Conversion */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" aria-hidden />
              <h2 className="text-sm font-semibold tracking-tight">
                Leaderboard
              </h2>
            </div>
            <span className="text-xs text-zinc-500">{PERIOD_LABEL[period]}</span>
          </div>
          <div className="mt-4 space-y-3">
            {leaderboard.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                No reps yet.
              </p>
            ) : (
              leaderboard.map((row, i) => (
                <LeaderboardItem key={row.user.id} row={row} rank={i + 1} />
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" aria-hidden />
              <h2 className="text-sm font-semibold tracking-tight">
                Conversion by rep
              </h2>
            </div>
            <span className="text-xs text-zinc-500">Stage-pair pass-through</span>
          </div>
          <ConversionTable rows={conversionRows} />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-medium text-zinc-500">
            <LegendDot tone="emerald" label="≥60% strong" />
            <LegendDot tone="amber" label="40–60% review" />
            <LegendDot tone="rose" label="<40% coach" />
          </div>
        </Card>
      </div>

      {/* Roster */}
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-500" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">Team roster</h2>
          </div>
          <RosterSortControl value={rosterSort} onChange={setRosterSort} />
        </div>
        <RosterTable rows={sortedRoster} />
      </Card>

      {/* Activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-500" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">
              Team activity
            </h2>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Refresh activity"
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              aria-hidden
            />
          </button>
        </div>
        <div className="mt-3 inline-flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          {(["all", "wins", "losses"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActivityTab(k)}
              className={cn(
                "h-7 rounded-md px-3 text-xs font-medium capitalize transition-colors",
                activityTab === k
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <ActivityList entries={activity} />
      </Card>
    </div>
  );
}

// ============================================================================
// Header helpers
// ============================================================================

function greeting(name: string): string {
  const hr = new Date(NOW_ISO).getUTCHours();
  const part = hr < 12 ? "morning" : hr < 17 ? "afternoon" : "evening";
  const first = name.split(" ")[0] ?? name;
  return `Good ${part}, ${first} 👋`;
}

function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (next: Period) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Period"
      className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      {(Object.keys(PERIOD_LABEL) as Period[]).map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50",
            )}
          >
            {PERIOD_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// KPI tiles
// ============================================================================

type Tone = "indigo" | "emerald" | "amber" | "sky" | "violet" | "rose";

const TONE_HEX: Record<Tone, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  rose: "#f43f5e",
};

const TONE_BG: Record<Tone, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-950/40",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40",
  amber: "bg-amber-50 dark:bg-amber-950/40",
  sky: "bg-sky-50 dark:bg-sky-950/40",
  violet: "bg-violet-50 dark:bg-violet-950/40",
  rose: "bg-rose-50 dark:bg-rose-950/40",
};

const TONE_FG: Record<Tone, string> = {
  indigo: "text-indigo-600 dark:text-indigo-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  sky: "text-sky-600 dark:text-sky-400",
  violet: "text-violet-600 dark:text-violet-400",
  rose: "text-rose-600 dark:text-rose-400",
};

const TONE_BAR: Record<Tone, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

interface KpiData {
  id: string;
  label: string;
  value: string;
  tone: Tone;
  spark?: { date: string; value: number }[];
  hint?: string;
}

function KpiTile({ id, label, value, tone, spark, hint }: KpiData) {
  const gid = `spark-${id}`;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {hint ? (
          <span
            className={cn(
              "grid h-5 w-5 place-items-center rounded-full",
              TONE_BG[tone],
              TONE_FG[tone],
            )}
            title={hint}
          >
            <Info className="h-3 w-3" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-2 h-9">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={spark}
              margin={{ top: 2, bottom: 0, left: 0, right: 0 }}
            >
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={TONE_HEX[tone]}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={TONE_HEX[tone]}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                type="natural"
                dataKey="value"
                stroke={TONE_HEX[tone]}
                strokeWidth={1.75}
                fill={`url(#${gid})`}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-9" aria-hidden />
      )}
    </Card>
  );
}

function buildKpis(
  leads: Lead[],
  members: User[],
  metrics: DailyMetric[],
  win: { from: string; to: string },
): KpiData[] {
  const spark = (key: string): { date: string; value: number }[] => {
    const byDate = new Map<string, number>();
    for (const m of metrics) {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + (m.values[key] ?? 0));
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  };

  const teamLeadsCount = leads.length;
  const openPipelineValue = leads
    .filter((l) => isOpenStage(l.stage))
    .reduce((s, l) => s + l.value, 0);
  const activeSprints = leads.filter(
    (l) => l.stage === "sprint-started" || l.stage === "sprint-review",
  ).length;
  const teamMrr = leads
    .filter((l) => l.stage === "subscription-closed")
    .reduce((s, l) => s + l.value, 0);
  const activeReps = members.filter((m) => m.status === "active").length;
  const totalReps = members.length;

  // Weighted quota attainment across the active members.
  const attainmentParts = members.map((m) => {
    const userMetrics = metrics.filter((x) => x.userId === m.id);
    const closed = aggregateMetricsForKey(userMetrics, "dealsClosed", "sum");
    const target = getTargetForUser(m.id)?.values.dealsClosed ?? 0;
    return target ? progressPct(closed, target) : 0;
  });
  const attainment =
    attainmentParts.length === 0
      ? 0
      : attainmentParts.reduce((s, v) => s + v, 0) / attainmentParts.length;

  // Sparks
  const dailyLeadAdds = leadsAddedByDay(leads, win);
  const dailyOpenValue = openPipelineByDay(leads, win);
  const dailySprintsActive = sprintsActiveByDay(leads, win);
  const dailyMrr = mrrByDay(leads, win);

  return [
    {
      id: "team-leads",
      label: "Team leads",
      value: teamLeadsCount.toLocaleString("en-IN"),
      tone: "indigo",
      spark: dailyLeadAdds,
    },
    {
      id: "open-pipeline",
      label: "Open pipeline",
      value: formatCurrency(openPipelineValue, "INR"),
      tone: "emerald",
      spark: dailyOpenValue,
    },
    {
      id: "active-sprints",
      label: "Active sprints",
      value: String(activeSprints),
      tone: "amber",
      spark: dailySprintsActive,
    },
    {
      id: "team-mrr",
      label: "Team MRR",
      value: formatCurrency(teamMrr, "INR"),
      tone: "sky",
      spark: dailyMrr,
    },
    {
      id: "active-reps",
      label: "Active reps",
      value: `${activeReps} of ${totalReps}`,
      tone: "violet",
      spark: spark("revenue").slice(-12),
    },
    {
      id: "quota-attainment",
      label: "Quota attainment",
      value: `${Math.round(attainment)}%`,
      tone: attainment >= 80 ? "emerald" : attainment >= 50 ? "amber" : "rose",
      spark: spark("dealsClosed"),
      hint: "Average % of monthly deals target across active reps.",
    },
  ];
}

// Daily synthesis from lead timelines.
function leadsAddedByDay(
  leads: Lead[],
  win: { from: string; to: string },
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const lead of leads) {
    const first = lead.timeline[0]?.timestamp ?? lead.lastActivityAt;
    const date = first.slice(0, 10);
    if (date < win.from || date > win.to) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + 1);
  }
  return densify(byDay, win);
}

function openPipelineByDay(
  leads: Lead[],
  win: { from: string; to: string },
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const lead of leads) {
    if (!isOpenStage(lead.stage)) continue;
    const date = lead.lastActivityAt.slice(0, 10);
    if (date < win.from || date > win.to) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + lead.value);
  }
  return densify(byDay, win);
}

function sprintsActiveByDay(
  leads: Lead[],
  win: { from: string; to: string },
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const lead of leads) {
    if (lead.stage !== "sprint-started" && lead.stage !== "sprint-review") {
      continue;
    }
    const date = lead.lastActivityAt.slice(0, 10);
    if (date < win.from || date > win.to) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + 1);
  }
  return densify(byDay, win);
}

function mrrByDay(
  leads: Lead[],
  win: { from: string; to: string },
): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const lead of leads) {
    if (lead.stage !== "subscription-closed") continue;
    const date = lead.lastActivityAt.slice(0, 10);
    if (date < win.from || date > win.to) continue;
    byDay.set(date, (byDay.get(date) ?? 0) + lead.value);
  }
  return densify(byDay, win);
}

function densify(
  byDay: Map<string, number>,
  win: { from: string; to: string },
): { date: string; value: number }[] {
  // Cap to 30 dense days so the spark stays readable for long ranges.
  const dates = lastNDates(30);
  const filtered = dates.filter((d) => d >= win.from && d <= win.to);
  return (filtered.length > 0 ? filtered : dates).map((date) => ({
    date,
    value: byDay.get(date) ?? 0,
  }));
}

// ============================================================================
// Status row
// ============================================================================

interface RepRiskRow {
  user: User;
  closed: number;
  target: number;
  behind: number;
}

function buildRepsAtRisk(members: User[], leads: Lead[]): RepRiskRow[] {
  const monthInfo = monthProgress(REFERENCE_DATE);
  const out: RepRiskRow[] = [];
  for (const m of members) {
    if (m.status !== "active") continue;
    const closed = leads.filter(
      (l) => l.ownerId === m.id && l.stage === "subscription-closed",
    ).length;
    const target = getTargetForUser(m.id)?.values.dealsClosed ?? 0;
    if (target === 0) continue;
    const expectedByToday = Math.round(
      target * (monthInfo.dayOfMonth / monthInfo.daysInMonth),
    );
    const behind = expectedByToday - closed;
    if (behind <= 0) continue;
    out.push({ user: m, closed, target, behind });
  }
  return out.sort((a, b) => b.behind - a.behind);
}

function RepsAtRiskCard({ rows }: { rows: RepRiskRow[] }) {
  const empty = rows.length === 0;
  return (
    <Card
      className={cn(
        "border-l-4 p-5",
        empty ? "border-l-emerald-400" : "border-l-rose-400",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md",
            empty ? TONE_BG.emerald : TONE_BG.rose,
            empty ? TONE_FG.emerald : TONE_FG.rose,
          )}
        >
          {empty ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            Reps at risk
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {empty ? "All reps on pace" : `${rows.length} below pace`}
          </div>
        </div>
      </div>

      {empty ? (
        <p className="mt-3 text-xs text-zinc-500">
          Every active rep is tracking to monthly target. Nice work.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 3).map((r) => (
            <li
              key={r.user.id}
              className="flex items-center gap-3 rounded-lg bg-rose-50/40 px-3 py-2 dark:bg-rose-950/20"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px]">
                  {getInitials(r.user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {r.user.name}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {r.closed}/{r.target} · {r.behind} behind ·{" "}
                  {timeAgo(r.user.lastActiveAt, NOW_ISO)}
                </div>
              </div>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-rose-100 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {getInitials(r.user.name)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!empty ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("Coaching link queued", {
                description: "Coaching plans land with the manager toolkit.",
              })
            }
          >
            Coach
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("Message draft started", {
                description: "Drops into the rep's DM in v2 — Phase 6.",
              })
            }
          >
            <MessageSquare className="h-4 w-4" />
            Message
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function StaleLeadsCard({ leads }: { leads: Lead[] }) {
  const empty = leads.length === 0;
  return (
    <Card className={cn("border-l-4 p-5", empty ? "border-l-emerald-400" : "border-l-amber-400")}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md",
            empty ? TONE_BG.emerald : TONE_BG.amber,
            empty ? TONE_FG.emerald : TONE_FG.amber,
          )}
        >
          {empty ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <CalendarClock className="h-3.5 w-3.5" />
          )}
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Stale leads (team-wide)
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {empty ? "Nothing stale" : `${leads.length} need a touch`}
          </div>
        </div>
      </div>

      {empty ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
          No leads gone cold across the team.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {leads.slice(0, 3).map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-amber-50/40 px-3 py-2 text-xs dark:bg-amber-950/20"
            >
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {l.clinicName}
              </span>
              <span className="shrink-0 text-zinc-500">
                {Math.floor((NOW_MS - Date.parse(l.lastActivityAt)) / 86_400_000)}d
                idle
              </span>
            </li>
          ))}
          {leads.length > 3 ? (
            <li className="text-[11px] text-zinc-500">
              +{leads.length - 3} more
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}

function HotOpportunitiesCard({
  leads,
  totalValue,
  memberById,
}: {
  leads: Lead[];
  totalValue: number;
  memberById: Map<string, User>;
}) {
  const empty = leads.length === 0;
  return (
    <Card
      className={cn("border-l-4 p-5", empty ? "border-l-zinc-300" : "border-l-emerald-400")}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md",
            empty ? "bg-zinc-100 dark:bg-zinc-800" : TONE_BG.emerald,
            empty ? "text-zinc-500" : TONE_FG.emerald,
          )}
        >
          <Flame className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Hot opportunities
          </div>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {empty ? "None right now" : `${formatCurrency(totalValue, "INR")} in flight`}
          </div>
        </div>
      </div>

      {empty ? (
        <p className="mt-4 text-xs text-zinc-500">
          Move pitch-delivered leads into &ldquo;hot&rdquo; when reps are ready to push.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {leads.slice(0, 3).map((l) => {
            const owner = memberById.get(l.ownerId);
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50/40 px-3 py-2 text-xs dark:bg-emerald-950/20"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {l.clinicName}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {owner?.name.split(" ")[0]?.toLowerCase() ?? "—"}
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatCurrency(l.value, "INR")}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!empty ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() =>
            toast.info("Opening opportunities", {
              description: "Filter the pipeline by Hot leads.",
            })
          }
        >
          View opportunities
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : null}
    </Card>
  );
}

// ============================================================================
// Leaderboard
// ============================================================================

interface LeaderRow {
  user: User;
  closed: number;
  target: number;
  pct: number;
  pipeline: number;
}

function buildLeaderboard(members: User[], leads: Lead[]): LeaderRow[] {
  const out: LeaderRow[] = [];
  for (const m of members) {
    const myLeads = leads.filter((l) => l.ownerId === m.id);
    const closed = myLeads.filter(
      (l) => l.stage === "subscription-closed",
    ).length;
    const target = getTargetForUser(m.id)?.values.dealsClosed ?? 0;
    const pct = target ? progressPct(closed, target) : 0;
    const pipeline = myLeads
      .filter((l) => isOpenStage(l.stage))
      .reduce((s, l) => s + l.value, 0);
    out.push({ user: m, closed, target, pct, pipeline });
  }
  return out.sort((a, b) => b.pct - a.pct || b.closed - a.closed);
}

function LeaderboardItem({ row, rank }: { row: LeaderRow; rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm",
            rank === 1
              ? "bg-amber-100 text-amber-700"
              : rank === 2
                ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                : rank === 3
                  ? "bg-orange-100 text-orange-700"
                  : "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400",
          )}
        >
          {medal || rank}
        </span>
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px]">
            {getInitials(row.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{row.user.name}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {row.closed}/{row.target}
          </div>
          <div className="text-[10px] text-zinc-500 tabular-nums">
            {formatCurrency(row.pipeline, "INR")}
          </div>
        </div>
      </div>
      <div className="ml-10 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn(
            "h-full transition-[width]",
            row.pct >= 80
              ? TONE_BAR.emerald
              : row.pct >= 50
                ? TONE_BAR.amber
                : TONE_BAR.rose,
          )}
          style={{ width: `${Math.min(100, row.pct)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Conversion by rep
// ============================================================================

interface ConversionRow {
  user: User;
  leadToMtg: number | null;
  mtgToSprint: number | null;
  sprintToSub: number | null;
}

function buildConversionRows(members: User[], leads: Lead[]): ConversionRow[] {
  return members.map((m) => {
    const myLeads = leads.filter((l) => l.ownerId === m.id);
    const totalLeads = myLeads.length;
    const reachedMeeting = myLeads.filter((l) =>
      hasReached(l, ["doctor-meeting", "pitch-delivered", "hot-lead", "sprint-started", "sprint-review", "subscription-closed"]),
    ).length;
    const reachedSprint = myLeads.filter((l) =>
      hasReached(l, ["sprint-started", "sprint-review", "subscription-closed"]),
    ).length;
    const reachedSub = myLeads.filter(
      (l) => l.stage === "subscription-closed",
    ).length;

    return {
      user: m,
      leadToMtg: totalLeads === 0 ? null : (reachedMeeting / totalLeads) * 100,
      mtgToSprint:
        reachedMeeting === 0 ? null : (reachedSprint / reachedMeeting) * 100,
      sprintToSub:
        reachedSprint === 0 ? null : (reachedSub / reachedSprint) * 100,
    };
  });
}

function hasReached(lead: Lead, stages: string[]): boolean {
  if (stages.includes(lead.stage)) return true;
  for (const ev of lead.timeline) {
    if (ev.type === "stage-change" && ev.toStage && stages.includes(ev.toStage)) {
      return true;
    }
  }
  return false;
}

function ConversionTable({ rows }: { rows: ConversionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 py-6 text-center text-sm text-zinc-500">
        No reps to compare yet.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Rep
            </th>
            <th className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Lead → Mtg
            </th>
            <th className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Mtg → Sprint
            </th>
            <th className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Sprint → Sub
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.user.id}
              className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800"
            >
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[9px]">
                      {getInitials(r.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    {r.user.name.split(" ")[0]?.toLowerCase()}
                  </span>
                </div>
              </td>
              <td className="px-1 py-1.5">
                <ConversionPill pct={r.leadToMtg} />
              </td>
              <td className="px-1 py-1.5">
                <ConversionPill pct={r.mtgToSprint} />
              </td>
              <td className="px-1 py-1.5">
                <ConversionPill pct={r.sprintToSub} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversionPill({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <div className="grid h-7 place-items-center rounded-md bg-zinc-50 text-[11px] font-medium text-zinc-400 dark:bg-zinc-900">
        —
      </div>
    );
  }
  const tone: "emerald" | "amber" | "rose" =
    pct >= 60 ? "emerald" : pct >= 40 ? "amber" : "rose";
  return (
    <div
      className={cn(
        "grid h-7 place-items-center rounded-md text-[11px] font-semibold tabular-nums",
        tone === "emerald" &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "amber" &&
          "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "rose" &&
          "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      )}
    >
      {Math.round(pct)}%
    </div>
  );
}

function LegendDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", TONE_BAR[tone])}
      />
      {label}
    </span>
  );
}

// ============================================================================
// Roster
// ============================================================================

type RosterSortKey = "pipeline" | "won" | "hot" | "name";

interface RosterRow {
  user: User;
  pipelineValue: number;
  wonValue: number;
  hotCount: number;
  staleCount: number;
  todaysActions: number;
  addedThisMonth: number;
  doneThisMonth: number;
  quotaPct: number;
  trend: number; // % delta vs prior week
}

function buildRosterRows(members: User[], leads: Lead[]): RosterRow[] {
  return members.map((m) => {
    const myLeads = leads.filter((l) => l.ownerId === m.id);
    const pipelineValue = myLeads
      .filter((l) => isOpenStage(l.stage))
      .reduce((s, l) => s + l.value, 0);
    const wonValue = myLeads
      .filter((l) => l.stage === "subscription-closed")
      .reduce((s, l) => s + l.value, 0);
    const hotCount = myLeads.filter((l) => l.stage === "hot-lead").length;
    const staleCount = myLeads.filter(
      (l) =>
        isOpenStage(l.stage) &&
        (NOW_MS - Date.parse(l.lastActivityAt)) / 86_400_000 >=
          STALE_THRESHOLD_DAYS,
    ).length;
    const todaysActions = myLeads.filter((l) => Boolean(l.nextAction)).length;
    const closed = myLeads.filter(
      (l) => l.stage === "subscription-closed",
    ).length;
    const target = getTargetForUser(m.id)?.values.dealsClosed ?? 0;
    const quotaPct = target ? progressPct(closed, target) : 0;

    const recent = countLeadsAddedSince(myLeads, 7);
    const previous = countLeadsAddedBetween(myLeads, 14, 7);
    const trend =
      previous === 0
        ? recent === 0
          ? 0
          : 100
        : ((recent - previous) / previous) * 100;

    return {
      user: m,
      pipelineValue,
      wonValue,
      hotCount,
      staleCount,
      todaysActions,
      addedThisMonth: countLeadsAddedSince(myLeads, 30),
      doneThisMonth: closed,
      quotaPct,
      trend,
    };
  });
}

function countLeadsAddedSince(leads: Lead[], days: number): number {
  const cutoff = NOW_MS - days * 86_400_000;
  return leads.filter((l) => {
    const first = l.timeline[0]?.timestamp ?? l.lastActivityAt;
    return Date.parse(first) >= cutoff;
  }).length;
}

function countLeadsAddedBetween(leads: Lead[], from: number, to: number): number {
  const lo = NOW_MS - from * 86_400_000;
  const hi = NOW_MS - to * 86_400_000;
  return leads.filter((l) => {
    const first = l.timeline[0]?.timestamp ?? l.lastActivityAt;
    const t = Date.parse(first);
    return t >= lo && t < hi;
  }).length;
}

function sortRoster(rows: RosterRow[], key: RosterSortKey): RosterRow[] {
  const copy = rows.slice();
  if (key === "pipeline") return copy.sort((a, b) => b.pipelineValue - a.pipelineValue);
  if (key === "won") return copy.sort((a, b) => b.wonValue - a.wonValue);
  if (key === "hot") return copy.sort((a, b) => b.hotCount - a.hotCount);
  return copy.sort((a, b) => a.user.name.localeCompare(b.user.name));
}

function RosterSortControl({
  value,
  onChange,
}: {
  value: RosterSortKey;
  onChange: (v: RosterSortKey) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Sort
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as RosterSortKey)}>
        <SelectTrigger className="h-8 w-[10rem] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pipeline">Pipeline value</SelectItem>
          <SelectItem value="won">Closed-won value</SelectItem>
          <SelectItem value="hot">Hot leads</SelectItem>
          <SelectItem value="name">Name</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function RosterTable({ rows }: { rows: RosterRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">No reps yet.</p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
            <Th>Rep</Th>
            <Th>Status</Th>
            <Th align="right">Today&apos;s actions</Th>
            <Th align="right">Added / Done</Th>
            <Th align="right">Pipeline</Th>
            <Th align="right">Trend</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.user.id}
              className="border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(r.user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.user.name}</div>
                    <div className="truncate text-xs text-zinc-500">
                      Last login {timeAgo(r.user.lastActiveAt, NOW_ISO)}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.user.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {r.todaysActions}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {r.addedThisMonth} / {r.doneThisMonth}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                {formatCurrency(r.pipelineValue, "INR")}
              </td>
              <td className="px-4 py-3 text-right">
                <TrendCell change={r.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function StatusPill({ status }: { status: User["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-emerald-700 dark:text-emerald-400">Active</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      <span className="text-zinc-500">Inactive</span>
    </span>
  );
}

function TrendCell({ change }: { change: number }) {
  if (!Number.isFinite(change) || change === 0) {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  const up = change > 0;
  const Icon: LucideIcon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        up
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(change).toFixed(0)}%
    </span>
  );
}

// ============================================================================
// Activity feed
// ============================================================================

type ActivityKind = "stage" | "won" | "lost" | "note" | "call" | "meeting";

interface ActivityRow {
  id: string;
  text: string;
  timestamp: string;
  actorId: string;
  kind: ActivityKind;
}

function collectTeamActivity(
  leads: Lead[],
  filter: "all" | "wins" | "losses",
): ActivityRow[] {
  const out: ActivityRow[] = [];
  for (const lead of leads) {
    for (const ev of lead.timeline) {
      const kind = kindFromEvent(ev);
      if (filter === "wins" && kind !== "won") continue;
      if (filter === "losses" && kind !== "lost") continue;
      out.push({
        id: ev.id,
        text: describeEvent(ev, lead),
        timestamp: ev.timestamp,
        actorId: ev.actorId,
        kind,
      });
    }
  }
  out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return out.slice(0, 20);
}

function kindFromEvent(ev: LeadTimelineEvent): ActivityKind {
  if (ev.type === "stage-change") {
    if (ev.toStage === "subscription-closed") return "won";
    if (ev.toStage === "lost") return "lost";
    return "stage";
  }
  if (ev.type === "call") return "call";
  if (ev.type === "meeting") return "meeting";
  return "note";
}

function describeEvent(ev: LeadTimelineEvent, lead: Lead): string {
  if (ev.type === "stage-change" && ev.fromStage && ev.toStage) {
    return `Moved ${lead.clinicName} from ${LEAD_STAGE_LABEL[ev.fromStage].toUpperCase()} → ${LEAD_STAGE_LABEL[ev.toStage].toUpperCase()}`;
  }
  if (ev.type === "call") return `Called ${lead.clinicName}`;
  if (ev.type === "meeting") return `Met with ${lead.clinicName}`;
  return `Noted on ${lead.clinicName}`;
}

function ActivityList({ entries }: { entries: ActivityRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="mt-6 py-8 text-center text-sm text-zinc-500">
        No matching activity.
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-3 py-3">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md",
              ACTIVITY_VISUAL[e.kind].bg,
              ACTIVITY_VISUAL[e.kind].fg,
            )}
          >
            {(() => {
              const Icon = ACTIVITY_VISUAL[e.kind].icon;
              return <Icon className="h-3 w-3" />;
            })()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 text-xs text-zinc-500">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {actorFirstName(e.actorId)}
              </span>
              <span>{relativeDay(e.timestamp)}</span>
            </div>
            <p className="mt-0.5 truncate text-sm text-zinc-700 dark:text-zinc-300">
              {e.text}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const ACTIVITY_VISUAL: Record<
  ActivityKind,
  { icon: LucideIcon; bg: string; fg: string }
> = {
  stage: {
    icon: ArrowRight,
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    fg: "text-indigo-600 dark:text-indigo-400",
  },
  won: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    fg: "text-emerald-600 dark:text-emerald-400",
  },
  lost: {
    icon: AlertTriangle,
    bg: "bg-rose-50 dark:bg-rose-950/40",
    fg: "text-rose-600 dark:text-rose-400",
  },
  note: {
    icon: Briefcase,
    bg: "bg-zinc-100 dark:bg-zinc-800",
    fg: "text-zinc-600 dark:text-zinc-400",
  },
  call: {
    icon: Target,
    bg: "bg-sky-50 dark:bg-sky-950/40",
    fg: "text-sky-600 dark:text-sky-400",
  },
  meeting: {
    icon: Users,
    bg: "bg-violet-50 dark:bg-violet-950/40",
    fg: "text-violet-600 dark:text-violet-400",
  },
};

function actorFirstName(id: string): string {
  const u = getTeamMembers("sales").find((m) => m.id === id);
  return u?.name.split(" ")[0]?.toLowerCase() ?? "someone";
}

// ============================================================================
// Time helpers
// ============================================================================

function getWindow(p: Period): { from: string; to: string } {
  const days = PERIOD_DAYS[p];
  const dates = lastNDates(Math.min(days, 30));
  const allDates = lastNDates(days);
  return {
    from: allDates[0] ?? dates[0] ?? REFERENCE_DATE,
    to: REFERENCE_DATE,
  };
}

function monthProgress(iso: string): {
  dayOfMonth: number;
  daysInMonth: number;
} {
  const d = new Date(iso + "T00:00:00.000Z");
  const dayOfMonth = d.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return { dayOfMonth, daysInMonth };
}

function relativeDay(iso: string): string {
  const diffMs = NOW_MS - Date.parse(iso);
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
}

function collectStaleLeads(leads: Lead[]): Lead[] {
  return leads
    .filter((l) => isOpenStage(l.stage))
    .filter(
      (l) =>
        (NOW_MS - Date.parse(l.lastActivityAt)) / 86_400_000 >=
        STALE_THRESHOLD_DAYS,
    )
    .sort((a, b) => a.lastActivityAt.localeCompare(b.lastActivityAt));
}
