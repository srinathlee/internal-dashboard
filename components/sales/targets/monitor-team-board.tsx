"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
  IndianRupee,
  MinusCircle,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/format";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useMetricCatalogue,
  useMetricMonitorBoard,
  useRepMetricDetail,
} from "@/lib/hooks/use-metric-targets";
import type {
  MetricCellSnapshot,
  MetricDefinition,
  MetricKey,
  MetricPeriod,
  MonitorRepRow,
  PaceStatus,
} from "@/lib/api/sales-metric-targets";
import { cn } from "@/lib/utils";

// =============================================================================
// Static config
// =============================================================================

const PERIODS: { key: MetricPeriod; label: string }[] = [
  { key: "MONTHLY", label: "Monthly" },
  { key: "QUARTERLY", label: "Quarterly" },
  { key: "HALF_YEARLY", label: "Half-yearly" },
  { key: "YEARLY", label: "Yearly" },
];

// Icon lookup driven by the catalogue's `icon_hint`, with fallbacks based on
// metric key so the board still renders if the backend sends an unknown hint.
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

const STATUS_META: Record<
  PaceStatus,
  {
    label: string;
    pill: string;
    bar: string;
    text: string;
    dot: string;
    icon: LucideIcon;
  }
> = {
  JUST_STARTED: {
    label: "Just started",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    bar: "bg-zinc-400 dark:bg-zinc-500",
    text: "text-zinc-500 dark:text-zinc-400",
    dot: "bg-zinc-400",
    icon: Clock,
  },
  AHEAD: {
    label: "Ahead",
    pill: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
    bar: "bg-emerald-500",
    text: "text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  ON_TRACK: {
    label: "On track",
    pill: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
    bar: "bg-zinc-400 dark:bg-zinc-500",
    text: "text-zinc-600 dark:text-zinc-300",
    dot: "bg-zinc-400",
    icon: TrendingUp,
  },
  AT_RISK: {
    label: "At risk",
    pill: "bg-amber-50 text-amber-600 ring-1 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
    bar: "bg-amber-500",
    text: "text-amber-500 dark:text-amber-400",
    dot: "bg-amber-500",
    icon: AlertTriangle,
  },
  BEHIND: {
    label: "Behind",
    pill: "bg-rose-50 text-rose-600 ring-1 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
    bar: "bg-rose-500",
    text: "text-rose-500 dark:text-rose-400",
    dot: "bg-rose-500",
    icon: TrendingDown,
  },
  UNSET: {
    label: "Unset",
    pill: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
    bar: "bg-zinc-300 dark:bg-zinc-700",
    text: "text-zinc-400",
    dot: "bg-zinc-400",
    icon: MinusCircle,
  },
};

function periodLabel(p: MetricPeriod): string {
  return PERIODS.find((x) => x.key === p)?.label ?? p;
}

// =============================================================================
// Public component
// =============================================================================

export function MonitorTeamBoard() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Board defaults to MONTHLY — the screenshot uses monthly progress bars in
  // every row. The per-rep period selector inside the expanded panel switches
  // the detailed breakdown, not the row-level summary.
  const catalogueQuery = useMetricCatalogue();
  const boardQuery = useMetricMonitorBoard({
    period: "MONTHLY",
    search: search.trim() || undefined,
  });

  const metrics = useMemo<MetricDefinition[]>(() => {
    const list = catalogueQuery.data?.metrics ?? [];
    return [...list].sort((a, b) => a.display_order - b.display_order);
  }, [catalogueQuery.data]);

  const board = boardQuery.data;
  const rows = board?.rows ?? [];
  const tallies = board?.tallies ?? {
    behind: 0,
    at_risk: 0,
    on_track: 0,
    ahead: 0,
    just_started: 0,
    unset: 0,
    total: 0,
  };

  const fatalError = catalogueQuery.error;
  const loading =
    catalogueQuery.isLoading || (boardQuery.isLoading && !boardQuery.data);

  if (fatalError) {
    return (
      <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
        {errorMessage(fatalError)}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <KpiRow tallies={tallies} />

      <SearchBar
        value={search}
        onChange={setSearch}
        count={rows.length}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse" />
          ))}
        </div>
      ) : boardQuery.error ? (
        <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          {errorMessage(boardQuery.error)}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="grid place-items-center py-12 text-sm text-zinc-500">
          {search ? "No reps match your search." : "No reps configured yet."}
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((rep) => (
            <RepRowItem
              key={rep.user.id}
              rep={rep}
              metrics={metrics}
              expanded={expandedId === rep.user.id}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === rep.user.id ? null : rep.user.id,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// KPI tiles
// =============================================================================

function KpiRow({
  tallies,
}: {
  tallies: {
    behind: number;
    at_risk: number;
    on_track: number;
    ahead: number;
  };
}) {
  const items = [
    {
      label: "Behind",
      value: tallies.behind,
      dot: "bg-rose-500",
      text: tallies.behind > 0 ? "text-rose-500" : "text-zinc-400",
    },
    {
      label: "At risk",
      value: tallies.at_risk,
      dot: "bg-amber-500",
      text: tallies.at_risk > 0 ? "text-amber-500" : "text-zinc-400",
    },
    {
      label: "On track",
      value: tallies.on_track,
      dot: "bg-zinc-400",
      text: "text-zinc-200",
    },
    {
      label: "Ahead",
      value: tallies.ahead,
      dot: "bg-emerald-500",
      text: tallies.ahead > 0 ? "text-emerald-500" : "text-zinc-400",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <Card
          key={it.label}
          className="flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <span aria-hidden className={cn("h-2 w-2 rounded-full", it.dot)} />
            {it.label}
          </div>
          <span className={cn("text-3xl font-bold tabular-nums", it.text)}>
            {it.value}
          </span>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// Search bar
// =============================================================================

function SearchBar({
  value,
  onChange,
  count,
}: {
  value: string;
  onChange: (v: string) => void;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="relative w-full max-w-md">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search reps..."
          className="h-10 pl-9"
          aria-label="Search reps"
        />
      </div>
      <span className="shrink-0 text-xs text-zinc-500">
        {count} rep{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

// =============================================================================
// Rep row (collapsed + expanded)
// =============================================================================

function RepRowItem({
  rep,
  metrics,
  expanded,
  onToggle,
}: {
  rep: MonitorRepRow;
  metrics: MetricDefinition[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS_META[rep.overall_status];
  const router = useRouter();

  return (
    <Card
      className={cn(
        "overflow-hidden p-0 transition-colors",
        expanded && "ring-1 ring-zinc-200 dark:ring-zinc-800",
      )}
    >
      <div className="flex w-full items-center gap-4 px-4 py-3">
        {/* Identity → opens the rep's full profile page. */}
        <button
          type="button"
          onClick={() => router.push(`/sales/reps/${rep.user.id}`)}
          className="flex min-w-0 items-center gap-4 rounded-md text-left transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`Open ${rep.user.name}'s profile`}
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback
              className={cn(
                "text-[11px] font-semibold text-white",
                colorForId(rep.user.id),
              )}
            >
              {getInitials(rep.user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 w-32 shrink-0">
            <div className="truncate text-sm font-semibold">
              {rep.user.name}
            </div>
            <div className="truncate text-[11px] text-zinc-500">
              {rep.user.role || "Sales Rep"}
            </div>
          </div>
        </button>

        {/* Metrics + status → toggles the inline target detail. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="hidden min-w-0 flex-1 grid-cols-4 gap-2 md:grid">
            {metrics.map((m) => (
              <InlineMetricBar
                key={m.key}
                label={m.label}
                snapshot={rep.metrics[m.key]}
              />
            ))}
          </div>

          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
              meta.pill,
            )}
          >
            {meta.label}
          </span>
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-400"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>
      </div>

      {expanded ? <RepExpanded userId={rep.user.id} metrics={metrics} /> : null}
    </Card>
  );
}

function InlineMetricBar({
  label,
  snapshot,
}: {
  label: string;
  snapshot: MetricCellSnapshot | undefined;
}) {
  const status = snapshot?.status ?? "UNSET";
  const meta = STATUS_META[status === "ACHIEVED" ? "AHEAD" : (status as PaceStatus)];
  const pct = Math.max(0, Math.min(100, snapshot?.progress_pct ?? 0));
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200/60 bg-zinc-50/40 px-2.5 py-1.5 dark:border-zinc-800/60 dark:bg-zinc-900/40">
      <span className="w-16 shrink-0 truncate text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span
          className={cn("block h-full rounded-full", meta.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {snapshot?.progress_pct ?? 0}%
      </span>
    </div>
  );
}

// =============================================================================
// Expanded panel — fetches the 4×4 detail endpoint on first open
// =============================================================================

function RepExpanded({
  userId,
  metrics,
}: {
  userId: string;
  metrics: MetricDefinition[];
}) {
  const detailQuery = useRepMetricDetail(userId);
  const [metricKey, setMetricKey] = useState<MetricKey>(
    (metrics[0]?.key ?? "leads") as MetricKey,
  );
  const [period, setPeriod] = useState<MetricPeriod>("MONTHLY");

  if (detailQuery.isLoading && !detailQuery.data) {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50/30 p-6 dark:border-zinc-800 dark:bg-zinc-900/20">
        <div className="h-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  if (detailQuery.error) {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50/30 p-6 dark:border-zinc-800 dark:bg-zinc-900/20">
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
          {errorMessage(detailQuery.error)}
        </Card>
      </div>
    );
  }

  const detail = detailQuery.data;
  if (!detail) return null;

  const metricDef =
    metrics.find((m) => m.key === metricKey) ?? metrics[0]!;
  const snapshot = detail.metrics[metricKey]?.[period];
  const periodWindow = detail.periods[period];
  const daysRemaining = periodWindow?.days_remaining ?? 0;

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/30 px-4 pb-5 pt-4 dark:border-zinc-800 dark:bg-zinc-900/20">
      <MetricTabs
        metrics={metrics}
        detail={detail}
        activePeriod={period}
        value={metricKey}
        onChange={setMetricKey}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PeriodChips value={period} onChange={setPeriod} />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {daysRemaining} days left
        </div>
      </div>

      {snapshot ? (
        <DetailPanel
          metricDef={metricDef}
          snapshot={snapshot}
          period={period}
          elapsedFraction={periodWindow?.elapsed_fraction ?? 0}
        />
      ) : null}

      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          All periods
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PERIODS.map((p) => {
            const snap = detail.metrics[metricKey]?.[p.key];
            return (
              <AllPeriodTile
                key={p.key}
                label={p.label}
                snapshot={snap}
                unit={metricDef.unit}
                active={p.key === period}
                onClick={() => setPeriod(p.key)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricTabs({
  metrics,
  detail,
  activePeriod,
  value,
  onChange,
}: {
  metrics: MetricDefinition[];
  detail: { metrics: Record<MetricKey, Record<MetricPeriod, MetricCellSnapshot>> };
  activePeriod: MetricPeriod;
  value: MetricKey;
  onChange: (m: MetricKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-white p-1 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950">
      {metrics.map((m) => {
        const Icon = metricIcon(m);
        const snap = detail.metrics[m.key]?.[activePeriod];
        const active = value === m.key;
        const status = (snap?.status ?? "UNSET") as PaceStatus;
        const meta = STATUS_META[status === ("ACHIEVED" as unknown as PaceStatus) ? "AHEAD" : status];
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{m.label}</span>
            <span className={cn("font-bold tabular-nums", meta.text)}>
              {snap?.progress_pct ?? 0}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PeriodChips({
  value,
  onChange,
}: {
  value: MetricPeriod;
  onChange: (p: MetricPeriod) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
      {PERIODS.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {p.label}
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active ? "bg-emerald-400" : "bg-zinc-300 dark:bg-zinc-700",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function DetailPanel({
  metricDef,
  snapshot,
  period,
  elapsedFraction,
}: {
  metricDef: MetricDefinition;
  snapshot: MetricCellSnapshot;
  period: MetricPeriod;
  elapsedFraction: number;
}) {
  const status = snapshot.status as PaceStatus;
  // The progress-status enum overlaps but isn't identical to pace-status.
  // ACHIEVED maps to AHEAD visually; the rest match.
  const meta =
    STATUS_META[status === ("ACHIEVED" as unknown as PaceStatus) ? "AHEAD" : status];
  const isCurrency = metricDef.unit === "currency";
  const fmt = (v: number) =>
    isCurrency ? formatCurrency(v, "INR") : formatNumber(v);

  const R = 42;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, snapshot.progress_pct));
  const dash = (pct / 100) * C;

  const isUnset = snapshot.status === "UNSET";
  const isJustStarted = snapshot.pace_status === "JUST_STARTED";
  const needsCallout =
    !isUnset &&
    !isJustStarted &&
    snapshot.remaining_to_target > 0;

  // Pace number — show signed delta from 100. "+45%" / "-25%".
  const paceDelta = snapshot.pace - 100;
  const paceLabel =
    isJustStarted || isUnset
      ? "—"
      : `${paceDelta >= 0 ? "+" : ""}${paceDelta}%`;
  const paceAccent: "emerald" | "rose" | undefined =
    isJustStarted || isUnset
      ? undefined
      : paceDelta >= 0
        ? "emerald"
        : "rose";

  const elapsedPct = Math.round(elapsedFraction * 100);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className={cn("h-0.5", meta.bar)} />
      <div className="bg-white p-5 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {periodLabel(period)} {metricDef.label}
            </div>
            <h3 className="mt-0.5 text-xl font-bold">Detailed breakdown</h3>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              meta.pill,
            )}
          >
            {meta.label}
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="relative mx-auto h-44 w-44">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth="8"
                className="stroke-zinc-100 dark:stroke-zinc-800"
              />
              {!isUnset ? (
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  strokeDasharray={`${dash} ${C}`}
                  className={meta.text}
                />
              ) : null}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={cn("text-3xl font-bold tabular-nums", meta.text)}
              >
                {isUnset ? "—" : `${snapshot.progress_pct}%`}
              </div>
              <div className="text-xs text-zinc-500">{meta.label}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Achieved" value={fmt(snapshot.actual)} />
            <StatCard label="Target" value={fmt(snapshot.target)} />
            <StatCard
              label="Expected by now"
              value={fmt(snapshot.expected_by_now)}
            />
            <StatCard
              label="Pace"
              value={paceLabel}
              accent={paceAccent}
              TrendIcon={
                paceAccent === "emerald"
                  ? TrendingUp
                  : paceAccent === "rose"
                    ? TrendingDown
                    : undefined
              }
            />
          </div>
        </div>

        {needsCallout ? (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-violet-200/60 bg-violet-50/60 px-4 py-3 text-sm dark:border-violet-900/40 dark:bg-violet-950/30">
            <Zap className="h-4 w-4 text-violet-500" aria-hidden />
            <span className="text-zinc-700 dark:text-zinc-200">
              Need{" "}
              <strong className="font-bold">
                {isCurrency
                  ? `${formatCurrency(Math.max(1, Math.round(snapshot.required_per_day)), "INR")}/day`
                  : `${snapshot.required_per_week}/week`}
              </strong>{" "}
              to hit target
            </span>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium text-zinc-500">Progress</span>
            <span className="text-xs font-medium tabular-nums text-zinc-500">
              {isUnset
                ? "Target not set"
                : `${snapshot.progress_pct}% complete`}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <span
              className={cn("block h-full rounded-full", meta.bar)}
              style={{ width: `${pct}%` }}
            />
            {!isUnset ? (
              <span
                aria-hidden
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-zinc-400 dark:bg-zinc-500"
                style={{ left: `${Math.max(0, Math.min(100, elapsedPct))}%` }}
              />
            ) : null}
          </div>
          <div
            className="mt-1 text-[10px] text-zinc-500"
            style={{
              marginLeft: `calc(${Math.max(0, Math.min(100, elapsedPct))}% - 1.5rem)`,
              width: "3rem",
              textAlign: "center",
            }}
          >
            {!isUnset ? "expected" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  TrendIcon,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "rose";
  TrendIcon?: LucideIcon;
}) {
  const tone =
    accent === "emerald"
      ? "border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      : accent === "rose"
        ? "border-rose-200/50 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
  const valueTone =
    accent === "emerald"
      ? "text-emerald-500 dark:text-emerald-400"
      : accent === "rose"
        ? "text-rose-500 dark:text-rose-400"
        : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className={cn("rounded-lg border p-4", tone)}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 flex items-center gap-1 text-2xl font-bold tabular-nums",
          valueTone,
        )}
      >
        {TrendIcon ? <TrendIcon className="h-5 w-5" aria-hidden /> : null}
        {value}
      </div>
    </div>
  );
}

function AllPeriodTile({
  label,
  snapshot,
  unit,
  active,
  onClick,
}: {
  label: string;
  snapshot: MetricCellSnapshot | undefined;
  unit: "count" | "currency";
  active: boolean;
  onClick: () => void;
}) {
  const status = (snapshot?.status ?? "UNSET") as PaceStatus;
  const meta =
    STATUS_META[
      status === ("ACHIEVED" as unknown as PaceStatus) ? "AHEAD" : status
    ];
  const isUnset = !snapshot || snapshot.status === "UNSET";
  const isJustStarted = snapshot?.pace_status === "JUST_STARTED";
  const display = isUnset
    ? "—"
    : unit === "currency"
      ? formatCurrency(snapshot!.actual, "INR")
      : formatNumber(snapshot!.actual);
  const target =
    unit === "currency"
      ? formatCurrency(snapshot?.target ?? 0, "INR")
      : formatNumber(snapshot?.target ?? 0);
  const paceDelta = (snapshot?.pace ?? 0) - 100;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border bg-white p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-zinc-950",
        active
          ? "border-violet-500 ring-1 ring-violet-500/40"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[9px] font-semibold",
            meta.pill,
          )}
        >
          {meta.label}
        </span>
      </div>
      <div className="mt-2 text-xl font-bold tabular-nums">{display}</div>
      <div className="text-[10px] text-zinc-500">of {target}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span
          className={cn("block h-full rounded-full", meta.bar)}
          style={{
            width: `${Math.max(0, Math.min(100, snapshot?.progress_pct ?? 0))}%`,
          }}
        />
      </div>
      {!isUnset && !isJustStarted ? (
        <div className={cn("mt-2 text-[10px] font-semibold", meta.text)}>
          {paceDelta >= 0 ? "+" : ""}
          {paceDelta}% pace
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-zinc-500">
          {isUnset ? "Target not set" : "Just started"}
        </div>
      )}
    </button>
  );
}

// =============================================================================
// Avatar palette (shared with target-management-screen)
// =============================================================================

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
