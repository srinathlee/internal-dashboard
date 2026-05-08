"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Flame,
  IndianRupee,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatTimestamp, timeAgo } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import { useMyActivity, useMyOverview } from "@/lib/hooks/use-overview";
import { cn } from "@/lib/utils";
import type { ActivityItem, MyOverview } from "@/lib/api/types";

import { TeamOverviewScreen } from "./team-overview-screen";

/**
 * /performance — sales member's personal scoreboard.
 *
 * Backed by:
 *   GET /api/v1/sales/me/overview   (everything except the activity list)
 *   GET /api/v1/sales/me/activity   (the recent-activity list at the bottom)
 *
 * Sales admins and super admins land here too — for them we render a
 * lighter-weight stub since the team-scoped Performance view is a separate
 * design surface that hasn't been built out yet. When the team view is
 * ready it slots in by role at the top of this component.
 */
export function PerformanceScreen() {
  const auth = useAuth();
  const overview = useMyOverview();
  // The 30-pill default matches the hero header range; the activity card
  // pulls a window large enough to scroll inside its own surface without
  // pagination.
  const activity = useMyActivity({ limit: 50 });

  if (!auth.isLoaded) return <Skeleton />;

  if (!auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Performance" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You're signed out.
        </Card>
      </div>
    );
  }

  // Sales admins and super admins get the full Team Overview surface —
  // KPI strip, health cards, leaderboard, conversion table, roster and
  // activity feed. Members continue below with their personal overview.
  if (auth.user.role !== "member") {
    return <TeamOverviewScreen />;
  }

  if (overview.isLoading && !overview.data) return <Skeleton />;

  if (overview.error || !overview.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Performance" />
        <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
          Couldn't load your overview: {errorMessage(overview.error)}
        </Card>
      </div>
    );
  }

  return (
    <MemberPerformance
      data={overview.data}
      activity={activity.data?.activities ?? []}
      activityLoading={activity.isLoading}
      activityError={activity.error}
      onRefreshActivity={() => void activity.refetch()}
    />
  );
}

// ---------- Member view ----------

type RangeKey = "7d" | "30d" | "quarter";

function MemberPerformance({
  data,
  activity,
  activityLoading,
  activityError,
  onRefreshActivity,
}: {
  data: MyOverview;
  activity: ActivityItem[];
  activityLoading: boolean;
  activityError: Error | null;
  onRefreshActivity: () => void;
}) {
  // Range is purely a header label today — the API returns the period
  // implicitly, and there's no per-range endpoint yet. Keeping the toggle
  // wired to UI state so it lights up correctly when one is added.
  const [range, setRange] = useState<RangeKey>("30d");

  const { user, quota, today_panel, kpis, funnel } = data;
  const greeting = `${greetingForHour(new Date().getHours())}, ${user.name.split(" ")[0]}`;
  const subtitle =
    today_panel.hot_to_advance.count > 0
      ? `${today_panel.hot_to_advance.count} hot lead${today_panel.hot_to_advance.count === 1 ? "" : "s"} ready to push forward.`
      : today_panel.due_today.count > 0
        ? `${today_panel.due_today.count} action${today_panel.due_today.count === 1 ? "" : "s"} due today.`
        : "Nothing on fire — keep moving the funnel.";

  // ---- derived: pace projection ("you'll finish at 298/20") ----
  const expectedDone =
    quota.days_total > 0
      ? Math.round((quota.target_hospitals * quota.day_of_period) / quota.days_total)
      : 0;
  const projection =
    quota.day_of_period > 0
      ? Math.round((quota.hospitals_done * quota.days_total) / quota.day_of_period)
      : quota.hospitals_done;

  // ---- derived: funnel quick counts (right-side mini dashboard) ----
  const stageCount = (key: string): number =>
    funnel.stages.find((s) => s.key === key)?.count ?? 0;

  const newLeadsCount = stageCount("cold-lead") || stageCount("new-leads");
  const meetingsCount = stageCount("doctor-meeting") || stageCount("meeting");
  const sprintsOfferedCount =
    stageCount("sprint-started") || stageCount("sprint-offered");
  const subsCount =
    stageCount("subscription-closed") || stageCount("subscription");

  // ---- derived: conversion percentages ----
  const sprintConversion =
    funnel.conversions.find(
      (c) =>
        (c.from === "doctor-meeting" || c.from === "meeting") &&
        (c.to === "sprint-started" || c.to === "sprint-offered"),
    )?.pct ?? 0;
  const subscriptionConversion =
    funnel.conversions.find(
      (c) =>
        (c.from === "sprint-started" || c.from === "sprint-offered") &&
        (c.to === "subscription-closed" || c.to === "subscription"),
    )?.pct ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            My overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        </div>
        <RangeSegmented value={range} onChange={setRange} />
      </div>

      {/* Status row: due today / stale / hot */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatusCard
          accent="indigo"
          icon={ArrowRight}
          label="Due today"
          headline={
            today_panel.due_today.count > 0
              ? `${today_panel.due_today.count} action${today_panel.due_today.count === 1 ? "" : "s"}`
              : "Nothing due"
          }
          hint={
            today_panel.due_today.items[0]?.clinic_name ??
            "All caught up for today."
          }
        />
        <StatusCard
          accent="emerald"
          icon={CheckCircle2}
          label="Stale leads"
          headline={
            today_panel.stale_leads.count > 0
              ? `${today_panel.stale_leads.count} stale`
              : "Nothing stale"
          }
          hint={
            today_panel.stale_leads.count === 0
              ? "All looking good now. Nice work."
              : (today_panel.stale_leads.items[0]?.clinic_name ?? "—")
          }
        />
        <StatusCard
          accent="rose"
          icon={Flame}
          label="Hot leads to advance"
          headline={
            today_panel.hot_to_advance.items[0]?.clinic_name ??
            (today_panel.hot_to_advance.count > 0
              ? `${today_panel.hot_to_advance.count} hot`
              : "No hot leads")
          }
          hint={
            today_panel.hot_to_advance.count > 0
              ? `${today_panel.hot_to_advance.count} lead${today_panel.hot_to_advance.count === 1 ? "" : "s"} · touch base today`
              : "Move a meeting forward to surface heat."
          }
          right={
            today_panel.hot_to_advance.value > 0
              ? formatCurrency(today_panel.hot_to_advance.value, "INR")
              : undefined
          }
        />
      </div>

      {/* Quota progress card */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Monthly quota
              </p>
              <p className="text-base font-medium">Deals to close</p>
            </div>
          </div>
          <PaceBadge status={quota.pace_status} />
        </div>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">
            {quota.hospitals_done}
          </span>
          <span className="text-base text-zinc-500 tabular-nums">
            / {quota.target_hospitals}
          </span>
          <span className="text-sm text-zinc-500">
            {quota.completion_pct}% complete · Day {quota.day_of_period} /{" "}
            {quota.days_total}
          </span>
        </div>

        <ProgressBar
          done={quota.hospitals_done}
          target={quota.target_hospitals}
          marker={expectedDone}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>
            You should be at{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
              {expectedDone}
            </span>{" "}
            by today · {quota.days_remaining} days remaining
          </span>
          <span>
            At current pace, you'll finish at{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
              {projection}/{quota.target_hospitals}
            </span>
          </span>
        </div>
      </Card>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={Users}
          label="Total leads"
          value={kpis.total_leads.value.toString()}
        />
        <KpiTile
          icon={TrendingUp}
          label="Open pipeline"
          value={formatCurrency(kpis.open_pipeline.value, "INR")}
        />
        <KpiTile
          icon={Zap}
          label="Active sprints"
          value={kpis.active_sprints.value.toString()}
          hint={
            kpis.active_sprints.value === 0
              ? "Move a hot lead into Sprint to start."
              : undefined
          }
        />
        <KpiTile
          icon={Trophy}
          label="Win"
          value={formatCurrency(kpis.mrr.value, "INR")}
          hint={`${subsCount} closed`}
        />
      </div>

      {/* Funnel + Conversion */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-medium">My funnel</h2>
            <span className="text-xs text-zinc-500">This month</span>
          </div>

          <div className="mt-4 space-y-4">
            {funnel.stages.map((stage) => {
              const conv = funnel.conversions.find((c) => c.from === stage.key);
              const isBottleneck = funnel.bottleneck === stage.key;
              const max = funnel.stages.reduce(
                (m, s) => Math.max(m, s.count),
                0,
              );
              return (
                <FunnelRow
                  key={stage.key}
                  label={stage.label}
                  count={stage.count}
                  max={max}
                  conversionPct={conv?.pct}
                  bottleneck={isBottleneck}
                  accent={accentForStage(stage.key)}
                />
              );
            })}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-base font-medium">Conversion &amp; activity</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <MiniStat
              label="Sprint conversion"
              value={`${formatPct(sprintConversion)}%`}
            />
            <MiniStat
              label="Sprints → subscriptions"
              value={`${formatPct(subscriptionConversion)}%`}
            />
            <MiniStat
              label="Active subscriptions"
              value={subsCount.toString()}
            />
            <MiniStat
              label="Sprint offered"
              value={sprintsOfferedCount.toString()}
            />
            <MiniStat
              label="Meetings scheduled"
              value={meetingsCount.toString()}
            />
            <MiniStat label="New leads" value={newLeadsCount.toString()} />
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-medium">Recent activity</h2>
            <p className="text-xs text-zinc-500">
              {activity.length} {activity.length === 1 ? "entry" : "entries"}
              {activity.length === 50 ? "+ shown" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshActivity}
            disabled={activityLoading}
            aria-label="Refresh activity"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", activityLoading && "animate-spin")}
              aria-hidden
            />
          </button>
        </div>

        {activityError ? (
          <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
            Couldn't load activity: {errorMessage(activityError)}
          </p>
        ) : activity.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No activity yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {activity.map((a) => (
              <ActivityRow key={a.id} item={a} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------- Subcomponents ----------

function RangeSegmented({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}) {
  const opts: { value: RangeKey; label: string }[] = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "quarter", label: "Quarter" },
  ];
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
      {opts.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "h-7 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const ACCENT_BY_KEY = {
  indigo: {
    border: "border-indigo-200 dark:border-indigo-900/40",
    bg: "bg-indigo-50 dark:bg-indigo-950/20",
    icon: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
  emerald: {
    border: "border-emerald-200 dark:border-emerald-900/40",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  rose: {
    border: "border-rose-200 dark:border-rose-900/40",
    bg: "bg-rose-50 dark:bg-rose-950/20",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
} as const;

function StatusCard({
  accent,
  icon: Icon,
  label,
  headline,
  hint,
  right,
}: {
  accent: keyof typeof ACCENT_BY_KEY;
  icon: typeof ArrowRight;
  label: string;
  headline: string;
  hint?: string;
  right?: string;
}) {
  const c = ACCENT_BY_KEY[accent];
  return (
    <Card className={cn("p-4", c.border, c.bg)}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full",
            c.icon,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <p className="truncate text-base font-semibold">{headline}</p>
            {right ? (
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {right}
              </span>
            ) : null}
          </div>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-zinc-500">{hint}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function PaceBadge({ status }: { status: "on" | "behind" | "ahead" }) {
  const map = {
    on: {
      label: "On track",
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    behind: {
      label: "Behind",
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    },
    ahead: {
      label: "Ahead",
      cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    },
  } as const;
  const v = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        v.cls,
      )}
    >
      {v.label}
    </span>
  );
}

function ProgressBar({
  done,
  target,
  marker,
}: {
  done: number;
  target: number;
  marker?: number;
}) {
  // Cap at 100% for the bar, but the value above can exceed target — the
  // band visually saturates, the headline shows the real number.
  const pct = target > 0 ? Math.min(100, (done / target) * 100) : 0;
  const markerPct =
    target > 0 && marker !== undefined
      ? Math.min(100, (marker / target) * 100)
      : null;

  return (
    <div className="relative mt-4 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div
        className="h-full rounded-full bg-emerald-500"
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      {markerPct !== null ? (
        <div
          className="absolute -top-1 h-4 w-px bg-zinc-400"
          style={{ left: `${markerPct}%` }}
          aria-hidden
        >
          <span className="absolute -top-4 left-1 whitespace-nowrap text-[9px] font-medium text-zinc-500">
            ↓ Target: {marker}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </p>
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}

function FunnelRow({
  label,
  count,
  max,
  conversionPct,
  bottleneck,
  accent,
}: {
  label: string;
  count: number;
  max: number;
  conversionPct?: number;
  bottleneck: boolean;
  accent: string;
}) {
  const pct = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-zinc-500 tabular-nums">{count}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn("h-full rounded-full", accent)}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      {(conversionPct !== undefined || bottleneck) && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
          {conversionPct !== undefined && (
            <span className="text-zinc-500">
              {formatPct(conversionPct)}% conversion
            </span>
          )}
          {bottleneck && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="h-2.5 w-2.5" aria-hidden />
              Bottleneck
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const stageMove = parseStageMove(item.body);
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden
        className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {item.actor_name || "Unknown"}
          </span>
          <span title={formatTimestamp(item.occurred_at)}>
            {timeAgo(item.occurred_at, new Date().toISOString())}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
          {stageMove ? <StageMoveLine move={stageMove} /> : item.body}
        </p>
      </div>
    </li>
  );
}

function StageMoveLine({
  move,
}: {
  move: { clinic: string; from: string; to: string };
}) {
  return (
    <span>
      Moved {move.clinic} from{" "}
      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {move.from}
      </span>
      {" → "}
      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {move.to}
      </span>
    </span>
  );
}

// ---------- Helpers ----------

function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatPct(value: number): string {
  if (Number.isNaN(value)) return "0.0";
  return value.toFixed(1);
}

const FUNNEL_ACCENTS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
];

function accentForStage(key: string): string {
  // Stable color per stage key — hashes the key so a new stage doesn't
  // accidentally inherit a confusing color when the API swaps order.
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FUNNEL_ACCENTS[h % FUNNEL_ACCENTS.length]!;
}

/**
 * Best-effort parse of "Moved <clinic> from <FROM> → <TO>" so we can
 * render the stage labels as pills. Falls back to the raw body when the
 * pattern doesn't match.
 */
function parseStageMove(
  body: string,
): { clinic: string; from: string; to: string } | null {
  const m = body.match(/^Moved\s+(.+?)\s+from\s+(.+?)\s+(?:→|->|to)\s+(.+)$/i);
  if (!m) return null;
  return { clinic: m[1]!, from: m[2]!, to: m[3]!.replace(/\.$/, "") };
}

// ---------- Skeleton ----------

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-7 w-64 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-20 animate-pulse" />
        ))}
      </div>
      <Card className="h-32 animate-pulse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="h-72 animate-pulse lg:col-span-3" />
        <Card className="h-72 animate-pulse lg:col-span-2" />
      </div>
    </div>
  );
}
