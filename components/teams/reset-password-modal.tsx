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
import { updateSubadmin } from "@/lib/api/sales-subadmins";
import { errorMessage } from "@/lib/hooks/use-async";

import { PasswordRevealCard } from "./password-reveal-card";

interface ResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; name: string; email: string } | null;
}

/**
 * Set a new password for an existing subadmin. The form takes the new
 * value and POSTs it via PATCH /sales/subadmins/:id (which already
 * accepts a `password` field per the doc). After success we surface
 * the same one-time-display card we use on team creation so the super
 * admin can hand off the new credentials.
 */
export function ResetPasswordModal({
  open,
  onOpenChange,
  user,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ password: string } | null>(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setDone(null);
      setSubmitting(false);
    }
  }, [open, user?.id]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await updateSubadmin(user.id, { password });
      toast.success("Password reset");
      setDone({ password });
    } catch (error) {
      toast.error("Couldn't reset password", {
        description: errorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription className="truncate">
            {user.name} · {user.email}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <>
            <PasswordRevealCard
              heading="New password"
              email={user.email}
              password={done.password}
            />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="reset-pw">New password</Label>
              <Input
                id="reset-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
                autoFocus
              />
              <p className="text-xs text-zinc-500">
                Min 8 characters · shown once after saving.
              </p>
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
                Reset password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
