"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Flame,
  Minus,
  Phone,
  RefreshCw,
  StickyNote,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { aggregateMetricsForKey, getDateWindow } from "@/lib/aggregations";
import { formatCurrency, progressPct, timeAgo } from "@/lib/format-metric";
import {
  REFERENCE_DATE,
  getMetricsForUser,
  getTargetForUser,
  getUser,
} from "@/lib/mock-data";
import { LEAD_STAGE_LABEL, leads as seedLeads } from "@/lib/sales-leads-data";
import { isOpenStage } from "@/lib/sales-pipeline";
import { cn } from "@/lib/utils";
import type { Lead, LeadStage, LeadTimelineEvent, User } from "@/lib/types";

import { DateRangeFilter, type DateRangeKey } from "./date-range-filter";

const NOW_ISO = `${REFERENCE_DATE}T12:00:00.000Z`;
const NOW_MS = Date.parse(NOW_ISO);
const STALE_THRESHOLD_DAYS = 7;

interface Props {
  user: User;
  range: DateRangeKey;
  onRangeChange: (k: DateRangeKey) => void;
}

/**
 * Sales-member performance view.
 *
 * Layout follows the design brief: action cards → monthly quota with pace
 * projection → KPI tiles with trend pills and sparklines → funnel with
 * conversion deltas and bottleneck call-outs → activity feed. Color is
 * scoped to icons, accent borders, and bar fills via a single Tone token
 * map so the page reads as one dashboard rather than a rainbow.
 */
export function SalesMemberPerformance({ user, range, onRangeChange }: Props) {
  const window = getDateWindow(range);

  const myLeads = useMemo(
    () => seedLeads.filter((l) => l.ownerId === user.id),
    [user.id],
  );

  const dueToday = useMemo(
    () => myLeads.filter((l) => Boolean(l.nextAction)),
    [myLeads],
  );
  const staleLeads = useMemo(
    () =>
      myLeads.filter((l) => {
        if (!isOpenStage(l.stage)) return false;
        const ageDays = (NOW_MS - Date.parse(l.lastActivityAt)) / 86_400_000;
        return ageDays >= STALE_THRESHOLD_DAYS;
      }),
    [myLeads],
  );
  const hotLeads = useMemo(
    () =>
      myLeads
        .filter((l) => l.stage === "hot-lead")
        .sort((a, b) => b.value - a.value),
    [myLeads],
  );
  const hotValue = hotLeads.reduce((sum, l) => sum + l.value, 0);

  const myMetrics = useMemo(
    () => getMetricsForUser(user.id, { from: window.from, to: window.to }),
    [user.id, window.from, window.to],
  );
  const target = getTargetForUser(user.id);

  // KPI: derived figures + previous-period delta for the trend pill.
  const closedWonLeads = myLeads.filter((l) => l.stage === "subscription-closed");
  const totalLeads = myLeads.length;
  const openPipelineValue = myLeads
    .filter((l) => isOpenStage(l.stage))
    .reduce((sum, l) => sum + l.value, 0);
  const activeSprints = myLeads.filter(
    (l) => l.stage === "sprint-started" || l.stage === "sprint-review",
  ).length;
  const winValue = closedWonLeads.reduce((sum, l) => sum + l.value, 0);

  const dealsClosedThis = aggregateMetricsForKey(myMetrics, "dealsClosed", "sum");
  const dealsClosedPrev = useMemo(() => {
    const span = Math.max(
      1,
      Math.round(
        (Date.parse(window.to + "T00:00:00.000Z") -
          Date.parse(window.from + "T00:00:00.000Z")) /
          86_400_000,
      ) + 1,
    );
    const prevTo = shiftDate(window.from, -1);
    const prevFrom = shiftDate(prevTo, -(span - 1));
    const rows = getMetricsForUser(user.id, { from: prevFrom, to: prevTo });
    return aggregateMetricsForKey(rows, "dealsClosed", "sum");
  }, [user.id, window.from, window.to]);

  const revenueThis = aggregateMetricsForKey(myMetrics, "revenue", "sum");

  // Monthly quota — pace + projection.
  const dealsTarget = target?.values.dealsClosed ?? 0;
  const monthInfo = monthProgress(REFERENCE_DATE);
  const expectedByToday = dealsTarget * (monthInfo.dayOfMonth / monthInfo.daysInMonth);
  const projectedEnd =
    monthInfo.dayOfMonth === 0
      ? 0
      : Math.round(dealsClosedThis * (monthInfo.daysInMonth / monthInfo.dayOfMonth));
  const quotaPct = dealsTarget ? progressPct(dealsClosedThis, dealsTarget) : 0;
  const atRisk = dealsTarget > 0 && projectedEnd < dealsTarget;
  const quotaTone: Tone = atRisk ? "rose" : quotaPct >= 80 ? "emerald" : "amber";

  const sparkRevenue = useMemo(() => buildSpark(myMetrics, "revenue"), [myMetrics]);
  const sparkDeals = useMemo(() => buildSpark(myMetrics, "dealsClosed"), [myMetrics]);

  // Funnel — bucket counts + conversion ratios.
  const funnel = useMemo(() => buildFunnel(myLeads), [myLeads]);

  const recentActivity = useMemo(() => collectRecentActivity(myLeads), [myLeads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            My overview
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Good {greetingPart()}, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-zinc-500">
            {greetingTagline(atRisk, hotLeads.length)}
          </p>
        </div>
        <DateRangeFilter value={range} onChange={onRangeChange} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionCard
          tone={dueToday.length === 0 ? "emerald" : "indigo"}
          icon={dueToday.length === 0 ? CheckCircle2 : ArrowRight}
          label="Due today"
          headline={
            dueToday.length === 0
              ? "All caught up"
              : `${dueToday.length} action${dueToday.length === 1 ? "" : "s"}`
          }
          subtitle={
            dueToday.length === 0
              ? "Nothing on the list — go own the pipeline."
              : firstClinic(dueToday)
          }
        />
        <ActionCard
          tone={staleLeads.length === 0 ? "emerald" : "amber"}
          icon={staleLeads.length === 0 ? CheckCircle2 : CalendarClock}
          label="Stale leads"
          headline={
            staleLeads.length === 0
              ? "Nothing stale"
              : `${staleLeads.length} need${staleLeads.length === 1 ? "s" : ""} a touch`
          }
          subtitle={
            staleLeads.length === 0
              ? "All looking good now. Nice work."
              : `Oldest: ${firstClinic(staleLeads)}`
          }
        />
        <ActionCard
          tone="rose"
          icon={Flame}
          label="Hot leads to advance"
          headline={
            hotLeads.length === 0
              ? "No hot leads yet"
              : firstClinic(hotLeads)
          }
          subtitle={
            hotLeads.length === 0
              ? "Move pitch-delivered leads here when ready."
              : `${hotLeads.length} lead${hotLeads.length === 1 ? "" : "s"} · touch base today`
          }
          trailing={
            hotLeads.length > 0 && hotValue > 0 ? (
              <span className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                {formatCurrency(hotValue, "INR")}
              </span>
            ) : null
          }
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                TONE_BG[quotaTone],
                TONE_FG[quotaTone],
              )}
            >
              <Target className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Monthly quota
              </div>
              <div className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                Deals to close
              </div>
            </div>
          </div>
          {atRisk ? (
            <span className="inline-flex h-6 items-center rounded-full bg-rose-50 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              At risk
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-full bg-emerald-50 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              On track
            </span>
          )}
        </div>

        <div className="px-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {Math.round(dealsClosedThis)}
            </span>
            <span className="text-base text-zinc-400 tabular-nums">
              / {dealsTarget}
            </span>
            <span className="ml-3 text-xs text-zinc-500 tabular-nums">
              {Math.round(quotaPct)}% complete · Day {monthInfo.dayOfMonth} / {monthInfo.daysInMonth}
            </span>
          </div>
          <QuotaBar
            valuePct={quotaPct}
            targetPct={Math.min(100, (expectedByToday / Math.max(dealsTarget, 1)) * 100)}
            tone={quotaTone}
            targetLabel={`Target: ${Math.round(expectedByToday)}`}
          />
        </div>

        <div className="flex flex-col gap-1 border-t border-zinc-200 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <span className="text-zinc-500">
            You should be at{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {Math.round(expectedByToday)}
            </span>{" "}
            by today · {monthInfo.daysInMonth - monthInfo.dayOfMonth} days remaining
          </span>
          <span
            className={cn(
              "tabular-nums",
              atRisk
                ? "text-rose-700 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400",
            )}
          >
            At current pace, you'll finish at {projectedEnd}/{dealsTarget}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total leads"
          value={String(totalLeads)}
          icon={Users}
          tone="sky"
          spark={sparkDeals}
          trend={deltaPct(dealsClosedThis, dealsClosedPrev)}
          trendDirection="higher"
        />
        <KpiTile
          label="Open pipeline"
          value={formatCurrency(openPipelineValue, "INR")}
          icon={TrendingUp}
          tone="indigo"
          spark={sparkRevenue}
          trend={deltaPct(revenueThis, dealsClosedPrev * 1000)}
          trendDirection="higher"
        />
        <KpiTile
          label="Active sprints"
          value={String(activeSprints)}
          icon={Zap}
          tone="violet"
          emptyHint={
            activeSprints === 0
              ? "Move a hot lead into Sprint to start."
              : undefined
          }
        />
        <KpiTile
          label="Win"
          value={formatCurrency(winValue, "INR")}
          icon={Trophy}
          tone="emerald"
          emptyHint={
            closedWonLeads.length === 0
              ? "Convert your first sprint to start earning."
              : `${closedWonLeads.length} closed`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">My funnel</h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              This month
            </span>
          </div>
          <div className="mt-5 space-y-5">
            {funnel.rows.map((row, idx) => (
              <FunnelRow
                key={row.label}
                row={row}
                conversion={funnel.conversions[idx] ?? null}
                bottleneck={funnel.bottleneckIndex === idx}
                max={funnel.max}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold tracking-tight">
            Conversion &amp; activity
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <ConversionStat
              label="Sprint conversion"
              value={
                funnel.meetingsToSprints === null
                  ? "—"
                  : `${(funnel.meetingsToSprints * 100).toFixed(1)}%`
              }
            />
            <ConversionStat
              label="Sprints → subscriptions"
              value={
                funnel.sprintsToSubs === null
                  ? "—"
                  : `${(funnel.sprintsToSubs * 100).toFixed(1)}%`
              }
            />
            <ConversionStat
              label="Active subscriptions"
              value={String(funnel.subscriptionsCount)}
            />
            <ConversionStat
              label="Sprint offered"
              value={String(funnel.sprintsOfferedCount)}
            />
            <ConversionStat
              label="Meetings scheduled"
              value={String(funnel.meetingsCount)}
            />
            <ConversionStat
              label="New leads"
              value={String(funnel.newLeadsCount)}
            />
          </div>
        </Card>
      </div>

      <RecentActivityCard entries={recentActivity} />
    </div>
  );
}

const ACTIVITY_PAGE_SIZE = 7;

function RecentActivityCard({ entries }: { entries: ActivityRow[] }) {
  const [visible, setVisible] = useState(ACTIVITY_PAGE_SIZE);
  // `refreshKey` is a remount nudge so the list pops back to its first page
  // when refresh is clicked — there's no backend to re-fetch from yet, but the
  // gesture still feels right (resets paging, brief icon spin).
  const [refreshing, setRefreshing] = useState(false);

  const shown = entries.slice(0, Math.min(visible, entries.length));
  const hasMore = visible < entries.length;

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setVisible(ACTIVITY_PAGE_SIZE);
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">
            Recent activity
          </h2>
          <span className="text-xs text-zinc-400 tabular-nums">
            {entries.length} total
          </span>
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

      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No recent activity.
        </p>
      ) : (
        <>
          <ul
            role="list"
            className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800"
          >
            {shown.map((entry) => (
              <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <ActivityItem entry={entry} />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="mt-3 flex justify-center border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() =>
                  setVisible((v) => Math.min(entries.length, v + ACTIVITY_PAGE_SIZE))
                }
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Load more
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ---------- Sub-components -----------------------------------------------

type Tone = "indigo" | "amber" | "rose" | "sky" | "violet" | "emerald";

const TONE_BG: Record<Tone, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-950/40",
  amber: "bg-amber-50 dark:bg-amber-950/40",
  rose: "bg-rose-50 dark:bg-rose-950/40",
  sky: "bg-sky-50 dark:bg-sky-950/40",
  violet: "bg-violet-50 dark:bg-violet-950/40",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40",
};

const TONE_FG: Record<Tone, string> = {
  indigo: "text-indigo-600 dark:text-indigo-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  sky: "text-sky-600 dark:text-sky-400",
  violet: "text-violet-600 dark:text-violet-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
};

const TONE_BAR: Record<Tone, string> = {
  indigo: "bg-indigo-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
};

const TONE_ACCENT_LEFT: Record<Tone, string> = {
  indigo: "border-l-indigo-400",
  amber: "border-l-amber-400",
  rose: "border-l-rose-400",
  sky: "border-l-sky-400",
  violet: "border-l-violet-400",
  emerald: "border-l-emerald-400",
};

function ActionCard({
  tone,
  icon: Icon,
  label,
  headline,
  subtitle,
  trailing,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  headline: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Card className={cn("border-l-4 p-4", TONE_ACCENT_LEFT[tone])}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            TONE_BG[tone],
            TONE_FG[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {headline}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {subtitle}
          </div>
        </div>
        {trailing ? (
          <div className="shrink-0 self-center">{trailing}</div>
        ) : null}
      </div>
    </Card>
  );
}

function QuotaBar({
  valuePct,
  targetPct,
  tone,
  targetLabel,
}: {
  valuePct: number;
  targetPct: number;
  tone: Tone;
  targetLabel: string;
}) {
  return (
    <div className="mt-3">
      <div className="relative">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={cn("h-full transition-[width]", TONE_BAR[tone])}
            style={{ width: `${Math.min(100, valuePct)}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${Math.min(100, Math.max(0, targetPct))}%` }}
          aria-hidden
        >
          <div className="h-3 w-px bg-zinc-400" />
        </div>
      </div>
      <div
        className="relative mt-1 h-3 text-[10px] text-zinc-400"
        aria-hidden
      >
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${Math.min(100, Math.max(0, targetPct))}%` }}
        >
          ▾ {targetLabel}
        </span>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone,
  spark,
  trend,
  trendDirection,
  emptyHint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  spark?: { date: string; value: number }[];
  trend?: number | null;
  trendDirection?: "higher" | "lower";
  emptyHint?: string;
}) {
  const id = `spark-${tone}-${label.replace(/\s+/g, "-")}`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md",
            TONE_BG[tone],
            TONE_FG[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-1.5">
        {trend !== undefined && trend !== null ? (
          <TrendPill change={trend} betterWhen={trendDirection ?? "higher"} />
        ) : emptyHint ? (
          <div className="text-xs text-zinc-500">{emptyHint}</div>
        ) : null}
      </div>
      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-3 h-14">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={spark}
              margin={{ top: 4, bottom: 0, left: 0, right: 0 }}
            >
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SPARK_COLORS[tone]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SPARK_COLORS[tone]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="natural"
                dataKey="value"
                stroke={SPARK_COLORS[tone]}
                strokeWidth={2}
                fill={`url(#${id})`}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </Card>
  );
}

function TrendPill({
  change,
  betterWhen,
}: {
  change: number;
  betterWhen: "higher" | "lower";
}) {
  if (!Number.isFinite(change) || change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400">
        <Minus className="h-3 w-3" aria-hidden />
        No change
      </span>
    );
  }
  const goingUp = change > 0;
  const isGood =
    (goingUp && betterWhen === "higher") || (!goingUp && betterWhen === "lower");
  const Icon = goingUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        isGood
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(change).toFixed(0)}%
    </span>
  );
}

const SPARK_COLORS: Record<Tone, string> = {
  indigo: "#6366f1",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  emerald: "#10b981",
};

interface FunnelRowSpec {
  label: string;
  count: number;
  accent: Tone;
}

function FunnelRow({
  row,
  conversion,
  bottleneck,
  max,
}: {
  row: FunnelRowSpec;
  conversion: number | null;
  bottleneck: boolean;
  max: number;
}) {
  const pct = max === 0 ? 0 : (row.count / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {row.label}
        </span>
        <span className="tabular-nums text-zinc-500">{row.count}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={cn("h-full transition-[width]", TONE_BAR[row.accent])}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <span
          className={cn(
            "grid h-5 min-w-[1.25rem] place-items-center rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
            TONE_BG[row.accent],
            TONE_FG[row.accent],
          )}
        >
          {row.count}
        </span>
      </div>
      {conversion !== null ? (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="tabular-nums">
            {Math.round(conversion * 100)}% conversion
          </span>
          {bottleneck ? (
            <span className="inline-flex h-4 items-center rounded-full bg-rose-50 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              Bottleneck
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ConversionStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function ActivityItem({ entry }: { entry: ActivityRow }) {
  const actor = getUser(entry.actorId);
  const visual = ACTIVITY_VISUAL[entry.kind];
  const Icon = visual.icon;

  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md",
          visual.bg,
          visual.fg,
        )}
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {actor?.name.split(" ")[0]?.toLowerCase() ?? "someone"}
          </span>
          <span>{relativeDay(entry.timestamp)}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-700 dark:text-zinc-300">
          {entry.text}
        </p>
      </div>
    </div>
  );
}

type ActivityKind = "stage" | "call" | "meeting" | "note";

const ACTIVITY_VISUAL: Record<
  ActivityKind,
  { icon: LucideIcon; bg: string; fg: string }
> = {
  stage: {
    icon: ArrowRight,
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    fg: "text-emerald-600 dark:text-emerald-400",
  },
  call: {
    icon: Phone,
    bg: "bg-sky-50 dark:bg-sky-950/40",
    fg: "text-sky-600 dark:text-sky-400",
  },
  meeting: {
    icon: CalendarDays,
    bg: "bg-violet-50 dark:bg-violet-950/40",
    fg: "text-violet-600 dark:text-violet-400",
  },
  note: {
    icon: StickyNote,
    bg: "bg-zinc-100 dark:bg-zinc-800",
    fg: "text-zinc-600 dark:text-zinc-400",
  },
};

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

// ---------- Helpers ------------------------------------------------------

function greetingPart(): string {
  const h = new Date(NOW_ISO).getUTCHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function greetingTagline(atRisk: boolean, hot: number): string {
  if (atRisk) return "You can still hit quota — focus on hot leads today.";
  if (hot > 0) return `${hot} hot lead${hot === 1 ? "" : "s"} ready to push forward.`;
  return "Steady pace — keep building the pipeline.";
}

function firstClinic(leads: Lead[]): string {
  return leads[0]?.clinicName ?? "";
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthProgress(
  iso: string,
): { dayOfMonth: number; daysInMonth: number } {
  const d = new Date(iso + "T00:00:00.000Z");
  const dayOfMonth = d.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return { dayOfMonth, daysInMonth };
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function buildSpark(
  metrics: ReturnType<typeof getMetricsForUser>,
  key: string,
): { date: string; value: number }[] {
  return metrics
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.values[key] ?? 0 }));
}

function countByStage(leads: Lead[]): Record<LeadStage, number> {
  const out: Record<LeadStage, number> = {
    "cold-lead": 0,
    "first-contact": 0,
    "doctor-meeting": 0,
    "pitch-delivered": 0,
    "hot-lead": 0,
    "sprint-started": 0,
    "sprint-review": 0,
    "subscription-closed": 0,
    lost: 0,
  };
  for (const l of leads) out[l.stage] += 1;
  return out;
}

function buildFunnel(leads: Lead[]): {
  rows: FunnelRowSpec[];
  conversions: (number | null)[];
  bottleneckIndex: number | null;
  max: number;
  // Surfaced separately so the Conversion & activity card doesn't have to
  // re-derive these from the row labels.
  newLeadsCount: number;
  meetingsCount: number;
  sprintsCount: number;
  sprintsOfferedCount: number;
  subscriptionsCount: number;
  meetingsToSprints: number | null;
  sprintsToSubs: number | null;
} {
  const counts = countByStage(leads);
  const newLeadsCount =
    counts["cold-lead"] + counts["first-contact"] + counts["doctor-meeting"];
  const meetingsCount = counts["pitch-delivered"] + counts["hot-lead"];
  const sprintsCount = counts["sprint-started"] + counts["sprint-review"];
  const subscriptionsCount = counts["subscription-closed"];
  // "Offered" includes deals that have already closed since they passed
  // through the sprint stage on the way out.
  const sprintsOfferedCount = sprintsCount + subscriptionsCount;

  const rows: FunnelRowSpec[] = [
    { label: "Leads", count: newLeadsCount, accent: "sky" },
    { label: "Meetings", count: meetingsCount, accent: "violet" },
    { label: "Sprints", count: sprintsCount, accent: "amber" },
    { label: "Subscriptions", count: subscriptionsCount, accent: "emerald" },
  ];
  const conversions: (number | null)[] = rows.map((row, i) => {
    if (i === rows.length - 1) return null;
    const next = rows[i + 1]!;
    if (row.count === 0) return null;
    return next.count / row.count;
  });
  // Lowest non-null conversion that has a non-zero source — that's the choke
  // point reps should attack first.
  let bottleneckIndex: number | null = null;
  let lowest = Infinity;
  for (let i = 0; i < conversions.length; i++) {
    const c = conversions[i];
    if (c == null) continue;
    if (c < lowest) {
      lowest = c;
      bottleneckIndex = i;
    }
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  const meetingsToSprints =
    meetingsCount === 0 ? null : sprintsOfferedCount / meetingsCount;
  const sprintsToSubs =
    sprintsOfferedCount === 0 ? null : subscriptionsCount / sprintsOfferedCount;
  return {
    rows,
    conversions,
    bottleneckIndex,
    max,
    newLeadsCount: counts["cold-lead"],
    meetingsCount,
    sprintsCount,
    sprintsOfferedCount,
    subscriptionsCount,
    meetingsToSprints,
    sprintsToSubs,
  };
}

interface ActivityRow {
  id: string;
  text: string;
  timestamp: string;
  actorId: string;
  kind: ActivityKind;
}

function collectRecentActivity(leads: Lead[]): ActivityRow[] {
  const out: ActivityRow[] = [];
  for (const lead of leads) {
    for (const ev of lead.timeline) {
      out.push({
        id: ev.id,
        text: describeEvent(ev, lead),
        timestamp: ev.timestamp,
        actorId: ev.actorId,
        kind: kindFromEvent(ev),
      });
    }
  }
  out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return out;
}

function kindFromEvent(ev: LeadTimelineEvent): ActivityKind {
  if (ev.type === "stage-change") return "stage";
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
