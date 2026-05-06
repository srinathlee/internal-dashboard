"use client";

import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/lib/auth";
import { aggregateMetricsForKey, primaryMetric } from "@/lib/aggregations";
import { formatMetric } from "@/lib/format-metric";
import { teamDotClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getMetricsForTeam,
  getTeamMembers,
  teams,
} from "@/lib/mock-data";
import type { Team } from "@/lib/types";

/**
 * /teams — Super Admin grid of all teams. Each card carries:
 *   - Team color dot + name + description
 *   - Member count
 *   - Headline KPI (the team's primary metric, 30-day total)
 *   - "View team" link to /teams/[teamId]
 *
 * The "Create team" button is intentionally disabled in v1; the spec scopes us
 * to two teams. Tooltip explains why.
 */
export function TeamsGridScreen() {
  const auth = useAuth();

  if (!auth.isLoaded) return <Skeleton />;

  if (!auth.can("performance:read:all")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Teams" />
        <Card className="p-12 text-center text-sm text-zinc-500">
          You don't have permission to view all teams.
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <PageHeader
          title="Teams"
          description={`${teams.length} teams · ${teams.reduce(
            (n, t) => n + getTeamMembers(t.id).length,
            0,
          )} total members`}
          actions={
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled aria-disabled className="pointer-events-none">
                    <Plus className="h-4 w-4" aria-hidden />
                    Create team
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function TeamCard({ team }: { team: Team }) {
  const members = getTeamMembers(team.id);
  const activeCount = members.filter((m) => m.status === "active").length;
  const teamMetrics = getMetricsForTeam(team.id);
  const primary = primaryMetric(team.metrics);
  const primaryValue = aggregateMetricsForKey(
    teamMetrics,
    primary.key,
    primary.aggregation,
  );

  return (
    <Card className="flex flex-col gap-6 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn("h-2.5 w-2.5 rounded-full", teamDotClass(team.id))}
          />
          <div>
            <div className="text-base font-medium tracking-tight">
              {team.name}
            </div>
            <div className="mt-0.5 text-sm text-zinc-500">{team.description}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiBlock
          label="Members"
          value={members.length.toString()}
          hint={`${activeCount} active`}
        />
        <KpiBlock
          label={primary.label}
          value={formatMetric(primaryValue, primary)}
          hint="Last 30 days"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden />
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
        <Link
          href={`/teams/${team.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
        >
          View team
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

function KpiBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 truncate text-xl font-semibold tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-zinc-500">{hint}</div>}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="h-44 animate-pulse" />
        <Card className="h-44 animate-pulse" />
      </div>
    </div>
  );
}
