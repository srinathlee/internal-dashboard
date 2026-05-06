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

import type { MetricDefinition } from "@/lib/types";
import { formatMetric, formatMetricCompact } from "@/lib/format-metric";

interface ComparisonBarDatum {
  label: string;
  value: number;
  /** Hex/HSL color string for this bar. */
  color: string;
}

interface ComparisonBarChartProps {
  data: ComparisonBarDatum[];
  metric: MetricDefinition;
  height?: number;
}

/**
 * Two-column bar chart for the Super Admin home — Sales vs Onboarding totals.
 * Single Bar with per-cell colors so each team gets its accent.
 */
export function ComparisonBarChart({
  data,
  metric,
  height = 240,
}: ComparisonBarChartProps) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          barCategoryGap="32%"
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
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
            content={<ComparisonTooltip metric={metric} />}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: ComparisonBarDatum }[];
  metric: MetricDefinition;
}

function ComparisonTooltip({ active, payload, metric }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  if (!p) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-zinc-500">{p.payload.label}</div>
      <div className="font-medium tabular-nums">
        {formatMetric(p.value, metric)}
      </div>
    </div>
  );
}
