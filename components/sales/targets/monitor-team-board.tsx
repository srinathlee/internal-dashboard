"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Hash,
  IndianRupee,
  MinusCircle,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/format";
import { formatCurrency } from "@/lib/format-metric";
import { useLeadPeople } from "@/lib/hooks/use-leads";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

export type MetricKey =
  | "leads"
  | "sprints_done"
  | "sprint_amount"
  | "revenue";

export type MonitorPeriod =
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "YEARLY";

type PaceStatus =
  | "JUST_STARTED"
  | "AHEAD"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "UNSET";

interface MetricSnapshot {
  target: number;
  achieved: number;
  progress_pct: number;
  expected: number;
  pace_pct: number;
  status: PaceStatus;
}

interface RepRow {
  user: { id: string; name: string };
  data: Record<MetricKey, Record<MonitorPeriod, MetricSnapshot>>;
}

// =============================================================================
// Static config
// =============================================================================

const PERIODS: { key: MonitorPeriod; label: string }[] = [
  { key: "MONTHLY", label: "Monthly" },
  { key: "QUARTERLY", label: "Quarterly" },
  { key: "HALF_YEARLY", label: "Half-yearly" },
  { key: "YEARLY", label: "Yearly" },
];

const METRICS: {
  key: MetricKey;
  label: string;
  short: string;
  icon: LucideIcon;
  unit: "count" | "currency";
}[] = [
  { key: "leads", label: "Leads", short: "Leads", icon: Users, unit: "count" },
  {
    key: "sprints_done",
    label: "Sprints done",
    short: "Sprints done",
    icon: Hash,
    unit: "count",
  },
  {
    key: "sprint_amount",
    label: "Sprint amount",
    short: "Sprint amount",
    icon: CreditCard,
    unit: "currency",
  },
  {
    key: "revenue",
    label: "Revenue",
    short: "Revenue",
    icon: IndianRupee,
    unit: "currency",
  },
];

// Per-rep targets aren't read from the backend yet (the matching API spec is
// in [docs/add-member-stepper-api.md](../../../docs/add-member-stepper-api.md)),
// so the board renders against these defaults. The defaults match the values
// pre-filled by the Add Member stepper, so a freshly created rep's UI is
// internally consistent.
const DEFAULT_TARGETS: Record<MetricKey, Record<MonitorPeriod, number>> = {
  leads: { MONTHLY: 30, QUARTERLY: 120, HALF_YEARLY: 240, YEARLY: 480 },
  sprints_done: { MONTHLY: 5, QUARTERLY: 20, HALF_YEARLY: 40, YEARLY: 80 },
  sprint_amount: {
    MONTHLY: 10_000,
    QUARTERLY: 45_000,
    HALF_YEARLY: 90_000,
    YEARLY: 180_000,
  },
  revenue: {
    MONTHLY: 5_000,
    QUARTERLY: 15_000,
    HALF_YEARLY: 70_000,
    YEARLY: 150_000,
  },
};

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

// =============================================================================
// Time math
// =============================================================================

function elapsedPctOf(period: MonitorPeriod): number {
  const now = new Date();
  switch (period) {
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
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), q * 3 + 3, 0);
      const total = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / 86_400_000),
      );
      const elapsed = Math.max(
        0,
        Math.round((now.getTime() - start.getTime()) / 86_400_000),
      );
      return Math.round((elapsed / total) * 100);
    }
    case "HALF_YEARLY": {
      const h = now.getMonth() < 6 ? 0 : 1;
      const start = new Date(now.getFullYear(), h * 6, 1);
      const end = new Date(now.getFullYear(), h * 6 + 6, 0);
      const total = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / 86_400_000),
      );
      const elapsed = Math.max(
        0,
        Math.round((now.getTime() - start.getTime()) / 86_400_000),
      );
      return Math.round((elapsed / total) * 100);
    }
    case "YEARLY": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return Math.round(
        ((now.getTime() - start.getTime()) /
          (end.getTime() - start.getTime())) *
          100,
      );
    }
  }
}

function periodEnd(period: MonitorPeriod): Date {
  const now = new Date();
  switch (period) {
    case "MONTHLY":
      return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    case "QUARTERLY": {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
    }
    case "HALF_YEARLY": {
      const h = now.getMonth() < 6 ? 0 : 1;
      return new Date(now.getFullYear(), h * 6 + 6, 0, 23, 59, 59);
    }
    case "YEARLY":
      return new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }
}

function daysLeft(period: MonitorPeriod): number {
  const end = periodEnd(period);
  const now = new Date();
  return Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / 86_400_000),
  );
}

function periodLabel(p: MonitorPeriod): string {
  return PERIODS.find((x) => x.key === p)?.label ?? p;
}

// =============================================================================
// Pace + demo data
// =============================================================================

function computeSnapshot(
  target: number,
  achieved: number,
  period: MonitorPeriod,
): MetricSnapshot {
  if (target <= 0) {
    return {
      target: 0,
      achieved,
      progress_pct: 0,
      expected: 0,
      pace_pct: 0,
      status: "UNSET",
    };
  }
  const elapsed = Math.min(1, Math.max(0, elapsedPctOf(period) / 100));
  const expected = Math.round(target * elapsed * 100) / 100;
  const progress_pct = Math.round((achieved / target) * 100);

  if (elapsed < 0.05) {
    return {
      target,
      achieved,
      progress_pct,
      expected,
      pace_pct: 0,
      status: "JUST_STARTED",
    };
  }

  const pace_pct = expected > 0 ? Math.round((achieved / expected) * 100) : 0;
  let status: PaceStatus;
  if (pace_pct >= 100) status = "AHEAD";
  else if (pace_pct >= 90) status = "ON_TRACK";
  else if (pace_pct >= 70) status = "AT_RISK";
  else status = "BEHIND";

  return { target, achieved, progress_pct, expected, pace_pct, status };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministic stand-in for achieved values until `/api/v1/sales/targets/board`
// (or equivalent) ships. Returns realistic numbers per (rep, metric, period)
// that vary across reps but stay stable across refreshes.
function demoAchieved(
  repId: string,
  metric: MetricKey,
  period: MonitorPeriod,
): number {
  const target = DEFAULT_TARGETS[metric][period];
  const elapsed = elapsedPctOf(period) / 100;
  const expected = target * elapsed;
  const seed = hashCode(`${repId}:${metric}:${period}`);
  // Pace multiplier 0.35 → 1.55 so we cover Behind / At risk / On track / Ahead.
  const factor = 0.35 + (seed % 1200) / 1000;
  const raw = expected * factor;
  if (metric === "leads" || metric === "sprints_done") {
    return Math.max(0, Math.round(raw));
  }
  return Math.max(0, Math.round(raw / 50) * 50);
}

function buildRepRow(user: { id: string; name: string }): RepRow {
  const data = {} as RepRow["data"];
  for (const m of METRICS) {
    const perPeriod = {} as Record<MonitorPeriod, MetricSnapshot>;
    for (const p of PERIODS) {
      perPeriod[p.key] = computeSnapshot(
        DEFAULT_TARGETS[m.key][p.key],
        demoAchieved(user.id, m.key, p.key),
        p.key,
      );
    }
    data[m.key] = perPeriod;
  }
  return { user, data };
}

// "Worst-of-four" — the rep's overall pill reflects whichever metric is in
// the most trouble. UNSET is excluded so a fully-unconfigured period doesn't
// hide a real Behind reading from the others.
const STATUS_ORDER: PaceStatus[] = [
  "BEHIND",
  "AT_RISK",
  "ON_TRACK",
  "JUST_STARTED",
  "AHEAD",
];

function overallStatus(
  rep: RepRow,
  period: MonitorPeriod = "MONTHLY",
): PaceStatus {
  let worst: PaceStatus = "AHEAD";
  let worstRank = STATUS_ORDER.indexOf("AHEAD");
  for (const m of METRICS) {
    const s = rep.data[m.key][period].status;
    if (s === "UNSET") continue;
    const r = STATUS_ORDER.indexOf(s);
    if (r >= 0 && r < worstRank) {
      worst = s;
      worstRank = r;
    }
  }
  return worst;
}

// =============================================================================
// Public component
// =============================================================================

export function MonitorTeamBoard() {
  const peopleQuery = useLeadPeople();
  const people = useMemo(
    () => peopleQuery.data ?? [],
    [peopleQuery.data],
  );
  const reps = useMemo(() => people.map(buildRepRow), [people]);

  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reps;
    return reps.filter((r) => r.user.name.toLowerCase().includes(q));
  }, [reps, search]);

  const tallies = useMemo(() => {
    const t = { behind: 0, at_risk: 0, on_track: 0, ahead: 0 };
    for (const rep of filtered) {
      const status = overallStatus(rep);
      if (status === "BEHIND") t.behind++;
      else if (status === "AT_RISK") t.at_risk++;
      else if (status === "AHEAD") t.ahead++;
      else t.on_track++;
    }
    return t;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <KpiRow tallies={tallies} />

      <SearchBar
        value={search}
        onChange={setSearch}
        count={filtered.length}
      />

      {peopleQuery.isLoading && reps.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="grid place-items-center py-12 text-sm text-zinc-500">
          {search
            ? "No reps match your search."
            : "No reps configured yet."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((rep) => (
            <RepRowItem
              key={rep.user.id}
              rep={rep}
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
          <span
            className={cn("text-3xl font-bold tabular-nums", it.text)}
          >
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
  expanded,
  onToggle,
}: {
  rep: RepRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = overallStatus(rep);
  const meta = STATUS_META[status];

  return (
    <Card
      className={cn(
        "overflow-hidden p-0 transition-colors",
        expanded && "ring-1 ring-zinc-200 dark:ring-zinc-800",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-zinc-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-900/40"
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
            Sales Rep
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 grid-cols-4 gap-2 md:grid">
          {METRICS.map((m) => (
            <InlineMetricBar
              key={m.key}
              label={m.short}
              snapshot={rep.data[m.key].MONTHLY}
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

      {expanded ? <RepExpanded rep={rep} /> : null}
    </Card>
  );
}

function InlineMetricBar({
  label,
  snapshot,
}: {
  label: string;
  snapshot: MetricSnapshot;
}) {
  const meta = STATUS_META[snapshot.status];
  const pct = Math.max(0, Math.min(100, snapshot.progress_pct));
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
        {snapshot.progress_pct}%
      </span>
    </div>
  );
}

// =============================================================================
// Expanded panel
// =============================================================================

function RepExpanded({ rep }: { rep: RepRow }) {
  const [metric, setMetric] = useState<MetricKey>("leads");
  const [period, setPeriod] = useState<MonitorPeriod>("MONTHLY");

  const snapshot = rep.data[metric][period];
  const metricDef = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="border-t border-zinc-200 bg-zinc-50/30 px-4 pb-5 pt-4 dark:border-zinc-800 dark:bg-zinc-900/20">
      <MetricTabs
        rep={rep}
        activePeriod={period}
        value={metric}
        onChange={setMetric}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PeriodChips value={period} onChange={setPeriod} />
        <div className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {daysLeft(period)} days left
        </div>
      </div>

      <DetailPanel
        metricDef={metricDef}
        snapshot={snapshot}
        period={period}
      />

      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          All periods
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PERIODS.map((p) => (
            <AllPeriodTile
              key={p.key}
              label={p.label}
              snapshot={rep.data[metric][p.key]}
              unit={metricDef.unit}
              active={p.key === period}
              onClick={() => setPeriod(p.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricTabs({
  rep,
  activePeriod,
  value,
  onChange,
}: {
  rep: RepRow;
  activePeriod: MonitorPeriod;
  value: MetricKey;
  onChange: (m: MetricKey) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-white p-1 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950">
      {METRICS.map((m) => {
        const Icon = m.icon;
        const snap = rep.data[m.key][activePeriod];
        const active = value === m.key;
        const meta = STATUS_META[snap.status];
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
              {snap.progress_pct}%
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
  value: MonitorPeriod;
  onChange: (p: MonitorPeriod) => void;
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
                active
                  ? "bg-emerald-400"
                  : "bg-zinc-300 dark:bg-zinc-700",
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
}: {
  metricDef: (typeof METRICS)[number];
  snapshot: MetricSnapshot;
  period: MonitorPeriod;
}) {
  const meta = STATUS_META[snapshot.status];
  const unit = metricDef.unit;
  const fmt = (v: number) =>
    unit === "currency" ? formatCurrency(v, "INR") : v.toString();

  const R = 42;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, snapshot.progress_pct));
  const dash = (pct / 100) * C;

  const remaining = Math.max(0, snapshot.target - snapshot.achieved);
  const daysRem = Math.max(1, daysLeft(period));
  const perDay = remaining / daysRem;
  const perWeek = perDay * 7;
  const needsCallout =
    remaining > 0 &&
    snapshot.status !== "UNSET" &&
    snapshot.status !== "JUST_STARTED";

  // Pace number — show signed delta from 100. "+45%" / "-25%".
  const paceDelta = snapshot.pace_pct - 100;
  const paceLabel =
    snapshot.status === "JUST_STARTED" || snapshot.status === "UNSET"
      ? "—"
      : `${paceDelta >= 0 ? "+" : ""}${paceDelta}%`;
  const paceAccent: "emerald" | "rose" | undefined =
    snapshot.status === "JUST_STARTED" || snapshot.status === "UNSET"
      ? undefined
      : paceDelta >= 0
        ? "emerald"
        : "rose";

  const elapsed = elapsedPctOf(period);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className={cn("h-0.5", meta.bar)} />
      <div className="bg-white p-5 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {periodLabel(period)} {metricDef.label}
            </div>
            <h3 className="mt-0.5 text-xl font-bold">
              Detailed breakdown
            </h3>
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
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full -rotate-90"
            >
              <circle
                cx="50"
                cy="50"
                r={R}
                fill="none"
                strokeWidth="8"
                className="stroke-zinc-100 dark:stroke-zinc-800"
              />
              {snapshot.status !== "UNSET" ? (
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
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  meta.text,
                )}
              >
                {snapshot.status === "UNSET"
                  ? "—"
                  : `${snapshot.progress_pct}%`}
              </div>
              <div className="text-xs text-zinc-500">{meta.label}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Achieved" value={fmt(snapshot.achieved)} />
            <StatCard label="Target" value={fmt(snapshot.target)} />
            <StatCard
              label="Expected by now"
              value={fmt(snapshot.expected)}
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
            <Zap
              className="h-4 w-4 text-violet-500"
              aria-hidden
            />
            <span className="text-zinc-700 dark:text-zinc-200">
              Need{" "}
              <strong className="font-bold">
                {unit === "currency"
                  ? `${formatCurrency(Math.max(1, Math.round(perDay)), "INR")}/day`
                  : `${Math.max(1, Math.round(perWeek))}/week`}
              </strong>{" "}
              to hit target
            </span>
          </div>
        ) : null}

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-medium text-zinc-500">
              Progress
            </span>
            <span className="text-xs font-medium tabular-nums text-zinc-500">
              {snapshot.status === "UNSET"
                ? "Target not set"
                : `${snapshot.progress_pct}% complete`}
            </span>
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <span
              className={cn("block h-full rounded-full", meta.bar)}
              style={{
                width: `${Math.max(0, Math.min(100, snapshot.progress_pct))}%`,
              }}
            />
            {snapshot.status !== "UNSET" ? (
              <span
                aria-hidden
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-zinc-400 dark:bg-zinc-500"
                style={{
                  left: `${Math.max(0, Math.min(100, elapsed))}%`,
                }}
              />
            ) : null}
          </div>
          <div
            className="mt-1 text-[10px] text-zinc-500"
            style={{
              marginLeft: `calc(${Math.max(0, Math.min(100, elapsed))}% - 1.5rem)`,
              width: "3rem",
              textAlign: "center",
            }}
          >
            {snapshot.status !== "UNSET" ? "expected" : ""}
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
        {TrendIcon ? (
          <TrendIcon className="h-5 w-5" aria-hidden />
        ) : null}
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
  snapshot: MetricSnapshot;
  unit: "count" | "currency";
  active: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[snapshot.status];
  const display =
    snapshot.status === "UNSET"
      ? "—"
      : unit === "currency"
        ? formatCurrency(snapshot.achieved, "INR")
        : snapshot.achieved.toString();
  const target =
    unit === "currency"
      ? formatCurrency(snapshot.target, "INR")
      : snapshot.target.toString();
  const paceDelta = snapshot.pace_pct - 100;

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
            width: `${Math.max(0, Math.min(100, snapshot.progress_pct))}%`,
          }}
        />
      </div>
      {snapshot.status !== "UNSET" &&
      snapshot.status !== "JUST_STARTED" ? (
        <div className={cn("mt-2 text-[10px] font-semibold", meta.text)}>
          {paceDelta >= 0 ? "+" : ""}
          {paceDelta}% pace
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-zinc-500">
          {snapshot.status === "UNSET" ? "Target not set" : "Just started"}
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
