"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getInitials } from "@/lib/format";
import type { User, UserStatus } from "@/lib/types";

interface DeactivateConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onConfirm: (userId: string, nextStatus: UserStatus) => void;
}

export function DeactivateConfirmModal({
  open,
  onOpenChange,
  user,
  onConfirm,
}: DeactivateConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  if (!user) return null;
  const reactivating = user.status === "inactive";

  const handleConfirm = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    const next: UserStatus = reactivating ? "active" : "inactive";
    onConfirm(user.id, next);
    if (reactivating) {
      toast.success(`Reactivated ${user.name}`);
    } else {
      toast.success(`Deactivated ${user.name}`, {
        description: "They can no longer sign in until reactivated.",
      });
    }
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {reactivating ? "Reactivate member?" : "Deactivate member?"}
          </DialogTitle>
          <DialogDescription>
            {reactivating
              ? "They'll be able to sign in again immediately."
              : "Their access is revoked immediately. You can reactivate them later."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-zinc-500">{user.email}</div>
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
          <Button
            type="button"
            variant={reactivating ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {reactivating ? "Reactivate" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
