import { cn } from "@/lib/utils";
import { LEAD_STAGE_LABEL } from "@/lib/sales-leads-data";
import type { LeadStage } from "@/lib/types";

const STAGE_CLASSES: Record<LeadStage, string> = {
  "cold-lead":
    "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
  "first-contact":
    "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-900",
  "doctor-meeting":
    "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-900",
  "pitch-delivered":
    "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:ring-indigo-900",
  "hot-lead":
    "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900",
  "sprint-started":
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900",
  "sprint-review":
    "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900",
  "subscription-closed":
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900",
  lost:
    "bg-zinc-100 text-zinc-600 ring-zinc-200 line-through decoration-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-800",
};

interface LeadStageBadgeProps {
  stage: LeadStage;
  size?: "sm" | "md";
  className?: string;
}

export function LeadStageBadge({
  stage,
  size = "md",
  className,
}: LeadStageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium uppercase tracking-wide ring-1 ring-inset whitespace-nowrap",
        size === "sm"
          ? "px-1.5 py-0 text-[9px]"
          : "px-2 py-0.5 text-[10px]",
        STAGE_CLASSES[stage],
        className,
      )}
    >
      {LEAD_STAGE_LABEL[stage]}
    </span>
  );
}
