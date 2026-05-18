"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Calendar,
  ChevronDown,
  ChevronRight,
  Hash,
  IndianRupee,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { formatCurrency } from "@/lib/format-metric";
import { cn } from "@/lib/utils";

type Period = "monthly" | "quarterly" | "half_yearly" | "yearly";
type Status = "ahead" | "on_track" | "behind" | "at_risk";

interface MetricRow {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actual: number;
  target: number;
  currency?: boolean;
}

interface PeriodData {
  daysTotal: number;
  daysElapsed: number;
  metrics: MetricRow[];
}

// Placeholder data — swap with a `useMyTargets(period)` hook once the
// backend endpoint is ready. The shape mirrors what the API will return:
// one snapshot per period with days-elapsed + per-metric actual/target.
const MOCK_DATA: Record<Period, PeriodData> = {
  monthly: {
    daysTotal: 30,
    daysElapsed: 14,
    metrics: [
      { key: "leads", title: "Leads", subtitle: "New leads generated", icon: Users, actual: 29, target: 30 },
      { key: "sprints_done", title: "Sprints done", subtitle: "Sprints completed", icon: Hash, actual: 5, target: 7 },
      { key: "sprint_amount", title: "Sprint amount", subtitle: "Revenue from sprints", icon: Wallet, actual: 11200, target: 15000, currency: true },
      { key: "revenue", title: "Revenue", subtitle: "Total revenue closed", icon: IndianRupee, actual: 5400, target: 5000, currency: true },
    ],
  },
  quarterly: {
    daysTotal: 91,
    daysElapsed: 44,
    metrics: [
      { key: "leads", title: "Leads", subtitle: "New leads generated", icon: Users, actual: 135, target: 120 },
      { key: "sprints_done", title: "Sprints done", subtitle: "Sprints completed", icon: Hash, actual: 18, target: 20 },
      { key: "sprint_amount", title: "Sprint amount", subtitle: "Revenue from sprints", icon: Wallet, actual: 34200, target: 45000, currency: true },
      { key: "revenue", title: "Revenue", subtitle: "Total revenue closed", icon: IndianRupee, actual: 16400, target: 15000, currency: true },
    ],
  },
  half_yearly: {
    daysTotal: 182,
    daysElapsed: 90,
    metrics: [
      { key: "leads", title: "Leads", subtitle: "New leads generated", icon: Users, actual: 229, target: 240 },
      { key: "sprints_done", title: "Sprints done", subtitle: "Sprints completed", icon: Hash, actual: 32, target: 40 },
      { key: "sprint_amount", title: "Sprint amount", subtitle: "Revenue from sprints", icon: Wallet, actual: 62000, target: 90000, currency: true },
      { key: "revenue", title: "Revenue", subtitle: "Total revenue closed", icon: IndianRupee, actual: 28000, target: 30000, currency: true },
    ],
  },
  yearly: {
    daysTotal: 365,
    daysElapsed: 168,
    metrics: [
      { key: "leads", title: "Leads", subtitle: "New leads generated", icon: Users, actual: 480, target: 480 },
      { key: "sprints_done", title: "Sprints done", subtitle: "Sprints completed", icon: Hash, actual: 55, target: 80 },
      { key: "sprint_amount", title: "Sprint amount", subtitle: "Revenue from sprints", icon: Wallet, actual: 110000, target: 180000, currency: true },
      { key: "revenue", title: "Revenue", subtitle: "Total revenue closed", icon: IndianRupee, actual: 48000, target: 60000, currency: true },
    ],
  },
};

const PERIOD_TABS: { id: Period; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "half_yearly", label: "Half-yearly" },
  { id: "yearly", label: "Yearly" },
];

const PERIOD_LABEL: Record<Period, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
};

export function MyTargetsScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>("quarterly");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const data = MOCK_DATA[period];

  const enriched = useMemo(
    () =>
      data.metrics.map((m) => {
        const pct = m.target > 0 ? (m.actual / m.target) * 100 : 0;
        return { ...m, pct, status: statusFor(pct) };
      }),
    [data],
  );

  const hit = enriched.filter((m) => m.pct >= 100).length;
  const behind = enriched.filter((m) => m.status === "behind").length;
  const atRisk = enriched.filter((m) => m.status === "at_risk").length;
  const overall = enriched.length
    ? enriched.reduce((s, m) => s + Math.min(120, m.pct), 0) / enriched.length
    : 0;
  const overallStatus = statusFor(overall);

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-20 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesMember(auth) || !auth.user) {
    return (
      <Card className="p-12 text-center text-sm text-zinc-500">
        You don't have permission to view this page.
      </Card>
    );
  }

  const user = auth.user;
  const daysLeft = Math.max(0, data.daysTotal - data.daysElapsed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-zinc-200 bg-zinc-50 text-base font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">My targets</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {user.name} · Sales Rep
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <Calendar className="h-4 w-4 text-zinc-500" aria-hidden />
          <span className="font-medium">
            Day {data.daysElapsed} of {data.daysTotal}
          </span>
          <span aria-hidden className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-zinc-500">{daysLeft} days left</span>
        </div>
      </div>

      {/* Period tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {PERIOD_TABS.map((t) => {
          const active = t.id === period;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setPeriod(t.id);
                setExpandedKey(null);
              }}
              aria-pressed={active}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverallCard
          pct={overall}
          hit={hit}
          total={enriched.length}
          status={overallStatus}
        />
        <StatCard
          label="Targets hit"
          value={hit}
          suffix={`/${enriched.length}`}
          tone={hit > 0 ? "emerald" : "zinc"}
        />
        <StatCard
          label="Behind"
          value={behind}
          tone={behind > 0 ? "amber" : "zinc"}
        />
        <StatCard
          label="At risk"
          value={atRisk}
          tone={atRisk > 0 ? "rose" : "zinc"}
        />
      </div>

      {/* Metric rows */}
      <div className="space-y-3">
        {enriched.map((m) => (
          <MetricCard
            key={m.key}
            metric={m}
            currentPeriod={period}
            daysElapsed={data.daysElapsed}
            daysTotal={data.daysTotal}
            expanded={expandedKey === m.key}
            onToggle={() =>
              setExpandedKey((cur) => (cur === m.key ? null : m.key))
            }
          />
        ))}
      </div>

      {/* Footer banner */}
      <FooterBanner status={overallStatus} />
    </div>
  );
}

// ---------- Pieces ----------

function OverallCard({
  pct,
  hit,
  total,
  status,
}: {
  pct: number;
  hit: number;
  total: number;
  status: Status;
}) {
  const display = Math.round(pct);
  const tone = statusTone(status);
  return (
    <Card className="flex items-center gap-5 p-5">
      <Donut pct={pct} colorClass={tone.ring} />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Overall
        </div>
        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
            {hit} of {total}
          </span>{" "}
          targets hit
        </div>
        <span
          className={cn(
            "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            tone.badgeBg,
            tone.badgeText,
          )}
        >
          {statusLabel(status)}
        </span>
        <span className="sr-only">{display}%</span>
      </div>
    </Card>
  );
}

function Donut({ pct, colorClass }: { pct: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const display = Math.round(pct);
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-zinc-200 dark:stroke-zinc-800"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className={colorClass}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-tight">
          <div className="text-base font-semibold tabular-nums">{display}%</div>
          <div className="text-[9px] uppercase tracking-wider text-zinc-500">
            On track
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: "emerald" | "amber" | "rose" | "zinc";
}) {
  const colorMap: Record<typeof tone, string> = {
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    zinc: "text-zinc-400 dark:text-zinc-500",
  };
  return (
    <Card className="p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cn("text-4xl font-semibold tabular-nums", colorMap[tone])}>
          {value}
        </span>
        {suffix ? (
          <span className="text-base text-zinc-400 tabular-nums">{suffix}</span>
        ) : null}
      </div>
    </Card>
  );
}

// ---------- Metric card (collapsed + expanded) ----------

interface EnrichedMetric extends MetricRow {
  pct: number;
  status: Status;
}

function MetricCard({
  metric,
  currentPeriod,
  daysElapsed,
  daysTotal,
  expanded,
  onToggle,
}: {
  metric: EnrichedMetric;
  currentPeriod: Period;
  daysElapsed: number;
  daysTotal: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = statusTone(metric.status);
  return (
    <Card className="overflow-hidden">
      <MetricHeader
        metric={metric}
        tone={tone}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded ? (
        <MetricDetail
          metric={metric}
          tone={tone}
          currentPeriod={currentPeriod}
          daysElapsed={daysElapsed}
          daysTotal={daysTotal}
        />
      ) : null}
    </Card>
  );
}

function MetricHeader({
  metric,
  tone,
  expanded,
  onToggle,
}: {
  metric: EnrichedMetric;
  tone: Tone;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = metric.icon;
  const fmt = formatterFor(metric);
  const barPct = Math.max(0, Math.min(100, metric.pct));
  const Chev = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-900/40 dark:focus-visible:bg-zinc-900/60 sm:px-5"
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{metric.title}</div>
            <div className="truncate text-xs text-zinc-500">{metric.subtitle}</div>
          </div>
          <div className="flex items-baseline gap-3 text-sm tabular-nums">
            <span>
              <span className="font-semibold">{fmt(metric.actual)}</span>{" "}
              <span className="text-zinc-500">of {fmt(metric.target)}</span>
            </span>
            <span
              className={cn(
                "font-semibold",
                metric.pct >= 100
                  ? "text-emerald-500"
                  : "text-zinc-700 dark:text-zinc-300",
              )}
            >
              {Math.round(metric.pct)}%
            </span>
          </div>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            aria-hidden
            className={cn("block h-full rounded-full", tone.barBg)}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <span
        className={cn(
          "ml-2 hidden shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
          tone.badgeBg,
          tone.badgeText,
        )}
      >
        {statusLabel(metric.status)}
      </span>

      <Chev
        aria-hidden
        className="h-4 w-4 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500"
      />
    </button>
  );
}

function MetricDetail({
  metric,
  tone,
  currentPeriod,
  daysElapsed,
  daysTotal,
}: {
  metric: EnrichedMetric;
  tone: Tone;
  currentPeriod: Period;
  daysElapsed: number;
  daysTotal: number;
}) {
  const fmt = formatterFor(metric);
  const expectedPct = daysTotal > 0 ? (daysElapsed / daysTotal) * 100 : 0;
  const pace = metric.pct - expectedPct;
  const remaining = Math.max(0, metric.target - metric.actual);
  const done = metric.actual >= metric.target;
  const barPct = Math.max(0, Math.min(100, metric.pct));
  const expectedClamped = Math.max(0, Math.min(100, expectedPct));

  const paceTone =
    pace >= 0
      ? {
          bg: "bg-emerald-50/40 dark:bg-emerald-950/30",
          border: "border-emerald-200/60 dark:border-emerald-900/40",
          text: "text-emerald-500",
        }
      : pace >= -15
        ? {
            bg: "bg-amber-50/40 dark:bg-amber-950/30",
            border: "border-amber-200/60 dark:border-amber-900/40",
            text: "text-amber-500",
          }
        : {
            bg: "bg-rose-50/40 dark:bg-rose-950/30",
            border: "border-rose-200/60 dark:border-rose-900/40",
            text: "text-rose-500",
          };
  const PaceArrow = pace >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="border-t border-zinc-200 px-4 py-5 dark:border-zinc-800 sm:px-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DetailTile label="Achieved" value={fmt(metric.actual)} />
        <DetailTile label="Target" value={fmt(metric.target)} />
        <DetailTile
          label="Remaining"
          value={done ? "Done!" : fmt(remaining)}
          valueClass={done ? "text-emerald-500" : undefined}
        />
        <DetailTile
          label="Pace"
          value={
            <span className={cn("inline-flex items-center gap-1", paceTone.text)}>
              <PaceArrow className="h-5 w-5" aria-hidden />
              {pace >= 0 ? "+" : ""}
              {Math.round(pace)}%
            </span>
          }
          className={cn("border", paceTone.border, paceTone.bg)}
        />
      </div>

      {/* Progress with expected marker */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Progress</span>
          <span className="tabular-nums text-zinc-500">
            {Math.round(metric.pct)}% of {fmt(metric.target)}
          </span>
        </div>
        <div className="relative mt-2 h-2.5 w-full overflow-visible rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            aria-hidden
            className={cn("absolute inset-y-0 left-0 rounded-full", tone.barBg)}
            style={{ width: `${barPct}%` }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-zinc-400 dark:bg-zinc-500"
            style={{ left: `${expectedClamped}%` }}
          />
          <span
            className="absolute mt-1 -translate-x-1/2 text-[10px] text-zinc-500"
            style={{ left: `${expectedClamped}%`, top: "100%" }}
          >
            expected
          </span>
        </div>
      </div>

      {/* All periods */}
      <div className="mt-8">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          All periods
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(MOCK_DATA) as Period[]).map((p) => {
            const row = MOCK_DATA[p].metrics.find((x) => x.key === metric.key);
            if (!row) return null;
            return (
              <PeriodMiniCard
                key={p}
                period={p}
                metric={row}
                isCurrent={p === currentPeriod}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailTile({
  label,
  value,
  valueClass,
  className,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-zinc-50/40 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40",
        className,
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums",
          valueClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PeriodMiniCard({
  period,
  metric,
  isCurrent,
}: {
  period: Period;
  metric: MetricRow;
  isCurrent: boolean;
}) {
  const fmt = formatterFor(metric);
  const pct = metric.target > 0 ? (metric.actual / metric.target) * 100 : 0;
  const status = statusFor(pct);
  const tone = statusTone(status);
  const barPct = Math.max(0, Math.min(100, pct));
  return (
    <div
      className={cn(
        "rounded-lg border bg-zinc-50/40 px-4 py-3 dark:bg-zinc-900/40",
        isCurrent
          ? "border-violet-400/60 dark:border-violet-500/50"
          : "border-zinc-200 dark:border-zinc-800",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {PERIOD_LABEL[period]}
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            tone.badgeBg,
            tone.badgeText,
          )}
        >
          {statusLabel(status)}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {fmt(metric.actual)}
      </div>
      <div className="text-xs text-zinc-500">of {fmt(metric.target)}</div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
        <span
          aria-hidden
          className={cn("block h-full rounded-full", tone.barBg)}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

function formatterFor(metric: MetricRow): (n: number) => string {
  return metric.currency
    ? (n) => formatCurrency(n, "INR")
    : (n) => n.toLocaleString("en-IN");
}

function FooterBanner({ status }: { status: Status }) {
  const tone = statusTone(status);
  const copy = bannerCopy(status);
  return (
    <Card
      className={cn(
        "flex items-start gap-3 border p-4 sm:p-5",
        tone.bannerBorder,
        tone.bannerBg,
      )}
    >
      <Award className={cn("h-5 w-5 shrink-0", tone.bannerIcon)} aria-hidden />
      <div className="min-w-0">
        <div className={cn("text-sm font-semibold", tone.bannerTitle)}>
          {copy.title}
        </div>
        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
          {copy.body}
        </p>
      </div>
    </Card>
  );
}

// ---------- Status helpers ----------

function statusFor(pct: number): Status {
  if (pct >= 100) return "ahead";
  if (pct >= 70) return "on_track";
  if (pct >= 40) return "behind";
  return "at_risk";
}

function statusLabel(s: Status): string {
  switch (s) {
    case "ahead":
      return "Ahead";
    case "on_track":
      return "On track";
    case "behind":
      return "Behind";
    case "at_risk":
      return "At risk";
  }
}

interface Tone {
  ring: string;
  barBg: string;
  badgeBg: string;
  badgeText: string;
  bannerBg: string;
  bannerBorder: string;
  bannerIcon: string;
  bannerTitle: string;
}

function statusTone(s: Status): Tone {
  switch (s) {
    case "ahead":
      return {
        ring: "stroke-emerald-500",
        barBg: "bg-emerald-500",
        badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
        badgeText: "text-emerald-700 dark:text-emerald-300",
        bannerBg: "bg-emerald-50/60 dark:bg-emerald-950/30",
        bannerBorder: "border-emerald-200 dark:border-emerald-900/50",
        bannerIcon: "text-emerald-500",
        bannerTitle: "text-emerald-700 dark:text-emerald-300",
      };
    case "on_track":
      return {
        ring: "stroke-zinc-400 dark:stroke-zinc-500",
        barBg: "bg-zinc-400 dark:bg-zinc-500",
        badgeBg: "bg-zinc-100 dark:bg-zinc-800",
        badgeText: "text-zinc-700 dark:text-zinc-300",
        bannerBg: "bg-zinc-50/60 dark:bg-zinc-900/40",
        bannerBorder: "border-zinc-200 dark:border-zinc-800",
        bannerIcon: "text-zinc-500",
        bannerTitle: "text-zinc-900 dark:text-zinc-100",
      };
    case "behind":
      return {
        ring: "stroke-amber-500",
        barBg: "bg-amber-500",
        badgeBg: "bg-amber-50 dark:bg-amber-950/40",
        badgeText: "text-amber-700 dark:text-amber-300",
        bannerBg: "bg-amber-50/60 dark:bg-amber-950/30",
        bannerBorder: "border-amber-200 dark:border-amber-900/50",
        bannerIcon: "text-amber-500",
        bannerTitle: "text-amber-700 dark:text-amber-300",
      };
    case "at_risk":
      return {
        ring: "stroke-rose-500",
        barBg: "bg-rose-500",
        badgeBg: "bg-rose-50 dark:bg-rose-950/40",
        badgeText: "text-rose-700 dark:text-rose-300",
        bannerBg: "bg-rose-50/60 dark:bg-rose-950/30",
        bannerBorder: "border-rose-200 dark:border-rose-900/50",
        bannerIcon: "text-rose-500",
        bannerTitle: "text-rose-700 dark:text-rose-300",
      };
  }
}

function bannerCopy(status: Status): { title: string; body: string } {
  switch (status) {
    case "ahead":
      return {
        title: "You're on track across all targets",
        body: "Keep up the momentum for the rest of the period.",
      };
    case "on_track":
      return {
        title: "Tracking close to your targets",
        body: "A steady pace will get you across the line.",
      };
    case "behind":
      return {
        title: "A few targets need attention",
        body: "Focus on the metrics flagged behind to close the gap.",
      };
    case "at_risk":
      return {
        title: "Several targets at risk",
        body: "Talk to your manager and prioritize the lowest progress items.",
      };
  }
}
