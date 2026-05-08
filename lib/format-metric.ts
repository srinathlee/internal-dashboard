import type { MetricDefinition } from "./types";

/**
 * Render a numeric value according to a MetricDefinition's unit/format.
 * Used wherever a metric is displayed — KPI cards, chart tooltips, leaderboard
 * cells — so units stay consistent across the app.
 */
export function formatMetric(value: number, metric: MetricDefinition): string {
  switch (metric.unit) {
    case "currency":
      return formatCurrency(value, metric.currency ?? "INR");
    case "percent":
      return `${value.toFixed(metric.format === "integer" ? 0 : 1)}%`;
    case "days":
      return `${value.toFixed(metric.format === "integer" ? 0 : 1)} d`;
    case "rating":
      return value.toFixed(2);
    case "count":
    default:
      return formatNumber(value, metric.format);
  }
}

/** Compact axis labels — e.g. 1240 → "1.2K", 1_500_000 → "15L". */
export function formatMetricCompact(value: number, metric: MetricDefinition): string {
  if (metric.unit === "currency") return formatCurrencyCompact(value, metric.currency ?? "INR");
  if (metric.unit === "percent") return `${Math.round(value)}%`;
  if (metric.unit === "days") return `${value.toFixed(0)}d`;
  if (metric.unit === "rating") return value.toFixed(1);
  return formatNumberCompact(value);
}

export function formatNumber(
  value: number,
  format: "integer" | "decimal" = "integer",
): string {
  return format === "integer"
    ? Math.round(value).toLocaleString("en-IN")
    : value.toFixed(1);
}

function formatNumberCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toString();
}

export function formatCurrency(value: number, currency: "INR" | "USD"): string {
  if (currency === "INR") {
    if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
    if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${Math.round(value).toLocaleString("en-IN")}`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatCurrencyCompact(value: number, currency: "INR" | "USD"): string {
  if (currency === "INR") {
    if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(1)}Cr`;
    if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${Math.round(value)}`;
  }
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/** Compute a percentage of `value` relative to `target`, capped at 999. */
export function progressPct(value: number, target: number): number {
  if (!target) return 0;
  return Math.min(999, (value / target) * 100);
}

/** Human time-ago like "5m ago", "2h ago", "3d ago". */
export function timeAgo(iso: string, nowIso?: string): string {
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/** Format a YYYY-MM-DD as "May 5". */
export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00.000Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Format an ISO timestamp as "May 5, 14:32". */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
