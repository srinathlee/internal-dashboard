import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiTrend {
  /** Percentage change vs previous period; sign is meaningful. */
  changePct: number;
  /** Whether higher values are good — flips color of positive/negative changes. */
  betterWhen: "higher" | "lower";
}

interface KpiCardProps {
  label: string;
  /** Pre-formatted display value (string). */
  value: string;
  /** Small line under the number, e.g. "of ₹12L target" or "Top 1 of 3". */
  hint?: string;
  trend?: KpiTrend;
  icon?: LucideIcon;
  className?: string;
}

/**
 * The atomic KPI card used across all three dashboard variants.
 * Spec:
 *   - Label: text-xs uppercase tracking-wide text-zinc-500
 *   - Value: text-3xl font-semibold tabular-nums
 *   - Optional trend: small arrow + colored % change
 *   - Optional hint: secondary line in muted text
 */
export function KpiCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {trend && <TrendBadge {...trend} />}
      </div>

      {hint && (
        <p className="mt-2 text-xs text-zinc-500" data-kpi-hint>
          {hint}
        </p>
      )}
    </Card>
  );
}

function TrendBadge({ changePct, betterWhen }: KpiTrend) {
  if (!Number.isFinite(changePct) || changePct === 0) {
    return (
      <span className="text-xs font-medium tabular-nums text-zinc-400">
        —
      </span>
    );
  }
  const goingUp = changePct > 0;
  const isGood = (goingUp && betterWhen === "higher") || (!goingUp && betterWhen === "lower");
  const Icon = goingUp ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        isGood
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(changePct).toFixed(1)}%
    </span>
  );
}
