import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { teamDotClass } from "@/lib/format";
import { formatMetric } from "@/lib/format-metric";
import type { MetricDefinition, Team } from "@/lib/types";

export interface TeamSummary {
  team: Team;
  memberCount: number;
  /** Up to ~3 metric values to render compactly. */
  metricValues: { metric: MetricDefinition; value: number }[];
  /** Optional href to deep-link. */
  href?: string;
}

export function TeamSummaryCard({ summary }: { summary: TeamSummary }) {
  const { team, memberCount, metricValues, href } = summary;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={cn("h-2 w-2 rounded-full", teamDotClass(team.id))}
          />
          <div>
            <div className="text-sm font-medium">{team.name}</div>
            <div className="text-xs text-zinc-500">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </div>
          </div>
        </div>
        {href && (
          <Link
            href={href}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50"
            aria-label={`View ${team.name}`}
          >
            View <ArrowRight className="ml-0.5 inline h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-4">
        {metricValues.map(({ metric, value }) => (
          <div key={metric.key} className="min-w-0">
            <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {metric.label}
            </dt>
            <dd className="mt-1 truncate text-lg font-semibold tabular-nums">
              {formatMetric(value, metric)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
