"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
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
import { ApiError } from "@/lib/api/client";
import type { SendBrochureResponse } from "@/lib/api/sales-brochure";
import { errorMessage } from "@/lib/hooks/use-async";

interface SendBrochureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Sends the brochure. Returns the `SendBrochureResponse` so the toast can
   * surface the backend-normalized E.164 number, or `void` for the demo /
   * placeholder mode. The modal owns the success / error toasts; the parent
   * just supplies the API call.
   */
  onSend?: (phone: string) => Promise<SendBrochureResponse | void>;
}

/** Strip non-digits — phone fields commonly receive spaces / dashes / +91. */
function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Pull `retry_after` (seconds) from a 429 ApiError. The backend nests it in
 * `error.details.retry_after`; the raw body shape is `{ error: { code, message, details } }`.
 */
function extractRetryAfter(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  const body = err.body as
    | { error?: { details?: { retry_after?: unknown } } }
    | null;
  const ra = body?.error?.details?.retry_after;
  if (typeof ra === "number" && Number.isFinite(ra)) return ra;
  return null;
}

export function SendBrochureModal({
  open,
  onOpenChange,
  onSend,
}: SendBrochureModalProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when the dialog closes so reopening starts clean.
  useEffect(() => {
    if (!open) {
      setPhone("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = digitsOnly(phone);
    if (cleaned.length < 10) {
      setError("Enter a valid phone number (at least 10 digits).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      let normalized: string | null = null;
      if (onSend) {
        const res = await onSend(cleaned);
        if (res && typeof res === "object" && "to" in res) {
          normalized = res.to;
        }
      } else {
        // Placeholder mode (no parent wiring): resolve after a short delay
        // so the loading state is visible during development.
        await new Promise((r) => setTimeout(r, 600));
      }
      toast.success("Brochure sent", {
        description: `WhatsApp message dispatched to ${normalized ?? cleaned}.`,
      });
      onOpenChange(false);
    } catch (err) {
      const retryAfter = extractRetryAfter(err);
      if (retryAfter !== null) {
        const seconds = Math.max(1, Math.round(retryAfter));
        toast.error("Rate limit reached", {
          description: `Too many sends. Try again in ${seconds}s.`,
        });
      } else if (err instanceof ApiError && err.code === "INVALID_PHONE") {
        // Surface validation errors inline so the user can fix the number
        // without losing context.
        setError("That phone number isn't valid. Check the digits and country code.");
      } else {
        toast.error("Couldn't send brochure", {
          description: errorMessage(err),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            >
              <MessageCircle className="h-4 w-4" />
            </span>
            Send brochure
          </DialogTitle>
          <DialogDescription>
            Enter the WhatsApp number to deliver the brochure to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brochure-phone">Phone number</Label>
            <Input
              id="brochure-phone"
              type="tel"
              autoComplete="off"
              inputMode="tel"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              disabled={submitting}
              autoFocus
            />
            {error ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            ) : (
              <p className="text-xs text-zinc-500">
                Include the country code if outside India. We'll strip spaces
                and dashes automatically.
              </p>
            )}
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
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Send message
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
