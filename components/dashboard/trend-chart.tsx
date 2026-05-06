"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MetricDefinition } from "@/lib/types";
import {
  formatMetric,
  formatMetricCompact,
  formatShortDate,
} from "@/lib/format-metric";

interface TrendChartProps {
  data: { date: string; value: number }[];
  metric: MetricDefinition;
  height?: number;
  /** Visible-X tick stride. Default ~6 ticks across the range. */
  xTickEvery?: number;
}

/**
 * Minimal line chart: indigo stroke, no dots, faint horizontal gridlines only.
 * Tooltip is a small zinc card matching the rest of the UI.
 */
export function TrendChart({
  data,
  metric,
  height = 240,
  xTickEvery,
}: TrendChartProps) {
  if (data.length === 0) {
    return <ChartEmpty height={height} />;
  }

  const stride = xTickEvery ?? Math.max(1, Math.floor(data.length / 6));
  const xTicks = data
    .map((d) => d.date)
    .filter((_, i) => i % stride === 0);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid
            stroke="hsl(var(--border))"
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            ticks={xTicks}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickFormatter={(d: string) => formatShortDate(d)}
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
            cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            content={<TrendTooltip metric={metric} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { date: string } }[];
  metric: MetricDefinition;
}

function TrendTooltip({ active, payload, metric }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  if (!p) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="font-medium tabular-nums">
        {formatMetric(p.value, metric)}
      </div>
      <div className="text-zinc-500">{formatShortDate(p.payload.date)}</div>
    </div>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center text-sm text-zinc-500"
    >
      No data for this range
    </div>
  );
}
