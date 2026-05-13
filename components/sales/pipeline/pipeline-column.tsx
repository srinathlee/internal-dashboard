"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-metric";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Lead, LeadStage } from "@/lib/types";

import { PipelineCard } from "./pipeline-card";

interface PipelineColumnProps {
  stage: LeadStage;
  label: string;
  /** Tailwind class for the small accent dot. */
  dotClass: string;
  /** Optional hex color override (custom stages). Wins over `dotClass`. */
  color?: string | null;
  isCustom?: boolean;
  leads: Lead[];
  forecastMode: boolean;
  draggingId: string | null;
  onDragStartCard: (lead: Lead) => void;
  onDragEndCard: () => void;
  onDropOnColumn: (stage: LeadStage) => void;
  onCardClick: (lead: Lead) => void;
  /** Provided only when the viewer can manage custom stages. */
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PipelineColumn({
  stage,
  label,
  dotClass,
  color,
  isCustom = false,
  leads,
  forecastMode,
  draggingId,
  onDragStartCard,
  onDragEndCard,
  onDropOnColumn,
  onCardClick,
  onEdit,
  onDelete,
}: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);

  const totalValue = leads.reduce((sum, l) => sum + l.value, 0);
  const canManage = isCustom && (onEdit || onDelete);

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
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              !color && dotClass,
            )}
            style={color ? { backgroundColor: color } : undefined}
          />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
          <span className="shrink-0 rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {leads.length}
          </span>
        </div>
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${label} options`}
                className="grid h-6 w-6 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onEdit ? (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Edit stage
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="text-rose-600 focus:text-rose-700 dark:text-rose-400 dark:focus:text-rose-300"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Delete stage
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center text-zinc-300 dark:text-zinc-700"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </span>
        )}
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
