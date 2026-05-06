"use client";

import { Award, Target as TargetIcon, TrendingUp } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

import {
  aggregateMetricsForKey,
  aggregatePerUser,
  buildDailySeries,
  primaryMetric,
  rankAmong,
} from "@/lib/aggregations";
import {
  formatMetric,
  formatPercent,
  progressPct,
} from "@/lib/format-metric";
import {
  REFERENCE_DATE,
  getActivityForUser,
  getMetricsForTeam,
  getMetricsForUser,
  getTargetForUser,
  getTeam,
} from "@/lib/mock-data";
import type { User } from "@/lib/types";

import { KpiCard } from "./kpi-card";
import { TrendChart } from "./trend-chart";
import { ActivityList } from "./activity-list";

interface MemberDashboardProps {
  user: User;
}

export function MemberDashboard({ user }: MemberDashboardProps) {
  if (!user.teamId) {
    // A member without a team would be a data error — render an empty state.
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Your performance at a glance." />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You're not assigned to a team yet. An admin will add you shortly.
        </Card>
      </div>
    );
  }

  const team = getTeam(user.teamId);
  const metric = primaryMetric(team.metrics);

  const myMetrics = getMetricsForUser(user.id);
  const teamMetrics = getMetricsForTeam(user.teamId);
  const target = getTargetForUser(user.id);
  const targetValue = target?.values[metric.key] ?? 0;

  const achieved = aggregateMetricsForKey(myMetrics, metric.key, metric.aggregation);
  const pct = progressPct(achieved, targetValue);

  const perUser = aggregatePerUser(teamMetrics, metric.key, metric.aggregation);
  const { rank, total } = rankAmong(perUser, user.id, metric.betterWhen);

  // Halve the window for "previous period" trend comparison
  const series = buildDailySeries(myMetrics, metric);
  const half = Math.floor(series.length / 2);
  const recent = series.slice(half).reduce((s, d) => s + d.value, 0);
  const previous = series.slice(0, half).reduce((s, d) => s + d.value, 0);
  const changePct = previous > 0 ? ((recent - previous) / previous) * 100 : 0;

  const activity = getActivityForUser(user.id, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`Your ${team.name} performance over the last 30 days.`}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="My target"
          icon={TargetIcon}
          value={targetValue ? formatMetric(targetValue, metric) : "—"}
          hint={`Monthly · ${metric.label}`}
        />
        <KpiCard
          label="Achieved"
          icon={TrendingUp}
          value={formatMetric(achieved, metric)}
          hint={`Last 30 days`}
          trend={{ changePct, betterWhen: metric.betterWhen }}
        />
        <KpiCard
          label="Progress"
          value={targetValue ? formatPercent(pct, 0) : "—"}
          hint={
            targetValue
              ? `${formatMetric(achieved, metric)} of ${formatMetric(targetValue, metric)}`
              : "No target set"
          }
        />
        <KpiCard
          label="Rank"
          icon={Award}
          value={`#${rank}`}
          hint={`of ${total} on ${team.name}`}
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{metric.label}</CardTitle>
            <p className="text-sm text-zinc-500">Last 30 days</p>
          </CardHeader>
          <CardContent>
            <TrendChart data={series} metric={metric} height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <p className="text-sm text-zinc-500">Your last actions</p>
          </CardHeader>
          <CardContent>
            <ActivityList entries={activity} nowIso={`${REFERENCE_DATE}T12:00:00.000Z`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

