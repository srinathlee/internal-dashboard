"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  LOST_REASON_LABEL,
  LOST_REASON_ORDER,
} from "@/lib/sales-pipeline";
import type { Lead, LeadLostReason } from "@/lib/types";

interface MarkAsLostModalProps {
  /** The lead being moved to "lost" — null when the modal is hidden. */
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (leadId: string, reason: LeadLostReason, notes: string) => void;
}

export function MarkAsLostModal({
  lead,
  open,
  onOpenChange,
  onConfirm,
}: MarkAsLostModalProps) {
  const [reason, setReason] = useState<LeadLostReason | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setNotes("");
    }
  }, [open, lead?.id]);

  if (!lead) return null;

  const canSubmit = reason !== null;

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(lead.id, reason, notes.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription className="truncate">
            {lead.clinicName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Reason
            </p>
            <div className="flex flex-wrap gap-2">
              {LOST_REASON_ORDER.map((r) => {
                const selected = reason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
                    )}
                  >
                    {LOST_REASON_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="lost-notes"
              className="text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Notes <span className="font-normal normal-case text-zinc-400">(optional)</span>
            </label>
            <Textarea
              id="lost-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else worth noting?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canSubmit}>
            Confirm lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
