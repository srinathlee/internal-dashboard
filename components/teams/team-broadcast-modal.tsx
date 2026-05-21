"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { broadcastToTeam } from "@/lib/api/sales-overview";
import { errorMessage } from "@/lib/hooks/use-async";
import { useSubadmins } from "@/lib/hooks/use-subadmins";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TeamBroadcastModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * POST /api/v1/sales/team/broadcast — send an in-app message to all (or a
 * subset of) the team's active reps. The picker defaults to "everyone" so
 * the common case is one click.
 */
export function TeamBroadcastModal({
  open,
  onOpenChange,
}: TeamBroadcastModalProps) {
  const subadminsQuery = useSubadmins({ limit: 200 });
  const reps = subadminsQuery.data?.sales_subadmins ?? [];

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setMessage("");
      setAudience("all");
      setSelectedIds(new Set());
      setSubmitting(false);
    }
  }, [open]);

  const toggleRep = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSubmit =
    message.trim().length > 0 &&
    (audience === "all" || selectedIds.size > 0) &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await broadcastToTeam({
        message: message.trim(),
        user_ids:
          audience === "selected" ? Array.from(selectedIds) : undefined,
      });
      toast.success(
        res.sent_count
          ? `Broadcast sent to ${res.sent_count} member${res.sent_count === 1 ? "" : "s"}`
          : "Broadcast sent",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't send broadcast", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-violet-500" aria-hidden />
            Broadcast to team
          </DialogTitle>
          <DialogDescription>
            Sends an in-app notification to the chosen reps. They&apos;ll see
            it in their bell dropdown immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="broadcast-msg">Message</Label>
            <Textarea
              id="broadcast-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Submit your weekly reports by EOD Friday."
              rows={4}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Audience
            </Label>
            <div className="flex gap-2">
              <AudienceButton
                active={audience === "all"}
                onClick={() => setAudience("all")}
                label={`Everyone${reps.length ? ` (${reps.length})` : ""}`}
              />
              <AudienceButton
                active={audience === "selected"}
                onClick={() => setAudience("selected")}
                label={
                  selectedIds.size > 0
                    ? `Selected (${selectedIds.size})`
                    : "Pick reps"
                }
              />
            </div>
          </div>

          {audience === "selected" ? (
            <div className="max-h-60 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              {subadminsQuery.isLoading ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Loading reps…
                </div>
              ) : reps.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No reps in this team.
                </div>
              ) : (
                reps.map((r) => {
                  const checked = selectedIds.has(r.id);
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm transition-colors last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900",
                        checked && "bg-violet-50/40 dark:bg-violet-950/20",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRep(r.id)}
                        className="h-3.5 w-3.5"
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(r.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.name}</div>
                        <div className="truncate text-xs text-zinc-500">
                          {r.email}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Megaphone className="h-4 w-4" aria-hidden />
              )}
              Send broadcast
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AudienceButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-300"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900",
      )}
    >
      {label}
    </button>
  );
}
