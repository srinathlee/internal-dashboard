"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/hooks/use-async";
import { useLeadMutations } from "@/lib/hooks/use-leads";

interface LeadNextActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  /** Pre-fills the form when editing an existing next action. */
  initialTitle: string | null;
  initialDue: string | null;
  /** Refetch hook so the sheet/table re-render with the latest value. */
  onSaved?: () => void;
}

/**
 * Edit (or clear) the next action for a lead.
 *
 * PATCH /api/v1/sales/leads/:id/next-action accepts `{ title, due }` where
 * either field can be null to clear it. We send both fields together so the
 * "Clear" button doesn't need a separate endpoint — `{ title: null, due: null }`
 * is enough to wipe both.
 */
export function LeadNextActionModal({
  open,
  onOpenChange,
  leadId,
  initialTitle,
  initialDue,
  onSaved,
}: LeadNextActionModalProps) {
  const mutations = useLeadMutations();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? "");
      // The API returns ISO timestamps; the <input type="date"> wants
      // YYYY-MM-DD. Slice the date portion off either format.
      setDue(initialDue ? initialDue.slice(0, 10) : "");
      setSubmitting(false);
    }
  }, [open, initialTitle, initialDue]);

  const submit = async (clear: boolean) => {
    setSubmitting(true);
    try {
      await mutations.setNextAction(leadId, {
        title: clear ? null : title.trim() || null,
        due: clear ? null : due ? `${due}T17:00:00.000Z` : null,
      });
      toast.success(clear ? "Next action cleared" : "Next action saved");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't update next action", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0) {
      toast.error("Add a title for the next action.");
      return;
    }
    void submit(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Next action</DialogTitle>
          <DialogDescription>
            What's the very next step on this lead, and when should it land?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="na-title">Title</Label>
            <Input
              id="na-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Send proposal · Call back to confirm slot"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="na-due">Due date</Label>
            <Input
              id="na-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              Leave blank to skip the deadline; the action still shows on the
              lead but doesn't surface in due-today reminders.
            </p>
          </div>

          <DialogFooter className="gap-2">
            {initialTitle ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void submit(true)}
                disabled={submitting}
                className="mr-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Clear
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
