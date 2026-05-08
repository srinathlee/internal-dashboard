"use client";

import {
  Activity as ActivityIcon,
  IndianRupee,
  Target as TargetIcon,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrency, formatNumber } from "@/lib/format-metric";
import { errorMessage } from "@/lib/hooks/use-async";
import { useMyActivity, useMyOverview } from "@/lib/hooks/use-overview";
import type { User } from "@/lib/types";

import { KpiCard } from "./kpi-card";

interface MemberDashboardProps {
  user: User;
}

/**
 * The "my dashboard" view backed by GET /api/v1/sales/me/overview.
 * Surfaces quota progress, the today panel, KPIs, and the funnel.
 */
export function MemberDashboard({ user }: MemberDashboardProps) {
  const overview = useMyOverview();
  const activity = useMyActivity({ limit: 8 });

  if (overview.isLoading && !overview.data) {
    return <DashboardSkeleton />;
  }

  if (overview.error || !overview.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome, ${user.name.split(" ")[0]}`}
          description="Your sales view."
        />
        <Card className="p-6 text-sm text-rose-700 dark:text-rose-300">
          Couldn't load your overview: {errorMessage(overview.error)}
        </Card>
      </div>
    );
  }

  const data = overview.data;
  const { quota, kpis, today_panel, funnel } = data;
  const paceLabel =
    quota.pace_status === "on"
      ? "On track"
      : quota.pace_status === "ahead"
        ? "Ahead"
        : "Behind";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${data.user.name.split(" ")[0] || user.name.split(" ")[0]}`}
        description={`${quota.day_of_period} of ${quota.days_total} days into ${quota.period} · ${quota.days_remaining} left.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Hospitals"
          icon={TargetIcon}
          value={`${quota.hospitals_done} / ${quota.target_hospitals}`}
          hint={`${quota.completion_pct}% complete · ${paceLabel}`}
        />
        <KpiCard
          label="Open pipeline"
          icon={IndianRupee}
          value={formatCurrency(kpis.open_pipeline.value, "INR")}
          hint={`${kpis.total_leads.value} leads`}
        />
        <KpiCard
          label="Active sprints"
          icon={TrendingUp}
          value={formatNumber(kpis.active_sprints.value)}
          hint="Currently running"
        />
        <KpiCard
          label="MRR"
          icon={IndianRupee}
          value={formatCurrency(kpis.mrr.value, "INR")}
          hint="Monthly recurring revenue"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funnel</CardTitle>
            <p className="text-sm text-zinc-500">
              Stage counts across your active leads.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {funnel.stages.map((s) => {
                const conv = funnel.conversions.find((c) => c.from === s.key);
                return (
                  <li
                    key={s.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="flex items-center gap-3 tabular-nums">
                      <span>{formatNumber(s.count)}</span>
                      {conv ? (
                        <span className="text-xs text-zinc-500">
                          → {conv.pct}%
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            {funnel.bottleneck && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                Bottleneck: {funnel.bottleneck.replace(/_/g, " ")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <p className="text-sm text-zinc-500">
              Items needing attention right now.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Section
              title={`Due today (${today_panel.due_today.count})`}
              empty="Nothing due today."
            >
              {today_panel.due_today.items.slice(0, 4).map((item) => (
                <Link
                  key={item.lead_id}
                  href={`/sales/leads`}
                  className="flex items-center justify-between gap-2 text-sm hover:underline"
                >
                  <span className="truncate">{item.clinic_name}</span>
                  <span className="text-xs text-zinc-500">
                    {item.next_action_title}
                  </span>
                </Link>
              ))}
            </Section>
            <Section
              title={`Stale (${today_panel.stale_leads.count})`}
              empty="No stale leads."
            >
              {today_panel.stale_leads.items.slice(0, 4).map((item) => (
                <div
                  key={item.lead_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{item.clinic_name}</span>
                  <span className="text-xs text-zinc-500">
                    {item.last_activity_days}d
                  </span>
                </div>
              ))}
            </Section>
            <Section
              title={`Hot to advance (${today_panel.hot_to_advance.count})`}
              empty="No hot leads waiting."
            >
              {today_panel.hot_to_advance.items.slice(0, 4).map((item) => (
                <div
                  key={item.lead_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{item.clinic_name}</span>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {formatCurrency(item.estimated_value, "INR")}
                  </span>
                </div>
              ))}
            </Section>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-zinc-400" aria-hidden />
            Recent activity
          </CardTitle>
          <p className="text-sm text-zinc-500">Your last actions across leads.</p>
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
                    {a.lead_clinic_name ? (
                      <div className="truncate text-xs text-zinc-500">
                        {a.lead_clinic_name}
                        {a.city ? ` · ${a.city}` : ""}
                      </div>
                    ) : null}
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

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const isEmpty = Array.isArray(children)
    ? children.length === 0
    : !children;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="mt-1 space-y-1">
        {isEmpty ? (
          <p className="text-xs text-zinc-400">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-72 animate-pulse lg:col-span-2" />
        <Card className="h-72 animate-pulse" />
      </div>
    </div>
  );
}
