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

interface SendBrochureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Backend hook for delivering the brochure over WhatsApp. The parent
   * supplies the actual API call once it's wired; until then this is a
   * promise that resolves after a short delay so the loading state can be
   * verified end-to-end.
   */
  onSend?: (phone: string) => Promise<void>;
}

/** Strip non-digits — phone fields commonly receive spaces / dashes / +91. */
function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
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
      if (onSend) {
        await onSend(cleaned);
      } else {
        // Placeholder until the backend endpoint is wired. Swap this for a
        // real `sendBrochure(phone)` call when the API ships.
        await new Promise((r) => setTimeout(r, 600));
      }
      toast.success("Brochure sent", {
        description: `WhatsApp message dispatched to ${cleaned}.`,
      });
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send brochure";
      toast.error("Couldn't send brochure", { description: message });
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
