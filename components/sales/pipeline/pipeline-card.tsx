"use client";

import { Building2, Phone } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, timeAgo } from "@/lib/format-metric";
import { stageProbability } from "@/lib/sales-pipeline";
import type { Lead } from "@/lib/types";

interface PipelineCardProps {
  lead: Lead;
  /**
   * When true, the headline value renders as the weighted-forecast amount
   * (value × stage probability) rather than the raw deal value.
   */
  forecastMode: boolean;
  /** True while this card is the active drag source. */
  isDragging: boolean;
  onDragStart: (lead: Lead) => void;
  onDragEnd: () => void;
  onClick: (lead: Lead) => void;
}

export function PipelineCard({
  lead,
  forecastMode,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: PipelineCardProps) {
  const weighted = Math.round(lead.value * stageProbability(lead.stage));
  const displayValue = forecastMode ? weighted : lead.value;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(lead);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(lead);
        }
      }}
      className={cn(
        "group cursor-grab rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          aria-hidden
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        >
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {lead.clinicName}
          </div>
          <div className="truncate text-xs text-zinc-500">{lead.doctorName}</div>
        </div>
        {displayValue > 0 ? (
          <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCurrency(displayValue, "INR")}
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-zinc-500">
        <div className="flex min-w-0 items-center gap-1.5">
          <Phone aria-hidden className="h-3 w-3" />
          <span className="font-mono">{lead.phone}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span>{timeAgo(lead.lastActivityAt, new Date().toISOString())}</span>
        </div>
      </div>
    </div>
  );
}
