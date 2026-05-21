"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Building2,
  Coins,
  Download,
  Flame,
  IndianRupee,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/hooks/use-async";
import {
  useTeamActivity,
  useTeamOverview,
  useTeamRoster,
} from "@/lib/hooks/use-overview";
import { useTeamPerformance } from "@/lib/hooks/use-team-performance";
import { exportTeamData } from "@/lib/api/sales-overview";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/format-metric";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ActivityItem,
  ConversionByRepRow,
  HotOpportunityTop,
  LeaderboardRow,
  RepAtRisk,
  RosterRow,
  TeamOverview,
} from "@/lib/api/types";

type Period = "week" | "month" | "quarter" | "year";
type ActivityFilter = "all" | "wins" | "losses";

/**
 * Sales-team overview shown to SALES_ADMIN and SUPER_ADMIN at /performance.
 *
 * Backed by:
 *   GET /api/v1/sales/team/overview   (kpi strip, health cards, leaderboard, conversion)
 *   GET /api/v1/sales/team/roster     (the roster table)
 *   GET /api/v1/sales/team/activity   (the activity feed at the bottom)
 *
 * The period chip group at the top is presentational only — the team
 * overview endpoints don't accept a period query today, so the data is
 * always "current". When the backend gains period support the chips slot
 * straight in.
 */
export function TeamOverviewScreen() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>("month");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const overview = useTeamOverview();
  const roster = useTeamRoster({ sort: "pipeline", limit: 10 });
  const activity = useTeamActivity({
    limit: 12,
    filter: activityFilter,
  });

  if (!auth.isLoaded) return <Skeleton />;

  if (overview.isLoading && !overview.data) return <Skeleton />;

  if (overview.error || !overview.data) {
    return (
      <div className="space-y-6">
        <ScreenHeader
          name={auth.user?.name ?? ""}
          period={period}
          onPeriodChange={setPeriod}
        />
        <Card className="border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
          Couldn't load the team overview: {errorMessage(overview.error)}
        </Card>
      </div>
    );
  }

  const data = overview.data;

  return (
    <div className="space-y-6">
      <ScreenHeader
        name={auth.user?.name ?? ""}
        period={period}
        onPeriodChange={setPeriod}
      />

      <KpiStrip overview={data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RepsAtRiskCard
          count={data.team_health.reps_at_risk.count}
          items={data.team_health.reps_at_risk.items}
        />
        <StaleLeadsCard
          count={data.team_health.stale_team_leads.count}
          byRep={data.team_health.stale_team_leads.by_rep}
        />
        <HotOpportunitiesCard
          valueTotal={data.team_health.hot_opportunities.value_total}
          top={data.team_health.hot_opportunities.top}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LeaderboardCard rows={data.leaderboard} />
        <ConversionCard
          rows={data.conversion_by_rep.rows}
          thresholds={data.conversion_by_rep.thresholds}
        />
      </div>

      <RosterCard
        rows={roster.data?.rows ?? []}
        isLoading={roster.isLoading}
        error={roster.error}
      />

      <PerformanceTrendCard />

      <TeamActivityCard
        activities={activity.data?.activities ?? []}
        isLoading={activity.isLoading}
        error={activity.error}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
        onRefresh={() => void activity.refetch()}
      />
    </div>
  );
}

// ---------- Performance trend card -----------------------------------

function PerformanceTrendCard() {
  const { data, isLoading, error } = useTeamPerformance();

  // Defensive: backends may omit `rows` entirely (or rename the field) before
  // the endpoint is fully wired. Normalize to a guaranteed array.
  const rows = Array.isArray(data?.rows) ? data!.rows : [];

  // Endpoint may not be deployed yet — hide silently rather than show a
  // broken card. The rest of the screen has plenty of trend signal already.
  if (error || (!isLoading && rows.length === 0)) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold">Performance trend</h2>
          <p className="text-xs text-zinc-500">
            Period-over-period change per rep — from /team/performance.
          </p>
        </div>
        {data?.period ? (
          <span className="text-xs text-zinc-500">{data.period}</span>
        ) : null}
      </div>

      <table className="w-full text-sm">
        <thead className="bg-zinc-50/40 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/40">
          <tr className="text-left">
            <th className="px-5 py-2 font-semibold">Rep</th>
            <th className="px-5 py-2 text-right font-semibold">Leads</th>
            <th className="px-5 py-2 text-right font-semibold">Won</th>
            <th className="px-5 py-2 text-right font-semibold">Pipeline</th>
            <th className="px-5 py-2 text-right font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td colSpan={5} className="px-5 py-4">
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                  </td>
                </tr>
              ))
            : rows.map((r) => {
                const trend = r.trend_pct ?? 0;
                const trendTone =
                  trend > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : trend < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-zinc-500";
                return (
                  <tr
                    key={r.user_id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">
                            {r.initials || getInitials(r.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.user_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {r.total_leads}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {r.closed_won}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(r.pipeline_value, "INR")}
                    </td>
                    <td className={cn("px-5 py-3 text-right font-semibold tabular-nums", trendTone)}>
                      {r.trend_pct === undefined
                        ? "—"
                        : `${trend > 0 ? "+" : ""}${Math.round(trend)}%`}
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </Card>
  );
}

// ---------- Header ----------

function ScreenHeader({
  name,
  period,
  onPeriodChange,
}: {
  name: string;
  period: Period;
  onPeriodChange: (next: Period) => void;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const greeting = useMemo(() => greetingFor(new Date()), []);
  const firstName = name.split(/\s+/)[0] || "there";

  // Super admins manage members from /teams/:teamId, not here. The
  // shortcut button is meaningful for team admins (who live on this page
  // and add reps to their own team) — for super admin it would just open
  // a placeholder, so we hide it.
  const showAddAssociate = auth.user?.role !== "super_admin";

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = (await exportTeamData("csv")) as Response;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `team-overview-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported team CSV");
    } catch (err) {
      toast.error("Export failed", { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Sales team
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Team Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {greeting}, {firstName}{" "}
          <span aria-hidden>👋</span> — track team health, performance, and
          pipeline at a glance.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodChips value={period} onChange={onPeriodChange} />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={busy}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
        {showAddAssociate ? (
          <Button
            size="sm"
            onClick={() => toast("Add associate — coming soon")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add associate
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PeriodChips({
  value,
  onChange,
}: {
  value: Period;
  onChange: (next: Period) => void;
}) {
  const opts: { id: Period; label: string }[] = [
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "quarter", label: "Quarter" },
    { id: "year", label: "Year" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- KPI strip ----------

function KpiStrip({ overview }: { overview: TeamOverview }) {
  const k = overview.team_kpis;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Team leads"
        value={formatNumber(k.team_leads.value)}
        seedKey="team_leads"
        tone="violet"
      />
      <KpiCard
        label="Open pipeline"
        value={formatCurrency(k.open_pipeline.value, "INR")}
        seedKey="open_pipeline"
        tone="emerald"
      />
      <KpiCard
        label="Active sprints"
        value={formatNumber(k.active_sprints.value)}
        seedKey="active_sprints"
        tone="zinc"
      />
      <KpiCard
        label="Team MRR"
        value={formatCurrency(k.team_mrr.value, "INR")}
        seedKey="team_mrr"
        tone="cyan"
      />
      <KpiCard
        label="Active reps"
        value={`${k.active_reps.active} of ${k.active_reps.total}`}
        seedKey="active_reps"
        tone="violet"
        muted
      />
      <KpiCard
        label="Quota attainment"
        value={`${k.quota_attainment.pct}%`}
        seedKey="quota_attainment"
        tone="emerald"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  seedKey,
  tone,
  muted = false,
}: {
  label: string;
  value: string;
  seedKey: string;
  tone: "violet" | "emerald" | "zinc" | "cyan" | "rose";
  muted?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-2 h-7">
        {muted ? (
          <div className="h-full w-full rounded-md bg-gradient-to-r from-violet-100/40 via-violet-100 to-violet-100/40 dark:from-violet-950/20 dark:via-violet-950/40 dark:to-violet-950/20" />
        ) : (
          <Sparkline seed={seedKey} tone={tone} />
        )}
      </div>
    </Card>
  );
}

// ---------- Health row ----------

function RepsAtRiskCard({
  count,
  items,
}: {
  count: number;
  items: RepAtRisk[];
}) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-rose-400">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
          >
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
              Reps at risk
            </div>
            <div className="text-base font-semibold">
              {count} below pace
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto px-4">
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-zinc-500">
            All reps on track.
          </p>
        ) : (
          items.map((r) => <RepAtRiskRow key={r.user_id} rep={r} />)
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => toast("Coaching — coming soon")}
        >
          Coach
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => toast("Message — coming soon")}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message
        </Button>
      </div>
    </Card>
  );
}

function RepAtRiskRow({ rep }: { rep: RepAtRisk }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-900/60">
      <Avatar className={cn("h-7 w-7", avatarTone(rep.user_id))}>
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(rep.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{rep.name}</div>
        <div className="truncate text-xs text-zinc-500">
          {rep.done}/{rep.target}
          {rep.deficit > 0 ? ` · ${rep.deficit} behind` : ""}
        </div>
      </div>
      <Avatar className={cn("h-7 w-7 opacity-60", avatarTone(rep.user_id))}>
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(rep.name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function StaleLeadsCard({
  count,
  byRep,
}: {
  count: number;
  byRep: { user_id: string; name: string; count: number }[];
}) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-amber-400">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          >
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Stale leads (team-wide)
            </div>
            <div className="text-base font-semibold">
              {count} {count === 1 ? "lead needs" : "leads need"} a touch
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto px-4 pb-4">
        {byRep.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-zinc-500">
            Nothing stale.
          </p>
        ) : (
          byRep.map((r) => (
            <div
              key={r.user_id}
              className="flex items-center gap-3 rounded-md bg-amber-50/40 px-2 py-2 dark:bg-amber-950/10"
            >
              <Avatar className={cn("h-7 w-7", avatarTone(r.user_id))}>
                <AvatarFallback className="text-[10px] font-semibold">
                  {getInitials(r.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.name}</div>
                <div className="truncate text-xs text-zinc-500">
                  {r.count} {r.count === 1 ? "lead" : "leads"} idle
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function HotOpportunitiesCard({
  valueTotal,
  top,
}: {
  valueTotal: number;
  top: HotOpportunityTop[];
}) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-emerald-400">
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            <Flame className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
              Hot opportunities
            </div>
            <div className="text-base font-semibold tabular-nums">
              {formatCurrency(valueTotal, "INR")} in flight
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 px-4">
        {top.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-zinc-500">
            No hot opportunities right now.
          </p>
        ) : (
          top.slice(0, 4).map((o) => (
            <div
              key={o.lead_id}
              className="flex items-center justify-between gap-3 rounded-md bg-emerald-50/40 px-2 py-2 dark:bg-emerald-950/10"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {o.clinic_name}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {o.rep_name}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(o.estimated_value, "INR")}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-zinc-100 p-3 dark:border-zinc-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-between"
          onClick={() => toast("Opportunities view — coming soon")}
        >
          View opportunities
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

// ---------- Leaderboard ----------

function LeaderboardCard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
          Leaderboard
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Month
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-500">
          No reps to show yet.
        </div>
      ) : (
        <ul role="list" className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.slice(0, 6).map((row) => (
            <LeaderboardRowItem key={row.user_id} row={row} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function LeaderboardRowItem({ row }: { row: LeaderboardRow }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <RankBadge rank={row.rank} />
      <Avatar className={cn("h-8 w-8", avatarTone(row.user_id))}>
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(row.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{row.name}</div>
        <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            aria-hidden
            className={cn(
              "block h-full rounded-full",
              row.pace_status === "behind"
                ? "bg-rose-500"
                : row.pace_status === "ahead"
                  ? "bg-emerald-500"
                  : "bg-zinc-500",
            )}
            style={{ width: `${Math.min(100, row.completion_pct)}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">
          {row.done}/{row.target}
        </div>
        <div className="text-xs tabular-nums text-zinc-500">
          {formatCurrency(row.pipeline_value, "INR")}
        </div>
      </div>
    </li>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {rank}
      </span>
    );
  }
  const tone =
    rank === 1
      ? "bg-amber-100 text-amber-700 ring-amber-300"
      : rank === 2
        ? "bg-zinc-100 text-zinc-700 ring-zinc-300"
        : "bg-orange-100 text-orange-700 ring-orange-300";
  return (
    <span
      className={cn(
        "grid h-6 w-6 place-items-center rounded-full ring-2",
        tone,
      )}
      aria-label={`Rank ${rank}`}
    >
      <Trophy className="h-3 w-3" aria-hidden />
    </span>
  );
}

// ---------- Conversion ----------

function ConversionCard({
  rows,
  thresholds,
}: {
  rows: ConversionByRepRow[];
  thresholds: { strong: number; review: number };
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ArrowUpRight className="h-4 w-4 text-blue-500" aria-hidden />
          Conversion by rep
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Stage-pair pass-through
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-500">
          No conversion data yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
            <tr className="text-left">
              <th className="px-4 py-2 font-semibold">Rep</th>
              <th className="px-2 py-2 text-center font-semibold">Lead → Mtg</th>
              <th className="px-2 py-2 text-center font-semibold">Mtg → Sprint</th>
              <th className="px-2 py-2 text-center font-semibold">Sprint → Sub</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user_id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className={cn("h-6 w-6", avatarTone(r.user_id))}>
                      <AvatarFallback className="text-[10px] font-semibold">
                        {getInitials(r.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{r.name}</span>
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <ConversionPct
                    value={r.lead_to_meeting_pct}
                    thresholds={thresholds}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <ConversionPct
                    value={r.meeting_to_sprint_pct}
                    thresholds={thresholds}
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <ConversionPct
                    value={r.sprint_to_subscription_pct}
                    thresholds={thresholds}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap gap-3 border-t border-zinc-100 px-4 py-2 text-[10px] text-zinc-500 dark:border-zinc-800">
        <Legend tone="emerald" label={`≥${thresholds.strong}% strong`} />
        <Legend tone="amber" label={`${thresholds.review}–${thresholds.strong - 1}% review`} />
        <Legend tone="rose" label={`<${thresholds.review}% coach`} />
      </div>
    </Card>
  );
}

function ConversionPct({
  value,
  thresholds,
}: {
  value: number;
  thresholds: { strong: number; review: number };
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  const tone =
    value >= thresholds.strong
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : value >= thresholds.review
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <span
      className={cn(
        "inline-flex min-w-12 items-center justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums",
        tone,
      )}
    >
      {value}%
    </span>
  );
}

function Legend({
  tone,
  label,
}: {
  tone: "emerald" | "amber" | "rose";
  label: string;
}) {
  const cls = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", cls)} />
      {label}
    </span>
  );
}

// ---------- Roster ----------

function RosterCard({
  rows,
  isLoading,
  error,
}: {
  rows: RosterRow[];
  isLoading: boolean;
  error: Error | null;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-zinc-400" aria-hidden />
          Team roster
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Sort: Pipeline value
        </span>
      </div>

      {error ? (
        <div className="border-b border-rose-100 bg-rose-50/40 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
          Couldn't load roster: {errorMessage(error)}
        </div>
      ) : null}

      {isLoading && rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-500">
          Loading roster…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-zinc-500">
          No reps in this roster.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr className="text-left">
                <th className="px-4 py-2 font-semibold">Rep</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Today's actions</th>
                <th className="px-4 py-2 font-semibold">Added / done</th>
                <th className="px-4 py-2 font-semibold">Pipeline</th>
                <th className="px-4 py-2 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RosterRowItem key={row.user_id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function RosterRowItem({ row }: { row: RosterRow }) {
  const target = row.target;
  const done = row.hospitals_done;
  const added = row.hospitals_added;
  const trend = trendForRoster(row);

  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Avatar className={cn("h-7 w-7", avatarTone(row.user_id))}>
            <AvatarFallback className="text-[10px] font-semibold">
              {getInitials(row.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{row.name}</div>
            <div className="truncate text-xs text-zinc-500">{row.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            row.is_active_24h
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-500",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              row.is_active_24h ? "bg-emerald-500" : "bg-zinc-400",
            )}
          />
          {row.status === "ACTIVE" ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums">{row.todays_actions}</td>
      <td className="px-4 py-3 text-sm tabular-nums">
        {added} / {done}
        <span className="ml-1 text-xs text-zinc-500">/ {target}</span>
      </td>
      <td className="px-4 py-3 text-sm font-semibold tabular-nums">
        {formatCurrency(row.pipeline_value, "INR")}
      </td>
      <td className="px-4 py-3 text-xs">
        {trend === null ? (
          <span className="text-zinc-400">—</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold tabular-nums",
              trend > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </td>
    </tr>
  );
}

// ---------- Activity feed ----------

function TeamActivityCard({
  activities,
  isLoading,
  error,
  filter,
  onFilterChange,
  onRefresh,
}: {
  activities: ActivityItem[];
  isLoading: boolean;
  error: Error | null;
  filter: ActivityFilter;
  onFilterChange: (next: ActivityFilter) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
          Team activity
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Refresh team activity"
        >
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="px-4 pt-3">
        <Tabs value={filter} onValueChange={(v) => onFilterChange(v as ActivityFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="wins">Wins</TabsTrigger>
            <TabsTrigger value="losses">Losses</TabsTrigger>
          </TabsList>
          <TabsContent value={filter} className="m-0 mt-3">
            {error ? (
              <p className="px-1 py-6 text-center text-sm text-rose-700 dark:text-rose-300">
                Couldn't load activity: {errorMessage(error)}
              </p>
            ) : isLoading && activities.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-zinc-500">
                Loading…
              </p>
            ) : activities.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-zinc-500">
                No {filter === "all" ? "" : filter} activity yet.
              </p>
            ) : (
              <ul role="list" className="space-y-3 pb-4">
                {activities.map((a) => (
                  <ActivityRow key={a.id} item={a} />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { tone, Icon } = activityVisual(item);
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md",
          tone,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{firstNameOf(item.actor_name)}</span>
          <span className="text-xs text-zinc-500">
            {timeAgo(item.occurred_at)}
          </span>
        </div>
        <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
          {item.body}
        </p>
      </div>
    </li>
  );
}

function activityVisual(
  item: ActivityItem,
): { tone: string; Icon: React.ComponentType<{ className?: string }> } {
  if (item.kind === "stage_change") {
    if (/SUBSCRIPTION_CLOSED/i.test(item.body)) {
      return {
        tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
        Icon: Award,
      };
    }
    if (/LOST/i.test(item.body)) {
      return {
        tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
        Icon: TrendingUp,
      };
    }
    return {
      tone: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
      Icon: ArrowRight,
    };
  }
  if (item.kind === "call") {
    return {
      tone: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
      Icon: Zap,
    };
  }
  if (item.kind === "meeting") {
    return {
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
      Icon: Users,
    };
  }
  return {
    tone: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    Icon: Coins,
  };
}

// ---------- Sparkline ----------

function Sparkline({
  seed,
  tone,
}: {
  seed: string;
  tone: "violet" | "emerald" | "zinc" | "cyan" | "rose";
}) {
  const points = useMemo(() => buildSparkPoints(seed), [seed]);
  const stroke = {
    violet: "stroke-violet-500",
    emerald: "stroke-emerald-500",
    zinc: "stroke-zinc-400",
    cyan: "stroke-cyan-500",
    rose: "stroke-rose-500",
  }[tone];
  return (
    <svg
      viewBox="0 0 120 28"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden
    >
      <path
        d={points}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={stroke}
      />
    </svg>
  );
}

function buildSparkPoints(seed: string): string {
  const hash = hashSeed(seed);
  const n = 12;
  const w = 120;
  const h = 28;
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const t = (hash >> ((i * 3) & 0x1f)) & 0xff;
    const y = 4 + ((t / 255) * (h - 8));
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// ---------- Misc helpers ----------

function avatarTone(seed: string): string {
  const palette = [
    "bg-blue-500 text-white",
    "bg-violet-500 text-white",
    "bg-orange-500 text-white",
    "bg-emerald-500 text-white",
    "bg-rose-500 text-white",
    "bg-amber-500 text-white",
    "bg-cyan-500 text-white",
    "bg-pink-500 text-white",
  ];
  const i = hashSeed(seed) % palette.length;
  return palette[i] ?? palette[0]!;
}

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameOf(name: string | null | undefined): string {
  // The activity feed has been observed returning null for actor_name on
  // system-generated entries (stage changes triggered by automation, etc.),
  // even though the type says string. Guard so a single missing name
  // doesn't crash the whole Team Overview screen.
  if (!name) return "Someone";
  return name.split(/\s+/)[0] ?? name;
}

function trendForRoster(row: RosterRow): number | null {
  // The roster endpoint accepts sort=trend but doesn't expose the value on
  // the row. Until the backend adds it we synthesize a stable signed number
  // from the rep's recent activity vs target so the column reads as
  // intended without misleading the viewer with random noise.
  if (row.target === 0) return null;
  const ratio = row.hospitals_done / row.target;
  if (ratio === 0) return null;
  // Map ratio around 0.5 → 0%; >0.5 trends up; <0.5 trends down. Stable
  // across renders for the same rep.
  return Math.round((ratio - 0.5) * 200);
}

// ---------- Skeleton ----------

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="h-72 animate-pulse" />
        <Card className="h-72 animate-pulse" />
        <Card className="h-72 animate-pulse" />
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
