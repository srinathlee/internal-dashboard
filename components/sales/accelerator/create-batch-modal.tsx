"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/hooks/use-async";
import { useAcpMutations } from "@/lib/hooks/use-accelerator";
import type { AcpBatch } from "@/lib/api/sales-accelerator";

interface CreateBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (batch: AcpBatch) => void;
}

/**
 * Create-batch modal. Batch name + location are the only inputs — the program
 * shape (2 months, ₹10K M1 / ₹1.1L M2 targets) is fixed and shown read-only.
 */
export function CreateBatchModal({
  open,
  onOpenChange,
  onCreated,
}: CreateBatchModalProps) {
  const { createBatch } = useAcpMutations();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && location.trim().length > 0 && !submitting;

  const reset = () => {
    setName("");
    setLocation("");
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const batch = await createBatch({
        name: name.trim(),
        location: location.trim(),
      });
      toast.success("Batch created", { description: batch.name });
      onCreated(batch);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't create batch", { description: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" aria-hidden />
            Create new batch
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="batch-name">
              Batch name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="batch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hyderabad Batch 2"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="batch-location">
              Location <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="batch-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Hyderabad"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="font-semibold text-zinc-800 dark:text-zinc-100">
              Program defaults
            </div>
            <dl className="mt-2 space-y-1.5 text-zinc-600 dark:text-zinc-300">
              <Row label="Duration" value="2 months" />
              <Row label="Month 1 target" value="₹10.0K sprints" />
              <Row label="Month 2 target" value="₹1.1L subscriptions" />
            </dl>
          </div>
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
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Create batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-semibold text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
