"use client";

import {
  AlertTriangle,
  Ban,
  BookOpen,
  Briefcase,
  Eye,
  RotateCcw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import type {
  AcpActivity,
  AcpReview,
  AcpTag,
} from "@/lib/api/sales-accelerator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Currency — compact ₹ matching the design (₹1.6L / ₹30.0K / ₹2500 / ₹0).
// ---------------------------------------------------------------------------

export function acpFmt(value: number | null | undefined): string {
  const n = Number(value) || 0;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

// ---------------------------------------------------------------------------
// Week / day placement — each rep progresses on their own joined_at clock.
// ---------------------------------------------------------------------------

export interface RepWeek {
  week: number;
  dayInWeek: number;
  month: 1 | 2;
}

export function getRepWeek(joinedAt: string): RepWeek {
  return weekDayForDate(joinedAt, new Date());
}

/**
 * Program week/day for an arbitrary date relative to the rep's join date.
 * Used to place each daily log into its week section (the backend doesn't
 * always echo `week`/`day_in_week` on the per-member log feed).
 */
export function weekDayForDate(
  joinedAt: string,
  date: string | Date,
): RepWeek {
  const joined = new Date(joinedAt).getTime();
  const at = (typeof date === "string" ? new Date(date) : date).getTime();
  const diffDays = Math.max(
    0,
    Math.floor((at - joined) / (1000 * 60 * 60 * 24)),
  );
  const week = Math.min(8, Math.floor(diffDays / 7) + 1);
  const dayInWeek = Math.min(5, (diffDays % 7) + 1);
  const month: 1 | 2 = week <= 4 ? 1 : 2;
  return { week, dayInWeek, month };
}

export const WEEK_CONFIG: { n: number; title: string }[] = [
  { n: 1, title: "Training" },
  { n: 2, title: "Observation" },
  { n: 3, title: "Sprint push" },
  { n: 4, title: "M1 close" },
  { n: 5, title: "Conversion" },
  { n: 6, title: "Selling" },
  { n: 7, title: "M2 target" },
  { n: 8, title: "Final" },
];

export function weekTitle(week: number): string {
  return WEEK_CONFIG.find((w) => w.n === week)?.title ?? "";
}

// ---------------------------------------------------------------------------
// Review meta
// ---------------------------------------------------------------------------

interface ReviewMeta {
  label: string;
  icon: LucideIcon;
  /** Solid status dot. */
  dot: string;
  /** Inline pill badge. */
  badge: string;
  /** Lit-up summary card (border + tint + text). */
  card: string;
  /** Accent text colour. */
  text: string;
}

export const REVIEW_META: Record<AcpReview, ReviewMeta> = {
  working_fine: {
    label: "Working fine",
    icon: ShieldCheck,
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    card: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  observation: {
    label: "Under observation",
    icon: Eye,
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    card: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
  },
  needs_improvement: {
    label: "Needs improvement",
    icon: AlertTriangle,
    dot: "bg-orange-500",
    badge:
      "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    card: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300",
    text: "text-orange-600 dark:text-orange-400",
  },
  retrain: {
    label: "Re-train",
    icon: RotateCcw,
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    card: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
  },
};

/** Left-border accent colour for a review (used on day-table rep rows). */
export function reviewBar(review: AcpReview | null): string {
  if (!review) return "bg-zinc-300 dark:bg-zinc-700";
  return REVIEW_META[review].dot;
}

// ---------------------------------------------------------------------------
// Tag meta
// ---------------------------------------------------------------------------

interface TagMeta {
  label: string;
  badge: string;
  /** Row background tint (fire list). */
  rowTint?: string;
}

export const TAG_META: Record<AcpTag, TagMeta> = {
  active: {
    label: "Active",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  close_monitoring: {
    label: "Monitoring",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  at_risk: {
    label: "At risk",
    badge:
      "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  },
  firing_zone: {
    label: "Firing zone",
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
  fired: {
    label: "Fired",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    rowTint: "bg-rose-50/60 dark:bg-rose-950/20",
  },
  converted: {
    label: "Converted",
    badge:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
};

/** Tag options in display order — drives the rep panel's tag selector. */
export const TAG_KEYS: AcpTag[] = [
  "active",
  "close_monitoring",
  "at_risk",
  "firing_zone",
  "converted",
  "fired",
];

// ---------------------------------------------------------------------------
// Activity (day-type) meta
// ---------------------------------------------------------------------------

interface ActivityMeta {
  label: string;
  icon: LucideIcon;
  badge: string;
}

export const ACTIVITY_META: Record<AcpActivity, ActivityMeta> = {
  training: {
    label: "Training",
    icon: BookOpen,
    badge:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  field: {
    label: "Field work",
    icon: Briefcase,
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  },
  observation: {
    label: "Observation",
    icon: Eye,
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  },
  retrain: {
    label: "Re-training",
    icon: RotateCcw,
    badge:
      "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  },
  absent: {
    label: "Absent",
    icon: Ban,
    badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  },
};

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </span>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Tailwind text colour for the value + icon. Defaults to neutral. */
  tone?: "neutral" | "amber" | "good" | "violet";
  className?: string;
}

const TONE_VALUE: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-zinc-900 dark:text-zinc-50",
  amber: "text-amber-600 dark:text-amber-400",
  good: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
};

const TONE_ICON: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-zinc-400",
  amber: "text-amber-500",
  good: "text-emerald-500",
  violet: "text-violet-500",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <Icon className={cn("h-4 w-4", TONE_ICON[tone])} aria-hidden />
        <span
          className={cn(
            "text-right text-2xl font-bold tabular-nums leading-none",
            TONE_VALUE[tone],
          )}
        >
          {value}
        </span>
      </div>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
    </Card>
  );
}
