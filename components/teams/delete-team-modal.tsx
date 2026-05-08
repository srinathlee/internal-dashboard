"use client";

import { useState } from "react";
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
import { useTeamMutations } from "@/lib/hooks/use-teams";

interface DeleteTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: { id: string; name: string; member_count: number } | null;
  onDeleted?: () => void;
}

/**
 * Two safety rails:
 *   1. Backend refuses the delete if member_count > 0 — but we still
 *      warn here so the super admin doesn't have to round-trip just to
 *      see the 409.
 *   2. The super admin must type the team's exact ID into a confirmation
 *      box. Same pattern as GitHub repo deletion.
 */
export function DeleteTeamModal({
  open,
  onOpenChange,
  team,
  onDeleted,
}: DeleteTeamModalProps) {
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const mutations = useTeamMutations();

  if (!team) return null;

  const matchesId = confirm.trim() === team.id;
  const hasMembers = team.member_count > 0;

  const handleDelete = async () => {
    if (!matchesId || hasMembers) return;
    setSubmitting(true);
    try {
      await mutations.remove(team.id);
      toast.success("Team deleted");
      onDeleted?.();
      onOpenChange(false);
      setConfirm("");
    } catch (err) {
      toast.error("Couldn't delete team", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirm("");
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2
              className="h-4 w-4 text-rose-600 dark:text-rose-400"
              aria-hidden
            />
            Delete team
          </DialogTitle>
          <DialogDescription>
            This permanently removes the team and its admin user. Members
            must be removed first.
          </DialogDescription>
        </DialogHeader>

        {hasMembers ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            This team has <strong>{team.member_count}</strong>{" "}
            {team.member_count === 1 ? "member" : "members"}. Remove or
            reassign them before deleting the team.
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="confirm-team-id" className="text-xs">
              Type the team ID{" "}
              <span className="font-mono font-medium">{team.id}</span> to
              confirm.
            </Label>
            <Input
              id="confirm-team-id"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoFocus
              className="font-mono"
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!matchesId || hasMembers || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
