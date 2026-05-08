"use client";

import { useEffect, useState } from "react";
import { Calendar, Loader2, Phone, StickyNote } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/hooks/use-async";
import { useLeadMutations } from "@/lib/hooks/use-leads";

export type ActivityKind = "call" | "meeting" | "note";

interface LeadActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which activity flavor we're capturing — drives copy and field set. */
  kind: ActivityKind;
  /** ID of the lead the activity is being logged against. */
  leadId: string;
  /** Called after the API confirms — caller refetches the timeline. */
  onLogged?: () => void;
}

/**
 * One modal, three flavors. Calls collect a duration; meetings collect a
 * date; notes are body-only. All three POST to
 * `/api/v1/sales/leads/:id/activities` via `mutations.addActivity`.
 *
 * Duration is sent as a label string (e.g. "15m", "1h 20m") matching the
 * shape `createLeadActivity` accepts. Server-side it's parsed into seconds
 * and exposed to the timeline as `event.durationSec`.
 */
export function LeadActivityModal({
  open,
  onOpenChange,
  kind,
  leadId,
  onLogged,
}: LeadActivityModalProps) {
  const mutations = useLeadMutations();
  const [body, setBody] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(15);
  const [meetingAt, setMeetingAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setBody("");
      setHours(0);
      setMinutes(kind === "call" ? 15 : 0);
      // Pre-fill meeting date with "now" rounded to the next 15 minutes.
      if (kind === "meeting") {
        const d = new Date();
        const ms = 15 * 60 * 1000;
        d.setTime(Math.ceil(d.getTime() / ms) * ms);
        // datetime-local needs YYYY-MM-DDTHH:MM (no timezone, no seconds).
        setMeetingAt(toLocalInputValue(d));
      } else {
        setMeetingAt("");
      }
      setSubmitting(false);
    }
  }, [open, kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length === 0) {
      toast.error("Write a few words about the activity.");
      return;
    }
    setSubmitting(true);
    try {
      const composedBody =
        kind === "meeting" && meetingAt
          ? `[${formatMeetingHeader(meetingAt)}] ${body.trim()}`
          : body.trim();

      const duration_label =
        kind === "call" ? formatDurationLabel(hours, minutes) : undefined;

      await mutations.addActivity(leadId, {
        kind,
        body: composedBody,
        duration_label,
      });
      toast.success(`${LABEL[kind]} logged`);
      onLogged?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Couldn't log ${LABEL[kind].toLowerCase()}`, {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = ICON[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-zinc-500" aria-hidden />
            {kind === "call"
              ? "Log call"
              : kind === "meeting"
                ? "Log meeting"
                : "Add note"}
          </DialogTitle>
          <DialogDescription>{DESCRIPTION[kind]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {kind === "call" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="call-hours">Hours</Label>
                <Input
                  id="call-hours"
                  type="number"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(e) =>
                    setHours(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="call-minutes">Minutes</Label>
                <Input
                  id="call-minutes"
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) =>
                    setMinutes(
                      Math.max(0, Math.min(59, Number(e.target.value) || 0)),
                    )
                  }
                  className="tabular-nums"
                />
              </div>
            </div>
          ) : null}

          {kind === "meeting" ? (
            <div className="space-y-1.5">
              <Label htmlFor="meeting-at">When</Label>
              <Input
                id="meeting-at"
                type="datetime-local"
                value={meetingAt}
                onChange={(e) => setMeetingAt(e.target.value)}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="activity-body">
              {kind === "note" ? "Note" : "Summary"}
            </Label>
            <Textarea
              id="activity-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={PLACEHOLDER[kind]}
              autoFocus
            />
          </div>

          <DialogFooter>
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
              {kind === "note" ? "Save note" : `Log ${kind}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ICON = {
  call: Phone,
  meeting: Calendar,
  note: StickyNote,
} satisfies Record<ActivityKind, typeof Phone>;

const LABEL: Record<ActivityKind, string> = {
  call: "Call",
  meeting: "Meeting",
  note: "Note",
};

const DESCRIPTION: Record<ActivityKind, string> = {
  call: "Capture what was discussed and how long the call lasted.",
  meeting: "Schedule or log a meeting with the lead.",
  note: "Free-form note that future reps can scan when they pick this up.",
};

const PLACEHOLDER: Record<ActivityKind, string> = {
  call: "Spoke with Dr. X about the demo, they want a follow-up next week…",
  meeting: "On-site visit to walk through the front desk workflow.",
  note: "Decision-maker prefers WhatsApp follow-ups, not email.",
};

/** "1h 30m", "0h 15m" → "15m". The API accepts both forms. */
function formatDurationLabel(hours: number, minutes: number): string {
  if (hours <= 0 && minutes <= 0) return "0m";
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMeetingHeader(localValue: string): string {
  // Display the user's local clock back to them; the timestamp on the
  // timeline event itself comes from the server's created_at.
  try {
    const d = new Date(localValue);
    return d.toLocaleString();
  } catch {
    return localValue;
  }
}
