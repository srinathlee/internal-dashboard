"use client";

import {
  Activity as ActivityIcon,
  AlertTriangle,
  Award,
  IndianRupee,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import { useTeamActivity, useTeamOverview } from "@/lib/hooks/use-overview";

import { KpiCard } from "./kpi-card";

/**
 * Super-admin dashboard backed by GET /api/v1/sales/team/overview and
 * /api/v1/sales/team/activity. Shows team-wide KPIs, the leaderboard,
 * health signals, and a feed of recent activity.
 */
export function SuperAdminDashboard() {
  const overview = useTeamOverview();
  const activity = useTeamActivity({ limit: 8 });

  if (overview.isLoading && !overview.data) {
    return <Skeleton />;
  }

  if (overview.error || !overview.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Org overview" />
        <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
          Couldn't load the team overview: {errorMessage(overview.error)}
        </Card>
      </div>
    );
  }

  const data = overview.data;
  const { team_kpis, team_health, leaderboard, conversion_by_rep } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org overview"
        description={`As of ${new Date(data.as_of).toLocaleString()} · ${team_kpis.active_reps.active}/${team_kpis.active_reps.total} reps active.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Team leads"
          icon={Users}
          value={formatNumber(team_kpis.team_leads.value)}
          hint={`${team_kpis.quota_attainment.on_track}/${team_kpis.quota_attainment.with_quota} on track`}
        />
        <KpiCard
          label="Open pipeline"
          icon={IndianRupee}
          value={formatCurrency(team_kpis.open_pipeline.value, "INR")}
          hint={`${team_kpis.active_sprints.value} active sprints`}
        />
        <KpiCard
          label="Team MRR"
          icon={IndianRupee}
          value={formatCurrency(team_kpis.team_mrr.value, "INR")}
          hint="Monthly recurring revenue"
        />
        <KpiCard
          label="Quota attainment"
          icon={Award}
          value={`${team_kpis.quota_attainment.pct}%`}
          hint={`${team_kpis.quota_attainment.on_track} of ${team_kpis.quota_attainment.with_quota} reps`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <p className="text-sm text-zinc-500">
              Reps ranked by completion against quota.
            </p>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No reps to show yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr className="text-left">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Rep</th>
                    <th className="py-2 text-right font-medium">Done</th>
                    <th className="py-2 text-right font-medium">%</th>
                    <th className="py-2 text-right font-medium">Pace</th>
                    <th className="py-2 text-right font-medium">Pipeline</th>
                    <th className="py-2 text-right font-medium">MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr
                      key={row.user_id}
                      className="border-t border-zinc-100 dark:border-zinc-800"
                    >
                      <td className="py-2 tabular-nums">{row.rank}</td>
                      <td className="py-2">{row.name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {row.done}/{row.target}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {row.completion_pct}%
                      </td>
                      <td className="py-2 text-right text-xs">
                        <PaceBadge status={row.pace_status} />
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(row.pipeline_value, "INR")}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(row.mrr_contribution, "INR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Health
            </CardTitle>
            <p className="text-sm text-zinc-500">Where to focus next.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthSection
              title={`Reps at risk (${team_health.reps_at_risk.count})`}
              empty="All reps on track."
            >
              {team_health.reps_at_risk.items.map((r) => (
                <div
                  key={r.user_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs text-zinc-500">
                    {r.done}/{r.target} ·{" "}
                    {r.deficit > 0 ? `-${r.deficit}` : ""}
                  </span>
                </div>
              ))}
            </HealthSection>
            <HealthSection
              title={`Hot opportunities (${team_health.hot_opportunities.count})`}
              empty="No hot opportunities."
            >
              {team_health.hot_opportunities.top.slice(0, 5).map((h) => (
                <div
                  key={h.lead_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{h.clinic_name}</span>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {formatCurrency(h.estimated_value, "INR")}
                  </span>
                </div>
              ))}
              {team_health.hot_opportunities.value_total > 0 && (
                <p className="pt-1 text-xs text-zinc-500">
                  Total{" "}
                  <span className="font-medium tabular-nums">
                    {formatCurrency(
                      team_health.hot_opportunities.value_total,
                      "INR",
                    )}
                  </span>
                </p>
              )}
            </HealthSection>
            <HealthSection
              title={`Stale (${team_health.stale_team_leads.count})`}
              empty="Nothing stale."
            >
              {team_health.stale_team_leads.by_rep.slice(0, 5).map((b) => (
                <div
                  key={b.user_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{b.name}</span>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {b.count}
                  </span>
                </div>
              ))}
            </HealthSection>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversion by rep</CardTitle>
          <p className="text-sm text-zinc-500">
            Lead → meeting → sprint → subscription. Strong:{" "}
            {conversion_by_rep.thresholds.strong}% · Review:{" "}
            {conversion_by_rep.thresholds.review}%.
          </p>
        </CardHeader>
        <CardContent>
          {conversion_by_rep.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr className="text-left">
                  <th className="py-2 font-medium">Rep</th>
                  <th className="py-2 text-right font-medium">L → M</th>
                  <th className="py-2 text-right font-medium">M → Sp</th>
                  <th className="py-2 text-right font-medium">Sp → Sub</th>
                </tr>
              </thead>
              <tbody>
                {conversion_by_rep.rows.map((r) => (
                  <tr
                    key={r.user_id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.lead_to_meeting_pct}%
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.meeting_to_sprint_pct}%
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.sprint_to_subscription_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-zinc-400" aria-hidden />
            Team activity
          </CardTitle>
          <p className="text-sm text-zinc-500">
            Latest actions across all reps.
          </p>
        </CardHeader>
        <CardContent>
          {activity.isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : activity.data?.activities.length ? (
            <ul className="space-y-2">
              {activity.data.activities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.body}</div>
                    <div className="truncate text-xs text-zinc-500">
                      {a.actor_name}
                      {a.lead_clinic_name ? ` · ${a.lead_clinic_name}` : ""}
                      {a.city ? ` · ${a.city}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {new Date(a.occurred_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No activity yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-1 space-y-1">
        {isEmpty ? <p className="text-xs text-zinc-400">{empty}</p> : children}
      </div>
    </div>
  );
}

function PaceBadge({ status }: { status: "on" | "behind" | "ahead" }) {
  const cls =
    status === "behind"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : status === "ahead"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const label =
    status === "behind" ? "Behind" : status === "ahead" ? "Ahead" : "On";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse" />
        ))}
      </div>
      <Card className="h-72 animate-pulse" />
    </div>
  );
}
