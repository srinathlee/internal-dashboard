"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { isSalesAdmin, isSalesMember } from "@/lib/access";
import {
  aggregateMetricsForKey,
  aggregatePerUser,
  buildDailySeries,
  getDateWindow,
  primaryMetric,
} from "@/lib/aggregations";
import { progressPct } from "@/lib/format-metric";
import {
  REFERENCE_DATE,
  getMetricsForTeam,
  getMetricsForUser,
  getTargetForUser,
  getTeam,
  getTeamMembers,
  teams,
} from "@/lib/mock-data";
import type {
  DailyMetric,
  MetricDefinition,
  Team,
  TeamId,
  User,
} from "@/lib/types";

import { TrendChart } from "@/components/dashboard/trend-chart";
import { DateRangeFilter, type DateRangeKey } from "./date-range-filter";
import { TeamFilter, type TeamFilterValue } from "./team-filter";
import {
  ContributorBarChart,
  type ContributorDatum,
} from "./contributor-bar-chart";
import { OrgLineChart, type OrgLineSeries } from "./org-line-chart";
import {
  buildCsvFrom,
  ExportCsvButton,
} from "./export-csv-button";
import { MembersTable, type MemberRow } from "./members-table";
import { MemberDailyTable } from "./member-daily-table";
import { SalesAdminPerformance } from "./sales-admin-performance";
import { SalesMemberPerformance } from "./sales-member-performance";

const TEAM_HEX: Record<TeamId, string> = {
  sales: "#3b82f6",
  onboarding: "#14b8a6",
};

/** Synthetic metric used when comparing across teams via % of target. */
const PCT_OF_TARGET_METRIC: MetricDefinition = {
  key: "targetPct",
  label: "% of Target",
  unit: "percent",
  format: "integer",
  aggregation: "avg",
  betterWhen: "higher",
};

export function PerformanceScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [teamFilter, setTeamFilter] = useState<TeamFilterValue>("all");

  if (!auth.isLoaded || !auth.user) return <PerformanceSkeleton />;
  const user = auth.user;

  const window = getDateWindow(range);
  const isSuperAdmin = user.role === "super_admin";
  const showTeamFilter = isSuperAdmin;
  const canExport = isSuperAdmin
    ? auth.can("performance:export:all")
    : auth.can("performance:export:team", user.teamId ? { teamId: user.teamId } : undefined);

  // Sales admin gets the team-overview surface — KPI tiles, status callouts,
  // leaderboard, conversion grid, roster, and activity. Hands "Add associate"
  // off to the existing /team flow so authoring stays in one place.
  if (isSalesAdmin(auth)) {
    return (
      <SalesAdminPerformance
        user={user}
        canAddMember={auth.can("user:invite", { teamId: "sales" })}
        onAddAssociate={() => router.push("/team")}
      />
    );
  }

  // Sales member gets a focused, action-oriented working surface — quota,
  // funnel, and recent activity instead of the daily metrics breakdown.
  if (isSalesMember(auth)) {
    return (
      <SalesMemberPerformance
        user={user}
        range={range}
        onRangeChange={setRange}
      />
    );
  }

  // Other team members keep the original single-user, daily breakdown.
  if (user.role === "member") {
    return (
      <MemberPerformance
        user={user}
        range={range}
        onRangeChange={setRange}
        canExport={canExport}
      />
    );
  }

  // Admin and Super Admin both render the multi-member table view.
  const effectiveScope: "all" | TeamId = isSuperAdmin
    ? teamFilter
    : (user.teamId as TeamId);
  const scopeTeam: Team | null =
    effectiveScope === "all" ? null : getTeam(effectiveScope);

  return (
    <TeamPerformance
      window={window}
      windowKey={range}
      onRangeChange={setRange}
      showTeamFilter={showTeamFilter}
      teamFilter={teamFilter}
      onTeamFilterChange={setTeamFilter}
      scope={effectiveScope}
      scopeTeam={scopeTeam}
      canExport={canExport}
    />
  );
}

// ============================================================
// Member view — single user, line + by-metric bar + daily table
// ============================================================

function MemberPerformance({
  user,
  range,
  onRangeChange,
  canExport,
}: {
  user: User;
  range: DateRangeKey;
  onRangeChange: (k: DateRangeKey) => void;
  canExport: boolean;
}) {
  const window = getDateWindow(range);
  const team = user.teamId ? getTeam(user.teamId) : null;

  if (!team) {
    return (
      <div className="space-y-6">
        <PageHeader title="Performance" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You're not assigned to a team yet.
        </Card>
      </div>
    );
  }

  const myMetrics = getMetricsForUser(user.id, {
    from: window.from,
    to: window.to,
  });
  const target = getTargetForUser(user.id);
  const primary = primaryMetric(team.metrics);
  const lineSeries = buildDailySeries(myMetrics, primary);

  // Bar chart: "by metric" — % of monthly target on each of the team's 4 metrics
  const byMetricBar: ContributorDatum[] = team.metrics.map((m) => {
    const achieved = aggregateMetricsForKey(myMetrics, m.key, m.aggregation);
    const targetVal = target?.values[m.key] ?? 0;
    const pct = targetVal ? progressPct(achieved, targetVal) : 0;
    return {
      shortLabel: m.label.length > 12 ? m.label.slice(0, 12) + "…" : m.label,
      fullLabel: m.label,
      value: pct,
      teamId: team.id,
    };
  });

  const buildCsv = () => {
    const headers = ["Date", ...team.metrics.map((m) => m.label)];
    const rows = myMetrics
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => [r.date, ...team.metrics.map((m) => r.values[m.key] ?? 0)]);
    return buildCsvFrom(headers, rows);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Your performance across all four metrics."
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter value={range} onChange={onRangeChange} />
            {canExport && (
              <ExportCsvButton
                buildCsv={buildCsv}
                filename={`performance-${user.id}-${range}.csv`}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{primary.label}</CardTitle>
            <p className="text-sm text-zinc-500">
              Daily trend · {windowDescription(range)}
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart data={lineSeries} metric={primary} height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By metric</CardTitle>
            <p className="text-sm text-zinc-500">% of monthly target</p>
          </CardHeader>
          <CardContent>
            <ContributorBarChart
              data={byMetricBar}
              metric={PCT_OF_TARGET_METRIC}
              height={260}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily breakdown</CardTitle>
          <p className="text-sm text-zinc-500">{myMetrics.length} days</p>
        </CardHeader>
        <CardContent>
          <MemberDailyTable rows={myMetrics} team={team} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Admin / Super-Admin view — team-wide or org-wide
// ============================================================

function TeamPerformance({
  window,
  windowKey,
  onRangeChange,
  showTeamFilter,
  teamFilter,
  onTeamFilterChange,
  scope,
  scopeTeam,
  canExport,
}: {
  window: { from: string; to: string };
  windowKey: DateRangeKey;
  onRangeChange: (k: DateRangeKey) => void;
  showTeamFilter: boolean;
  teamFilter: TeamFilterValue;
  onTeamFilterChange: (v: TeamFilterValue) => void;
  scope: "all" | TeamId;
  scopeTeam: Team | null;
  canExport: boolean;
}) {
  // Pull the right slice of metrics
  const inWindow = (m: DailyMetric) =>
    m.date >= window.from && m.date <= window.to;

  const memberRows: MemberRow[] = useMemo(() => {
    const teamsInScope: Team[] =
      scope === "all" ? teams : [getTeam(scope)];
    const out: MemberRow[] = [];
    for (const team of teamsInScope) {
      const members = getTeamMembers(team.id);
      const teamMetrics = getMetricsForTeam(team.id).filter(inWindow);
      const primary = primaryMetric(team.metrics);
      const perUserPrimary = aggregatePerUser(teamMetrics, primary.key, primary.aggregation);
      for (const m of members) {
        const userRows = teamMetrics.filter((r) => r.userId === m.id);
        const values: Record<string, number> = {};
        for (const def of team.metrics) {
          values[def.key] = aggregateMetricsForKey(
            userRows,
            def.key,
            def.aggregation,
          );
        }
        const target = getTargetForUser(m.id)?.values[primary.key] ?? 0;
        const achievedPrimary = perUserPrimary.get(m.id) ?? 0;
        const targetPct = target ? progressPct(achievedPrimary, target) : 0;
        out.push({ user: m, team, values, targetPct });
      }
    }
    return out;
  }, [scope, window.from, window.to]);

  // Charts
  const lineCard = useMemo(() => {
    if (scope === "all") {
      // Two-line overlay: dealsClosed (Sales) vs clientsOnboarded (Onb)
      const series: OrgLineSeries[] = [
        { key: "sales", label: "Sales · deals", color: TEAM_HEX.sales },
        {
          key: "onboarding",
          label: "Onb · clients",
          color: TEAM_HEX.onboarding,
        },
      ];
      const salesSeries = buildDailySeries(
        getMetricsForTeam("sales").filter(inWindow),
        primaryMetric(getTeam("sales").metrics).key === "revenue"
          ? // Use 'dealsClosed' for comparability with onboarding's count
            { ...primaryMetric(getTeam("sales").metrics), key: "dealsClosed", aggregation: "sum" }
          : primaryMetric(getTeam("sales").metrics),
      );
      const onbSeries = buildDailySeries(
        getMetricsForTeam("onboarding").filter(inWindow),
        primaryMetric(getTeam("onboarding").metrics),
      );
      const dateMap = new Map<string, Record<string, number>>();
      for (const p of salesSeries) {
        dateMap.set(p.date, {
          ...(dateMap.get(p.date) ?? {}),
          sales: p.value,
        });
      }
      for (const p of onbSeries) {
        dateMap.set(p.date, {
          ...(dateMap.get(p.date) ?? {}),
          onboarding: p.value,
        });
      }
      const data = Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({
          date,
          sales: values.sales ?? 0,
          onboarding: values.onboarding ?? 0,
        }));
      const sharedMetric: MetricDefinition = {
        key: "count",
        label: "30-day output",
        unit: "count",
        format: "integer",
        aggregation: "sum",
        betterWhen: "higher",
      };
      return { kind: "org" as const, data, series, metric: sharedMetric };
    }

    if (scopeTeam) {
      const tm = getMetricsForTeam(scopeTeam.id).filter(inWindow);
      const m = primaryMetric(scopeTeam.metrics);
      return {
        kind: "single" as const,
        data: buildDailySeries(tm, m),
        metric: m,
      };
    }
    return null;
  }, [scope, scopeTeam, window.from, window.to]);

  const barData: ContributorDatum[] = useMemo(() => {
    if (scope === "all") {
      // Rank everyone by % of target on their primary
      return memberRows
        .slice()
        .sort((a, b) => b.targetPct - a.targetPct)
        .map((r) => ({
          shortLabel: r.user.name.split(" ")[0] ?? r.user.name,
          fullLabel: `${r.user.name} · ${r.team.name}`,
          value: r.targetPct,
          teamId: r.team.id,
        }));
    }
    if (!scopeTeam) return [];
    const primary = primaryMetric(scopeTeam.metrics);
    return memberRows
      .slice()
      .sort((a, b) =>
        primary.betterWhen === "higher"
          ? (b.values[primary.key] ?? 0) - (a.values[primary.key] ?? 0)
          : (a.values[primary.key] ?? 0) - (b.values[primary.key] ?? 0),
      )
      .map((r) => ({
        shortLabel: r.user.name.split(" ")[0] ?? r.user.name,
        fullLabel: r.user.name,
        value: r.values[primary.key] ?? 0,
        teamId: r.team.id,
      }));
  }, [memberRows, scope, scopeTeam]);

  const barMetric: MetricDefinition = useMemo(() => {
    if (scope === "all" || !scopeTeam) return PCT_OF_TARGET_METRIC;
    return primaryMetric(scopeTeam.metrics);
  }, [scope, scopeTeam]);

  const buildCsv = () => {
    if (scope === "all") {
      const headers = [
        "Name",
        "Email",
        "Team",
        "Role",
        "Primary metric value",
        "Target %",
        "Last active",
      ];
      const rows = memberRows.map((r) => {
        const primary = primaryMetric(r.team.metrics);
        return [
          r.user.name,
          r.user.email,
          r.team.name,
          r.user.role,
          r.values[primary.key] ?? 0,
          r.targetPct.toFixed(1),
          r.user.lastActiveAt,
        ];
      });
      return buildCsvFrom(headers, rows);
    }
    if (!scopeTeam) return "";
    const headers = [
      "Name",
      "Email",
      ...scopeTeam.metrics.map((m) => m.label),
      "Target %",
    ];
    const rows = memberRows.map((r) => [
      r.user.name,
      r.user.email,
      ...scopeTeam.metrics.map((m) => r.values[m.key] ?? 0),
      r.targetPct.toFixed(1),
    ]);
    return buildCsvFrom(headers, rows);
  };

  const title =
    scope === "all"
      ? "Org performance"
      : `${scopeTeam?.name ?? ""} performance`;
  const description =
    scope === "all"
      ? `${memberRows.length} members across ${teams.length} teams`
      : `${memberRows.length} members on ${scopeTeam?.name ?? ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter value={windowKey} onChange={onRangeChange} />
            {showTeamFilter && (
              <TeamFilter value={teamFilter} onChange={onTeamFilterChange} />
            )}
            {canExport && (
              <ExportCsvButton
                buildCsv={buildCsv}
                filename={`performance-${scope}-${windowKey}.csv`}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {scope === "all"
                ? "Sales vs Onboarding"
                : primaryMetric(scopeTeam!.metrics).label}
            </CardTitle>
            <p className="text-sm text-zinc-500">
              {windowDescription(windowKey)}
              {scope === "all" && " · units: count"}
            </p>
          </CardHeader>
          <CardContent>
            {lineCard?.kind === "org" ? (
              <OrgLineChart
                data={lineCard.data}
                series={lineCard.series}
                metric={lineCard.metric}
                height={260}
              />
            ) : lineCard?.kind === "single" ? (
              <TrendChart
                data={lineCard.data}
                metric={lineCard.metric}
                height={260}
              />
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {scope === "all" ? "Members ranked" : "Top contributors"}
            </CardTitle>
            <p className="text-sm text-zinc-500">
              {scope === "all"
                ? "By % of monthly target"
                : `By ${primaryMetric(scopeTeam!.metrics).label.toLowerCase()}`}
            </p>
          </CardHeader>
          <CardContent>
            <ContributorBarChart
              data={barData}
              metric={barMetric}
              height={260}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <p className="text-sm text-zinc-500">
            {windowDescription(windowKey)}
          </p>
        </CardHeader>
        <CardContent>
          <MembersTable
            rows={memberRows}
            scope={scope === "all" ? "all" : "single-team"}
            team={scopeTeam ?? undefined}
            nowIso={`${REFERENCE_DATE}T12:00:00.000Z`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function windowDescription(key: DateRangeKey): string {
  if (key === "7d") return "Last 7 days";
  if (key === "30d") return "Last 30 days";
  return "Quarter (last 90 days)";
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-72 animate-pulse" />
        <Card className="h-72 animate-pulse" />
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}

