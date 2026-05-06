"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials, roleLabel } from "@/lib/format";
import type { Role, User } from "@/lib/types";

interface EditRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  /** Roles the editor is allowed to assign. */
  assignableRoles: Role[];
  onSave: (userId: string, role: Role) => void;
}

export function EditRoleModal({
  open,
  onOpenChange,
  user,
  assignableRoles,
  onSave,
}: EditRoleModalProps) {
  const [role, setRole] = useState<Role>(user?.role ?? "member");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) setRole(user.role);
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === user.role) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 200));
    onSave(user.id, role);
    toast.success(`Updated ${user.name}`, {
      description: `${roleLabel(user.role)} → ${roleLabel(role)}`,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
          <DialogDescription>
            Change the access level for this member.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-role-select">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="edit-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
