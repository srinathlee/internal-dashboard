"use client";

import { LineChart } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";

/**
 * /performance — placeholder.
 *
 * The previous Performance surface was driven by lib/mock-data.ts (multiple
 * 1000+ line screens computing trend lines, leaderboards, and grades from
 * deterministic seeded data). It was removed when mock data was deleted.
 *
 * The new implementation should render data from the existing real-API
 * hooks (useMyOverview / useTeamOverview / useScorecard) — those are
 * already wired into the dashboards, so the work here is presentational:
 * pull the same numbers in for a per-user / per-team Performance view.
 */
export function PerformanceScreen() {
  const auth = useAuth();
  if (!auth.isLoaded) return <Skeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Trend lines, leaderboards, and target attainment."
      />
      <Card className="flex flex-col items-center gap-3 p-12 text-center text-sm text-zinc-500">
        <LineChart className="h-8 w-8 text-zinc-400" aria-hidden />
        <div>
          <div className="font-medium text-zinc-700 dark:text-zinc-300">
            Not connected to live data yet.
          </div>
          <p className="mt-1 max-w-md">
            Use the Dashboard for the API-backed view of overview, KPIs, and
            health signals. This page will be rebuilt against
            /api/v1/sales/me/overview and /api/v1/sales/team/overview.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <Card className="h-64 animate-pulse" />
    </div>
  );
}
