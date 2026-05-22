"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  Hash,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useMetricCatalogue,
  useRepMetricDetail,
} from "@/lib/hooks/use-metric-targets";
import type {
  MetricCellSnapshot,
  MetricDefinition,
  MetricKey,
  MetricPeriod,
} from "@/lib/api/sales-metric-targets";
import { cn } from "@/lib/utils";

const PERIODS: { key: MetricPeriod; label: string }[] = [
  { key: "MONTHLY", label: "Monthly" },
  { key: "QUARTERLY", label: "Quarterly" },
  { key: "HALF_YEARLY", label: "Half-yearly" },
  { key: "YEARLY", label: "Yearly" },
];

const ICON_BY_HINT: Record<string, LucideIcon> = {
  users: Users,
  hash: Hash,
  wallet: Wallet,
  "indian-rupee": IndianRupee,
};

function metricIcon(def: MetricDefinition): LucideIcon {
  return (
    ICON_BY_HINT[def.icon_hint] ??
    (def.unit === "currency" ? IndianRupee : Hash)
  );
}

type Vis = "good" | "track" | "warn" | "bad" | "idle";

function visFor(status: string): Vis {
  switch (status) {
    case "ACHIEVED":
    case "AHEAD":
      return "good";
    case "ON_TRACK":
      return "track";
    case "AT_RISK":
      return "warn";
    case "BEHIND":
      return "bad";
    default:
      return "idle";
  }
}

const STATUS_LABEL: Record<string, string> = {
  ACHIEVED: "Achieved",
  AHEAD: "Ahead",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BEHIND: "Behind",
  JUST_STARTED: "Just started",
  UNSET: "Unset",
};

const VIS: Record<
  Vis,
  { text: string; bar: string; pill: string; dot: string; ring: string }
> = {
  good: {
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    ring: "ring-emerald-300 dark:ring-emerald-800",
  },
  track: {
    text: "text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    dot: "bg-blue-500",
    ring: "ring-blue-300 dark:ring-blue-800",
  },
  warn: {
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    dot: "bg-amber-500",
    ring: "ring-amber-300 dark:ring-amber-800",
  },
  bad: {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    pill: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    dot: "bg-rose-500",
    ring: "ring-rose-300 dark:ring-rose-800",
  },
  idle: {
    text: "text-zinc-400",
    bar: "bg-zinc-300 dark:bg-zinc-700",
    pill: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
    ring: "ring-zinc-200 dark:ring-zinc-700",
  },
};

function fmtVal(v: number, def: MetricDefinition): string {
  return def.unit === "currency" ? formatCurrency(v, "INR") : formatNumber(v);
}

/**
 * Targets tab — the rep's full multi-metric target management (4 metrics ×
 * 4 periods) from /sales/targets/monitor/:userId. Distinct layout from the
 * board's ring view: selectable metric cards + a linear progress rail with an
 * "expected by now" marker + an all-periods matrix.
 */
export function RepTargetsTab({ repId }: { repId: string }) {
  const catalogue = useMetricCatalogue();
  const detailQuery = useRepMetricDetail(repId);

  const metrics = useMemo<MetricDefinition[]>(
    () =>
      [...(catalogue.data?.metrics ?? [])].sort(
        (a, b) => a.display_order - b.display_order,
      ),
    [catalogue.data],
  );

  const [metricKey, setMetricKey] = useState<MetricKey | null>(null);
  const [period, setPeriod] = useState<MetricPeriod>("MONTHLY");

  const activeMetric = metricKey ?? metrics[0]?.key ?? "leads";

  if (
    (catalogue.isLoading && !catalogue.data) ||
    (detailQuery.isLoading && !detailQuery.data)
  ) {
    return <Card className="h-96 animate-pulse" />;
  }
  if (catalogue.error || detailQuery.error) {
    return (
      <Card className="p-8 text-center text-sm text-rose-600 dark:text-rose-400">
        Couldn&apos;t load targets:{" "}
        {errorMessage(catalogue.error ?? detailQuery.error)}
      </Card>
    );
  }
  const detail = detailQuery.data;
  if (!detail || metrics.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-zinc-500">
        No targets configured for this rep yet.
      </Card>
    );
  }

  const metricDef = metrics.find((m) => m.key === activeMetric) ?? metrics[0]!;
  const snapshot = detail.metrics[activeMetric]?.[period];
  const win = detail.periods[period];

  return (
    <div className="space-y-5">
      {/* Metric selector cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => {
          const snap = detail.metrics[m.key]?.[period];
          const vis = visFor(snap?.status ?? "UNSET");
          const Icon = metricIcon(m);
          const active = m.key === activeMetric;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                active
                  ? "border-violet-400 bg-violet-50/40 ring-1 ring-violet-300 dark:border-violet-700 dark:bg-violet-950/20 dark:ring-violet-800"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-zinc-400" aria-hidden />
                <span className={cn("h-2 w-2 rounded-full", VIS[vis].dot)} />
              </div>
              <div className="mt-2 truncate text-xs font-medium text-zinc-500">
                {m.label}
              </div>
              <div
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  VIS[vis].text,
                )}
              >
                {snap ? `${snap.progress_pct}%` : "—"}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span
                  className={cn("block h-full rounded-full", VIS[vis].bar)}
                  style={{
                    width: `${Math.max(0, Math.min(100, snap?.progress_pct ?? 0))}%`,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Period selector + days left */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-950">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.key
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {win ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {win.days_remaining} days left
          </span>
        ) : null}
      </div>

      {/* Detail rail */}
      {snapshot ? (
        <DetailRail
          metricDef={metricDef}
          snapshot={snapshot}
          period={period}
        />
      ) : (
        <Card className="p-8 text-center text-sm text-zinc-500">
          No data for this period.
        </Card>
      )}

      {/* All periods matrix */}
      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          All periods · {metricDef.label}
        </div>
        <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
          {PERIODS.map((p) => {
            const snap = detail.metrics[activeMetric]?.[p.key];
            const vis = visFor(snap?.status ?? "UNSET");
            const unset = !snap || snap.target <= 0;
            const pct = Math.max(0, Math.min(100, snap?.progress_pct ?? 0));
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
                  period === p.key && "bg-zinc-50 dark:bg-zinc-900/50",
                )}
              >
                <span className="w-24 shrink-0 text-sm font-medium">
                  {p.label}
                </span>
                <span className="w-28 shrink-0 text-sm tabular-nums text-zinc-500">
                  {unset ? (
                    "Target not set"
                  ) : (
                    <>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {fmtVal(snap!.actual, metricDef)}
                      </span>{" "}
                      / {fmtVal(snap!.target, metricDef)}
                    </>
                  )}
                </span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <span
                    className={cn("block h-full rounded-full", VIS[vis].bar)}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span
                  className={cn(
                    "w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-medium",
                    VIS[vis].pill,
                  )}
                >
                  {STATUS_LABEL[snap?.status ?? "UNSET"]}
                </span>
              </button>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function DetailRail({
  metricDef,
  snapshot,
  period,
}: {
  metricDef: MetricDefinition;
  snapshot: MetricCellSnapshot;
  period: MetricPeriod;
}) {
  const isCurrency = metricDef.unit === "currency";
  const isUnset = snapshot.status === "UNSET" || snapshot.target <= 0;
  const vis = visFor(snapshot.status);
  const periodLabel =
    PERIODS.find((p) => p.key === period)?.label ?? period;

  const progressPct = Math.max(0, Math.min(100, snapshot.progress_pct));
  const expectedPct =
    snapshot.target > 0
      ? Math.max(0, Math.min(100, (snapshot.expected_by_now / snapshot.target) * 100))
      : 0;

  const paceDelta = snapshot.pace - 100;
  const paceLabel = isUnset ? "—" : `${paceDelta >= 0 ? "+" : ""}${paceDelta}%`;
  const paceUp = paceDelta >= 0;

  const needCallout =
    !isUnset &&
    snapshot.pace_status !== "JUST_STARTED" &&
    snapshot.remaining_to_target > 0;

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-1", VIS[vis].bar)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {periodLabel} {metricDef.label}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn("text-4xl font-bold tabular-nums", VIS[vis].text)}>
                {isUnset ? "—" : `${snapshot.progress_pct}%`}
              </span>
              <span className="text-sm text-zinc-500">complete</span>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
              VIS[vis].pill,
            )}
          >
            {STATUS_LABEL[snapshot.status]}
          </span>
        </div>

        {/* Progress rail with an "expected by now" marker */}
        <div className="mt-5">
          <div className="relative h-3 overflow-visible rounded-full bg-zinc-100 dark:bg-zinc-800">
            <span
              className={cn("block h-full rounded-full", VIS[vis].bar)}
              style={{ width: `${progressPct}%` }}
            />
            {!isUnset && expectedPct > 0 ? (
              <span
                className="absolute -top-1 bottom-[-4px] w-0.5 -translate-x-1/2 rounded bg-zinc-400 dark:bg-zinc-500"
                style={{ left: `${expectedPct}%` }}
                aria-hidden
              />
            ) : null}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-500">
            <span>{isUnset ? "Target not set" : `${progressPct}% achieved`}</span>
            {!isUnset && expectedPct > 0 ? (
              <span>expected {Math.round(expectedPct)}%</span>
            ) : null}
          </div>
        </div>

        {/* Stat chips */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chip label="Achieved" value={fmtVal(snapshot.actual, metricDef)} />
          <Chip label="Target" value={fmtVal(snapshot.target, metricDef)} />
          <Chip
            label="Expected by now"
            value={fmtVal(snapshot.expected_by_now, metricDef)}
          />
          <Chip
            label="Pace"
            value={paceLabel}
            accent={isUnset ? undefined : paceUp ? "good" : "bad"}
            trend={isUnset ? undefined : paceUp ? "up" : "down"}
          />
        </div>

        {needCallout ? (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-violet-200/60 bg-violet-50/60 px-4 py-3 text-sm dark:border-violet-900/40 dark:bg-violet-950/30">
            <Zap className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span className="text-zinc-700 dark:text-zinc-200">
              Need{" "}
              <strong className="font-bold">
                {isCurrency
                  ? `${formatCurrency(Math.max(1, Math.round(snapshot.required_per_day)), "INR")}/day`
                  : `${snapshot.required_per_week}/week`}
              </strong>{" "}
              to hit target ·{" "}
              {fmtVal(snapshot.remaining_to_target, metricDef)} to go
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Chip({
  label,
  value,
  accent,
  trend,
}: {
  label: string;
  value: string;
  accent?: "good" | "bad";
  trend?: "up" | "down";
}) {
  const accentCls =
    accent === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "bad"
        ? "text-rose-600 dark:text-rose-400"
        : "text-zinc-900 dark:text-zinc-50";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1 text-lg font-bold tabular-nums",
          accentCls,
        )}
      >
        {TrendIcon ? <TrendIcon className="h-4 w-4" aria-hidden /> : null}
        {value}
      </div>
    </div>
  );
}
