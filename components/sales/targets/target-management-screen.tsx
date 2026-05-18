"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Hash,
  IndianRupee,
  Loader2,
  MinusCircle,
  Pencil,
  RotateCcw,
  Save,
  Target as TargetIcon,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useAssignTargets,
  useAssignTargetsMutation,
  useMetricCatalogue,
  useTargetReps,
} from "@/lib/hooks/use-metric-targets";
import type {
  MetricKey,
  MetricPeriod,
  TargetValuesMap,
} from "@/lib/api/sales-metric-targets";
import type {
  PeriodSnapshot,
  RevenuePeriod,
} from "@/lib/api/sales-revenue-targets";
import { cn } from "@/lib/utils";

import { MonitorTeamBoard } from "./monitor-team-board";

// ---------- Period model ---------------------------------------------------

export type Period = RevenuePeriod;

const PERIODS: { key: Period; label: string }[] = [
  { key: "DAILY", label: "Daily" },
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "QUARTERLY", label: "Quarterly" },
  { key: "YEARLY", label: "Yearly" },
];

const PERIOD_LABEL: Record<Period, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const PERIOD_HUMAN: Record<Period, string> = {
  DAILY: "Today",
  WEEKLY: "This Week",
  MONTHLY: "This Month",
  QUARTERLY: "This Quarter",
  YEARLY: "This Year",
};

const PERIOD_ICON: Record<Period, LucideIcon> = {
  DAILY: Zap,
  WEEKLY: Calendar,
  MONTHLY: CalendarDays,
  QUARTERLY: BarChart3,
  YEARLY: TargetIcon,
};

// How much of the current period has elapsed (0–100). Used for the
// "pace vs expected" stat — the backend doesn't pre-compute this since it
// changes minute-to-minute, so derive client-side.
function elapsedPctOf(period: Period): number {
  const now = new Date();
  switch (period) {
    case "DAILY":
      return Math.round(
        ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100,
      );
    case "WEEKLY": {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      return Math.round((day / 7) * 100);
    }
    case "MONTHLY": {
      const total = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return Math.round((now.getDate() / total) * 100);
    }
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), q * 3, 1);
      const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      const totalDays = Math.ceil(
        (qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const elapsedDays =
        Math.ceil((now.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24));
      return Math.round((elapsedDays / totalDays) * 100);
    }
    case "YEARLY": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
      return Math.round(
        ((now.getTime() - yearStart.getTime()) /
          (yearEnd.getTime() - yearStart.getTime())) *
          100,
      );
    }
  }
}

/**
 * "Day X of Y" / "Hour X of 24" summary for the current period. Lets each
 * tile show how far through the period we are in concrete units, not just
 * the elapsed percentage.
 */
function periodElapsedSummary(period: Period): {
  current: number;
  total: number;
  label: string;
} {
  const now = new Date();
  switch (period) {
    case "DAILY": {
      const hour = now.getHours() + 1; // 1..24, friendly count
      return { current: hour, total: 24, label: `Hour ${hour} of 24` };
    }
    case "WEEKLY": {
      // ISO week: Monday=1, Sunday=7
      const day = now.getDay() === 0 ? 7 : now.getDay();
      return { current: day, total: 7, label: `Day ${day} of 7` };
    }
    case "MONTHLY": {
      const total = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return {
        current: now.getDate(),
        total,
        label: `Day ${now.getDate()} of ${total}`,
      };
    }
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      const qStart = new Date(now.getFullYear(), q * 3, 1);
      const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
      const totalDays =
        Math.round((qEnd.getTime() - qStart.getTime()) / 86400000) + 1;
      const current =
        Math.floor((now.getTime() - qStart.getTime()) / 86400000) + 1;
      return { current, total: totalDays, label: `Day ${current} of ${totalDays}` };
    }
    case "YEARLY": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const current =
        Math.floor((now.getTime() - yearStart.getTime()) / 86400000) + 1;
      const y = now.getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const total = isLeap ? 366 : 365;
      return { current, total, label: `Day ${current} of ${total}` };
    }
  }
}

function periodEndsLabel(period: Period): { label: string; days: number } {
  const now = new Date();
  let end: Date;
  switch (period) {
    case "DAILY":
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
      break;
    case "WEEKLY": {
      const day = now.getDay();
      const daysUntilSun = day === 0 ? 0 : 7 - day;
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + daysUntilSun,
        23,
        59,
        59,
      );
      break;
    }
    case "MONTHLY":
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      break;
    }
    case "YEARLY":
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
  }
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const label =
    days === 0
      ? "Ends today"
      : days === 1
        ? "Ends tomorrow"
        : `Ends in ${days} days`;
  return { label, days };
}

// ---------- Pace-based status ----------------------------------------------
//
// The backend's `status` field bands by `achieved/target` ratio, which paints
// every rep "Behind" on day 1 of a period. We override it client-side with a
// *pace* model that compares achieved against what's expected by today —
// `expected = target * elapsed_fraction_of_period`. A rep at 5% achievement
// on day 1 (when expected is also ~5%) is "On Track", not "Behind".

type PaceStatus =
  | "JUST_STARTED"
  | "AHEAD"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "UNSET";

interface PaceResult {
  status: PaceStatus;
  /** `(achieved / expected) * 100`. 0 when just started / unset. */
  pace: number;
  /** Revenue the rep should have hit by now (`target * elapsed`). */
  expected: number;
  /** Fraction of the period elapsed, 0–1. */
  elapsed: number;
}

function isUnset(snap: PeriodSnapshot | null | undefined): boolean {
  return !snap || snap.target_amount <= 0 || snap.status === "UNSET";
}

function computePace(
  snapshot: PeriodSnapshot | null | undefined,
  period: Period,
): PaceResult {
  if (isUnset(snapshot)) {
    return { status: "UNSET", pace: 0, expected: 0, elapsed: 0 };
  }
  const target = snapshot!.target_amount;
  const achieved = snapshot!.actual_amount;
  // `elapsedPctOf` already returns 0–100 from real clock math; clamp to
  // [0, 1] so we don't divide by a near-zero or go past 100% after period end.
  const elapsed = Math.min(1, Math.max(0, elapsedPctOf(period) / 100));

  // Very early in the period: pace is meaningless (huge division), so we
  // bail out to a neutral "Just started" state per the spec.
  if (elapsed < 0.1) {
    return {
      status: "JUST_STARTED",
      pace: 0,
      expected: target * elapsed,
      elapsed,
    };
  }

  const expected = target * elapsed;
  if (expected <= 0) {
    return { status: "JUST_STARTED", pace: 0, expected: 0, elapsed };
  }

  const pace = (achieved / expected) * 100;
  let status: PaceStatus;
  if (pace >= 100) status = "AHEAD";
  else if (pace >= 90) status = "ON_TRACK";
  else if (pace >= 70) status = "AT_RISK";
  else status = "BEHIND";

  return { status, pace, expected, elapsed };
}

const STATUS_META: Record<
  PaceStatus,
  {
    label: string;
    pill: string;
    text: string;
    bar: string;
    icon: LucideIcon;
  }
> = {
  JUST_STARTED: {
    label: "Just started",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    text: "text-zinc-500 dark:text-zinc-400",
    bar: "bg-zinc-300 dark:bg-zinc-600",
    icon: Clock,
  },
  AHEAD: {
    label: "Ahead",
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    icon: CheckCircle2,
  },
  ON_TRACK: {
    label: "On Track",
    pill: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
    text: "text-zinc-700 dark:text-zinc-200",
    bar: "bg-zinc-500 dark:bg-zinc-400",
    icon: TrendingUp,
  },
  AT_RISK: {
    label: "At Risk",
    pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    icon: AlertTriangle,
  },
  BEHIND: {
    label: "Behind",
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    icon: TrendingDown,
  },
  UNSET: {
    label: "Unset",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    text: "text-zinc-400",
    bar: "bg-zinc-300",
    icon: MinusCircle,
  },
};

// ---------- Screen ---------------------------------------------------------

export function TargetManagementScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<"monitor" | "assign">("monitor");

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-16 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }
  if (auth.user?.role !== "super_admin") {
    return (
      <div className="space-y-6">
        <PageHeader title="Target management" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Target management is for super admins only.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target management"
        description="Track leads, sprint completion, and revenue targets across your team."
      />

      <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <TabButton
          active={tab === "monitor"}
          onClick={() => setTab("monitor")}
          icon={Activity}
          label="Monitor team"
        />
        <TabButton
          active={tab === "assign"}
          onClick={() => setTab("assign")}
          icon={TargetIcon}
          label="Assign targets"
        />
      </div>

      {tab === "monitor" ? <MonitorTeamBoard /> : <AssignTargetsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}


// =============================================================
// Single-rep detailed view
// =============================================================

export function SingleRepDetailedView({
  user,
  periods,
  activePeriod,
  onPeriodChange,
  profileHref,
}: {
  user: { id: string; name: string };
  periods: Partial<Record<Period, PeriodSnapshot | null>>;
  activePeriod: Period;
  onPeriodChange: (p: Period) => void;
  /**
   * When provided, renders a "Manage profile" link in the rep header that
   * deep-links into the team detail screen (which auto-opens the member
   * sheet via `?member=<id>`). Omit to hide the affordance — e.g. for the
   * rep's own My Targets view, where this isn't applicable.
   */
  profileHref?: string;
}) {
  const activeSnapshot = periods[activePeriod] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback
            className={cn(
              "text-xs font-semibold text-white",
              colorForId(user.id),
            )}
          >
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{user.name}</div>
          <div className="truncate text-xs text-zinc-500">Sales Rep</div>
        </div>
        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <UserCog className="h-3.5 w-3.5" aria-hidden />
            Manage profile
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PERIODS.map((p) => (
          <PeriodTile
            key={p.key}
            period={p.key}
            snapshot={periods[p.key] ?? null}
            active={p.key === activePeriod}
            onClick={() => onPeriodChange(p.key)}
          />
        ))}
      </div>

      <DetailedBreakdownCard
        period={activePeriod}
        snapshot={activeSnapshot}
      />
    </div>
  );
}

function PeriodTile({
  period,
  snapshot,
  active,
  onClick,
}: {
  period: Period;
  snapshot: PeriodSnapshot | null;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = PERIOD_ICON[period];
  const pace = computePace(snapshot, period);
  const elapsedSummary = periodElapsedSummary(period);
  const noTarget = pace.status === "UNSET";
  const justStarted = pace.status === "JUST_STARTED";
  const meta = STATUS_META[pace.status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white p-4 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-zinc-950",
        active
          ? "border-indigo-500 ring-2 ring-indigo-500/30 dark:border-indigo-400"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              active
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-400",
            )}
            aria-hidden
          />
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {PERIOD_HUMAN[period]}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            meta.pill,
          )}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-2 text-xl font-bold tabular-nums">
        {noTarget ? (
          <span className="text-base text-zinc-400">No target</span>
        ) : (
          formatCurrency(actual, "INR")
        )}
      </div>

      {!noTarget ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            className={cn("block h-full rounded-full", meta.bar)}
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      ) : null}

      <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-zinc-500">
        {noTarget ? (
          <div>Set from Assign targets · {elapsedSummary.label}</div>
        ) : (
          <>
            <div className="truncate">
              of {formatCurrency(target, "INR")} · {elapsedSummary.label}
            </div>
            {justStarted ? (
              <div className="truncate">
                Expected {formatCurrency(pace.expected, "INR")} by today
              </div>
            ) : (
              <div className="truncate">
                Expected {formatCurrency(pace.expected, "INR")} ·{" "}
                <span className={cn("font-semibold", meta.text)}>
                  {Math.round(pace.pace)}% pace
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}

function DetailedBreakdownCard({
  period,
  snapshot,
}: {
  period: Period;
  snapshot: PeriodSnapshot | null;
}) {
  const pace = computePace(snapshot, period);
  const elapsedSummary = periodElapsedSummary(period);
  const noTarget = pace.status === "UNSET";
  const justStarted = pace.status === "JUST_STARTED";
  const meta = STATUS_META[pace.status];
  const target = snapshot?.target_amount ?? 0;
  const actual = snapshot?.actual_amount ?? 0;
  const pct = snapshot?.progress_pct ?? 0;
  const ends = periodEndsLabel(period);

  // SVG ring math: r=42 → circumference ≈ 263.89
  const R = 42;
  const C = 2 * Math.PI * R;
  const clampedPct = Math.max(0, Math.min(100, pct));
  const dash = (clampedPct / 100) * C;

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {PERIOD_HUMAN[period]} revenue
            </div>
            <h3 className="mt-0.5 text-xl font-bold">Detailed breakdown</h3>
            <div className="mt-1 text-xs tabular-nums text-zinc-500">
              {elapsedSummary.label}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              ends.days <= 1
                ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/40"
                : ends.days <= 7
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40"
                  : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
            )}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {ends.label}
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  strokeWidth="9"
                  className="stroke-zinc-100 dark:stroke-zinc-800"
                />
                {!noTarget ? (
                  <circle
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    stroke="currentColor"
                    strokeDasharray={`${dash} ${C}`}
                    className={meta.text}
                  />
                ) : null}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    noTarget ? "text-zinc-400" : meta.text,
                  )}
                >
                  {noTarget ? "—" : `${pct}%`}
                </div>
                <div className="text-xs text-zinc-500">
                  {meta.label}
                </div>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                meta.pill,
              )}
            >
              <meta.icon className="h-3.5 w-3.5" aria-hidden />
              {meta.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Achieved"
              value={noTarget ? "—" : formatCurrency(actual, "INR")}
            />
            <StatTile
              label="Target"
              value={noTarget ? "—" : formatCurrency(target, "INR")}
            />
            <StatTile
              label="Expected by today"
              value={noTarget ? "—" : formatCurrency(pace.expected, "INR")}
              accent="sky"
            />
            <StatTile
              label="Pace"
              value={
                noTarget || justStarted
                  ? "—"
                  : `${Math.round(pace.pace)}%`
              }
              accent="sky"
              TrendIcon={
                noTarget || justStarted
                  ? undefined
                  : pace.pace >= 100
                    ? TrendingUp
                    : TrendingDown
              }
            />
          </div>
        </div>

        {!noTarget ? (
          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-zinc-500">
                Progress
              </span>
              <span className="text-xs font-semibold tabular-nums text-zinc-500">
                {pct}% of {formatCurrency(target, "INR")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span
                className={cn("block h-full rounded-full", meta.bar)}
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function StatTile({
  label,
  value,
  accent,
  TrendIcon,
}: {
  label: string;
  value: string;
  accent?: "rose" | "sky";
  TrendIcon?: LucideIcon;
}) {
  const tone =
    accent === "rose"
      ? "border-rose-200/60 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20"
      : accent === "sky"
        ? "border-sky-200/60 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20"
        : "border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40";
  const valueTone =
    accent === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : accent === "sky"
        ? "text-sky-600 dark:text-sky-400"
        : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className={cn("rounded-lg border p-4", tone)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums",
          valueTone,
        )}
      >
        {TrendIcon ? <TrendIcon className="h-5 w-5" aria-hidden /> : null}
        {value}
      </div>
    </div>
  );
}


// =============================================================
// Assign targets
// =============================================================
//
// Wired to the multi-metric API in `sales-metric-targets.ts`. Metric
// catalogue, rep list, and target values all come from the backend; the
// save call is a partial PUT so only changed cells are sent.

const ASSIGN_PERIODS: { key: MetricPeriod; label: string }[] = [
  { key: "MONTHLY", label: "Monthly" },
  { key: "QUARTERLY", label: "Quarterly" },
  { key: "HALF_YEARLY", label: "Half-yearly" },
  { key: "YEARLY", label: "Yearly" },
];

// Icon mapping is driven by `icon_hint` from the metric catalogue so the
// backend can introduce a new metric without a frontend deploy.
const METRIC_ICON_BY_HINT: Record<string, LucideIcon> = {
  users: Users,
  hash: Hash,
  wallet: Wallet,
  "indian-rupee": IndianRupee,
};

function metricIconFromHint(
  hint: string,
  fallbackUnit: "count" | "currency",
): LucideIcon {
  return (
    METRIC_ICON_BY_HINT[hint] ??
    (fallbackUnit === "currency" ? IndianRupee : Hash)
  );
}

function emptyPeriodValues(): Record<MetricPeriod, number> {
  return { MONTHLY: 0, QUARTERLY: 0, HALF_YEARLY: 0, YEARLY: 0 };
}

function AssignTargetsTab() {
  const catalogueQuery = useMetricCatalogue();
  const repsQuery = useTargetReps();
  const reps = useMemo(() => repsQuery.data ?? [], [repsQuery.data]);

  const metrics = useMemo(() => {
    const list = catalogueQuery.data?.metrics ?? [];
    return [...list].sort((a, b) => a.display_order - b.display_order);
  }, [catalogueQuery.data]);

  const [userId, setUserId] = useState<string>("");
  const assignQuery = useAssignTargets(userId || null);
  const { save } = useAssignTargetsMutation();

  const [working, setWorking] = useState<TargetValuesMap>(
    () => ({}) as TargetValuesMap,
  );
  const [initial, setInitial] = useState<TargetValuesMap>(
    () => ({}) as TargetValuesMap,
  );
  const [editing, setEditing] = useState<
    { key: MetricKey; period: MetricPeriod } | null
  >(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Default the rep selection to the first active rep once the list loads.
  useEffect(() => {
    if (userId) return;
    const firstActive = reps.find((r) => r.is_active) ?? reps[0];
    if (firstActive) setUserId(firstActive.id);
  }, [reps, userId]);

  // Sync working/initial state when the assign payload arrives. The backend
  // always returns every metric × period (filling missing ones with 0); we
  // still merge against the catalogue defensively in case a response omits
  // a metric the FE knows about.
  useEffect(() => {
    if (!assignQuery.data) return;
    const merged: TargetValuesMap = {} as TargetValuesMap;
    for (const m of metrics) {
      const fromServer = assignQuery.data.targets[m.key];
      merged[m.key] = {
        MONTHLY: fromServer?.MONTHLY ?? 0,
        QUARTERLY: fromServer?.QUARTERLY ?? 0,
        HALF_YEARLY: fromServer?.HALF_YEARLY ?? 0,
        YEARLY: fromServer?.YEARLY ?? 0,
      };
    }
    setWorking(merged);
    setInitial(JSON.parse(JSON.stringify(merged)) as TargetValuesMap);
    setEditing(null);
  }, [assignQuery.data, metrics]);

  const isDirty = useMemo(() => {
    for (const m of metrics) {
      for (const p of ASSIGN_PERIODS) {
        if (
          (working[m.key]?.[p.key] ?? 0) !== (initial[m.key]?.[p.key] ?? 0)
        ) {
          return true;
        }
      }
    }
    return false;
  }, [working, initial, metrics]);

  const selectedRep = reps.find((p) => p.id === userId) ?? null;
  const loading =
    catalogueQuery.isLoading ||
    repsQuery.isLoading ||
    (!!userId && assignQuery.isLoading && !assignQuery.data);
  const fatalError = catalogueQuery.error ?? repsQuery.error;

  const startEdit = (metricKey: MetricKey, period: MetricPeriod) => {
    setEditing({ key: metricKey, period });
    setEditValue(String(working[metricKey]?.[period] ?? 0));
  };

  const commitEdit = () => {
    if (!editing) return;
    const raw = Number(editValue);
    if (!Number.isFinite(raw) || raw < 0 || !Number.isInteger(raw)) {
      toast.error("Target must be a non-negative whole number");
      return;
    }
    setWorking((prev) => {
      const bucket = prev[editing.key] ?? emptyPeriodValues();
      return {
        ...prev,
        [editing.key]: { ...bucket, [editing.period]: raw },
      };
    });
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  const handleReset = () => {
    setWorking(JSON.parse(JSON.stringify(initial)) as TargetValuesMap);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!userId || !isDirty || saving) return;
    // Build a sparse patch — only send cells whose value actually changed,
    // matching the spec's "unmentioned cells are untouched" behavior.
    const patch: Partial<
      Record<MetricKey, Partial<Record<MetricPeriod, number>>>
    > = {};
    for (const m of metrics) {
      for (const p of ASSIGN_PERIODS) {
        const newV = working[m.key]?.[p.key] ?? 0;
        const oldV = initial[m.key]?.[p.key] ?? 0;
        if (newV !== oldV) {
          if (!patch[m.key]) patch[m.key] = {};
          patch[m.key]![p.key] = newV;
        }
      }
    }
    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    try {
      const res = await save(userId, patch);
      // Use the server response as the new baseline — keeps Reset accurate
      // even if the backend normalized values during the round-trip.
      const merged: TargetValuesMap = {} as TargetValuesMap;
      for (const m of metrics) {
        const fromServer = res.targets[m.key];
        merged[m.key] = {
          MONTHLY: fromServer?.MONTHLY ?? 0,
          QUARTERLY: fromServer?.QUARTERLY ?? 0,
          HALF_YEARLY: fromServer?.HALF_YEARLY ?? 0,
          YEARLY: fromServer?.YEARLY ?? 0,
        };
      }
      setWorking(merged);
      setInitial(JSON.parse(JSON.stringify(merged)) as TargetValuesMap);
      toast.success(
        res.changed_count === 1
          ? "1 target saved"
          : `${res.changed_count} targets saved`,
      );
    } catch (err) {
      toast.error("Couldn't save targets", {
        description: errorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  if (fatalError) {
    return (
      <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
        {errorMessage(fatalError)}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ---------- Header: rep selector + actions ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[240px] flex-1 sm:max-w-sm">
          <Select value={userId} onValueChange={(v) => setUserId(v)}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Pick a rep">
                {selectedRep ? (
                  <span className="inline-flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback
                        className={cn(
                          "text-[11px] font-semibold text-white",
                          colorForId(selectedRep.id),
                        )}
                      >
                        {getInitials(selectedRep.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">
                      {selectedRep.name}
                    </span>
                  </span>
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {reps.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="inline-flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback
                        className={cn(
                          "text-[9px] text-white",
                          colorForId(p.id),
                        )}
                      >
                        {getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn(!p.is_active && "text-zinc-400")}>
                      {p.name}
                      {!p.is_active ? " (inactive)" : ""}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="h-12 rounded-xl px-5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={!isDirty || saving || !userId}
            className="h-12 rounded-xl px-5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* ---------- Metric cards ---------- */}
      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-72 animate-pulse" />
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500">
          No metrics configured.
        </Card>
      ) : assignQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          {errorMessage(assignQuery.error)}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {metrics.map((metric) => (
            <MetricTargetCard
              key={metric.key}
              metricKey={metric.key}
              label={metric.label}
              unit={metric.unit}
              icon={metricIconFromHint(metric.icon_hint, metric.unit)}
              values={working[metric.key] ?? emptyPeriodValues()}
              initialValues={initial[metric.key] ?? emptyPeriodValues()}
              editing={editing}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartEdit={startEdit}
              onCommitEdit={commitEdit}
              onCancelEdit={cancelEdit}
              disabled={!userId || saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricTargetCard({
  metricKey,
  label,
  unit,
  icon: Icon,
  values,
  initialValues,
  editing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  disabled,
}: {
  metricKey: MetricKey;
  label: string;
  unit: "count" | "currency";
  icon: LucideIcon;
  values: Record<MetricPeriod, number>;
  initialValues: Record<MetricPeriod, number>;
  editing: { key: MetricKey; period: MetricPeriod } | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: (metricKey: MetricKey, period: MetricPeriod) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  disabled: boolean;
}) {
  const isCurrency = unit === "currency";
  const UnitIcon = isCurrency ? IndianRupee : Hash;

  const formatValue = (n: number): string =>
    isCurrency ? formatCurrency(n, "INR") : formatNumber(n);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <div className="inline-flex items-center gap-2.5">
          <Icon
            className="h-4 w-4 text-violet-500 dark:text-violet-400"
            aria-hidden
          />
          <h3 className="text-base font-semibold">{label}</h3>
        </div>
        <UnitIcon
          className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500"
          aria-hidden
        />
      </div>

      <div>
        {ASSIGN_PERIODS.map((p, idx) => {
          const value = values[p.key] ?? 0;
          const original = initialValues[p.key] ?? 0;
          const dirty = value !== original;
          const isEditing =
            editing?.key === metricKey && editing.period === p.key;

          return (
            <div
              key={p.key}
              className={cn(
                "flex items-center justify-between gap-3 px-5 py-3.5",
                idx > 0 && "border-t border-zinc-100 dark:border-zinc-800",
              )}
            >
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {p.label}
              </span>

              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <UnitIcon
                      className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400"
                      aria-hidden
                    />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      autoFocus
                      value={editValue}
                      onChange={(e) => onEditValueChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onCommitEdit();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          onCancelEdit();
                        }
                      }}
                      className="h-8 w-28 pl-6 text-right text-sm tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onCommitEdit}
                    aria-label="Apply"
                    className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    aria-label="Cancel"
                    className="grid h-7 w-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-base font-bold tabular-nums",
                      dirty
                        ? "text-indigo-600 dark:text-indigo-400"
                        : value > 0
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-400",
                    )}
                  >
                    {value > 0 ? formatValue(value) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onStartEdit(metricKey, p.key)}
                    disabled={disabled}
                    aria-label={`Edit ${p.label.toLowerCase()} ${label.toLowerCase()} target`}
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition-colors",
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Avatar colour palette ------------------------------------------

const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-teal-500",
];

function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}
