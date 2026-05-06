"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Share2,
  Trophy,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
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

type Period = "month" | "quarter" | "year" | "range";

const PERIOD_LABELS: Record<Period, string> = {
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  range: "Range",
};

/**
 * Sales-member scorecard. Single-rep view that scores the period against six
 * weighted metrics, surfaces a letter grade based on the weighted total, and
 * lists the per-metric breakdown so the rep knows where to push.
 *
 * Strictly scoped to `isSalesMember` — admins and super-admins use the
 * org-wide Performance views instead.
 */
export function ScorecardScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  // Selection key whose meaning depends on `period`:
  //   month   → "YYYY-MM"
  //   quarter → "YYYY-Qn"
  //   year    → "YYYY"
  //   range   → reserved for the custom-range picker (single option for now)
  const [selectionKey, setSelectionKey] = useState<string>(() =>
    defaultSelectionFor("month"),
  );

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    setSelectionKey(defaultSelectionFor(next));
  };

  const options = useMemo(() => buildOptions(period), [period]);

  if (!auth.isLoaded) return <Skeleton />;

  if (!isSalesMember(auth) || !auth.user) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales scorecard" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          The scorecard is for individual sales reps. Admins and super-admins
          should use the Performance views instead.
        </Card>
      </div>
    );
  }

  const user = auth.user;
  const window = resolveWindow(period, selectionKey);
  const metrics = useMemo(
    () => buildScorecard(user, window),
    [user, window.from, window.to],
  );

  const totalPoints = metrics.reduce((sum, m) => sum + m.rawCount, 0);
  const weightedScore = metrics.reduce((sum, m) => sum + m.score, 0);
  const grade = letterGrade(weightedScore);
  const winValue = metrics.find((m) => m.id === "deals_won")?.achieved ?? 0;

  const onTrack = metrics.filter((m) => m.status === "on-track").length;
  const atRisk = metrics.filter((m) => m.status === "at-risk").length;
  const distribution = metrics.length === 0 ? 0 : (onTrack / metrics.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Sales scorecard
            </h1>
            <p className="text-sm text-zinc-500">
              Choose the reporting period. Everything below uses that same time range.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4">
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
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 items-center rounded-full bg-zinc-100 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {periodTagLabel(period)}
          </span>
          <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
            {window.tagDate}
          </span>
          <span className="text-sm text-zinc-500">
            ({window.fromHuman} – {window.toHuman})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share with manager
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export PDF
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroGrade
          grade={grade}
          name={user.name.split(" ")[0] ?? user.name}
          email={user.email}
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
        <HeroStat
          label="Win"
          value={formatCurrency(winValue, "INR")}
        />
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
            <span className="font-medium text-rose-600 dark:text-rose-400">
              {atRisk} at risk
            </span>
          </div>
        </div>
        {atRisk > 0 ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
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

      <ScorecardTable metrics={metrics} />

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p>
          Weighted score is the sum of each metric's progress (capped at 100%)
          times its weight. Grades land at A+ ≥95, A ≥85, B ≥75, C ≥65, D ≥50,
          F &lt;50.
        </p>
        <p className="mt-1">
          Calculated against {user.name.split(" ")[0]}'s targets for{" "}
          {window.tagDate}.
        </p>
      </div>
    </div>
  );
}

// ---------- Period -----------------------------------------------------

function PeriodTabs({
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

function periodTagLabel(p: Period): string {
  if (p === "month") return "Monthly";
  if (p === "quarter") return "Quarterly";
  if (p === "year") return "Yearly";
  return "Custom";
}

interface PeriodOption {
  /** Stable id used as the selection key. */
  key: string;
  /** Label rendered in the dropdown row. */
  label: string;
}

function PeriodValueDropdown({
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

function defaultSelectionFor(period: Period): string {
  const ref = new Date(REFERENCE_DATE + "T00:00:00.000Z");
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  if (period === "month") return `${year}-${String(month + 1).padStart(2, "0")}`;
  if (period === "quarter") return `${year}-Q${Math.floor(month / 3) + 1}`;
  if (period === "year") return `${year}`;
  return "range";
}

function buildOptions(period: Period): PeriodOption[] {
  const ref = new Date(REFERENCE_DATE + "T00:00:00.000Z");
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();

  if (period === "month") {
    // Last 12 months ending at the reference month, newest first.
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
    let qIdx = Math.floor(month / 3); // 0..3
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
    // 5 years ending at the reference year, newest first.
    return Array.from({ length: 5 }, (_, i) => {
      const y = year - i;
      return { key: `${y}`, label: `${y}` };
    });
  }

  // range — single placeholder for now until a real picker lands.
  return [{ key: "range", label: "Last 30 days" }];
}

interface ScorecardWindow {
  from: string;
  to: string;
  /** Compact label shown in the period chip — e.g. "May, 2026". */
  label: string;
  /** Tag chip inside the period bar — e.g. "2026-05". */
  tagDate: string;
  /** Long-form bounds shown in parens. */
  fromHuman: string;
  toHuman: string;
}

function resolveWindow(period: Period, selectionKey: string): ScorecardWindow {
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

  // range fallback — last 30 days from REFERENCE_DATE
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

// ---------- Hero --------------------------------------------------------

function HeroGrade({
  grade,
  name,
  email,
}: {
  grade: { letter: string; tone: GradeTone };
  name: string;
  email: string;
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
            Performance grade
          </div>
          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {name}
          </div>
          <div className="truncate text-xs text-zinc-500">{email}</div>
        </div>
      </div>
    </Card>
  );
}

function HeroStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
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

// ---------- Grades ------------------------------------------------------

type GradeTone = "emerald" | "indigo" | "amber" | "rose";

const GRADE_BG: Record<GradeTone, string> = {
  emerald: "bg-emerald-50 dark:bg-emerald-950/40",
  indigo: "bg-indigo-50 dark:bg-indigo-950/40",
  amber: "bg-amber-50 dark:bg-amber-950/40",
  rose: "bg-rose-50 dark:bg-rose-950/40",
};

const GRADE_FG: Record<GradeTone, string> = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  indigo: "text-indigo-700 dark:text-indigo-400",
  amber: "text-amber-700 dark:text-amber-400",
  rose: "text-rose-700 dark:text-rose-400",
};

function letterGrade(score: number): { letter: string; tone: GradeTone } {
  if (score >= 95) return { letter: "A+", tone: "emerald" };
  if (score >= 85) return { letter: "A", tone: "emerald" };
  if (score >= 75) return { letter: "B", tone: "indigo" };
  if (score >= 65) return { letter: "C", tone: "amber" };
  if (score >= 50) return { letter: "D", tone: "amber" };
  return { letter: "F", tone: "rose" };
}

// ---------- Scorecard table --------------------------------------------

interface ScoreRow {
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

function ScorecardTable({ metrics }: { metrics: ScoreRow[] }) {
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
              <Th align="right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <ScoreRowItem key={m.id} row={m} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ScoreRowItem({ row }: { row: ScoreRow }) {
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

// ---------- Scorecard data builder -------------------------------------

function buildScorecard(
  user: User,
  window: ScorecardWindow,
): ScoreRow[] {
  const target = getTargetForUser(user.id);
  const dailyMetrics = getMetricsForUser(user.id, {
    from: window.from,
    to: window.to,
  });
  const myLeads = seedLeads.filter((l) => l.ownerId === user.id);

  const inWindow = (iso: string) => iso >= window.from && iso <= window.to + "T23:59:59.999Z";

  const newLeadsCount = myLeads.filter((l) =>
    l.timeline.some(
      (e) => e.type === "stage-change" && e.toStage === "first-contact" && inWindow(e.timestamp),
    ),
  ).length;

  const meetingsCount = countTimelineByType(myLeads, "meeting", inWindow);
  const callsCount = countTimelineByType(myLeads, "call", inWindow);
  const notesCount = countTimelineByType(myLeads, "note", inWindow);

  // Discipline = days with at least one timeline event / days in period.
  const totalDays = daysBetween(window.from, window.to);
  const activeDays = countActiveDays(myLeads, window);
  const disciplinePct = totalDays === 0 ? 0 : (activeDays / totalDays) * 100;

  // Pipeline value moved to proposal (pitch-delivered) — sum of values for
  // leads whose latest stage entered pitch-delivered within the window.
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
      (l) =>
        l.stage === "subscription-closed" && inWindow(l.lastActivityAt),
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
      description: "New leads created in the period.",
      unit: "count",
      weight: 15,
      achieved: newLeadsCount,
      target: 0,
      trend: trendDealsClosed,
      rawCount: newLeadsCount,
    },
    {
      id: "discipline",
      label: "Discipline",
      description: "Logging discipline (daily activity rate).",
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
      description: "Leads moved into meeting-related stages during the period.",
      unit: "count",
      weight: 20,
      achieved: meetingsCount,
      target: 0,
      trend: trendDealsClosed,
      rawCount: meetingsCount,
    },
    {
      id: "pipeline_moved",
      label: "Pipeline value moved to proposal",
      description: "Estimated INR value for leads moved to pitch delivered during the period.",
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
      description: "Leads moved to subscription closed during the period.",
      unit: "count",
      weight: 20,
      achieved: dealsClosed > 0 ? dealsClosed : (wonValue > 0 ? 1 : 0),
      target: dealsTarget,
      trend: trendDealsClosed,
      rawCount: notesCount,
    },
    {
      id: "field_checkins",
      label: "Field check-ins",
      description: "Geo location pins captured during the period.",
      unit: "count",
      weight: 10,
      achieved: fieldCheckIns,
      target: 8,
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

// ---------- Skeleton ---------------------------------------------------

function Skeleton() {
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
