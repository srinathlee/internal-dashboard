"use client";

import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

import {
  aggregateMetricsForKey,
  aggregatePerUser,
  buildDailySeries,
  primaryMetric,
} from "@/lib/aggregations";
import { formatMetric } from "@/lib/format-metric";
import {
  getMetricsForTeam,
  getTargetForUser,
  getTeam,
  getTeamMembers,
} from "@/lib/mock-data";
import type { User } from "@/lib/types";

import { KpiCard } from "./kpi-card";
import { Leaderboard, type LeaderboardRow } from "./leaderboard";
import { TrendChart } from "./trend-chart";

interface AdminDashboardProps {
  user: User;
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  if (!user.teamId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          No team assigned.
        </Card>
      </div>
    );
  }

  const team = getTeam(user.teamId);
  const teamMetrics = getMetricsForTeam(user.teamId);
  const members = getTeamMembers(user.teamId);

  // 4 KPI cards — one per team-defined metric, with previous-period trend.
  const kpiCards = team.metrics.map((m) => {
    const series = buildDailySeries(teamMetrics, m);
    const half = Math.floor(series.length / 2);
    const recent = collapse(series.slice(half), m.aggregation);
    const previous = collapse(series.slice(0, half), m.aggregation);
    const changePct = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
    const value = aggregateMetricsForKey(teamMetrics, m.key, m.aggregation);
    return { metric: m, value, changePct };
  });

  // Team-level chart of the primary metric (sum/avg per day across members)
  const primary = primaryMetric(team.metrics);
  const teamSeries = buildDailySeries(teamMetrics, primary);

  // Top 5 leaderboard by primary metric
  const perUser = aggregatePerUser(teamMetrics, primary.key, primary.aggregation);
  const sorted = [...members]
    .map((m) => ({
      user: m,
      value: perUser.get(m.id) ?? 0,
      target: getTargetForUser(m.id)?.values[primary.key],
    }))
    .sort((a, b) =>
      primary.betterWhen === "higher" ? b.value - a.value : a.value - b.value,
    );
  const top5: LeaderboardRow[] = sorted.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${team.name} dashboard`}
        description={`Team performance over the last 30 days. ${members.length} members.`}
        actions={
          <Button
            onClick={() =>
              toast.info("Member invites land in Phase 5", {
                description: "The full invite flow is part of Team management.",
              })
            }
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Invite member
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ metric, value, changePct }) => (
          <KpiCard
            key={metric.key}
            label={metric.label}
            value={formatMetric(value, metric)}
            trend={{ changePct, betterWhen: metric.betterWhen }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{primary.label}</CardTitle>
            <p className="text-sm text-zinc-500">
              Team total · last 30 days
            </p>
          </CardHeader>
          <CardContent>
            <TrendChart data={teamSeries} metric={primary} height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top performers</CardTitle>
            <p className="text-sm text-zinc-500">
              Ranked by {primary.label.toLowerCase()}
            </p>
          </CardHeader>
          <CardContent>
            <Leaderboard rows={top5} metric={primary} limit={5} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function collapse(
  series: { value: number }[],
  aggregation: "sum" | "avg" | "last",
): number {
  if (series.length === 0) return 0;
  if (aggregation === "sum") return series.reduce((s, d) => s + d.value, 0);
  if (aggregation === "avg")
    return series.reduce((s, d) => s + d.value, 0) / series.length;
  return series[series.length - 1]?.value ?? 0;
}
