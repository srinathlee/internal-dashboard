"use client";

import {
  CartesianGrid,
  Legend,
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

export interface OrgLineSeries {
  /** Stable key; also used as Recharts dataKey */
  key: string;
  label: string;
  color: string;
}

interface OrgLineChartProps {
  /** Each row: { date, [seriesKey1]: value, [seriesKey2]: value, ... } */
  data: Array<Record<string, number | string>>;
  series: OrgLineSeries[];
  /** Metric used for tooltip + axis formatting (must be unit-comparable across series). */
  metric: MetricDefinition;
  height?: number;
  xTickEvery?: number;
}

/**
 * Multi-line chart used by the Super Admin "All teams" view to overlay
 * Sales and Onboarding output on a single comparable y-axis.
 */
export function OrgLineChart({
  data,
  series,
  metric,
  height = 260,
  xTickEvery,
}: OrgLineChartProps) {
  if (data.length === 0 || series.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-zinc-500"
      >
        No data for this range
      </div>
    );
  }

  const stride = xTickEvery ?? Math.max(1, Math.floor(data.length / 6));
  const xTicks = data
    .map((d) => d.date as string)
    .filter((_, i) => i % stride === 0);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
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
            content={<OrgTooltip metric={metric} series={series} />}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: {
    name: string;
    value: number;
    color: string;
    payload: { date: string };
  }[];
  metric: MetricDefinition;
  series: OrgLineSeries[];
}

function OrgTooltip({ active, payload, metric }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload.date;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {date && <div className="text-zinc-500">{formatShortDate(date)}</div>}
      <div className="mt-0.5 space-y-0.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-zinc-500">{p.name}</span>
            <span className="ml-2 font-medium tabular-nums">
              {formatMetric(p.value, metric)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
