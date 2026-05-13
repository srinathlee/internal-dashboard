"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { PipelineStage } from "@/lib/api/sales-pipeline-stages";

const PRESET_COLORS = [
  "#F59E0B", // amber
  "#EF4444", // red
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
];

interface StageModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** When provided, the modal is in edit mode. */
  stage?: PipelineStage | null;
  onSubmit: (input: { name: string; color: string }) => Promise<void>;
}

export function StageModal({
  open,
  onOpenChange,
  stage,
  onSubmit,
}: StageModalProps) {
  const isEdit = stage != null;
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]!);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(stage?.label ?? stage?.name ?? "");
      setColor(stage?.color ?? PRESET_COLORS[0]!);
    }
  }, [open, stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Stage name is required");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), color });
      onOpenChange(false);
    } catch (err) {
      toast.error(isEdit ? "Couldn't update stage" : "Couldn't create stage", {
        description: errorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit stage" : "Add custom stage"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename or recolor this Kanban column."
              : "Create a new pipeline column. The name is auto-uppercased and spaces become underscores."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stage-name" className="text-sm font-medium">
              Stage name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="stage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Negotiation"
              autoFocus
            />
            <p className="text-xs text-zinc-500">
              Will be stored as{" "}
              <span className="font-mono">
                {name.trim()
                  ? name.trim().toUpperCase().replace(/\s+/g, "_")
                  : "STAGE_NAME"}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className="grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: c }}
                >
                  {color === c ? (
                    <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                  ) : null}
                </button>
              ))}
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
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {isEdit ? "Save changes" : "Create stage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
