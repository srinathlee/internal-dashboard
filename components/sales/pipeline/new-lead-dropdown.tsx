"use client";

import {
  Building2,
  ClipboardList,
  Plus,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "+ New lead" dropdown shown in the pipeline header. The actual creation
 * flows aren't wired in v1 — selecting an option emits a toast so the
 * affordance is still demoable.
 */
export function NewLeadDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden />
          New lead
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Add a lead</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => toast.info("Manual lead form — coming soon")}>
          <UserPlus className="text-zinc-500" aria-hidden />
          <div className="flex flex-col">
            <span>Manual entry</span>
            <span className="text-xs text-zinc-500">Add a single clinic by hand.</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.info("Hospital picker — coming soon")}>
          <Building2 className="text-zinc-500" aria-hidden />
          <div className="flex flex-col">
            <span>From hospitals</span>
            <span className="text-xs text-zinc-500">Pick an existing hospital.</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast.info("CSV import — coming soon")}>
          <Upload className="text-zinc-500" aria-hidden />
          <div className="flex flex-col">
            <span>Import CSV</span>
            <span className="text-xs text-zinc-500">Bulk upload from a spreadsheet.</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.info("Capture form — coming soon")}>
          <ClipboardList className="text-zinc-500" aria-hidden />
          <div className="flex flex-col">
            <span>Field capture</span>
            <span className="text-xs text-zinc-500">Quick form from a clinic visit.</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
