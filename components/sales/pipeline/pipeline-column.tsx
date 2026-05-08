"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-metric";
import {
  KANBAN_STAGE_LABEL,
  STAGE_DOT_CLASS,
} from "@/lib/sales-pipeline";
import type { Lead, LeadStage } from "@/lib/types";

import { PipelineCard } from "./pipeline-card";

interface PipelineColumnProps {
  stage: LeadStage;
  leads: Lead[];
  forecastMode: boolean;
  draggingId: string | null;
  onDragStartCard: (lead: Lead) => void;
  onDragEndCard: () => void;
  onDropOnColumn: (stage: LeadStage) => void;
  onCardClick: (lead: Lead) => void;
}

export function PipelineColumn({
  stage,
  leads,
  forecastMode,
  draggingId,
  onDragStartCard,
  onDragEndCard,
  onDropOnColumn,
  onCardClick,
}: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);

  return (
    <div
      data-stage={stage}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={() => setIsOver(true)}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDropOnColumn(stage);
      }}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/60 transition-colors dark:border-zinc-800 dark:bg-zinc-900/40",
        isOver && "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-900",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_DOT_CLASS[stage])}
          />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            {KANBAN_STAGE_LABEL[stage]}
          </span>
          <span className="shrink-0 rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {leads.length}
          </span>
        </div>
        <button
          type="button"
          aria-label={`${KANBAN_STAGE_LABEL[stage]} options`}
          className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 pb-1 pt-2 text-[11px] tabular-nums text-zinc-500">
        {totalValue > 0 ? formatCurrency(totalValue, "INR") : "₹0"}
      </div>

      <div className="flex-1 space-y-2 px-2 pb-3 pt-1">
        {leads.length === 0 ? (
          <div className="grid h-24 place-items-center rounded-md border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-zinc-800">
            No leads
          </div>
        ) : (
          leads.map((lead) => (
            <PipelineCard
              key={lead.id}
              lead={lead}
              forecastMode={forecastMode}
              isDragging={draggingId === lead.id}
              onDragStart={onDragStartCard}
              onDragEnd={onDragEndCard}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
