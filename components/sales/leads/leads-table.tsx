"use client";

import { Building2, SquarePen } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-metric";
import { LEAD_SOURCE_LABEL } from "@/lib/sales-leads-data";
import type { Lead } from "@/lib/types";

import { LeadStageBadge } from "./lead-stage-badge";

interface LeadsTableProps {
  leads: Lead[];
  selectedId: string | null;
  /** Row click — opens the read-mostly detail Sheet on the right. */
  onRowClick: (lead: Lead) => void;
  /** Edit icon click — opens the Edit lead Dialog. */
  onEditClick: (lead: Lead) => void;
}

export function LeadsTable({
  leads,
  selectedId,
  onRowClick,
  onEditClick,
}: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-16 text-center text-sm text-zinc-500 dark:border-zinc-800">
        No leads match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
              <Th>Clinic / Doctor</Th>
              <Th>City</Th>
              <Th>Stage</Th>
              <Th align="right">Value</Th>
              <Th>Source</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const selected = lead.id === selectedId;
              return (
                <tr
                  key={lead.id}
                  onClick={() => onRowClick(lead)}
                  className={cn(
                    "group cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50",
                    selected &&
                      "bg-indigo-50/60 hover:bg-indigo-50 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/40",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        aria-hidden
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                          selected
                            ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
                        )}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                          {lead.clinicName}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          <span>{lead.doctorName}</span>
                          <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">·</span>
                          <span className="font-mono">{lead.phone}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {lead.city}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStageBadge stage={lead.stage} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {lead.value > 0 ? (
                      formatCurrency(lead.value, "INR")
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-zinc-500">
                    {LEAD_SOURCE_LABEL[lead.source]}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Edit ${lead.clinicName}`}
                      onClick={(e) => {
                        // Edit icon opens the editor Dialog instead of the
                        // row's detail Sheet; stop propagation so the row
                        // handler doesn't fire as well.
                        e.stopPropagation();
                        onEditClick(lead);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    >
                      <SquarePen className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-zinc-500",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}
