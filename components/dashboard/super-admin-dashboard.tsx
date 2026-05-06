"use client";

import { Briefcase, IndianRupee, Smile, Users } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

import { aggregateMetricsForKey } from "@/lib/aggregations";
import { formatMetric } from "@/lib/format-metric";
import {
  REFERENCE_DATE,
  auditLog,
  getMetricsForTeam,
  getTeam,
  getTeamMembers,
  teams,
  users,
} from "@/lib/mock-data";
import type { MetricDefinition, TeamId } from "@/lib/types";

import { KpiCard } from "./kpi-card";
import { ComparisonBarChart } from "./comparison-bar-chart";
import { TeamSummaryCard, type TeamSummary } from "./team-summary-card";
import { AuditFeed } from "./audit-feed";

const TEAM_BAR_COLOR: Record<TeamId, string> = {
  sales: "#3b82f6", // blue-500
  onboarding: "#14b8a6", // teal-500
};

/**
 * Synthetic metric definition used for the cross-team comparison chart.
 * Sales contributes `dealsClosed`, Onboarding contributes `clientsOnboarded`;
 * both are integer counts so the y-axis is meaningful.
 */
const OUTPUT_METRIC: MetricDefinition = {
  key: "output",
  label: "30-day output",
  unit: "count",
  format: "integer",
  aggregation: "sum",
  betterWhen: "higher",
};

export function SuperAdminDashboard() {
  // Pull a representative metric from each team for the four KPI cards.
  const salesMetrics = getMetricsForTeam("sales");
  const onbMetrics = getMetricsForTeam("onboarding");
  const salesTeam = getTeam("sales");
  const onbTeam = getTeam("onboarding");

  const findMetric = (def: MetricDefinition[], key: string) =>
    def.find((m) => m.key === key)!;

  const revenueDef = findMetric(salesTeam.metrics, "revenue");
  const dealsDef = findMetric(salesTeam.metrics, "dealsClosed");
  const clientsDef = findMetric(onbTeam.metrics, "clientsOnboarded");
  const csatDef = findMetric(onbTeam.metrics, "csatScore");

  const totalRevenue = aggregateMetricsForKey(
    salesMetrics,
    revenueDef.key,
    revenueDef.aggregation,
  );
  const totalDeals = aggregateMetricsForKey(
    salesMetrics,
    dealsDef.key,
    dealsDef.aggregation,
  );
  const totalClients = aggregateMetricsForKey(
    onbMetrics,
    clientsDef.key,
    clientsDef.aggregation,
  );
  const avgCsat = aggregateMetricsForKey(
    onbMetrics,
    csatDef.key,
    csatDef.aggregation,
  );

  // Headcount counts only active people, super admin excluded
  const activeHeadcount = users.filter(
    (u) => u.role !== "super_admin" && u.status === "active",
  ).length;

  // Comparison bar: 30-day total output per team
  const barData = [
    {
      label: salesTeam.name,
      value: aggregateMetricsForKey(salesMetrics, "dealsClosed", "sum"),
      color: TEAM_BAR_COLOR.sales,
    },
    {
      label: onbTeam.name,
      value: aggregateMetricsForKey(onbMetrics, "clientsOnboarded", "sum"),
      color: TEAM_BAR_COLOR.onboarding,
    },
  ];

  // 2 team summary cards — show top 3 metrics each
  const summaries: TeamSummary[] = teams.map((team) => {
    const metrics = team.id === "sales" ? salesMetrics : onbMetrics;
    return {
      team,
      memberCount: getTeamMembers(team.id).length,
      metricValues: team.metrics.slice(0, 3).map((m) => ({
        metric: m,
        value: aggregateMetricsForKey(metrics, m.key, m.aggregation),
      })),
      href: "/teams",
    };
  });

  const recentAudit = auditLog.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org overview"
        description={`${activeHeadcount} active people across ${teams.length} teams · last 30 days.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Headcount"
          icon={Users}
          value={activeHeadcount.toString()}
          hint={`Across ${teams.length} teams`}
        />
        <KpiCard
          label="Sales · revenue"
          icon={IndianRupee}
          value={formatMetric(totalRevenue, revenueDef)}
          hint={`${formatMetric(totalDeals, dealsDef)} deals`}
        />
        <KpiCard
          label="Onb · clients"
          icon={Briefcase}
          value={formatMetric(totalClients, clientsDef)}
          hint="Activated in last 30 days"
        />
        <KpiCard
          label="Onb · CSAT"
          icon={Smile}
          value={formatMetric(avgCsat, csatDef)}
          hint="Out of 5"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales vs Onboarding</CardTitle>
            <p className="text-sm text-zinc-500">
              30-day output: deals closed (Sales) and clients onboarded (Onboarding).
            </p>
          </CardHeader>
          <CardContent>
            <ComparisonBarChart
              data={barData}
              metric={OUTPUT_METRIC}
              height={260}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent audit events</CardTitle>
            <p className="text-sm text-zinc-500">
              Last {recentAudit.length} actions
            </p>
          </CardHeader>
          <CardContent>
            <AuditFeed
              entries={recentAudit}
              users={users}
              nowIso={`${REFERENCE_DATE}T12:00:00.000Z`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {summaries.map((s) => (
          <TeamSummaryCard key={s.team.id} summary={s} />
        ))}
      </div>
    </div>
  );
}
