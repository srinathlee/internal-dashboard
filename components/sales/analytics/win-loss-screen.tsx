"use client";

import { useState } from "react";
import {
  Award,
  ChevronRight,
  Clock,
  Layers,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdminOrSuperAdmin } from "@/lib/access";
import { getInitials } from "@/lib/format";
import { errorMessage } from "@/lib/hooks/use-async";
import { useWinLossAnalytics } from "@/lib/hooks/use-analytics";
import type { WinLossPeriod } from "@/lib/api/sales-analytics";
import { cn } from "@/lib/utils";

const PERIODS: { value: WinLossPeriod; label: string }[] = [
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "quarterly", label: "This quarter" },
  { value: "half_yearly", label: "This half" },
  { value: "yearly", label: "This year" },
];

const REASON_COLORS = [
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#6366f1", // indigo
  "#ec4899", // pink
];

const HUMAN_REASON: Record<string, string> = {
  pricing: "Pricing",
  timing: "Timing",
  competitor: "Competitor",
  "no-budget": "No budget",
  "lost-contact": "Lost contact",
  "wrong-fit": "Wrong fit",
  other: "Other",
};

export function WinLossScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<WinLossPeriod>("monthly");
  // When a rep row is tapped we re-fetch scoped to that rep (§7). Holding the
  // name too lets us label the drill-down banner without another lookup.
  const [selectedRep, setSelectedRep] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { data, isLoading, error } = useWinLossAnalytics(
    period,
    selectedRep?.id,
  );

  if (!auth.isLoaded) {
    return (
      <div className="space-y-4">
        <Card className="h-20 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (!isSalesAdminOrSuperAdmin(auth)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Win / loss" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          Analytics is for sales admins and super admins.
        </Card>
      </div>
    );
  }

  const reasonsData =
    data?.reasons.map((r) => ({
      reason: HUMAN_REASON[r.reason] ?? r.reason,
      count: r.count,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Win / loss"
        description="Why deals close — and why they don't. Filter by period to spot trends."
        actions={
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as WinLossPeriod)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {selectedRep ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-violet-200 bg-violet-50/60 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-950/30">
          <span className="text-sm text-zinc-700 dark:text-zinc-200">
            Viewing{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {selectedRep.name}
            </span>{" "}
            — per-rep breakdown
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRep(null)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Back to team
          </Button>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage(error)}
        </Card>
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Kpi
          icon={TrendingUp}
          label="Won"
          value={isLoading ? "—" : String(data?.won ?? 0)}
          tone="emerald"
        />
        <Kpi
          icon={TrendingDown}
          label="Lost"
          value={isLoading ? "—" : String(data?.lost ?? 0)}
          tone="rose"
        />
        <Kpi
          icon={Target}
          label="Win rate"
          value={
            isLoading
              ? "—"
              : data?.win_rate === undefined
                ? "—"
                : `${Math.round(data.win_rate)}%`
          }
          tone="violet"
        />
        <Kpi
          icon={Layers}
          label="Pipeline"
          value={isLoading ? "—" : String(data?.total_pipeline ?? 0)}
          tone="sky"
        />
        <Kpi
          icon={Clock}
          label="Avg days to win"
          value={
            isLoading
              ? "—"
              : data?.avg_days_to_win
                ? `${Math.round(data.avg_days_to_win)}d`
                : "—"
          }
          tone="zinc"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Loss reasons</h3>
          <p className="text-xs text-zinc-500">
            Where deals are slipping out of the pipeline.
          </p>
          <div className="mt-4 h-64">
            {reasonsData.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                {isLoading ? "Loading…" : "No lost deals in this period."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonsData}
                    dataKey="count"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {reasonsData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={REASON_COLORS[i % REASON_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {reasonsData.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {reasonsData.map((r, i) => (
                <div key={r.reason} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        REASON_COLORS[i % REASON_COLORS.length],
                    }}
                    aria-hidden
                  />
                  <span className="truncate">{r.reason}</span>
                  <span className="ml-auto tabular-nums text-zinc-500">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">Per-rep win rate</h3>
          <p className="text-xs text-zinc-500">
            Bars are total closed (won + lost). The percent is win rate.
          </p>
          <div className="mt-4 h-64">
            {(data?.by_rep ?? []).length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                {isLoading ? "Loading…" : "No closed deals in this period."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data?.by_rep.map((r) => ({
                    name: r.user_name,
                    won: r.won,
                    lost: r.lost,
                    win_rate: Math.round(r.win_rate),
                  }))}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-zinc-200 dark:stroke-zinc-800"
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                  <Bar dataKey="won" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <Users className="h-4 w-4 text-zinc-500" aria-hidden />
          <h3 className="text-sm font-semibold">Rep breakdown</h3>
          <span className="ml-auto text-xs text-zinc-400">
            Tap a rep to drill in
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50/40 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/40">
            <tr className="text-left">
              <th className="px-5 py-2 font-semibold">Rep</th>
              <th className="px-5 py-2 text-right font-semibold">Won</th>
              <th className="px-5 py-2 text-right font-semibold">Lost</th>
              <th className="px-5 py-2 text-right font-semibold">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {(data?.by_rep ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-sm text-zinc-500"
                >
                  {isLoading ? "Loading…" : "No reps closed deals in this period."}
                </td>
              </tr>
            ) : (
              data?.by_rep.map((r) => {
                const active = selectedRep?.id === r.user_id;
                return (
                  <tr
                    key={r.user_id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() =>
                      setSelectedRep({ id: r.user_id, name: r.user_name })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRep({ id: r.user_id, name: r.user_name });
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-t border-zinc-100 transition-colors hover:bg-zinc-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:border-zinc-800 dark:hover:bg-zinc-900/40",
                      active && "bg-violet-50/50 dark:bg-violet-950/20",
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(r.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.user_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {r.won}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      {r.lost}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                        {r.win_rate >= 50 ? (
                          <Award className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                        ) : null}
                        {Math.round(r.win_rate)}%
                        <ChevronRight
                          className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600"
                          aria-hidden
                        />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  tone: "emerald" | "rose" | "violet" | "sky" | "zinc";
}) {
  const toneClass = {
    emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    rose: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
    violet: "text-violet-500 bg-violet-50 dark:bg-violet-950/40",
    sky: "text-sky-500 bg-sky-50 dark:bg-sky-950/40",
    zinc: "text-zinc-500 bg-zinc-100 dark:bg-zinc-900",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-md", toneClass)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </div>
    </Card>
  );
}
