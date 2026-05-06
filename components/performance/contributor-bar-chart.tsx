"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MetricDefinition, TeamId } from "@/lib/types";
import { formatMetric, formatMetricCompact } from "@/lib/format-metric";

const TEAM_COLOR: Record<TeamId, string> = {
  sales: "#3b82f6", // blue-500
  onboarding: "#14b8a6", // teal-500
};

export interface ContributorDatum {
  /** First name; full name kept for tooltip label */
  shortLabel: string;
  fullLabel: string;
  value: number;
  teamId: TeamId;
}

interface ContributorBarChartProps {
  data: ContributorDatum[];
  metric: MetricDefinition;
  height?: number;
}

/**
 * Horizontal-style bar chart showing top contributors. Bars are colored by
 * team — blue for Sales, teal for Onboarding — so the org-wide view stays
 * readable when both teams' members appear together.
 */
export function ContributorBarChart({
  data,
  metric,
  height = 260,
}: ContributorBarChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-zinc-500"
      >
        No contributors in this range
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          barCategoryGap="28%"
        >
          <XAxis
            dataKey="shortLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            width={48}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickFormatter={(v: number) => formatMetricCompact(v, metric)}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            content={<ContributorTooltip metric={metric} />}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.fullLabel} fill={TEAM_COLOR[d.teamId]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: ContributorDatum }[];
  metric: MetricDefinition;
}

function ContributorTooltip({ active, payload, metric }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  if (!p) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-zinc-500">{p.payload.fullLabel}</div>
      <div className="font-medium tabular-nums">
        {formatMetric(p.value, metric)}
      </div>
    </div>
  );
}
