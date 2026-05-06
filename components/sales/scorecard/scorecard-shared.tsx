"use client";

import { ChevronDown } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { aggregateMetricsForKey } from "@/lib/aggregations";
import { formatCurrency } from "@/lib/format-metric";
import {
  REFERENCE_DATE,
  getMetricsForUser,
  getTargetForUser,
} from "@/lib/mock-data";
import { leads as seedLeads } from "@/lib/sales-leads-data";
import { cn } from "@/lib/utils";
import type { Lead, User } from "@/lib/types";

/**
 * Shared scorecard primitives used by both the sales-member and sales-admin
 * views. The data builder, period controls, hero stats, table, and grade
 * styling all live here so the two screens stay visually identical and any
 * tweak (new metric, weight rebalance, status threshold) lands in one place.
 */

// ---------- Period selection ------------------------------------------------

export type Period = "month" | "quarter" | "year" | "range";

export const PERIOD_LABELS: Record<Period, string> = {
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  range: "Range",
};

export interface PeriodOption {
  /** Stable id used as the selection key. */
  key: string;
  /** Label rendered in the dropdown row. */
  label: string;
}

export function PeriodTabs({
  value,
  onChange,
}: {
  value: Period;
  onChange: (next: Period) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Reporting period"
      className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

export function periodTagLabel(p: Period): string {
  if (p === "month") return "Monthly";
  if (p === "quarter") return "Quarterly";
  if (p === "year") return "Yearly";
  return "Custom";
}

export function PeriodValueDropdown({
  period,
  value,
  options,
  label,
  onChange,
}: {
  period: Period;
  value: string;
  options: PeriodOption[];
  label: string;
  onChange: (next: string) => void;
}) {
  const triggerPrefix = PERIOD_LABELS[period];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Select ${triggerPrefix.toLowerCase()}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          <span className="text-zinc-500">{triggerPrefix}</span>
          <span className="font-medium tabular-nums">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.key}
            onSelect={() => onChange(opt.key)}
            className={cn(
              "justify-between",
              opt.key === value && "bg-zinc-100 dark:bg-zinc-800",
            )}
          >
            <span className="tabular-nums">{opt.label}</span>
            {opt.key === value ? (
              <span className="text-xs text-zinc-500">Selected</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function defaultSelectionFor(period: Period): string {
  const ref = new Date(REFERENCE_DATE + "T00:00:00.000Z");
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  if (period === "month") return `${year}-${String(month + 1).padStart(2, "0")}`;
  if (period === "quarter") return `${year}-Q${Math.floor(month / 3) + 1}`;
  if (period === "year") return `${year}`;
  return "range";
}

export function buildOptions(period: Period): PeriodOption[] {
  const ref = new Date(REFERENCE_DATE + "T00:00:00.000Z");
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();

  if (period === "month") {
    const out: PeriodOption[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(year, month - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
      out.push({ key, label });
    }
    return out;
  }

  if (period === "quarter") {
    const out: PeriodOption[] = [];
    let qYear = year;
    let qIdx = Math.floor(month / 3);
    for (let i = 0; i < 8; i++) {
      const key = `${qYear}-Q${qIdx + 1}`;
      const label = `Q${qIdx + 1} ${qYear}`;
      out.push({ key, label });
      qIdx -= 1;
      if (qIdx < 0) {
        qIdx = 3;
        qYear -= 1;
      }
    }
    return out;
  }

  if (period === "year") {
    return Array.from({ length: 5 }, (_, i) => {
      const y = year - i;
      return { key: `${y}`, label: `${y}` };
    });
  }

  return [{ key: "range", label: "Last 30 days" }];
}

export interface ScorecardWindow {
  from: string;
  to: string;
  label: string;
  tagDate: string;
  fromHuman: string;
  toHuman: string;
}

export function resolveWindow(period: Period, selectionKey: string): ScorecardWindow {
  const ref = new Date(REFERENCE_DATE + "T00:00:00.000Z");
  const refYear = ref.getUTCFullYear();
  const refMonth = ref.getUTCMonth();

  if (period === "year") {
    const year = parseYear(selectionKey, refYear);
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31));
    return {
      from: toIso(from),
      to: toIso(to),
      label: `${year}`,
      tagDate: `${year}`,
      fromHuman: longDate(from),
      toHuman: longDate(to),
    };
  }
  if (period === "quarter") {
    const { year, qIdx } = parseQuarter(selectionKey, refYear, refMonth);
    const qStart = qIdx * 3;
    const from = new Date(Date.UTC(year, qStart, 1));
    const to = new Date(Date.UTC(year, qStart + 3, 0));
    const qLabel = `Q${qIdx + 1} ${year}`;
    return {
      from: toIso(from),
      to: toIso(to),
      label: qLabel,
      tagDate: qLabel,
      fromHuman: longDate(from),
      toHuman: longDate(to),
    };
  }
  if (period === "month") {
    const { year, month } = parseMonth(selectionKey, refYear, refMonth);
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 0));
    return {
      from: toIso(from),
      to: toIso(to),
      label: from.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      tagDate: `${year}-${String(month + 1).padStart(2, "0")}`,
      fromHuman: longDate(from),
      toHuman: longDate(to),
    };
  }

  const to = new Date(Date.UTC(refYear, refMonth, ref.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: toIso(from),
    to: toIso(to),
    label: "Last 30 days",
    tagDate: "Custom",
    fromHuman: longDate(from),
    toHuman: longDate(to),
  };
}

function parseYear(key: string, fallback: number): number {
  const n = parseInt(key, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseQuarter(
  key: string,
  fallbackYear: number,
  fallbackMonth: number,
): { year: number; qIdx: number } {
  const m = /^(\d{4})-Q([1-4])$/.exec(key);
  if (!m) {
    return { year: fallbackYear, qIdx: Math.floor(fallbackMonth / 3) };
  }
  return { year: Number(m[1]), qIdx: Number(m[2]) - 1 };
}

function parseMonth(
  key: string,
  fallbackYear: number,
  fallbackMonth: number,
): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return { year: fallbackYear, month: fallbackMonth };
  return { year: Number(m[1]), month: Number(m[2]) - 1 };
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------- Hero ------------------------------------------------------------

export function HeroGrade({
  grade,
  name,
  email,
  label = "Performance grade",
}: {
  grade: { letter: string; tone: GradeTone };
  name: string;
  email?: string;
  label?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-semibold",
            GRADE_BG[grade.tone],
            GRADE_FG[grade.tone],
          )}
        >
          {grade.letter}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {name}
          </div>
          {email ? (
            <div className="truncate text-xs text-zinc-500">{email}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function HeroStat({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {icon ? (
          <span className="grid h-5 w-5 place-items-center rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {suffix ? (
          <span className="text-sm text-zinc-400 tabular-nums">{suffix}</span>
        ) : null}
      </div>
    </Card>
  );
}

// ---------- Grades ----------------------------------------------------------

export type GradeTone = "emerald" | "indigo" | "amber" | "rose";

export const GRADE_BG: Record<GradeTone, string> = {
  emerald: "bg-emerald-50 dark:bg-emerald-950/40",
  indigo: "bg-indigo-50 dark:bg-indigo-950/40",
  amber: "bg-amber-50 dark:bg-amber-950/40",
  rose: "bg-rose-50 dark:bg-rose-950/40",
};

export const GRADE_FG: Record<GradeTone, string> = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  indigo: "text-indigo-700 dark:text-indigo-400",
  amber: "text-amber-700 dark:text-amber-400",
  rose: "text-rose-700 dark:text-rose-400",
};

export function letterGrade(score: number): { letter: string; tone: GradeTone } {
  if (score >= 95) return { letter: "A+", tone: "emerald" };
  if (score >= 85) return { letter: "A", tone: "emerald" };
  if (score >= 75) return { letter: "B", tone: "indigo" };
  if (score >= 65) return { letter: "C", tone: "amber" };
  if (score >= 50) return { letter: "D", tone: "amber" };
  return { letter: "F", tone: "rose" };
}

// ---------- Scorecard table -------------------------------------------------

export interface ScoreRow {
  id: string;
  label: string;
  description: string;
  unit: "count" | "currency" | "percent";
  weight: number;
  achieved: number;
  target: number;
  /** Achievement clamped to [0, 1] for the progress bar. */
  progress: number;
  /** Achievement × weight, capped at weight. */
  score: number;
  status: "on-track" | "at-risk";
  trend: { date: string; value: number }[];
  /** Used for the "Total points" hero — counts of activity across metrics. */
  rawCount: number;
}

export interface ScorecardTableProps {
  metrics: ScoreRow[];
  /** Optional team-rank lookup keyed by metric id (1 = best in team). */
  rankByMetricId?: Record<string, { rank: number; total: number }>;
  /** Whether to render the Team Rank column. */
  showTeamRank?: boolean;
}

export function ScorecardTable({
  metrics,
  rankByMetricId,
  showTeamRank = false,
}: ScorecardTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
              <Th className="w-[34%]">Metric</Th>
              <Th>Weight</Th>
              <Th className="w-[22%]">Progress</Th>
              <Th className="w-[14%]">Trend</Th>
              <Th align="right">Score</Th>
              {showTeamRank ? <Th align="right">Team Rank</Th> : null}
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <ScoreRowItem
                key={m.id}
                row={m}
                rank={rankByMetricId?.[m.id]}
                showTeamRank={showTeamRank}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ScoreRowItem({
  row,
  rank,
  showTeamRank,
}: {
  row: ScoreRow;
  rank?: { rank: number; total: number };
  showTeamRank: boolean;
}) {
  const tone: GradeTone =
    row.status === "on-track"
      ? "emerald"
      : row.progress >= 0.25
      ? "amber"
      : "rose";
  return (
    <tr className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-0.5 h-3.5 w-0.5 shrink-0 rounded-full bg-amber-400"
          />
          <div className="min-w-0">
            <div className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.label}
            </div>
            <div className="text-xs text-zinc-500">{row.description}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-500 tabular-nums">{row.weight}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={cn(
                "h-full",
                tone === "emerald"
                  ? "bg-emerald-500"
                  : tone === "amber"
                  ? "bg-amber-500"
                  : "bg-rose-500",
              )}
              style={{ width: `${Math.max(2, row.progress * 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
            {formatAchieved(row)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <RowTrend data={row.trend} tone={tone} />
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
        {row.score.toFixed(2)}
      </td>
      {showTeamRank ? (
        <td className="px-4 py-3 text-right text-xs tabular-nums text-zinc-500">
          {rank ? `#${rank.rank}/${rank.total}` : "—"}
        </td>
      ) : null}
      <td className="px-4 py-3 text-right">
        <StatusPill status={row.status} />
      </td>
    </tr>
  );
}

function Th({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function StatusPill({ status }: { status: ScoreRow["status"] }) {
  if (status === "on-track") {
    return (
      <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
        On track
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-rose-50 px-2 text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
      At risk
    </span>
  );
}

const TREND_COLORS: Record<GradeTone, string> = {
  emerald: "#10b981",
  indigo: "#6366f1",
  amber: "#f59e0b",
  rose: "#f43f5e",
};

function RowTrend({
  data,
  tone,
}: {
  data: { date: string; value: number }[];
  tone: GradeTone;
}) {
  if (data.length < 2) {
    return <span className="text-xs text-zinc-300">—</span>;
  }
  const id = `trend-${tone}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TREND_COLORS[tone]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={TREND_COLORS[tone]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="natural"
            dataKey="value"
            stroke={TREND_COLORS[tone]}
            strokeWidth={1.75}
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

function formatAchieved(row: ScoreRow): string {
  if (row.unit === "currency") {
    return `${formatCurrency(row.achieved, "INR")} / ${formatCurrency(row.target, "INR")}`;
  }
  if (row.unit === "percent") {
    return `${Math.round(row.achieved)}% / ${Math.round(row.target)}%`;
  }
  return `${Math.round(row.achieved)} / ${Math.round(row.target)}`;
}

// ---------- Scorecard data builder ------------------------------------------

export function buildScorecard(user: User, window: ScorecardWindow): ScoreRow[] {
  const target = getTargetForUser(user.id);
  const dailyMetrics = getMetricsForUser(user.id, {
    from: window.from,
    to: window.to,
  });
  const myLeads = seedLeads.filter((l) => l.ownerId === user.id);

  const inWindow = (iso: string) =>
    iso >= window.from && iso <= window.to + "T23:59:59.999Z";

  const newLeadsCount = myLeads.filter((l) =>
    l.timeline.some(
      (e) =>
        e.type === "stage-change" &&
        e.toStage === "first-contact" &&
        inWindow(e.timestamp),
    ),
  ).length;

  const meetingsCount = countTimelineByType(myLeads, "meeting", inWindow);
  const callsCount = countTimelineByType(myLeads, "call", inWindow);
  const notesCount = countTimelineByType(myLeads, "note", inWindow);

  const totalDays = daysBetween(window.from, window.to);
  const activeDays = countActiveDays(myLeads, window);
  const disciplinePct = totalDays === 0 ? 0 : (activeDays / totalDays) * 100;

  const pipelineMoved = myLeads
    .filter((l) =>
      l.timeline.some(
        (e) =>
          e.type === "stage-change" &&
          e.toStage === "pitch-delivered" &&
          inWindow(e.timestamp),
      ),
    )
    .reduce((sum, l) => sum + l.value, 0);

  const dealsClosed = aggregateMetricsForKey(dailyMetrics, "dealsClosed", "sum");
  const wonValue = myLeads
    .filter(
      (l) => l.stage === "subscription-closed" && inWindow(l.lastActivityAt),
    )
    .reduce((sum, l) => sum + l.value, 0);

  // Field check-ins — no real source yet; deterministically derive from the
  // user's id so two reps don't coincidentally show the same number.
  const fieldCheckIns = Math.abs(simpleHash(user.id)) % 4;

  const dealsTarget = target?.values.dealsClosed ?? 20;
  const revenueTarget = target?.values.revenue ?? 1_200_000;

  const trendDealsClosed = dailyMetrics
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.values.dealsClosed ?? 0 }));
  const trendRevenue = dailyMetrics
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.values.revenue ?? 0 }));

  const rows: Omit<ScoreRow, "progress" | "score" | "status">[] = [
    {
      id: "new_leads",
      label: "New leads assigned",
      description: "New sales leads created in the period",
      unit: "count",
      weight: 15,
      achieved: newLeadsCount,
      target: 20,
      trend: trendDealsClosed,
      rawCount: newLeadsCount,
    },
    {
      id: "discipline",
      label: "Discipline",
      description: "Logins, Daily visits,",
      unit: "percent",
      weight: 10,
      achieved: disciplinePct,
      target: 80,
      trend: trendDealsClosed,
      rawCount: activeDays,
    },
    {
      id: "meetings",
      label: "Meetings completed",
      description: "Leads moved into meeting-related stages during the period",
      unit: "count",
      weight: 20,
      achieved: meetingsCount,
      target: 8,
      trend: trendDealsClosed,
      rawCount: meetingsCount,
    },
    {
      id: "pipeline_moved",
      label: "Pipeline value moved to proposal",
      description:
        "Estimated INR value for leads in proposal stage during the period",
      unit: "currency",
      weight: 25,
      achieved: pipelineMoved,
      target: revenueTarget,
      trend: trendRevenue,
      rawCount: callsCount,
    },
    {
      id: "deals_won",
      label: "Deals won",
      description: "Leads moved to SUBSCRIPTION_CLOSED in the period",
      unit: "count",
      weight: 20,
      achieved: dealsClosed > 0 ? dealsClosed : wonValue > 0 ? 1 : 0,
      target: dealsTarget > 0 ? Math.min(dealsTarget, 3) : 3,
      trend: trendDealsClosed,
      rawCount: notesCount,
    },
    {
      id: "field_checkins",
      label: "Field check-ins",
      description: "Sales location pins captured during the period",
      unit: "count",
      weight: 10,
      achieved: fieldCheckIns,
      target: 12,
      trend: trendDealsClosed,
      rawCount: fieldCheckIns,
    },
  ];

  return rows.map((r) => {
    const progress = r.target > 0 ? Math.min(1, r.achieved / r.target) : 0;
    const score = progress * r.weight;
    const status: ScoreRow["status"] = progress >= 0.5 ? "on-track" : "at-risk";
    return { ...r, progress, score, status };
  });
}

function countTimelineByType(
  leads: Lead[],
  type: "meeting" | "call" | "note",
  inWindow: (iso: string) => boolean,
): number {
  let n = 0;
  for (const l of leads) {
    for (const e of l.timeline) {
      if (e.type === type && inWindow(e.timestamp)) n += 1;
    }
  }
  return n;
}

function countActiveDays(leads: Lead[], window: ScorecardWindow): number {
  const days = new Set<string>();
  for (const l of leads) {
    for (const e of l.timeline) {
      const date = e.timestamp.slice(0, 10);
      if (date >= window.from && date <= window.to) days.add(date);
    }
  }
  return days.size;
}

function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (Date.parse(to + "T00:00:00.000Z") - Date.parse(from + "T00:00:00.000Z")) /
        86_400_000,
    ) + 1
  );
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// ---------- MRR -------------------------------------------------------------
//
// Monthly recurring revenue contribution for the period — sum of value on
// closed-won leads inside the window. Used by the MRR hero stat in both the
// rep and team views.

export function computeMrrForUser(user: User, window: ScorecardWindow): number {
  const inWindow = (iso: string) =>
    iso >= window.from && iso <= window.to + "T23:59:59.999Z";
  return seedLeads
    .filter((l) => l.ownerId === user.id)
    .filter(
      (l) => l.stage === "subscription-closed" && inWindow(l.lastActivityAt),
    )
    .reduce((sum, l) => sum + l.value, 0);
}

// ---------- Skeleton --------------------------------------------------------

export function ScorecardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-16 animate-pulse" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse" />
        ))}
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
